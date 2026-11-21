import { useEffect } from 'react';
import { ChatPane } from './ChatPane';
import { IconClose } from './icons';
import type { AIAssistantModalProps } from './types';

export function AIAssistantModal({
  open,
  onClose,
  title = 'AI Assistant',
  maxWidth = 640,
  chatProps,
  className,
  style,
}: AIAssistantModalProps) {
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

  return (
    <div
      className={`ai-assistant-modal-root ${className || ''}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        ...style,
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          backdropFilter: 'blur(3px)',
        }}
      />

      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
          height: '80vh',
          maxHeight: 720,
          backgroundColor: 'var(--color-background, #ffffff)',
          borderRadius: 16,
          boxShadow: '0 12px 36px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 1,
          overflow: 'hidden',
        }}
      >
        <ChatPane
          {...chatProps}
          title={title}
          style={{
            height: '100%',
            borderRadius: 16,
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
