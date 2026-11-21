import { useState } from 'react';
import { IconBrain, IconChevronDown, IconChevronRight } from './icons';
import { MarkdownView } from './MarkdownView';
import type { ReasoningBlockProps } from './types';

export function ReasoningBlock({
  reasoning,
  streaming = false,
  label = 'Thought Process',
  thinkingLabel = 'Thinking...',
  className,
  style,
  defaultOpen = false,
}: ReasoningBlockProps) {
  const [open, setOpen] = useState(defaultOpen);

  if (reasoning.length === 0 && !streaming) return null;

  return (
    <div
      className={`ai-reasoning-block ${className || ''}`}
      style={{
        margin: '6px 0',
        borderRadius: 8,
        border: '1px solid var(--color-border, #e2e8f0)',
        backgroundColor: 'var(--color-muted, #f8fafc)',
        overflow: 'hidden',
        fontSize: 12.5,
        ...style,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        style={{
          display: 'flex',
          width: '100%',
          alignItems: 'center',
          gap: 6,
          padding: '6px 10px',
          background: 'none',
          border: 'none',
          color: 'var(--color-muted-foreground, #64748b)',
          cursor: 'pointer',
          fontWeight: 500,
          textAlign: 'left',
        }}
      >
        <IconBrain style={{ color: 'var(--color-primary, #2563eb)', flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{streaming && reasoning.length === 0 ? thinkingLabel : label}</span>
        {open ? <IconChevronDown /> : <IconChevronRight />}
      </button>

      {open && reasoning.length > 0 && (
        <div
          style={{
            borderTop: '1px solid var(--color-border, #e2e8f0)',
            padding: '8px 12px',
            color: 'var(--color-muted-foreground, #475569)',
            fontSize: 12,
            lineHeight: 1.5,
          }}
        >
          <MarkdownView content={reasoning} />
        </div>
      )}
    </div>
  );
}
