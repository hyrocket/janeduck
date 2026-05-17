"""
asyncpg connection pool + DB helper functions for Writing Mode.
All DB I/O for the LangGraph workflow lives here.
"""
import json
import os
import uuid as uuid_mod
from typing import Optional

import asyncpg

_pool: Optional[asyncpg.Pool] = None


async def _set_json_codec(conn: asyncpg.Connection) -> None:
    await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")
    await conn.set_type_codec("json",  encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        url = os.environ.get("DATABASE_URL")
        if not url:
            raise ValueError("DATABASE_URL not set")
        # min_size=1 keeps one warm connection for local dev.
        # For Vercel serverless use the Neon pooler URL in DATABASE_URL.
        _pool = await asyncpg.create_pool(url, min_size=1, max_size=5, init=_set_json_codec)
    return _pool


async def get_card_and_user_card(card_id: str, user_id: str) -> dict:
    """
    Returns card metadata and user_card state.
    Upserts user_card with defaults if the row doesn't exist yet.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        card = await conn.fetchrow(
            """
            SELECT starter_templates, topic_hints, part_of_speech, example_sentences
            FROM cards WHERE id = $1
            """,
            uuid_mod.UUID(card_id),
        )

        user_card = await conn.fetchrow(
            """
            INSERT INTO user_cards (user_id, card_id, mastery_level, current_scaffold, writing_attempts_count)
            VALUES ($1, $2, 0, 'high', 0)
            ON CONFLICT (user_id, card_id) DO UPDATE SET updated_at = NOW()
            RETURNING mastery_level, current_scaffold, writing_attempts_count
            """,
            uuid_mod.UUID(user_id),
            uuid_mod.UUID(card_id),
        )

    return {
        "starter_templates":      list(card["starter_templates"] or []) if card else [],
        "topic_hints":            list(card["topic_hints"] or [])        if card else [],
        "part_of_speech":         card["part_of_speech"]                 if card else None,
        "example_sentences":      list(card["example_sentences"] or [])  if card else [],
        "mastery_level":          user_card["mastery_level"],
        "current_scaffold":       user_card["current_scaffold"],
        "writing_attempts_count": user_card["writing_attempts_count"],
    }


async def save_attempt_and_mastery(
    *,
    attempt_id:           str,
    user_id:              str,
    card_id:              str,
    session_id:           Optional[str],
    scaffold_used:        str,
    is_master_challenge:  bool,
    reference_starter:    Optional[str],
    topic_used:           Optional[str],
    structure_guide_used: Optional[str],
    user_text:            str,
    ai_score:             int,
    ai_feedback:          str,
    ai_strengths:         list,
    ai_weakness_signals:  list,
    writing_rating:       str,
    target_word_used:     bool,
    target_word_correctly: bool,
    attempt_number:       int,
    new_mastery:          int,
    new_scaffold:         str,
) -> None:
    """
    INSERT writing_attempts (idempotent via ON CONFLICT DO NOTHING)
    + UPDATE user_cards — both in one transaction.
    writing_attempts_count is only incremented when the INSERT actually lands.
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                """
                WITH ins AS (
                    INSERT INTO writing_attempts (
                        id, user_id, card_id, session_id,
                        scaffold_used, is_master_challenge,
                        reference_starter, topic_used, structure_guide_used,
                        user_text,
                        ai_score, ai_feedback, ai_strengths, ai_weakness_signals,
                        writing_rating, used_target_word, meaning_correct,
                        attempt_number
                    ) VALUES (
                        $1,$2,$3,$4,
                        $5,$6,
                        $7,$8,$9,
                        $10,
                        $11,$12,$13,$14,
                        $15,$16,$17,
                        $18
                    )
                    ON CONFLICT (id) DO NOTHING
                    RETURNING id
                )
                UPDATE user_cards SET
                    mastery_level  = $19,
                    current_scaffold = $20,
                    last_writing_score = $11,
                    last_writing_at = NOW(),
                    last_reviewed_at = NOW(),
                    writing_attempts_count = CASE
                        WHEN (SELECT COUNT(*) FROM ins) > 0
                        THEN writing_attempts_count + 1
                        ELSE writing_attempts_count
                    END,
                    recent_scores = CASE
                        WHEN jsonb_array_length(COALESCE(recent_scores, '[]')) >= 3
                        THEN (COALESCE(recent_scores, '[]') - 0) || jsonb_build_array($11::int)
                        ELSE COALESCE(recent_scores, '[]') || jsonb_build_array($11::int)
                    END,
                    updated_at = NOW()
                WHERE user_id = $2 AND card_id = $3
                """,
                uuid_mod.UUID(attempt_id),
                uuid_mod.UUID(user_id),
                uuid_mod.UUID(card_id),
                uuid_mod.UUID(session_id) if session_id else None,
                scaffold_used,
                is_master_challenge,
                reference_starter,
                topic_used,
                structure_guide_used,
                user_text,
                ai_score,
                ai_feedback,
                ai_strengths,
                ai_weakness_signals,
                writing_rating,
                target_word_used,
                target_word_correctly,
                attempt_number,
                new_mastery,
                new_scaffold,
            )
