
function repairCommonJsonDefects(text: string): string {
  return (
    text
      .replace(/(:\s*-?\d+(?:\.\d+)?)\s*"/g, '$1')
      .replace(/(:\s*"[^"]*")"/g, '$1')
  );
}

export function safeJSONParse<T>(text: string, fallback: T, onError?: (context: string) => void): T {
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    try {
      return JSON.parse(repairCommonJsonDefects(text)) as T;
    } catch {
      // fall through to the position-aware error report below
    }
    if (error instanceof SyntaxError) {
      const positionMatch = error.message.match(/position (\d+)/);
      const position = positionMatch ? parseInt(positionMatch[1], 10) : -1;
      if (position > 0) {
        const context = text.substring(Math.max(0, position - 50), position + 50);
        onError?.(`JSON parse error at position ${position}: "${context}"`);
      } else {
        onError?.(`JSON parse error: ${error.message}`);
      }
    }
    return fallback;
  }
}

export function extractJSON(text: string): string | null {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    const candidate = codeBlockMatch[1].trim();
    if (candidate.startsWith('{') || candidate.startsWith('[')) {
      return candidate;
    }
  }

  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) {
    return arrayMatch[0];
  }

  return null;
}

export function parseAIResponse<T>(response: string, fallback: T, onError?: (context: string) => void): T {
  const json = extractJSON(response);
  if (!json) {
    onError?.('No JSON payload found in response');
    return fallback;
  }

  return safeJSONParse(json, fallback, onError);
}

export function isValidJSON(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) return false;

  if (
    !(
      (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
      (trimmed.startsWith('[') && trimmed.endsWith(']'))
    )
  ) {
    return false;
  }

  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}
