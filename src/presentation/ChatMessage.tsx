import { useState } from 'react';
import { IconBot, IconCheck, IconCopy, IconUser } from './icons';
import { MarkdownView } from './MarkdownView';
import type { ChatMessageProps } from './types';

export function ChatMessage({
  message,
  showAvatar = true,
  avatar,
  userAvatar,
  assistantAvatar,
  onCopy,
  className,
  style,
}: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(message.content);
      setCopied(true);
      onCopy?.(message.content);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const defaultAvatar = isUser ? (
    userAvatar || <IconUser />
  ) : isSystem ? (
    avatar || <IconBot />
  ) : (
    assistantAvatar || <IconBot />
  );

  return (
    <div
      className={`ai-chat-message ${isUser ? 'ai-chat-message--user' : 'ai-chat-message--assistant'} ${className || ''}`}
      style={{
        display: 'flex',
        flexDirection: isUser ? 'row-reverse' : 'row',
        gap: 12,
        alignItems: 'flex-start',
        margin: '12px 0',
        ...style,
      }}
    >
      {showAvatar && (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: isUser ? 'var(--color-primary, #2563eb)' : 'var(--color-muted, #f1f5f9)',
            color: isUser ? '#ffffff' : 'var(--color-foreground, #0f172a)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            border: '1px solid var(--color-border, #e2e8f0)',
          }}
        >
          {defaultAvatar}
        </div>
      )}

      <div
        style={{
          maxWidth: '82%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
        }}
      >
        <div
          style={{
            padding: '10px 16px',
            borderRadius: 14,
            borderBottomRightRadius: isUser ? 2 : 14,
            borderBottomLeftRadius: isUser ? 14 : 2,
            backgroundColor: isUser
              ? 'var(--color-primary, #2563eb)'
              : isSystem
              ? '#fef3c7'
              : 'var(--color-card, #f8fafc)',
            color: isUser
              ? '#ffffff'
              : isSystem
              ? '#92400e'
              : 'var(--color-foreground, #0f172a)',
            border: isUser ? 'none' : '1px solid var(--color-border, #e2e8f0)',
            fontSize: 14,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          {isUser ? (
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{message.content}</div>
          ) : (
            <MarkdownView content={message.content} />
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 4,
            fontSize: 11,
            color: 'var(--color-muted-foreground, #94a3b8)',
          }}
        >
          {message.createdAt && (
            <span>
              {typeof message.createdAt === 'string'
                ? message.createdAt
                : message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}

          {message.status === 'error' && (
            <span style={{ color: '#ef4444' }}>{message.error || 'Failed to send'}</span>
          )}

          {!isUser && message.content && (
            <button
              type="button"
              onClick={handleCopy}
              aria-label={copied ? 'Copied' : 'Copy response'}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 4px',
                borderRadius: 4,
                fontSize: 11,
              }}
            >
              {copied ? <IconCheck /> : <IconCopy />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
