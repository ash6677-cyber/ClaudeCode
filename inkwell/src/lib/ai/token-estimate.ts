/**
 * Approximate token count for any provider/model, always shown in the UI as an
 * estimate ("≈ N tokens") rather than an exact count — exact tokenization
 * differs per model and a full BPE tokenizer isn't worth the bundle weight for
 * a number the UI is explicit about being approximate.
 *
 * Blends a chars-per-token ratio with a words-per-token ratio (English prose
 * averages ~4 chars/token and ~1.3 tokens/word) and takes the higher of the
 * two, which stays reasonably accurate across both dense and sparse text.
 */
export function estimateTokens(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  const byChars = trimmed.length / 4
  const byWords = trimmed.split(/\s+/).length * 1.3
  return Math.ceil(Math.max(byChars, byWords))
}
