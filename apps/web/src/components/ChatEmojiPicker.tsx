import { useEffect, useRef, useState } from 'react';

const EMOJIS = [
  '😀',
  '😂',
  '😊',
  '😎',
  '🤔',
  '😭',
  '😤',
  '👍',
  '👎',
  '❤️',
  '🎮',
  '🔥',
  '💯',
  '🙌',
  '🎉',
  '✨',
  '👀',
  '💪',
  '🤝',
  '😴',
];

type Props = {
  onPick: (emoji: string) => void;
};

export function ChatEmojiPicker({ onPick }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <div className={`chat-emoji-picker ${open ? 'open' : ''}`} ref={rootRef}>
      <button
        type="button"
        className="ghost chat-emoji-trigger"
        aria-label="选择表情"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        😊
      </button>
      {open && (
        <div className="chat-emoji-panel glass-panel" role="listbox">
          {EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="chat-emoji-item"
              onClick={() => {
                onPick(emoji);
                setOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
