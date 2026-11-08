
export function calculateImprovementPercentage(scoreA: number, scoreB: number): string {
  const higher = Math.max(scoreA, scoreB);
  const lower = Math.min(scoreA, scoreB);
  if (lower <= 0) {
    return '100';
  }
  const delta = ((higher / lower) - 1) * 100;
  return Math.abs(delta).toFixed(0);
}

export function selectHigherScoreVariantId(
  scoreA: number,
  scoreB: number,
  idA: string = 'A',
  idB: string = 'B',
): string {
  return scoreA > scoreB ? idA : idB;
}
