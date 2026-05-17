import type { SrsRating, SrsState, SelfEvalRating } from "@/lib/types"

interface SrsFields {
  srs_state: SrsState
  ease_factor: number
  interval_days: number
  previous_interval_days: number
  lapse_count: number
  writing_attempts_count: number
}

export interface SrsUpdateResult {
  srs_state: SrsState
  ease_factor: number
  interval_days: number
  previous_interval_days: number
  lapse_count: number
  next_review_at: Date
}

function clampEase(e: number) { return Math.min(3.0, Math.max(1.3, e)) }
function clampInterval(i: number) { return Math.min(365, Math.max(0, i)) }

export function applySrsRating(current: SrsFields, rating: SrsRating): SrsUpdateResult {
  const { srs_state, ease_factor, interval_days, previous_interval_days, lapse_count, writing_attempts_count } = current

  let newState: SrsState = srs_state
  let newEase = ease_factor
  let newInterval = interval_days
  let newPrev = previous_interval_days
  let newLapse = lapse_count

  if (srs_state === "new" || srs_state === "learning") {
    if (rating === "again" || rating === "hard") {
      newState = "learning"
      newInterval = 1
    } else if (rating === "good") {
      newState = "review"
      newInterval = 1
    } else {
      newState = "review"
      newInterval = 4
    }
  } else if (srs_state === "review") {
    if (rating === "again") {
      newState = "relearning"
      newPrev = interval_days
      newInterval = 0
      newEase = clampEase(ease_factor - 0.20)
      newLapse = lapse_count + 1
    } else if (rating === "hard") {
      newInterval = Math.max(1, Math.round(interval_days * 1.2))
      newEase = clampEase(ease_factor - 0.15)
    } else if (rating === "good") {
      newInterval = Math.max(1, Math.round(interval_days * ease_factor))
    } else {
      newInterval = Math.max(1, Math.round(interval_days * ease_factor * 1.15))
      newEase = clampEase(ease_factor + 0.15)
    }
  } else {
    // relearning
    if (rating === "again" || rating === "hard") {
      newState = "relearning"
      newInterval = 1
    } else if (rating === "good") {
      newState = "review"
      newInterval = Math.max(1, Math.round(previous_interval_days * 0.5))
    } else {
      newState = "review"
      newInterval = Math.max(1, previous_interval_days)
    }
  }

  // self_eval cap: without writing practice, cap interval to avoid false mastery
  if (writing_attempts_count === 0) {
    newInterval = Math.min(newInterval, 3)
  } else if (writing_attempts_count < 3) {
    newInterval = Math.min(newInterval, 14)
  }

  newInterval = clampInterval(newInterval)

  const next_review_at = new Date()
  next_review_at.setDate(next_review_at.getDate() + newInterval)

  return { srs_state: newState, ease_factor: newEase, interval_days: newInterval, previous_interval_days: newPrev, lapse_count: newLapse, next_review_at }
}

export function selfEvalToSrsRating(selfEval: SelfEvalRating): SrsRating {
  const map: Record<SelfEvalRating, SrsRating> = {
    dont_know: "again",
    unsure: "hard",
    know: "good",
    know_well: "easy",
  }
  return map[selfEval]
}
