import { IconSparkles } from './icons';
import type { SuggestedPromptsProps } from './types';

export function SuggestedPrompts({
  prompts,
  onSelect,
  className,
  style,
  disabled = false,
}: SuggestedPromptsProps) {
  if (!prompts || prompts.length === 0) {
    return null;
  }

  return (
    <div
      className={`ai-suggested-prompts ${className || ''}`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        margin: '12px 0',
        ...style,
      }}
      role="group"
      aria-label="Suggested prompts"
    >
      {prompts.map((prompt, idx) => (
        <button
          key={idx}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(prompt)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            borderRadius: 9999,
            fontSize: 12.5,
            fontWeight: 500,
            color: 'var(--color-primary, #2563eb)',
            backgroundColor: 'var(--color-primary-subtle, rgba(37, 99, 235, 0.08))',
            border: '1px solid var(--color-primary-border, rgba(37, 99, 235, 0.2))',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 120ms ease',
            textAlign: 'left',
            lineHeight: 1.3,
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <IconSparkles style={{ flexShrink: 0, opacity: 0.8 }} />
          <span>{prompt}</span>
        </button>
      ))}
    </div>
  );
}
