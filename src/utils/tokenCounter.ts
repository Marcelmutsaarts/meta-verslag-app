// Simple token estimation utility
// Using a rough approximation: 1 token ≈ 4 characters for most languages

export function estimateTokens(text: string): number {
  if (!text) return 0
  
  // Remove extra whitespace and normalize
  const cleanText = text.trim().replace(/\s+/g, ' ')
  
  // Rough estimation: 1 token ≈ 4 characters
  // This is approximate but good enough for UI feedback
  return Math.ceil(cleanText.length / 4)
}

export function formatTokenCount(count: number, maxTokens: number = 20000): string {
  const percentage = (count / maxTokens) * 100
  return `${count.toLocaleString()} / ${maxTokens.toLocaleString()} tokens (${percentage.toFixed(1)}%)`
}

export function getTokenCountColor(count: number, maxTokens: number = 20000): string {
  const percentage = (count / maxTokens) * 100
  
  if (percentage >= 100) return 'text-red-600'
  if (percentage >= 90) return 'text-orange-600'
  if (percentage >= 75) return 'text-yellow-600'
  return 'text-green-600'
}

export function isWithinTokenLimit(count: number, maxTokens: number = 20000): boolean {
  return count <= maxTokens
}