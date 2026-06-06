import { Inject, forwardRef } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';
import { RedisService } from '../redis/redis.service';
import { VisibilityService } from '../visibility/visibility.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { DirectMessagesService } from '../direct-messages/direct-messages.service';

const PRESENCE_TTL_SECONDS = 330;
const PRESENCE_REFRESH_MS = 60_000;

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private jwt: JwtService,
    private chat: ChatService,
    private redis: RedisService,
    private visibility: VisibilityService,
    private prisma: PrismaService,
    private directMessages: DirectMessagesService,
    @Inject(forwardRef(() => NotificationsService))
    private notifications: NotificationsService,
  ) {}

  private presenceKey(userId: string) {
    return `presence:${userId}`;
  }

  private presenceConnectionsKey(userId: string) {
    return `presence:connections:${userId}`;
  }

  private async markUserOnline(userId: string) {
    await this.redis.set(this.presenceKey(userId), '1', 'EX', PRESENCE_TTL_SECONDS);
  }

  private startPresenceRefresh(client: Socket, userId: string) {
    const timer = setInterval(() => {
      void this.markUserOnline(userId);
    }, PRESENCE_REFRESH_MS);
    client.data.presenceTimer = timer;
  }

  private stopPresenceRefresh(client: Socket) {
    const timer = client.data.presenceTimer as NodeJS.Timeout | undefined;
    if (timer) {
      clearInterval(timer);
      delete client.data.presenceTimer;
    }
  }

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ??
        client.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = this.jwt.verify<{ sub: string }>(token, {
        secret: process.env.JWT_SECRET ?? 'dev-secret',
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, isBanned: true },
      });
      if (!user || user.isBanned) {
        client.disconnect();
        return;
      }
      client.data.userId = payload.sub;
      await this.redis.incr(this.presenceConnectionsKey(payload.sub));
      await this.markUserOnline(payload.sub);
      this.startPresenceRefresh(client, payload.sub);
      client.join(`user:${payload.sub}`);
      const visibility = await this.visibility.get(payload.sub);
      this.server.emit('presence:update', {
        userId: payload.sub,
        online: true,
        visibility,
      });
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (userId) {
      this.stopPresenceRefresh(client);
      const remaining = await this.redis.decr(this.presenceConnectionsKey(userId));
      if (remaining > 0) {
        await this.markUserOnline(userId);
        return;
      }
      await this.redis.del(this.presenceKey(userId));
      this.server.emit('presence:update', { userId, online: false });
    }
  }

  private async emitUnreadToRoomMembers(
    roomId: string,
    excludeUserId?: string,
  ) {
    const members = await this.chat.getRoomMembers(roomId);
    for (const m of members) {
      if (m.userId === excludeUserId) continue;
      const count = await this.chat.getUnreadCount(roomId, m.userId);
      this.emitToUser(m.userId, 'room:unread', { roomId, count });
    }
  }

  @SubscribeMessage('room:join')
  async joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data.userId as string;
    await this.chat.getMessages(data.roomId, userId);
    client.join(`room:${data.roomId}`);
    await this.emitUnreadToRoomMembers(data.roomId);
    return { ok: true };
  }

  @SubscribeMessage('room:message')
  async sendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; content: string },
  ) {
    const userId = client.data.userId as string;
    const { message, mentioned, senderNickname } = await this.chat.sendMessage(
      data.roomId,
      userId,
      data.content,
    );
    this.server.to(`room:${data.roomId}`).emit('room:message', message);

    for (const m of mentioned) {
      await this.notifications.create(m.userId, {
        type: 'chat_mention',
        title: '有人@了你',
        message: `${senderNickname} 在聊天室提到了你`,
        link: `/chat/${data.roomId}`,
        refId: message.id,
      });
      this.emitToUser(m.userId, 'room:mention', {
        roomId: data.roomId,
        messageId: message.id,
        senderNickname,
        preview: message.content.slice(0, 80),
      });
    }

    await this.emitUnreadToRoomMembers(data.roomId, userId);
    return message;
  }

  @SubscribeMessage('room:typing')
  typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data.userId as string;
    client.to(`room:${data.roomId}`).emit('room:typing', { userId, roomId: data.roomId });
  }

  @SubscribeMessage('dm:join')
  async joinDirectMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { threadId: string },
  ) {
    const userId = client.data.userId as string;
    await this.directMessages.assertThreadParticipant(data.threadId, userId);
    client.join(`dm:${data.threadId}`);
    return { ok: true };
  }

  @SubscribeMessage('dm:message')
  async sendDirectMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { receiverId: string; content: string },
  ) {
    const senderId = client.data.userId as string;
    const result = await this.directMessages.sendMessage(
      senderId,
      data.receiverId,
      data.content,
    );

    this.server.to(`dm:${result.threadId}`).emit('dm:message', {
      threadId: result.threadId,
      message: result.message,
    });
    this.emitToUser(senderId, 'dm:conversation:update', {
      threadId: result.threadId,
      friendId: data.receiverId,
    });
    this.emitToUser(data.receiverId, 'dm:conversation:update', {
      threadId: result.threadId,
      friendId: senderId,
    });
    this.emitToUser(data.receiverId, 'user:notify', {
      title: '新的好友私信',
      message: `${result.senderNickname} 给你发来一条私信`,
      friendId: senderId,
    });

    return {
      ok: true,
      threadId: result.threadId,
      messageId: result.message.id,
    };
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitRoomMessage(roomId: string, msg: unknown) {
    this.server.to(`room:${roomId}`).emit('room:message', msg);
  }

  emitRoomDissolved(
    roomId: string,
    memberIds: string[],
    payload: { partyId: string; message: string },
  ) {
    this.server.to(`room:${roomId}`).emit('room:dissolved', payload);
    for (const userId of memberIds) {
      this.emitToUser(userId, 'room:dissolved', { roomId, ...payload });
    }
  }

  removeUserFromRoom(
    userId: string,
    roomId: string,
    payload: { partyId: string; message: string },
  ) {
    this.server.in(`user:${userId}`).socketsLeave(`room:${roomId}`);
    this.emitToUser(userId, 'room:removed', { roomId, ...payload });
  }
}
