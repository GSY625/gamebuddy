import assert from 'node:assert/strict';
import {
  getInvitableFriends,
  getMentionFilter,
  patchMemberPresence,
  sanitizeMemberLimitInput,
  shouldMarkMentionForMessage,
  shouldRefreshMetaForMessage,
} from '../apps/web/src/pages/chatRoomUtils';
import type { FriendListItem, Member, Msg } from '../apps/web/src/pages/chatTypes';

const members: Member[] = [
  {
    userId: 'leader-1',
    role: 'leader',
    isLeader: true,
    presenceStatus: 'online',
    user: { id: 'leader-1', nickname: 'Leader' },
  },
  {
    userId: 'member-1',
    role: 'member',
    isLeader: false,
    presenceStatus: 'online',
    user: { id: 'member-1', nickname: 'Member' },
  },
];

function testPatchMemberPresence() {
  const invisibleForSelf = patchMemberPresence(
    members,
    { userId: 'member-1', visibility: 'invisible' },
    'member-1',
  );
  assert.equal(invisibleForSelf[1]?.presenceStatus, 'invisible');

  const invisibleForOthers = patchMemberPresence(members, {
    userId: 'member-1',
    visibility: 'invisible',
  });
  assert.equal(invisibleForOthers[1]?.presenceStatus, 'offline');

  const offlineMember = patchMemberPresence(members, {
    userId: 'member-1',
    online: false,
  });
  assert.equal(offlineMember[1]?.presenceStatus, 'offline');
}

function testMentionFilterAndLimitSanitizer() {
  assert.equal(getMentionFilter('hello @te'), '@te');
  assert.equal(getMentionFilter('hello world'), null);
  assert.equal(sanitizeMemberLimitInput('a1b2c3'), '12');
  assert.equal(sanitizeMemberLimitInput('999'), '99');
}

function testInvitableFriends() {
  const friends: FriendListItem[] = [
    {
      id: 'friend-1',
      friend: { id: 'leader-1', nickname: 'Leader' },
    },
    {
      id: 'friend-2',
      friend: { id: 'outsider-1', nickname: 'Outsider' },
    },
  ];

  const invitable = getInvitableFriends(friends, { members });
  assert.equal(invitable.length, 1);
  assert.equal(invitable[0]?.friend.id, 'outsider-1');
}

function testMessageHeuristics() {
  const joinMessage: Msg = {
    id: 'msg-1',
    content: 'Alice 加入了聊天室',
    type: 'system',
    createdAt: new Date().toISOString(),
  };
  assert.equal(shouldRefreshMetaForMessage(joinMessage), true);

  const mentionMessage: Msg = {
    id: 'msg-2',
    content: 'Hi @Buddy',
    type: 'text',
    createdAt: new Date().toISOString(),
    user: { id: 'other-user', nickname: 'Alice' },
  };
  assert.equal(
    shouldMarkMentionForMessage(mentionMessage, {
      id: 'viewer-1',
      nickname: 'Buddy',
    }),
    true,
  );
  assert.equal(
    shouldMarkMentionForMessage(mentionMessage, {
      id: 'other-user',
      nickname: 'Buddy',
    }),
    false,
  );
}

function main() {
  testPatchMemberPresence();
  testMentionFilterAndLimitSanitizer();
  testInvitableFriends();
  testMessageHeuristics();

  console.log('validated chat room helper behaviors');
}

main();
