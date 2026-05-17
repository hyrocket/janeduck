"""
update_srs_mastery — MasteryUpdater + DB write (§4-3, §12).

Idempotency: attempt_id is derived deterministically from
(card_id, user_id, session_id, attempt_count, user_text).
ON CONFLICT (id) DO NOTHING on writing_attempts ensures
re-running this node with the same state writes nothing twice.

"Last attempt only" for mastery: mastery_level in state always
holds the session-start value (load_context loaded it; no node
mutates it). Every call to this node computes
  new_mastery = f(initial_mastery, current_score)
and writes it to DB — so the last attempt's score always wins.
"""
import traceback
import uuid as uuid_mod
from workflows.state import WritingState
from workflows.judgers import update_mastery
from workflows.db import save_attempt_and_mastery

# Stable namespace for deterministic attempt IDs
_ATTEMPT_NS = uuid_mod.UUID("a1b2c3d4-1234-5678-abcd-a1b2c3d4e5f6")


def _derive_attempt_id(
    card_id: str, user_id: str, session_id: str,
    attempt_count: int, user_text: str,
) -> str:
    key = f"{card_id}|{user_id}|{session_id}|{attempt_count}|{user_text.strip()}"
    return str(uuid_mod.uuid5(_ATTEMPT_NS, key))


async def update_srs_mastery_node(state: WritingState) -> dict:
    current_mastery = state.get("mastery_level", 0)
    score           = state.get("overall_score") or 0
    scaffold        = state.get("current_scaffold", "high")
    is_mc           = state.get("is_master_challenge", False)
    attempt_count   = state.get("attempt_count", 0)
    user_text       = state.get("user_text") or ""

    # ── Mastery calculation ───────────────────────────────────
    mastery_result = update_mastery(current_mastery, score, scaffold, is_mc)
    new_mastery    = mastery_result["new_mastery"]
    new_scaffold   = mastery_result["new_scaffold"]
    print(f"[update_srs_mastery] {mastery_result['reason']} → {current_mastery}→{new_mastery}")

    # ── Build previous_attempts list (for evaluate_writing context on try_again) ─
    prev = list(state.get("previous_attempts") or [])
    attempt_number = len(prev) + 1
    if user_text and state.get("chat_message"):
        prev.append({"user_text": user_text, "ai_feedback": state["chat_message"]})

    # ── Deterministic attempt ID (idempotent insert) ──────────
    attempt_id = _derive_attempt_id(
        state.get("card_id", ""),
        state.get("user_id", ""),
        state.get("session_id") or "",
        attempt_count,
        user_text,
    )

    # ── DB write ──────────────────────────────────────────────
    try:
        await save_attempt_and_mastery(
            attempt_id           = attempt_id,
            user_id              = state.get("user_id", ""),
            card_id              = state.get("card_id", ""),
            session_id           = state.get("session_id"),
            scaffold_used        = scaffold,
            is_master_challenge  = is_mc,
            reference_starter    = state.get("starter_used"),
            topic_used           = state.get("topic_used"),
            structure_guide_used = state.get("structure_guide_used"),
            user_text            = user_text,
            ai_score             = score,
            ai_feedback          = state.get("chat_message", ""),
            ai_strengths         = state.get("strengths") or [],
            ai_weakness_signals  = state.get("weakness_signals") or [],
            writing_rating       = state.get("writing_rating", "again"),
            target_word_used     = state.get("target_word_used", False),
            target_word_correctly= state.get("target_word_used_correctly", False),
            attempt_number       = attempt_number,
            new_mastery          = new_mastery,
            new_scaffold         = new_scaffold,
        )
    except Exception as exc:
        traceback.print_exc()
        print(f"[update_srs_mastery] DB error (non-fatal, continuing): {exc}")

    return {
        "previous_attempts":   prev,
        "last_attempt_id":     attempt_id,
        "mastery_level_before": current_mastery,
        "mastery_level_after":  new_mastery,
    }
