import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ChatPane,
  ChatMessage,
  PromptComposer,
  SuggestedPrompts,
  AIAssistantDrawer,
  AIAssistantModal,
  MarkdownView,
} from '../../src/presentation';

describe('ChatPane presentation components', () => {
  it('renders ChatPane with title, empty state and suggested prompts', () => {
    const html = renderToStaticMarkup(
      <ChatPane
        messages={[]}
        onSend={() => {}}
        title="Custom Assistant"
        subtitle="Powered by Antigravity"
        suggestedPrompts={['Summarize document', 'Draft release notes']}
      />
    );

    expect(html).toContain('Custom Assistant');
    expect(html).toContain('Powered by Antigravity');
    expect(html).toContain('Summarize document');
    expect(html).toContain('Draft release notes');
    expect(html).toContain('Ask anything...');
  });

  it('renders user and assistant messages with markdown', () => {
    const html = renderToStaticMarkup(
      <ChatPane
        messages={[
          { role: 'user', content: 'What is Web AI?' },
          { role: 'assistant', content: 'Web AI is **awesome** and supports `code` blocks.' },
        ]}
        onSend={() => {}}
      />
    );

    expect(html).toContain('What is Web AI?');
    expect(html).toContain('Web AI is ');
    expect(html).toContain('<strong>awesome</strong>');
    expect(html).toContain('>code</code>');
  });

  it('renders ChatMessage individually with avatar and status', () => {
    const html = renderToStaticMarkup(
      <ChatMessage
        message={{
          role: 'user',
          content: 'Direct message test',
          createdAt: '12:30 PM',
          status: 'sent',
        }}
      />
    );
    expect(html).toContain('Direct message test');
    expect(html).toContain('12:30 PM');
    expect(html).toContain('ai-chat-message--user');
  });

  it('renders thinking state when loading without streaming message', () => {
    const html = renderToStaticMarkup(
      <ChatPane
        messages={[{ role: 'user', content: 'Tell me a joke' }]}
        loading={true}
        onSend={() => {}}
      />
    );

    expect(html).toContain('Thinking...');
    expect(html).toContain('ai-dot-pulse');
  });

  it('renders streaming assistant message when provided', () => {
    const html = renderToStaticMarkup(
      <ChatPane
        messages={[{ role: 'user', content: 'Explain quantum physics' }]}
        streamingMessage="Quantum physics is the study of matter and energy..."
        onSend={() => {}}
      />
    );

    expect(html).toContain('Quantum physics is the study of matter and energy...');
  });

  it('renders stop button in composer when loading', () => {
    const html = renderToStaticMarkup(
      <PromptComposer onSend={() => {}} onStop={() => {}} loading={true} />
    );

    expect(html).toContain('aria-label="Stop generation"');
  });

  it('renders send button in composer when not loading', () => {
    const html = renderToStaticMarkup(
      <PromptComposer onSend={() => {}} loading={false} value="Hello world" />
    );

    expect(html).toContain('aria-label="Send message"');
    expect(html).toContain('Hello world');
  });

  it('renders SuggestedPrompts correctly', () => {
    const html = renderToStaticMarkup(
      <SuggestedPrompts
        prompts={['How does authentication work?', 'Explain billing']}
        onSelect={() => {}}
      />
    );

    expect(html).toContain('How does authentication work?');
    expect(html).toContain('Explain billing');
  });

  it('renders AIAssistantDrawer when open and hides when closed', () => {
    const openHtml = renderToStaticMarkup(
      <AIAssistantDrawer
        open={true}
        onClose={() => {}}
        title="Side Copilot"
        chatProps={{
          messages: [],
          onSend: () => {},
        }}
      />
    );
    expect(openHtml).toContain('Side Copilot');
    expect(openHtml).toContain('ai-assistant-drawer-root');

    const closedHtml = renderToStaticMarkup(
      <AIAssistantDrawer
        open={false}
        onClose={() => {}}
        title="Side Copilot"
        chatProps={{
          messages: [],
          onSend: () => {},
        }}
      />
    );
    expect(closedHtml).toBe('');
  });

  it('renders AIAssistantModal when open and hides when closed', () => {
    const openHtml = renderToStaticMarkup(
      <AIAssistantModal
        open={true}
        onClose={() => {}}
        title="Copilot Modal"
        chatProps={{
          messages: [],
          onSend: () => {},
        }}
      />
    );
    expect(openHtml).toContain('Copilot Modal');
    expect(openHtml).toContain('ai-assistant-modal-root');

    const closedHtml = renderToStaticMarkup(
      <AIAssistantModal
        open={false}
        onClose={() => {}}
        title="Copilot Modal"
        chatProps={{
          messages: [],
          onSend: () => {},
        }}
      />
    );
    expect(closedHtml).toBe('');
  });

  it('renders MarkdownView with code blocks and lists', () => {
    const md = 'Here is a list:\n- First item\n- Second item\n\n```typescript\nconst x = 42;\n```';
    const html = renderToStaticMarkup(<MarkdownView content={md} />);

    expect(html).toContain('First item');
    expect(html).toContain('Second item');
    expect(html).toContain('const x = 42;');
    expect(html).toContain('typescript');
  });
});
