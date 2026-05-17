import type { SelfEvalRating } from "@/lib/types"

// ── Tuning constants (SRS_SPEC.md §4) ────────────────────────
export const W_MASTERY          = 0.40
export const W_RECENCY          = 0.30
export const W_SELFEVAL         = 0.15
export const W_PRACTICE         = 0.15
export const MASTERY_DECAY_COEF = 0.5   // recency mastery-decay strength
export const RECENCY_COEF       = 25    // log2 curve scale factor

// ── Factor calculators (SRS_SPEC.md §1-3 ~ §1-6) ─────────────

function masteryFactor(mastery: number): number {
  // Lower mastery = more urgent. SRS_SPEC §1-3 — linear inverse.
  return ((5 - Math.min(5, Math.max(0, mastery))) / 5) * 100
}

function recencyFactor(lastReviewedAt: Date | null, mastery: number): number {
  // Never reviewed = maximum urgency.
  if (!lastReviewedAt) return 100

  const msPerDay = 1000 * 60 * 60 * 24
  const days = (Date.now() - lastReviewedAt.getTime()) / msPerDay

  // Well-known words are forgotten more slowly (mastery decay). SRS_SPEC §1-4.
  const adjustedDays = days / (1 + mastery * MASTERY_DECAY_COEF)

  // log2 curve: fast rise early, plateau later. SRS_SPEC §1-4.
  return Math.min(100, Math.log2(adjustedDays + 1) * RECENCY_COEF)
}

function selfevalFactor(rating: SelfEvalRating | null): number {
  // Optional — 0 if not provided. SRS_SPEC §1-5.
  if (!rating) return 0
  const map: Record<SelfEvalRating, number> = {
    dont_know: 100,
    unsure:    60,
    know:      20,
    know_well: 0,
  }
  return map[rating]
}

function practiceFactor(writingCount: number): number {
  // Catches "knows but hasn't written" gap. SRS_SPEC §1-6.
  if (writingCount === 0) return 100
  if (writingCount === 1) return 60
  if (writingCount === 2) return 30
  return 0
}

// ── Public API ────────────────────────────────────────────────

export interface ReviewPriorityInput {
  mastery_level: number
  last_reviewed_at: Date | null
  last_self_eval_rating: SelfEvalRating | null
  writing_attempts_count: number
}

/** Returns 0–100. Higher = more urgent to review. SRS_SPEC.md §1-1. */
export function calculateReviewPriority(input: ReviewPriorityInput): number {
  return (
    W_MASTERY  * masteryFactor(input.mastery_level) +
    W_RECENCY  * recencyFactor(input.last_reviewed_at, input.mastery_level) +
    W_SELFEVAL * selfevalFactor(input.last_self_eval_rating) +
    W_PRACTICE * practiceFactor(input.writing_attempts_count)
  )
}
