import { UserAvatarLink } from '../UserAvatarLink';
import type {
  FriendStatusMap,
  Member,
  PresenceStatus,
} from '../../pages/chatTypes';

type ChatMembersPanelProps = {
  members: Member[];
  maxMembers?: number | null;
  currentUserId?: string;
  friendStatus: FriendStatusMap;
  isPartyFull: boolean;
  onOpenInviteModal: () => void;
  onInsertMention: (nickname: string) => void;
  onAddFriend: (userId: string) => void;
  onAcceptFriendRequest: (
    userId: string,
    requestId: string,
    nickname: string,
  ) => void;
};

const text = {
  title: '\u6210\u5458',
  inviteFriend: '\u9080\u8bf7\u597d\u53cb',
  leader: '\u623f\u4e3b',
  self: '\uff08\u6211\uff09',
  alreadyFriends: '\u5df2\u7ecf\u662f\u597d\u53cb',
  requestSent: '\u5df2\u7533\u8bf7',
  acceptFriend: '\u540c\u610f\u597d\u53cb',
  addFriend: '\u52a0\u597d\u53cb',
};

function presenceLabel(status: PresenceStatus) {
  if (status === 'online') return '\u5728\u7ebf';
  if (status === 'invisible') return '\u9690\u8eab';
  return '\u79bb\u7ebf';
}

export function ChatMembersPanel({
  members,
  maxMembers,
  currentUserId,
  friendStatus,
  isPartyFull,
  onOpenInviteModal,
  onInsertMention,
  onAddFriend,
  onAcceptFriendRequest,
}: ChatMembersPanelProps) {
  return (
    <aside className="chat-members glass-panel">
      <div className="chat-members-header">
        <h2>
          {text.title} ({members.length}
          {typeof maxMembers === 'number' ? `/${maxMembers}` : ''}
          )
        </h2>
        <button
          type="button"
          className="ghost small-btn"
          disabled={isPartyFull}
          onClick={onOpenInviteModal}
        >
          {text.inviteFriend}
        </button>
      </div>

      <ul className="chat-member-list">
        {members.map((member) => {
          const status = friendStatus[member.userId];
          const pendingRequestId =
            status?.status === 'pending_received' ? status.requestId : undefined;

          return (
            <li key={member.userId} className="chat-member-item">
              <UserAvatarLink
                userId={member.userId}
                url={member.user.avatarUrl}
                name={member.user.nickname}
                size={36}
                status={
                  member.presenceStatus === 'online'
                    ? 'online'
                    : member.presenceStatus === 'invisible'
                      ? 'invisible'
                      : undefined
                }
              />
              <div className="chat-member-info">
                <span className="chat-member-name">
                  {member.user.nickname}
                  {member.isLeader && <span className="leader-badge">{text.leader}</span>}
                  {member.userId === currentUserId && (
                    <span className="muted small">{text.self}</span>
                  )}
                </span>

                <div className="member-presence-row">
                  <span
                    className={`member-presence-dot ${member.presenceStatus ?? 'offline'}`}
                    aria-hidden
                  />
                  <span
                    className={`member-presence-label ${
                      member.presenceStatus === 'online' ? 'online' : ''
                    }`}
                  >
                    {presenceLabel(member.presenceStatus ?? 'offline')}
                  </span>
                </div>

                {member.userId !== currentUserId && (
                  <div className="chat-member-actions">
                    <button
                      type="button"
                      className="ghost small-btn"
                      title={`@${member.user.nickname}`}
                      onClick={() => onInsertMention(member.user.nickname)}
                    >
                      @
                    </button>

                    {status?.status === 'friends' && (
                      <span className="muted small">{text.alreadyFriends}</span>
                    )}

                    {status?.status === 'pending_sent' && (
                      <span className="muted small">{text.requestSent}</span>
                    )}

                    {typeof pendingRequestId === 'string' && (
                      <button
                        type="button"
                        className="ghost small-btn"
                        onClick={() =>
                          onAcceptFriendRequest(
                            member.userId,
                            pendingRequestId,
                            member.user.nickname,
                          )
                        }
                      >
                        {text.acceptFriend}
                      </button>
                    )}

                    {(!status || status.status === 'none') && (
                      <button
                        type="button"
                        className="ghost small-btn"
                        onClick={() => onAddFriend(member.userId)}
                      >
                        {text.addFriend}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
