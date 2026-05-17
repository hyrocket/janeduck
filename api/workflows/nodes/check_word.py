from ..state import WritingState


def check_target_word_node(state: WritingState) -> dict:
    # STUB — always reports word used.
    # Real impl: regex + lemmatisation check (no LLM). §7.
    return {
        "target_word_used":           True,
        "target_word_used_correctly": True,
    }
