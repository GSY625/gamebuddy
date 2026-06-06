import { useEffect, useId, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function UserStatusMenu() {
  const { visibilityStatus, setVisibilityStatus } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pick = async (status: 'online' | 'invisible') => {
    setOpen(false);
    if (status === visibilityStatus) return;
    await setVisibilityStatus(status);
  };

  const isOnline = visibilityStatus === 'online';

  return (
    <div
      className={`user-status-menu ${open ? 'open' : ''}`}
      ref={rootRef}
    >
      <button
        type="button"
        className="user-status-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        title="设置在线状态"
      >
        <span
          className={`user-status-dot ${isOnline ? 'online' : 'invisible'}`}
          aria-hidden
        />
        <span className="user-status-label">
          {isOnline ? '在线' : '隐身'}
        </span>
        <span className="theme-select-chevron" aria-hidden />
      </button>
      {open && (
        <ul
          className="theme-select-menu glass-panel user-status-dropdown"
          id={listId}
          role="listbox"
        >
          <li>
            <button
              type="button"
              role="option"
              className={`theme-select-option user-status-option ${isOnline ? 'selected' : ''}`}
              onClick={() => pick('online')}
            >
              <span className="user-status-dot online" aria-hidden />
              在线
            </button>
          </li>
          <li>
            <button
              type="button"
              role="option"
              className={`theme-select-option user-status-option ${!isOnline ? 'selected' : ''}`}
              onClick={() => pick('invisible')}
            >
              <span className="user-status-dot invisible" aria-hidden />
              隐身
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
