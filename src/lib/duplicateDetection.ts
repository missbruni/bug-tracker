import type { Bug } from '../components/BugCard'

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'in', 'on', 'at', 'to', 'for', 'of', 'and', 'or',
  'not', 'it', 'be', 'as', 'by', 'but', 'with', 'from', 'has', 'was', 'are',
  'bug', 'issue', 'error', 'broken', 'does', 'when', 'after', 'before',
])

const MIN_QUERY_LENGTH = 4
const MIN_SCORE = 0.35

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
}

function similarity(queryTokens: string[], candidateTokens: string[]): number {
  if (!queryTokens.length || !candidateTokens.length) return 0

  const candidateSet = new Set(candidateTokens)
  let matchCount = 0

  for (const token of queryTokens) {
    if (candidateSet.has(token)) {
      matchCount++
      continue
    }
    // Partial match: check if any candidate token starts with or contains query token
    for (const candidate of candidateSet) {
      if (candidate.includes(token) || token.includes(candidate)) {
        matchCount += 0.6
        break
      }
    }
  }

  const precision = matchCount / queryTokens.length
  const recall = matchCount / candidateTokens.length
  if (precision + recall === 0) return 0

  // F1-like score
  return (2 * precision * recall) / (precision + recall)
}

export interface DuplicateCandidate {
  bug: Bug
  score: number
}

export function findPotentialDuplicates(
  title: string,
  existingBugs: Bug[],
  maxResults = 3,
): DuplicateCandidate[] {
  const trimmed = title.trim()
  if (trimmed.length < MIN_QUERY_LENGTH) return []

  const queryTokens = tokenize(trimmed)
  if (queryTokens.length === 0) return []

  const scored: DuplicateCandidate[] = []

  for (const bug of existingBugs) {
    const titleTokens = tokenize(bug.title)
    const descTokens = tokenize(bug.description || '')
    const combinedTokens = [...new Set([...titleTokens, ...descTokens])]

    const titleScore = similarity(queryTokens, titleTokens)
    const combinedScore = similarity(queryTokens, combinedTokens)

    // Weight title matches higher
    const score = Math.max(titleScore, combinedScore * 0.8)

    if (score >= MIN_SCORE) {
      scored.push({ bug, score })
    }
  }

  return scored
    .sort((first, second) => second.score - first.score)
    .slice(0, maxResults)
}
