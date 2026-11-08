
export function countKeywordOccurrences(content: string, keyword: string): number {
  if (!keyword) return 0;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = content.match(new RegExp(escaped, 'gi'));
  return matches ? matches.length : 0;
}

export function countWordsInContent(content: string): number {
  const tokens = content.split(/\s+/).filter(Boolean);
  return tokens.length || 1;
}

export function calculateKeywordDensity(content: string, keyword: string): number {
  const totalWords = countWordsInContent(content);
  const occurrences = countKeywordOccurrences(content, keyword);
  return (occurrences / totalWords) * 100;
}
