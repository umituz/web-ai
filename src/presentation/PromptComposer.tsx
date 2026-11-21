import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { IconSend, IconStop } from './icons';
import type { PromptComposerProps } from './types';

export function PromptComposer({
  onSend,
  onStop,
  loading = false,
  placeholder = 'Ask anything...',
  disabled = false,
  value,
  onChange,
  className,
  style,
  maxLength = 4000,
}: PromptComposerProps) {
  const [internalValue, setInternalValue] = useState('');
  const text = value !== undefined ? value : internalValue;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const setText = (next: string) => {
    if (value === undefined) {
      setInternalValue(next);
    }
    onChange?.(next);
  };

  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }, [text]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || loading || disabled) return;
    void onSend(trimmed);
    setText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={`ai-prompt-composer ${className || ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: '10px 14px',
        backgroundColor: 'var(--color-card, #ffffff)',
        border: '1px solid var(--color-border, #e2e8f0)',
        borderRadius: 12,
        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <textarea
          ref={textareaRef}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={1}
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            resize: 'none',
            fontSize: 14,
            lineHeight: 1.5,
            fontFamily: 'inherit',
            backgroundColor: 'transparent',
            color: 'var(--color-foreground, #0f172a)',
            padding: '4px 0',
            maxHeight: 200,
          }}
        />

        {loading ? (
          <button
            type="button"
            onClick={onStop}
            aria-label="Stop generation"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 8,
              border: 'none',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'background-color 120ms ease',
            }}
          >
            <IconStop />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={disabled || !text.trim()}
            aria-label="Send message"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 34,
              height: 34,
              borderRadius: 8,
              border: 'none',
              backgroundColor: disabled || !text.trim() ? 'var(--color-muted, #e2e8f0)' : 'var(--color-primary, #2563eb)',
              color: disabled || !text.trim() ? 'var(--color-muted-foreground, #94a3b8)' : '#ffffff',
              cursor: disabled || !text.trim() ? 'not-allowed' : 'pointer',
              flexShrink: 0,
              transition: 'all 120ms ease',
            }}
          >
            <IconSend />
          </button>
        )}
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 11,
          color: 'var(--color-muted-foreground, #94a3b8)',
        }}
      >
        <span>Enter to send · Shift+Enter for newline</span>
        {text.length > 0 && <span>{text.length} / {maxLength}</span>}
      </div>
    </div>
  );
}
