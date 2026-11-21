import { useEffect, useRef, useState } from 'react';
import { ChatMessage } from './ChatMessage';
import { IconArrowDown, IconBot, IconSparkles, IconTrash } from './icons';
import { PromptComposer } from './PromptComposer';
import { SuggestedPrompts } from './SuggestedPrompts';
import type { ChatPaneProps } from './types';

export function ChatPane({
  messages = [],
  loading = false,
  streamingMessage,
  onSend,
  onStop,
  onClear,
  suggestedPrompts = [],
  placeholder = 'Ask anything...',
  title = 'AI Assistant',
  subtitle,
  brandName,
  emptyTitle,
  emptyDescription,
  disabled = false,
  className,
  style,
  headerActions,
  footerNotice,
  userAvatar,
  assistantAvatar,
}: ChatPaneProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  const scrollToBottom = (smooth = true) => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
      setShowScrollBottom(false);
    }
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBottom(distanceToBottom > 100);
  };

  useEffect(() => {
    scrollToBottom(true);
  }, [messages.length, streamingMessage, loading]);

  const resolvedEmptyTitle = emptyTitle || `How can I help you today${brandName ? ` with ${brandName}` : ''}?`;
  const resolvedEmptyDescription = emptyDescription || 'Ask questions, draft content, summarize records, or pick a suggested topic below.';

  return (
    <div
      className={`ai-chat-pane ${className || ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 480,
        backgroundColor: 'var(--color-background, #ffffff)',
        color: 'var(--color-foreground, #0f172a)',
        border: '1px solid var(--color-border, #e2e8f0)',
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 18px',
          borderBottom: '1px solid var(--color-border, #e2e8f0)',
          backgroundColor: 'var(--color-card, #f8fafc)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'var(--color-primary-subtle, rgba(37, 99, 235, 0.1))',
              color: 'var(--color-primary, #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <IconSparkles />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>{title}</h3>
            {subtitle && (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--color-muted-foreground, #64748b)' }}>
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {headerActions}
          {onClear && messages.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear chat history"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-muted-foreground, #64748b)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 8px',
                borderRadius: 6,
                fontSize: 12,
              }}
            >
              <IconTrash />
              <span>Clear</span>
            </button>
          )}
        </div>
      </header>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {messages.length === 0 ? (
          <div
            style={{
              margin: 'auto',
              maxWidth: 460,
              textAlign: 'center',
              padding: '24px 0',
            }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: '50%',
                backgroundColor: 'var(--color-primary-subtle, rgba(37, 99, 235, 0.1))',
                color: 'var(--color-primary, #2563eb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 14px',
              }}
            >
              <IconBot style={{ width: 24, height: 24 }} />
            </div>
            <h4 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 600 }}>
              {resolvedEmptyTitle}
            </h4>
            <p
              style={{
                margin: '0 0 16px',
                fontSize: 13.5,
                color: 'var(--color-muted-foreground, #64748b)',
                lineHeight: 1.5,
              }}
            >
              {resolvedEmptyDescription}
            </p>

            {suggestedPrompts.length > 0 && (
              <SuggestedPrompts
                prompts={suggestedPrompts}
                onSelect={onSend}
                disabled={disabled || loading}
                style={{ justifyContent: 'center' }}
              />
            )}
          </div>
        ) : (
          <>
            {messages.map((m, idx) => (
              <ChatMessage
                key={m.id || idx}
                message={m}
                userAvatar={userAvatar}
                assistantAvatar={assistantAvatar}
              />
            ))}

            {streamingMessage && (
              <ChatMessage
                message={{
                  role: 'assistant',
                  content: streamingMessage,
                  status: 'streaming',
                }}
                assistantAvatar={assistantAvatar}
              />
            )}

            {loading && !streamingMessage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  backgroundColor: 'var(--color-card, #f8fafc)',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: 14,
                  width: 'fit-content',
                  margin: '8px 0',
                }}
              >
                <div style={{ display: 'flex', gap: 4 }}>
                  <span className="ai-dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--color-primary, #2563eb)' }} />
                  <span className="ai-dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--color-primary, #2563eb)', animationDelay: '200ms' }} />
                  <span className="ai-dot-pulse" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: 'var(--color-primary, #2563eb)', animationDelay: '400ms' }} />
                </div>
                <span style={{ fontSize: 12, color: 'var(--color-muted-foreground, #64748b)' }}>
                  Thinking...
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {showScrollBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom(true)}
          aria-label="Scroll to bottom"
          style={{
            position: 'absolute',
            bottom: 90,
            right: 24,
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: 'var(--color-card, #ffffff)',
            border: '1px solid var(--color-border, #e2e8f0)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--color-foreground, #0f172a)',
          }}
        >
          <IconArrowDown />
        </button>
      )}

      <footer
        style={{
          padding: '12px 18px',
          borderTop: '1px solid var(--color-border, #e2e8f0)',
          backgroundColor: 'var(--color-card, #f8fafc)',
          flexShrink: 0,
        }}
      >
        <PromptComposer
          onSend={onSend}
          onStop={onStop}
          loading={loading}
          placeholder={placeholder}
          disabled={disabled}
        />
        {footerNotice && (
          <div style={{ marginTop: 6, fontSize: 11, textAlign: 'center', color: 'var(--color-muted-foreground, #94a3b8)' }}>
            {footerNotice}
          </div>
        )}
      </footer>
    </div>
  );
}
