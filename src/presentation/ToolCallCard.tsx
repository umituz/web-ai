import { IconWrench } from './icons';
import type { ToolCallCardProps } from './types';

function formatPayload(data: unknown): string {
  if (typeof data === 'string') return data;
  if (!data) return '';
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

export function ToolCallCard({ toolCall, onResolve, disabled = false, className, style }: ToolCallCardProps) {
  const statusColors: Record<typeof toolCall.status, { text: string; bg: string }> = {
    pending: { text: '#d97706', bg: 'rgba(217, 119, 6, 0.1)' },
    approved: { text: '#2563eb', bg: 'rgba(37, 99, 235, 0.1)' },
    rejected: { text: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' },
    succeeded: { text: '#16a34a', bg: 'rgba(22, 163, 74, 0.1)' },
    failed: { text: '#dc2626', bg: 'rgba(220, 38, 38, 0.1)' },
  };

  const statusStyle = statusColors[toolCall.status] || statusColors.pending;
  const argsText = formatPayload(toolCall.args);
  const resultText = toolCall.error ? toolCall.error : toolCall.result ? formatPayload(toolCall.result) : null;

  return (
    <div
      className={`ai-tool-call-card ${className || ''}`}
      data-testid="tool-call-card"
      style={{
        margin: '8px 0',
        padding: '10px 12px',
        borderRadius: 10,
        border: '1px solid var(--color-border, #e2e8f0)',
        backgroundColor: 'var(--color-card, #ffffff)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
        fontSize: 12.5,
        ...style,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
          <IconWrench style={{ color: 'var(--color-primary, #2563eb)' }} />
          <span>{toolCall.toolName}</span>
        </div>
        <span
          style={{
            padding: '2px 8px',
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 500,
            textTransform: 'capitalize',
            color: statusStyle.text,
            backgroundColor: statusStyle.bg,
          }}
        >
          {toolCall.status}
        </span>
      </div>

      {argsText && (
        <pre
          style={{
            margin: '4px 0',
            padding: '6px 8px',
            borderRadius: 6,
            backgroundColor: 'var(--color-muted, #f8fafc)',
            color: 'var(--color-muted-foreground, #475569)',
            fontSize: 11.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'monospace',
          }}
        >
          {argsText}
        </pre>
      )}

      {resultText && (
        <pre
          style={{
            margin: '6px 0 0',
            padding: '6px 8px',
            borderRadius: 6,
            backgroundColor: toolCall.error ? 'rgba(220, 38, 38, 0.05)' : 'var(--color-muted, #f8fafc)',
            color: toolCall.error ? '#dc2626' : 'var(--color-muted-foreground, #475569)',
            fontSize: 11.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'monospace',
          }}
        >
          {resultText}
        </pre>
      )}

      {toolCall.status === 'pending' && onResolve && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onResolve(toolCall.id, true)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: 'var(--color-primary, #2563eb)',
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 500,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
            }}
          >
            Approve
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onResolve(toolCall.id, false)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              border: '1px solid var(--color-border, #cbd5e1)',
              backgroundColor: 'transparent',
              color: 'var(--color-foreground, #334155)',
              fontSize: 12,
              fontWeight: 500,
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
            }}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
