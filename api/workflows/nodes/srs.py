from ..state import WritingState


async def update_srs_mastery_node(state: WritingState) -> dict:
    # STUB — no DB write.
    # Real impl: INSERT writing_attempts + UPDATE user_cards mastery (§4-3 ceiling rules).
    print(
        f"[STUB update_srs_mastery] card={state.get('card_id')} "
        f"user={state.get('user_id')} score={state.get('overall_score')} "
        f"scaffold={state.get('current_scaffold')} "
        f"master_challenge={state.get('is_master_challenge')}"
    )

    # Accumulate previous_attempts so try_again has context
    prev = list(state.get("previous_attempts") or [])
    if state.get("user_text") and state.get("chat_message"):
        prev.append({
            "user_text":   state["user_text"],
            "ai_feedback": state["chat_message"],
        })

    return {"previous_attempts": prev, "last_attempt_id": None}
