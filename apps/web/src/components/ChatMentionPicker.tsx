import { useEffect, useRef } from 'react';
import { UserAvatar } from './UserAvatar';

type Member = {
  userId: string;
  user: { nickname: string; avatarUrl?: string | null };
};

type Props = {
  members: Member[];
  filter: string;
  selfId?: string;
  onPick: (nickname: string) => void;
  onClose: () => void;
};

export function ChatMentionPicker({
  members,
  filter,
  selfId,
  onPick,
  onClose,
}: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  const filtered = members
    .filter((m) => m.userId !== selfId)
    .filter((m) =>
      filter ? m.user.nickname.toLowerCase().includes(filter.toLowerCase()) : true,
    )
    .slice(0, 8);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  if (filtered.length === 0) return null;

  return (
    <div className="chat-mention-picker glass-panel" ref={rootRef}>
      {filtered.map((m) => (
        <button
          key={m.userId}
          type="button"
          className="chat-mention-option"
          onClick={() => onPick(m.user.nickname)}
        >
          <UserAvatar url={m.user.avatarUrl} name={m.user.nickname} size={28} />
          <span>{m.user.nickname}</span>
        </button>
      ))}
    </div>
  );
}

export function renderMessageContent(content: string, highlightNick?: string) {
  const parts = content.split(/(@[^\s@]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const nick = part.slice(1);
      const isMe = highlightNick && nick === highlightNick;
      return (
        <span key={i} className={isMe ? 'msg-mention msg-mention-me' : 'msg-mention'}>
          {part}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}
