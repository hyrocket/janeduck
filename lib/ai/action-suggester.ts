import type { ScaffoldLevel } from "@/lib/types"

export type SuggestedAction = "try_again" | "master_challenge" | "next_word"

export interface ActionSuggesterInput {
  score: number
  scaffold: ScaffoldLevel
  attempt_count: number        // 1-indexed: 1 = first attempt
  target_word_used: boolean
}

export interface ActionSuggesterOutput {
  actions: SuggestedAction[]
  reason: string               // for logging/debugging (§11)
}

// Rule table — DESIGN_DECISIONS.md §8-1
export function suggestActions(input: ActionSuggesterInput): ActionSuggesterOutput {
  const { score, scaffold, attempt_count, target_word_used } = input

  // 3rd attempt reached: only next_word (frustration prevention — §6)
  if (attempt_count >= 3) {
    return { actions: ["next_word"], reason: "rule: attempt_count >= 3" }
  }

  // Target word not used at all → always try_again (not knowing > bad score)
  if (!target_word_used) {
    return { actions: ["try_again", "next_word"], reason: "rule: target_word_used=false" }
  }

  // Score ≤ 7 → try_again + next_word
  if (score <= 7) {
    return { actions: ["try_again", "next_word"], reason: `rule: score=${score} <= 7` }
  }

  // Score 8-10 on low scaffold — no higher scaffold to offer
  if (scaffold === "low") {
    return { actions: ["next_word"], reason: "rule: score>=8, scaffold=low (ceiling reached)" }
  }

  // Score 8-10 on high or medium → offer master_challenge
  return {
    actions: ["master_challenge", "next_word"],
    reason: `rule: score=${score} >= 8, scaffold=${scaffold}`,
  }
}
