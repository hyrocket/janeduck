"""
introduce_word_node — JaneDuck greets + explains the word on first encounter.
Skipped when writing_attempts_count > 0 (try_again / master_challenge bypass this
node entirely via graph routing, so they are always unaffected).
"""
import os
from typing import Optional

from openai import AsyncOpenAI
from workflows.state import WritingState

_client: Optional[AsyncOpenAI] = None


def _get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")
        _client = AsyncOpenAI(api_key=api_key)
    return _client


_SYSTEM = (
    "You are JaneDuck, a friendly AI writing coach for Singapore secondary school students "
    "(Sec 1-2, age 13-15). Your tone: warm, encouraging, conversational. "
    "Use simple English. Singapore-friendly — avoid heavy American slang. "
    "Be genuine: don't over-praise, keep it short and natural."
)


async def introduce_word_node(state: WritingState) -> dict:
    """
    First encounter only (writing_attempts_count == 0):
    generate a JaneDuck-style word intro + bridge to writing.
    Returns {"introduce_message": "..."} or {} on skip / LLM error.
    """
    if state.get("writing_attempts_count", 0) > 0:
        return {}

    word       = state.get("word", "")
    definition = state.get("definition", "")
    pos        = state.get("part_of_speech") or ""
    examples   = state.get("example_sentences") or []
    is_first   = state.get("is_first_word_in_session", True)

    if not word:
        return {}

    try:
        message = await _generate_intro(word, definition, pos, examples, is_first)
        return {"introduce_message": message}
    except Exception as exc:
        print(f"[introduce_word] LLM error: {exc}")
        return {}


async def _generate_intro(word: str, definition: str, pos: str, examples: list, is_first: bool = True) -> str:
    model  = os.environ.get("LLM_MODEL_PROMPT", "gpt-4o-mini")
    client = _get_client()

    pos_str = f"\nPart of speech: {pos}" if pos else ""

    example_parts = []
    for ex in examples[:2]:
        if isinstance(ex, dict):
            sentence = ex.get("sentence") or ex.get("text") or str(ex)
        else:
            sentence = str(ex)
        example_parts.append(f'"{sentence.strip()}"')
    examples_str = ("\nExample: " + " / ".join(example_parts)) if example_parts else ""

    greeting_rule = (
        "Start with a warm greeting (e.g. 'Hey there!')."
        if is_first
        else "Do NOT start with a greeting like 'Hey there!' or 'Hello!' — jump straight into the word."
    )

    user_msg = (
        f"Introduce this vocabulary word to a student:\n\n"
        f"Word: {word}{pos_str}\n"
        f"Definition: {definition}{examples_str}\n\n"
        f"Write a 2–3 sentence introduction as JaneDuck:\n"
        f"1. {greeting_rule}\n"
        "2. Explain the word's meaning in your own conversational words (don't copy the definition verbatim)\n"
        "3. End with a short, encouraging bridge to writing "
        "(e.g. 'Ready to use it in a sentence?')\n\n"
        "Under 60 words. Plain text only — no markdown, no bullet points."
    )

    resp = await client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user",   "content": user_msg},
        ],
        temperature=0.7,
        max_tokens=120,
    )
    return resp.choices[0].message.content.strip()
