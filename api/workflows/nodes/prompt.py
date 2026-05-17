"""
Prompt nodes — scaffold-specific writing task generation (§7, §5-1, §10).

try_again reuse rule: if the relevant prompt field is already set in state,
return {} (no state update) — the LLM call is skipped and the existing
prompt is reused. A new prompt is only generated when the field is absent
(fresh session or master_challenge scaffold change).
"""
import json
import os
import random
from typing import Optional

from openai import AsyncOpenAI
from workflows.state import WritingState

# ── App-wide constants (§5-1) ─────────────────────────────────

STRUCTURE_GUIDES = ["reason", "result", "feeling", "contrast"]

TOPIC_POOL = [
    "school life",
    "friendship",
    "family",
    "weekend plans",
    "emotions",
    "a small incident",
    "hobbies",
    "exam pressure",
    "after-school activities",
]

# ── OpenAI client (shared with evaluate.py singleton pattern) ─

_client: Optional[AsyncOpenAI] = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")
        _client = AsyncOpenAI(api_key=api_key)
    return _client


# ── prompt_high ───────────────────────────────────────────────

def prompt_high_node(state: WritingState) -> dict:
    """
    Pick a sentence starter from cards.starter_templates (DB, loaded by load_context).
    No LLM call — starters are pre-generated at seed time (§10).
    Skipped on try_again (starter_used already set).
    """
    if state.get("starter_used"):
        return {}

    templates = state.get("starter_templates") or []
    if templates:
        starter = random.choice(templates)
    else:
        word = state.get("word", "word")
        starter = f"I used {word} when ___."

    return {
        "starter_used":         starter,
        "topic_hint":           None,
        "topic_used":           None,
        "structure_guide_used": None,
        "user_text":            None,
        "validation_error":     None,
    }


# ── prompt_medium ─────────────────────────────────────────────

async def prompt_medium_node(state: WritingState) -> dict:
    """
    LLM selects the best topic hint from cards.topic_hints for this word.
    Skipped on try_again (topic_hint already set).
    """
    if state.get("topic_hint"):
        return {}

    word       = state.get("word", "")
    definition = state.get("definition", "")
    hints      = state.get("topic_hints") or []
    if not hints:
        hints = TOPIC_POOL

    topic = await _pick_topic_medium(word, definition, hints)

    return {
        "starter_used":         None,
        "topic_hint":           topic,
        "topic_used":           None,
        "structure_guide_used": None,
        "user_text":            None,
        "validation_error":     None,
    }


async def _pick_topic_medium(word: str, definition: str, hints: list) -> str:
    model  = os.environ.get("LLM_MODEL_PROMPT", "gpt-4o-mini")
    client = _get_client()
    hints_str = "\n".join(f"- {h}" for h in hints)

    user_msg = (
        f'Target word: "{word}"\n'
        f'Definition: "{definition}"\n\n'
        f"Available topic hints (choose the ONE that fits best):\n{hints_str}\n\n"
        "Pick the topic that lets a 13-15 year old Singapore student use this word "
        "most naturally. You may make the topic slightly more specific (max 8 words), "
        "but it must come from the list.\n"
        'Return JSON only: {"topic": "your choice"}'
    )
    try:
        resp = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": user_msg}],
            response_format={"type": "json_object"},
            temperature=0.8,
            max_tokens=60,
        )
        data  = json.loads(resp.choices[0].message.content)
        topic = data.get("topic", "").strip()
        if topic and len(topic) <= 80:
            return topic
    except Exception as exc:
        print(f"[prompt_medium] LLM error: {exc}")

    return random.choice(hints)


# ── prompt_low ────────────────────────────────────────────────

async def prompt_low_node(state: WritingState) -> dict:
    """
    LLM selects structure guide (from STRUCTURE_GUIDES) + topic (from TOPIC_POOL).
    Skipped on try_again (topic_used already set).
    """
    if state.get("topic_used") and state.get("structure_guide_used"):
        return {}

    word       = state.get("word", "")
    definition = state.get("definition", "")

    result = await _pick_combo_low(word, definition)

    return {
        "starter_used":         None,
        "topic_hint":           None,
        "topic_used":           result["topic"],
        "structure_guide_used": result["structure_guide"],
        "user_text":            None,
        "validation_error":     None,
    }


async def _pick_combo_low(word: str, definition: str) -> dict:
    model  = os.environ.get("LLM_MODEL_PROMPT", "gpt-4o-mini")
    client = _get_client()

    guides_str = ", ".join(STRUCTURE_GUIDES)
    topics_str = "\n".join(f"- {t}" for t in TOPIC_POOL)

    user_msg = (
        f'Target word: "{word}"\n'
        f'Definition: "{definition}"\n\n'
        f"Structure guides (choose ONE — what the 2nd sentence must do): {guides_str}\n"
        f"Topics (choose ONE):\n{topics_str}\n\n"
        "Choose the combination that feels most natural for using this word in "
        "two connected sentences for a 13-15 year old Singapore student.\n"
        f"structure_guide MUST be one of: {guides_str}\n"
        "topic MUST come from the list above.\n"
        'Return JSON only: {"structure_guide": "...", "topic": "..."}'
    )
    try:
        resp = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": user_msg}],
            response_format={"type": "json_object"},
            temperature=0.8,
            max_tokens=80,
        )
        data  = json.loads(resp.choices[0].message.content)
        guide = data.get("structure_guide", "").strip().lower()
        topic = data.get("topic", "").strip()

        if guide not in STRUCTURE_GUIDES:
            guide = random.choice(STRUCTURE_GUIDES)
        if not topic or len(topic) > 80:
            topic = random.choice(TOPIC_POOL)

        return {"structure_guide": guide, "topic": topic}

    except Exception as exc:
        print(f"[prompt_low] LLM error: {exc}")

    return {
        "structure_guide": random.choice(STRUCTURE_GUIDES),
        "topic":           random.choice(TOPIC_POOL),
    }
