import {
  Inject,
  OnModuleDestroy,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { randomUUID } from 'crypto';
import { Server, Socket } from 'socket.io';
import { AuthSessionService } from '../auth/auth-session.service';
import { DirectMessagesService } from '../direct-messages/direct-messages.service';
import { BusinessLogService } from '../logging/business-log.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { RateLimitService } from '../rate-limit/rate-limit.service';
import { RedisService } from '../redis/redis.service';
import { VisibilityService } from '../visibility/visibility.service';
import { ChatService } from './chat.service';

const PRESENCE_TTL_SECONDS = 330;
const PRESENCE_REFRESH_MS = 60_000;
const DUPLICATE_MESSAGE_WINDOW_SECONDS = 15;
const SOCKET_CLUSTER_CHANNEL = 'socket:cluster:broadcast';

type ClusterSocketEvent =
  | {
      sourceInstanceId: string;
      target: 'global';
      event: string;
      payload: unknown;
    }
  | {
      sourceInstanceId: string;
      target: 'user';
      userId: string;
      event: string;
      payload: unknown;
    }
  | {
      sourceInstanceId: string;
      target: 'room';
      roomId: string;
      event: string;
      payload: unknown;
      exceptSocketId?: string;
    }
  | {
      sourceInstanceId: string;
      target: 'dm';
      threadId: string;
      event: string;
      payload: unknown;
    }
  | {
      sourceInstanceId: string;
      target: 'remove-user-room';
      userId: string;
      roomId: string;
      payload: { partyId: string; message: string };
    }
  | {
      sourceInstanceId: string;
      target: 'disconnect-user';
      userId: string;
      payload: { event: 'user:banned'; message: string };
    };

@WebSocketGateway({
  cors: { origin: process.env.CORS_ORIGIN?.split(',') ?? true },
})
export class ChatGateway
  implements
    OnGatewayInit,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly instanceId = randomUUID();
  private clusterUnsubscribe?: () => Promise<void> | void;

  constructor(
    private jwt: JwtService,
    private chat: ChatService,
    private redis: RedisService,
    private visibility: VisibilityService,
    private prisma: PrismaService,
    private directMessages: DirectMessagesService,
    private rateLimit: RateLimitService,
    private businessLog: BusinessLogService,
    private authSessions: AuthSessionService,
    @Inject(forwardRef(() => NotificationsService))
    private notifications: NotificationsService,
  ) {}

  async afterInit() {
    this.clusterUnsubscribe = await this.redis.subscribe(
      SOCKET_CLUSTER_CHANNEL,
      async (rawMessage) => {
        try {
          const event = JSON.parse(rawMessage) as ClusterSocketEvent;
          if (event.sourceInstanceId === this.instanceId) {
            return;
          }
          this.applyClusterEvent(event);
        } catch (error) {
          this.businessLog.warn('socket.cluster_sync.invalid_message', {
            rawMessage,
            error:
              error instanceof Error ? error.message : 'invalid-cluster-event',
          });
        }
      },
    );
  }

  async onModuleDestroy() {
    await this.clusterUnsubscribe?.();
  }

  private presenceKey(userId: string) {
    return `presence:${userId}`;
  }

  private presenceConnectionsKey(userId: string) {
    return `presence:connections:${userId}`;
  }

  private async publishClusterEvent(event: ClusterSocketEvent) {
    await this.redis.publish(SOCKET_CLUSTER_CHANNEL, JSON.stringify(event));
  }

  private applyClusterEvent(event: ClusterSocketEvent) {
    switch (event.target) {
      case 'global':
        this.server.emit(event.event, event.payload);
        return;
      case 'user':
        this.server.to(`user:${event.userId}`).emit(event.event, event.payload);
        return;
      case 'room':
        if (event.exceptSocketId) {
          this.server
            .except(event.exceptSocketId)
            .to(`room:${event.roomId}`)
            .emit(event.event, event.payload);
          return;
        }
        this.server.to(`room:${event.roomId}`).emit(event.event, event.payload);
        return;
      case 'dm':
        this.server.to(`dm:${event.threadId}`).emit(event.event, event.payload);
        return;
      case 'remove-user-room':
        this.server.in(`user:${event.userId}`).socketsLeave(`room:${event.roomId}`);
        this.server.to(`user:${event.userId}`).emit('room:removed', {
          roomId: event.roomId,
          ...event.payload,
        });
        return;
      case 'disconnect-user':
        this.server.to(`user:${event.userId}`).emit(event.payload.event, {
          message: event.payload.message,
        });
        setTimeout(() => {
          this.server.in(`user:${event.userId}`).disconnectSockets(true);
        }, 80);
        return;
    }
  }

  private async emitGlobalEvent(event: string, payload: unknown) {
    const clusterEvent: ClusterSocketEvent = {
      sourceInstanceId: this.instanceId,
      target: 'global',
      event,
      payload,
    };
    this.applyClusterEvent(clusterEvent);
    await this.publishClusterEvent(clusterEvent);
  }

  private async emitRoomEvent(
    roomId: string,
    event: string,
    payload: unknown,
    exceptSocketId?: string,
  ) {
    const clusterEvent: ClusterSocketEvent = {
      sourceInstanceId: this.instanceId,
      target: 'room',
      roomId,
      event,
      payload,
      exceptSocketId,
    };
    this.applyClusterEvent(clusterEvent);
    await this.publishClusterEvent(clusterEvent);
  }

  private async emitDirectMessageEvent(
    threadId: string,
    event: string,
    payload: unknown,
  ) {
    const clusterEvent: ClusterSocketEvent = {
      sourceInstanceId: this.instanceId,
      target: 'dm',
      threadId,
      event,
      payload,
    };
    this.applyClusterEvent(clusterEvent);
    await this.publishClusterEvent(clusterEvent);
  }

  async emitPresenceUpdate(
    userId: string,
    online: boolean,
    visibility?: string,
  ) {
    await this.emitGlobalEvent('presence:update', {
      userId,
      online,
      ...(visibility ? { visibility } : {}),
    });
  }

  async disconnectUserByBan(userId: string, message: string) {
    const clusterEvent: ClusterSocketEvent = {
      sourceInstanceId: this.instanceId,
      target: 'disconnect-user',
      userId,
      payload: {
        event: 'user:banned',
        message,
      },
    };
    this.applyClusterEvent(clusterEvent);
    await this.publishClusterEvent(clusterEvent);
  }

  private async markUserOnline(userId: string) {
    await this.redis.set(this.presenceKey(userId), '1', 'EX', PRESENCE_TTL_SECONDS);
  }

  private async ensureActiveUser(client: Socket) {
    const userId = client.data.userId as string | undefined;
    const sessionId = client.data.sessionId as string | undefined;
    if (!userId) {
      client.disconnect();
      return null;
    }

    if (!sessionId) {
      client.emit('user:notify', {
        title: '登录状态已失效',
        message: '请重新登录后再继续操作',
      });
      client.disconnect();
      return null;
    }

    try {
      await this.authSessions.assertAccessSessionValid(sessionId, userId);
    } catch {
      client.emit('user:notify', {
        title: '登录状态已失效',
        message: '请重新登录后再继续操作',
      });
      client.disconnect();
      return null;
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isBanned: true },
    });
    if (!user || user.isBanned) {
      client.emit('user:banned', { message: '账号已被封禁' });
      client.disconnect();
      return null;
    }
    return userId;
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
      const payload = this.jwt.verify<{
        sub: string;
        sid?: string;
        type?: 'access' | 'refresh';
      }>(token);
      if (!payload.sid || payload.type !== 'access') {
        client.disconnect();
        return;
      }

      await this.authSessions.assertAccessSessionValid(payload.sid, payload.sub);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, isBanned: true },
      });
      if (!user || user.isBanned) {
        client.disconnect();
        return;
      }

      client.data.userId = payload.sub;
      client.data.sessionId = payload.sid;
      await this.redis.incr(this.presenceConnectionsKey(payload.sub));
      await this.markUserOnline(payload.sub);
      this.startPresenceRefresh(client, payload.sub);
      client.join(`user:${payload.sub}`);

      const visibility = await this.visibility.get(payload.sub);
      await this.emitPresenceUpdate(payload.sub, true, visibility);
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data.userId as string | undefined;
    if (!userId) {
      return;
    }

    this.stopPresenceRefresh(client);
    const remaining = await this.redis.decr(this.presenceConnectionsKey(userId));
    if (remaining > 0) {
      await this.markUserOnline(userId);
      return;
    }

    await this.redis.del(this.presenceKey(userId));
    await this.emitPresenceUpdate(userId, false);
  }

  private async emitUnreadToRoomMembers(roomId: string, excludeUserId?: string) {
    const members = await this.chat.getRoomMembers(roomId);
    for (const member of members) {
      if (member.userId === excludeUserId) {
        continue;
      }
      const count = await this.chat.getUnreadCount(roomId, member.userId);
      await this.emitToUser(member.userId, 'room:unread', { roomId, count });
    }
  }

  private emitRateLimitNotice(client: Socket, message: string) {
    client.emit('user:notify', {
      title: '操作过快',
      message,
    });
  }

  private getRateLimitMessage(error: unknown, fallback: string) {
    if (
      error &&
      typeof error === 'object' &&
      'getResponse' in error &&
      typeof error.getResponse === 'function'
    ) {
      const response = error.getResponse();
      if (response && typeof response === 'object' && !Array.isArray(response)) {
        const message = (response as { message?: unknown }).message;
        if (typeof message === 'string') {
          return message;
        }
        if (Array.isArray(message) && typeof message[0] === 'string') {
          return message[0];
        }
      }
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return fallback;
  }

  private normalizeDuplicateMessage(content: string) {
    return content.trim().replace(/\s+/g, ' ').toLowerCase();
  }

  private duplicateMessageKey(
    scope: 'room' | 'dm',
    targetId: string,
    userId: string,
  ) {
    return `message-duplicate:${scope}:${targetId}:${userId}`;
  }

  private async assertNotDuplicateMessage(
    scope: 'room' | 'dm',
    targetId: string,
    userId: string,
    content: string,
  ) {
    const normalized = this.normalizeDuplicateMessage(content);
    if (!normalized) {
      return;
    }

    const key = this.duplicateMessageKey(scope, targetId, userId);
    const previous = await this.redis.get(key);
    if (previous === normalized) {
      this.businessLog.warn('chat.duplicate_message.blocked', {
        scope,
        targetId,
        userId,
        windowSeconds: DUPLICATE_MESSAGE_WINDOW_SECONDS,
      });
      throw new Error('请勿短时间内重复发送相同内容');
    }
  }

  private async rememberMessageFingerprint(
    scope: 'room' | 'dm',
    targetId: string,
    userId: string,
    content: string,
  ) {
    const normalized = this.normalizeDuplicateMessage(content);
    if (!normalized) {
      return;
    }

    await this.redis.set(
      this.duplicateMessageKey(scope, targetId, userId),
      normalized,
      'EX',
      DUPLICATE_MESSAGE_WINDOW_SECONDS,
    );
  }

  @SubscribeMessage('room:join')
  async joinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = await this.ensureActiveUser(client);
    if (!userId) return { ok: false };

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
    const userId = await this.ensureActiveUser(client);
    if (!userId) return { ok: false };

    try {
      await this.rateLimit.consume(
        `user:${userId}`,
        {
          bucket: 'ws-room-message',
          limit: 8,
          windowSeconds: 5,
          message: '聊天室发言过于频繁，请稍后再试',
        },
        {
          channel: 'ws',
          event: 'room:message',
          userId,
        },
      );
    } catch (error) {
      const message = this.getRateLimitMessage(
        error,
        '聊天室发言过于频繁，请稍后再试',
      );
      this.emitRateLimitNotice(client, message);
      return { ok: false, rateLimited: true };
    }

    try {
      await this.assertNotDuplicateMessage('room', data.roomId, userId, data.content);
    } catch (error) {
      const message = this.getRateLimitMessage(
        error,
        '请勿短时间内重复发送相同内容',
      );
      this.emitRateLimitNotice(client, message);
      return { ok: false, duplicateBlocked: true };
    }

    const { message, mentioned, senderNickname } = await this.chat.sendMessage(
      data.roomId,
      userId,
      data.content,
    );
    await this.rememberMessageFingerprint('room', data.roomId, userId, data.content);
    await this.emitRoomEvent(data.roomId, 'room:message', message);

    for (const member of mentioned) {
      await this.notifications.create(member.userId, {
        type: 'chat_mention',
        title: '有人 @ 你',
        message: `${senderNickname} 在聊天室提到了你`,
        link: `/chat/${data.roomId}`,
        refId: message.id,
      });
      await this.emitToUser(member.userId, 'room:mention', {
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
  async typing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = await this.ensureActiveUser(client);
    if (!userId) return { ok: false };

    await this.emitRoomEvent(
      data.roomId,
      'room:typing',
      { userId, roomId: data.roomId },
      client.id,
    );
    return { ok: true };
  }

  @SubscribeMessage('dm:join')
  async joinDirectMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { threadId: string },
  ) {
    const userId = await this.ensureActiveUser(client);
    if (!userId) return { ok: false };

    await this.directMessages.assertThreadParticipant(data.threadId, userId);
    client.join(`dm:${data.threadId}`);
    return { ok: true };
  }

  @SubscribeMessage('dm:message')
  async sendDirectMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { receiverId: string; content: string },
  ) {
    const senderId = await this.ensureActiveUser(client);
    if (!senderId) return { ok: false };

    try {
      await this.rateLimit.consume(
        `user:${senderId}`,
        {
          bucket: 'ws-direct-message',
          limit: 6,
          windowSeconds: 5,
          message: '私信发送过于频繁，请稍后再试',
        },
        {
          channel: 'ws',
          event: 'dm:message',
          userId: senderId,
        },
      );
    } catch (error) {
      const message = this.getRateLimitMessage(
        error,
        '私信发送过于频繁，请稍后再试',
      );
      this.emitRateLimitNotice(client, message);
      return { ok: false, rateLimited: true };
    }

    try {
      // Allow repeated direct-message content; only rate limiting should apply here.
    } catch (error) {
      const message = this.getRateLimitMessage(
        error,
        '请勿短时间内重复发送相同内容',
      );
      this.emitRateLimitNotice(client, message);
      return { ok: false, duplicateBlocked: true };
    }

    const result = await this.directMessages.sendMessage(
      senderId,
      data.receiverId,
      data.content,
    );

    await this.emitDirectMessageEvent(result.threadId, 'dm:message', {
      threadId: result.threadId,
      message: result.message,
    });
    await this.emitToUser(senderId, 'dm:conversation:update', {
      threadId: result.threadId,
      friendId: data.receiverId,
    });
    await this.emitToUser(data.receiverId, 'dm:conversation:update', {
      threadId: result.threadId,
      friendId: senderId,
    });
    await this.emitToUser(data.receiverId, 'user:notify', {
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

  async emitToUser(userId: string, event: string, payload: unknown) {
    const clusterEvent: ClusterSocketEvent = {
      sourceInstanceId: this.instanceId,
      target: 'user',
      userId,
      event,
      payload,
    };
    this.applyClusterEvent(clusterEvent);
    await this.publishClusterEvent(clusterEvent);
  }

  emitRoomMessage(roomId: string, payload: unknown) {
    return this.emitRoomEvent(roomId, 'room:message', payload);
  }

  async emitRoomDissolved(
    roomId: string,
    memberIds: string[],
    payload: { partyId: string; message: string },
  ) {
    await this.emitRoomEvent(roomId, 'room:dissolved', payload);
    for (const userId of memberIds) {
      await this.emitToUser(userId, 'room:dissolved', { roomId, ...payload });
    }
  }

  async removeUserFromRoom(
    userId: string,
    roomId: string,
    payload: { partyId: string; message: string },
  ) {
    const clusterEvent: ClusterSocketEvent = {
      sourceInstanceId: this.instanceId,
      target: 'remove-user-room',
      userId,
      roomId,
      payload,
    };
    this.applyClusterEvent(clusterEvent);
    await this.publishClusterEvent(clusterEvent);
  }
}
