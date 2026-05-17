import { sql } from "@/lib/db"
import { auth } from "@/auth"
import { NextResponse } from "next/server"
import type { SelfEvalRating } from "@/lib/types"

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id
  const cardId = params.id
  const body = await req.json()
  const selfEval = body.self_eval_rating as SelfEvalRating

  if (!["dont_know", "unsure", "know", "know_well"].includes(selfEval)) {
    return NextResponse.json({ error: "Invalid self_eval_rating" }, { status: 400 })
  }

  // Per SRS_SPEC.md §3: self-eval updates last_self_eval_rating + last_reviewed_at.
  // mastery is NOT changed by self-eval (DESIGN_DECISIONS.md §4-2).
  await sql`
    INSERT INTO user_cards (
      user_id, card_id,
      last_self_eval_rating, last_self_eval_at, last_reviewed_at,
      mastery_level, mastery_score,
      writing_attempts_count, recent_scores, current_scaffold,
      is_starred, review_count, self_eval_count,
      srs_state, ease_factor, interval_days, previous_interval_days,
      lapse_count, next_review_at
    ) VALUES (
      ${userId}, ${cardId},
      ${selfEval}, NOW(), NOW(),
      0, 0,
      0, '[]'::jsonb, 'high',
      false, 1, 1,
      'new', 2.5, 0, 0,
      0, NOW() + INTERVAL '1 day'
    )
    ON CONFLICT (user_id, card_id) DO UPDATE SET
      last_self_eval_rating = ${selfEval},
      last_self_eval_at     = NOW(),
      last_reviewed_at      = NOW(),
      self_eval_count       = user_cards.self_eval_count + 1,
      review_count          = user_cards.review_count + 1,
      updated_at            = NOW()
  `

  return NextResponse.json({ ok: true })
}
