import { sql } from "@/lib/db"
import { auth } from "@/auth"
import { NextResponse } from "next/server"
import { applySrsRating, selfEvalToSrsRating } from "@/lib/srs/update"
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

  // Fetch or initialise user_card
  const existing = await sql`
    SELECT srs_state, ease_factor, interval_days, previous_interval_days,
           lapse_count, writing_attempts_count, review_count, self_eval_count
    FROM user_cards
    WHERE user_id = ${userId} AND card_id = ${cardId}
  `

  const rating = selfEvalToSrsRating(selfEval)

  if (existing.length === 0) {
    // First encounter — create record then apply rating
    const srsResult = applySrsRating({
      srs_state: "new",
      ease_factor: 2.5,
      interval_days: 0,
      previous_interval_days: 0,
      lapse_count: 0,
      writing_attempts_count: 0,
    }, rating)

    await sql`
      INSERT INTO user_cards (
        user_id, card_id,
        mastery_level, mastery_score,
        last_self_eval_rating, last_self_eval_at,
        writing_attempts_count, recent_scores, current_scaffold,
        is_starred,
        review_count, self_eval_count,
        srs_state, ease_factor, interval_days, previous_interval_days,
        lapse_count, next_review_at, last_reviewed_at,
        last_rating, last_rating_source
      ) VALUES (
        ${userId}, ${cardId},
        0, 0,
        ${selfEval}, NOW(),
        0, '[]'::jsonb, 'high',
        false,
        1, 1,
        ${srsResult.srs_state}, ${srsResult.ease_factor},
        ${srsResult.interval_days}, ${srsResult.previous_interval_days},
        ${srsResult.lapse_count}, ${srsResult.next_review_at.toISOString()}, NOW(),
        ${rating}, 'self_eval'
      )
    `
  } else {
    const uc = existing[0]
    const srsResult = applySrsRating({
      srs_state: uc.srs_state as "new" | "learning" | "review" | "relearning" | "mastered",
      ease_factor: Number(uc.ease_factor),
      interval_days: Number(uc.interval_days),
      previous_interval_days: Number(uc.previous_interval_days),
      lapse_count: Number(uc.lapse_count),
      writing_attempts_count: Number(uc.writing_attempts_count),
    }, rating)

    await sql`
      UPDATE user_cards SET
        last_self_eval_rating = ${selfEval},
        last_self_eval_at     = NOW(),
        review_count          = review_count + 1,
        self_eval_count       = self_eval_count + 1,
        srs_state             = ${srsResult.srs_state},
        ease_factor           = ${srsResult.ease_factor},
        interval_days         = ${srsResult.interval_days},
        previous_interval_days= ${srsResult.previous_interval_days},
        lapse_count           = ${srsResult.lapse_count},
        next_review_at        = ${srsResult.next_review_at.toISOString()},
        last_reviewed_at      = NOW(),
        last_rating           = ${rating},
        last_rating_source    = 'self_eval',
        updated_at            = NOW()
      WHERE user_id = ${userId} AND card_id = ${cardId}
    `
  }

  return NextResponse.json({ ok: true })
}
