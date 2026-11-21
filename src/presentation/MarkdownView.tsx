import { useState, type ReactNode } from 'react';
import { IconCheck, IconCopy } from './icons';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

export function MarkdownView({ content, className }: MarkdownViewProps) {
  const blocks = parseBlocks(content);

  return (
    <div className={`ai-markdown-view ${className || ''}`} style={{ lineHeight: 1.6, wordBreak: 'break-word' }}>
      {blocks.map((b, idx) => {
        if (b.type === 'code') {
          return <CodeBlock key={idx} code={b.text} language={b.lang} />;
        }
        if (b.type === 'list') {
          return (
            <ul key={idx} style={{ margin: '8px 0', paddingLeft: 20 }}>
              {b.items.map((item, itemIdx) => (
                <li key={itemIdx} style={{ marginBottom: 4 }}>
                  {renderInline(item)}
                </li>
              ))}
            </ul>
          );
        }
        return (
          <p key={idx} style={{ margin: '6px 0' }}>
            {renderInline(b.text)}
          </p>
        );
      })}
    </div>
  );
}

function CodeBlock({ code, language }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      style={{
        margin: '10px 0',
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        fontSize: 13,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 12px',
          backgroundColor: '#1e293b',
          borderBottom: '1px solid #334155',
          fontSize: 11,
          color: '#94a3b8',
        }}
      >
        <span>{language || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={copied ? 'Copied code' : 'Copy code'}
          style={{
            background: 'none',
            border: 'none',
            color: '#cbd5e1',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: 2,
            fontSize: 11,
          }}
        >
          {copied ? <IconCheck /> : <IconCopy />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre style={{ margin: 0, padding: 12, overflowX: 'auto', fontFamily: 'monospace' }}>
        <code>{code}</code>
      </pre>
    </div>
  );
}

type Block =
  | { type: 'code'; text: string; lang?: string }
  | { type: 'list'; items: string[] }
  | { type: 'paragraph'; text: string };

function parseBlocks(markdown: string): Block[] {
  const lines = markdown.split(/\r?\n/);
  const blocks: Block[] = [];
  let inCode = false;
  let codeLang = '';
  let codeBuffer: string[] = [];
  let listBuffer: string[] = [];
  let paraBuffer: string[] = [];

  const flushList = () => {
    if (listBuffer.length > 0) {
      blocks.push({ type: 'list', items: [...listBuffer] });
      listBuffer = [];
    }
  };

  const flushPara = () => {
    if (paraBuffer.length > 0) {
      blocks.push({ type: 'paragraph', text: paraBuffer.join('\n') });
      paraBuffer = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        blocks.push({ type: 'code', text: codeBuffer.join('\n'), lang: codeLang });
        codeBuffer = [];
        codeLang = '';
        inCode = false;
      } else {
        flushPara();
        flushList();
        inCode = true;
        codeLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCode) {
      codeBuffer.push(line);
      continue;
    }

    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      flushPara();
      listBuffer.push(trimmed.slice(2));
      continue;
    }

    if (trimmed === '') {
      flushList();
      flushPara();
      continue;
    }

    if (listBuffer.length > 0) {
      flushList();
    }
    paraBuffer.push(line);
  }

  if (inCode) {
    blocks.push({ type: 'code', text: codeBuffer.join('\n'), lang: codeLang });
  }
  flushList();
  flushPara();

  return blocks;
}

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('`') && token.endsWith('`')) {
      parts.push(
        <code
          key={match.index}
          style={{
            backgroundColor: 'rgba(0,0,0,0.06)',
            padding: '2px 5px',
            borderRadius: 4,
            fontSize: '0.9em',
            fontFamily: 'monospace',
          }}
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      parts.push(<strong key={match.index}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('*') && token.endsWith('*')) {
      parts.push(<em key={match.index}>{token.slice(1, -1)}</em>);
    }
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
