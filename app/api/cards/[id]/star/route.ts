import { sql } from "@/lib/db"
import { auth } from "@/auth"
import { NextResponse } from "next/server"

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const userId = session.user.id
  const cardId = params.id

  // Upsert: create if not exists (starred=true), toggle if exists
  const result = await sql`
    INSERT INTO user_cards (
      user_id, card_id,
      is_starred, starred_at,
      mastery_level, mastery_score,
      writing_attempts_count, recent_scores, current_scaffold,
      review_count, self_eval_count,
      srs_state, ease_factor, interval_days, previous_interval_days,
      lapse_count, next_review_at
    ) VALUES (
      ${userId}, ${cardId},
      true, NOW(),
      0, 0,
      0, '[]'::jsonb, 'high',
      0, 0,
      'new', 2.5, 0, 0,
      0, NOW() + INTERVAL '1 day'
    )
    ON CONFLICT (user_id, card_id) DO UPDATE SET
      is_starred = NOT user_cards.is_starred,
      starred_at = CASE WHEN NOT user_cards.is_starred THEN NOW() ELSE NULL END,
      updated_at = NOW()
    RETURNING is_starred
  `

  return NextResponse.json({ is_starred: result[0].is_starred })
}
