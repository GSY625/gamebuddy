import { ThemeModal } from '../ThemeModal';
import { UserAvatarLink } from '../UserAvatarLink';
import type { FriendListItem } from '../../pages/chatTypes';

type ChatInviteModalProps = {
  open: boolean;
  currentMembers: number;
  maxMembers?: number | null;
  friendsLoading: boolean;
  invitableFriends: FriendListItem[];
  invitingId: string | null;
  onClose: () => void;
  onInvite: (friendId: string, nickname: string) => void;
};

const text = {
  title: '\u9080\u8bf7\u597d\u53cb\u52a0\u5165\u804a\u5929\u5ba4',
  hint:
    '\u597d\u53cb\u63a5\u53d7\u9080\u8bf7\u540e\uff0c\u4ecd\u9700\u623f\u4e3b\u540c\u610f\uff0c\u624d\u4f1a\u6b63\u5f0f\u52a0\u5165\u804a\u5929\u5ba4\u3002',
  loading: '\u52a0\u8f7d\u597d\u53cb\u5217\u8868\u4e2d...',
  empty:
    '\u6ca1\u6709\u53ef\u9080\u8bf7\u7684\u597d\u53cb\uff08\u5df2\u662f\u6210\u5458\u6216\u5c1a\u672a\u6dfb\u52a0\u597d\u53cb\uff09',
  invite: '\u9080\u8bf7',
  inviting: '\u53d1\u9001\u4e2d...',
  currentMembers: '\u5f53\u524d\u4eba\u6570',
};

export function ChatInviteModal({
  open,
  currentMembers,
  maxMembers,
  friendsLoading,
  invitableFriends,
  invitingId,
  onClose,
  onInvite,
}: ChatInviteModalProps) {
  return (
    <ThemeModal open={open} title={text.title} onClose={onClose}>
      <p className="muted small">{text.hint}</p>

      {typeof maxMembers === 'number' && (
        <p className="muted small">
          {text.currentMembers} {currentMembers}/{maxMembers}
        </p>
      )}

      {friendsLoading ? (
        <p className="muted">{text.loading}</p>
      ) : invitableFriends.length === 0 ? (
        <p className="muted">{text.empty}</p>
      ) : (
        <ul className="invite-friend-list">
          {invitableFriends.map((friend) => (
            <li key={friend.id} className="invite-friend-item">
              <UserAvatarLink
                userId={friend.friend.id}
                url={friend.friend.avatarUrl}
                name={friend.friend.nickname}
                size={36}
              />
              <span>{friend.friend.nickname}</span>
              <button
                type="button"
                className="ghost small-btn"
                disabled={invitingId === friend.friend.id}
                onClick={() => onInvite(friend.friend.id, friend.friend.nickname)}
              >
                {invitingId === friend.friend.id ? text.inviting : text.invite}
              </button>
            </li>
          ))}
        </ul>
      )}
    </ThemeModal>
  );
}
