"""
check_target_word — rule-based, no LLM (§7).
Checks exact match and common morphological variants.
"""
import re
from workflows.state import WritingState

# Ordered longest-first to avoid partial stripping (e.g. "tion" before "ion")
_SUFFIXES = [
    "ness", "tion", "sion", "ism", "ist", "ity", "ance", "ence",
    "ment", "ous", "ive", "al", "ic", "ful", "less", "ly",
    "ed", "ing", "er", "s",
]


def _normalize(s: str) -> str:
    """Strip hyphens and spaces for compound-word comparison."""
    return re.sub(r"[-\s]", "", s.lower())


def _stem(word: str) -> str:
    """Very lightweight suffix stripping — no NLP deps required."""
    w = word.lower()
    for suffix in _SUFFIXES:
        if w.endswith(suffix) and len(w) - len(suffix) >= 3:
            return w[: -len(suffix)]
    return w


def check_word(word: str, user_text: str) -> dict:
    text       = user_text.lower()
    word_lower = word.lower()

    # 1 — Exact whole-word match (case-insensitive)
    exact_match = bool(re.search(r"\b" + re.escape(word_lower) + r"\b", text))

    # 2 — Normalised compound match (handles "self-awareness" ↔ "self awareness")
    norm_word = _normalize(word_lower)
    norm_text = _normalize(text)
    norm_match = len(norm_word) > 2 and norm_word in norm_text and not exact_match

    # 3 — Stem match (handles optimism ↔ optimistic, reluctant ↔ reluctantly)
    stem        = _stem(norm_word)
    stem_match  = (
        len(stem) >= 3
        and not exact_match
        and not norm_match
        and bool(re.search(r"\b" + re.escape(stem) + r"[a-z]*\b", text))
    )

    variant_match    = norm_match or stem_match
    target_word_used = exact_match or variant_match

    return {
        "exact_match":               exact_match,
        "variant_match":             variant_match,
        "target_word_used":          target_word_used,
        # evaluate_writing will refine correctness; this is the pre-check
        "target_word_used_correctly": target_word_used,
    }


def check_target_word_node(state: WritingState) -> dict:
    word      = state.get("word", "")
    user_text = state.get("user_text") or ""
    result    = check_word(word, user_text)
    match_type = (
        "exact"   if result["exact_match"]   else
        "variant" if result["variant_match"] else
        "none"
    )
    print(f"[check_target_word] '{word}' match={match_type}")
    return result
