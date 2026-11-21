import { useEffect } from 'react';
import { ChatPane } from './ChatPane';
import { IconClose } from './icons';
import type { AIAssistantDrawerProps } from './types';

export function AIAssistantDrawer({
  open,
  onClose,
  title = 'AI Assistant',
  subtitle,
  position = 'right',
  width = 440,
  chatProps,
  className,
  style,
}: AIAssistantDrawerProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const isRight = position === 'right';

  return (
    <div
      className={`ai-assistant-drawer-root ${className || ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: isRight ? 'flex-end' : 'flex-start',
        ...style,
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(2px)',
          animation: 'ai-fade-in 150ms ease',
        }}
      />

      <div
        style={{
          position: 'relative',
          width: typeof width === 'number' ? `${width}px` : width,
          maxWidth: '100vw',
          height: '100%',
          backgroundColor: 'var(--color-background, #ffffff)',
          boxShadow: isRight ? '-4px 0 24px rgba(0,0,0,0.15)' : '4px 0 24px rgba(0,0,0,0.15)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1,
        }}
      >
        <ChatPane
          {...chatProps}
          title={title}
          subtitle={subtitle}
          style={{
            height: '100%',
            borderRadius: 0,
            border: 'none',
            ...chatProps.style,
          }}
          headerActions={
            <>
              {chatProps.headerActions}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close assistant"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-muted-foreground, #64748b)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                }}
              >
                <IconClose />
              </button>
            </>
          }
        />
      </div>
    </div>
  );
}
