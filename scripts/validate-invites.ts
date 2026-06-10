import assert from 'node:assert/strict';
import { InvitesService } from '../server/src/invites/invites.service';

type NotificationPayload = {
  userId: string;
  payload: {
    type: string;
    title: string;
    message: string;
    link: string;
    refId: string;
  };
};

function createInvitesHarness() {
  const notifications: NotificationPayload[] = [];
  const updates: Array<{ where: { id: string }; data: { status: string } }> = [];

  const prisma = {
    friendship: { findUnique: async () => ({ id: 'friendship-1' }) },
    invite: {
      findUnique: async () => null,
      update: async (input: { where: { id: string }; data: { status: string } }) => {
        updates.push(input);
        return input;
      },
      findFirst: async () => null,
      create: async () => null,
      findMany: async () => [],
    },
    party: { findUnique: async () => null, findFirst: async () => null },
    partyMember: { findMany: async () => [] },
    block: { findFirst: async () => null },
  };

  const parties = {
    assertPartyHasCapacity: () => {},
    createFromUsers: async (
      userIds: string[],
      gameId: string | undefined,
      leaderId: string,
    ) => ({
      id: 'party-created',
      userIds,
      gameId,
      leaderId,
      chatRoom: { id: 'room-created' },
    }),
    addMember: async (partyId: string, receiverId: string) => ({
      id: partyId,
      addedUserId: receiverId,
      chatRoom: { id: 'room-approved' },
    }),
  };

  const service = new InvitesService(
    prisma as never,
    parties as never,
    { assertOnline: async () => {} } as never,
    {
      create: async (userId: string, payload: NotificationPayload['payload']) => {
        notifications.push({ userId, payload });
      },
    } as never,
    { assertAllowed: async () => {} } as never,
  );

  return { service, prisma, parties, notifications, updates };
}

async function testRoomInviteMovesToLeaderApproval() {
  const { service, notifications, updates } = createInvitesHarness();

  (service as unknown as { getInviteById: () => Promise<unknown> }).getInviteById =
    async () => ({
      id: 'invite-room-1',
      status: 'pending',
      senderId: 'sender-1',
      receiverId: 'receiver-1',
      partyId: 'party-1',
      receiver: { nickname: 'Receiver' },
      sender: { nickname: 'Sender' },
      party: {
        id: 'party-1',
        status: 'active',
        chatRoom: { id: 'room-1', status: 'active', name: 'Room 1' },
        members: [
          { userId: 'leader-1', role: 'leader' },
          { userId: 'sender-1', role: 'member' },
        ],
      },
    });

  const result = await service.resolve('invite-room-1', 'receiver-1', true);

  assert.deepEqual(result, { status: 'pending_leader', kind: 'room' });
  assert.equal(updates[0]?.data.status, 'pending_leader');
  assert.equal(notifications.length, 2);
  assert.equal(notifications[0]?.userId, 'leader-1');
  assert.equal(notifications[0]?.payload.type, 'room_join_request_received');
  assert.equal(notifications[1]?.userId, 'sender-1');
  assert.equal(notifications[1]?.payload.type, 'room_invite_waiting_leader');
}

async function testTeamInviteAcceptanceCreatesParty() {
  const { service, notifications, updates } = createInvitesHarness();

  (service as unknown as { getInviteById: () => Promise<unknown> }).getInviteById =
    async () => ({
      id: 'invite-team-1',
      status: 'pending',
      senderId: 'sender-2',
      receiverId: 'receiver-2',
      gameId: 'game-1',
      receiver: { nickname: 'Receiver 2' },
      sender: { nickname: 'Sender 2' },
      partyId: null,
      party: null,
    });

  const result = await service.resolve('invite-team-1', 'receiver-2', true);

  assert.equal(result.status, 'accepted');
  assert.equal(result.kind, 'team');
  assert.equal(updates[0]?.data.status, 'accepted');
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0]?.userId, 'sender-2');
  assert.equal(notifications[0]?.payload.type, 'invite_accept');
}

async function testLeaderRejectionNotifiesBothSides() {
  const { service, notifications, updates } = createInvitesHarness();

  (service as unknown as { getInviteById: () => Promise<unknown> }).getInviteById =
    async () => ({
      id: 'invite-room-2',
      status: 'pending_leader',
      senderId: 'sender-3',
      receiverId: 'receiver-3',
      receiver: { nickname: 'Receiver 3' },
      partyId: 'party-2',
      party: {
        id: 'party-2',
        status: 'active',
        chatRoom: { id: 'room-2', status: 'active', name: 'Room 2' },
        members: [{ userId: 'leader-2', role: 'leader' }],
      },
    });

  const result = await service.resolve('invite-room-2', 'leader-2', false);

  assert.deepEqual(result, { status: 'rejected' });
  assert.equal(updates[0]?.data.status, 'rejected');
  assert.equal(notifications.length, 2);
  assert.equal(notifications[0]?.userId, 'sender-3');
  assert.equal(notifications[0]?.payload.type, 'room_invite_reject');
  assert.equal(notifications[1]?.userId, 'receiver-3');
  assert.equal(notifications[1]?.payload.type, 'room_invite_leader_reject');
}

async function main() {
  await testRoomInviteMovesToLeaderApproval();
  await testTeamInviteAcceptanceCreatesParty();
  await testLeaderRejectionNotifiesBothSides();

  console.log('validated invites service resolve flows');
}

void main();
