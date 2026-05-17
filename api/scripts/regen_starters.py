"""
Regenerate cards.starter_templates for all cards using the new format:
  - Target word IS in the sentence (already filled in)
  - Blank ___ is at the SITUATION/CONTEXT position (after when/because/after/to/by etc.)
  - Blank requires a PHRASE or CLAUSE, not a single word

Usage (run from api/ directory):
  python scripts/regen_starters.py
  python scripts/regen_starters.py --dry-run
  python scripts/regen_starters.py --limit 5
  python scripts/regen_starters.py --card-id <UUID>

Options:
  --dry-run      Print starters without writing to DB
  --limit N      Process only first N cards (for testing)
  --card-id UUID Process only one specific card
"""
import argparse
import asyncio
import json
import os
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env.local", override=False)
load_dotenv(Path(__file__).parent.parent.parent / ".env", override=False)

import asyncpg
from openai import AsyncOpenAI

_SYSTEM = """\
You are an expert EFL teacher creating sentence-completion exercises for Singapore \
secondary school students (Sec 1, age 13-15).

CORE RULE — the most important constraint:
  The SUBJECT of the sentence MUST be a PERSON: I / She / He / My friend / We / \
My teacher / They / etc.
  The TARGET WORD must be something the person EXPERIENCED, SHOWED, or DID — \
NOT the subject of the sentence.
  NEVER start a sentence with the target word itself.

Format rules:
1. Subject = person (I / She / He / My friend / We / etc.) — ALWAYS.
2. Target word appears mid-sentence as something experienced or demonstrated.
3. Blank ___ is at the SITUATION/CONTEXT position — after: when, after, because, \
since, so that, until, while, as, if.
4. The blank must require a PHRASE or CLAUSE — a student cannot fill it with \
a single word.
5. Sentences should feel natural and relatable to Singapore teens \
(school, friends, family, exams, daily life).
6. Keep language simple enough for a 13-year-old.
7. Vary the subject and connector across the 3 starters.

FORBIDDEN patterns (never generate these):
  "[Word] is important because ___."
  "[Word] helps us when ___."
  "[Word] can be difficult after ___."
  "[Word] became a problem because ___."
  Any sentence where the target word itself is the grammatical subject.

GOOD examples:
  noun    -> "My friend showed resilience when ___."
  noun    -> "She felt vulnerability after ___."
  noun    -> "I noticed his optimism when ___."
  adjective -> "She remained resilient even after ___."
  adjective -> "He felt grateful when ___."

Return JSON only: {"starters": ["...", "...", "..."]}  (exactly 3 strings)\
"""


async def generate_starters(
    client: AsyncOpenAI,
    word: str,
    definition: str,
    pos: str,
    model: str,
    max_attempts: int = 3,
) -> list:
    pos_note = f" ({pos})" if pos else ""
    user_msg = (
        f'Generate 3 sentence starters for the word "{word}"{pos_note}.\n'
        f"Definition: {definition}\n\n"
        "IMPORTANT: Every starter MUST contain ___ (three underscores) as the blank.\n"
        'Return JSON only: {"starters": ["...", "...", "..."]}'
    )

    for attempt in range(max_attempts):
        resp = await client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM},
                {"role": "user",   "content": user_msg},
            ],
            response_format={"type": "json_object"},
            temperature=0.8 + attempt * 0.05,
            max_tokens=220,
        )
        data     = json.loads(resp.choices[0].message.content)
        starters = [s.strip() for s in data.get("starters", []) if isinstance(s, str) and s.strip()]

        if len(starters) != 3:
            continue

        # All 3 must contain ___ (the blank marker)
        if all("___" in s for s in starters):
            return starters

    raise ValueError(f"could not generate valid starters with ___ after {max_attempts} attempts")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run",  action="store_true")
    parser.add_argument("--limit",    type=int,   default=None)
    parser.add_argument("--card-id",  type=str,   default=None)
    args = parser.parse_args()

    db_url  = os.environ.get("DATABASE_URL")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not db_url:
        sys.exit("ERROR: DATABASE_URL not set")
    if not api_key:
        sys.exit("ERROR: OPENAI_API_KEY not set")

    model  = os.environ.get("LLM_MODEL_PROMPT", "gpt-4o-mini")
    client = AsyncOpenAI(api_key=api_key)
    conn   = await asyncpg.connect(db_url)

    if args.card_id:
        rows = await conn.fetch(
            "SELECT id, word, definition, part_of_speech FROM cards WHERE id = $1",
            uuid.UUID(args.card_id),
        )
    else:
        rows = await conn.fetch(
            "SELECT id, word, definition, part_of_speech FROM cards ORDER BY word",
        )

    if args.limit:
        rows = list(rows)[: args.limit]

    total   = len(rows)
    updated = 0
    failed  = 0
    samples_by_pos: dict = {}  # pos -> list of {word, starters}

    print(f"Processing {total} cards  [model={model}, dry_run={args.dry_run}]\n")

    for i, row in enumerate(rows):
        word       = row["word"]
        definition = row["definition"] or ""
        pos        = row["part_of_speech"] or ""

        try:
            starters = await generate_starters(client, word, definition, pos, model)

            key = pos or "unknown"
            if key not in samples_by_pos or len(samples_by_pos[key]) < 3:
                samples_by_pos.setdefault(key, []).append({"word": word, "starters": starters})

            if not args.dry_run:
                await conn.execute(
                    "UPDATE cards SET starter_templates = $1::jsonb WHERE id = $2",
                    json.dumps(starters),
                    row["id"],
                )
            print(f"  [{i+1:3d}/{total}] {word:20s} ({pos}) OK")
            updated += 1

        except Exception as exc:
            print(f"  [{i+1:3d}/{total}] {word:20s} FAILED: {exc}")
            failed += 1

        # Gentle throttle: 1 s pause every 10 cards to avoid rate-limit bursts
        if (i + 1) % 10 == 0:
            await asyncio.sleep(1)

    await conn.close()

    flag = "DRY RUN - " if args.dry_run else ""
    print(f"\n{flag}Done: {updated} updated, {failed} failed\n")

    # -- Sample output by part of speech -----------------------------
    print("-- Sample starters by part of speech -------------------")
    for pos_key, entries in sorted(samples_by_pos.items()):
        print(f"\n  [{pos_key}]")
        for entry in entries:
            print(f"    {entry['word']}:")
            for st in entry["starters"]:
                print(f"      - {st}")
    print()


asyncio.run(main())
