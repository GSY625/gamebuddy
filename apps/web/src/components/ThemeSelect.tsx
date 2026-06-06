import { useEffect, useId, useMemo, useRef, useState } from 'react';

export type ThemeSelectItem = {
  value: string;
  label: string;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** 字符串选项（value 与展示文案相同） */
  options?: string[];
  /** 带 value/label 的选项（与 options 二选一） */
  items?: ThemeSelectItem[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
  /** 选项展示文案，仅在使用 options 时生效 */
  formatOption?: (value: string) => string;
};

export function ThemeSelect({
  value,
  onChange,
  options = [],
  items,
  placeholder = '请选择',
  required,
  className = '',
  disabled = false,
  formatOption = (v) => v,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const resolvedItems = useMemo<ThemeSelectItem[]>(() => {
    if (items?.length) return items;
    return options.map((opt) => ({
      value: opt,
      label: formatOption(opt),
    }));
  }, [items, options, formatOption]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const selected = resolvedItems.find((i) => i.value === value);
  const display = selected?.label ?? placeholder;

  return (
    <div
      className={`theme-select ${open ? 'open' : ''} ${disabled ? 'disabled' : ''} ${className}`.trim()}
      ref={rootRef}
    >
      <button
        type="button"
        className="theme-select-trigger glass-panel"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((o) => !o);
        }}
      >
        <span
          className={
            selected ? 'theme-select-value' : 'theme-select-placeholder'
          }
        >
          {display}
        </span>
        <span className="theme-select-chevron" aria-hidden />
      </button>
      {open && (
        <ul className="theme-select-menu glass-panel" id={listId} role="listbox">
          {!required && (
            <li>
              <button
                type="button"
                role="option"
                className={`theme-select-option ${!value ? 'selected' : ''}`}
                onClick={() => {
                  onChange('');
                  setOpen(false);
                }}
              >
                {placeholder}
              </button>
            </li>
          )}
          {resolvedItems.map((item) => (
            <li key={item.value}>
              <button
                type="button"
                role="option"
                aria-selected={value === item.value}
                className={`theme-select-option ${value === item.value ? 'selected' : ''}`}
                onClick={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
