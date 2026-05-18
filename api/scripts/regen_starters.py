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
  python scripts/regen_starters.py --deck-name "Sec 1 Essentials (test)"
  python scripts/regen_starters.py --deck-name "Sec 1 Essentials (test)" --words describe,suggest,curious

Options:
  --dry-run           Print starters without writing to DB
  --limit N           Process only first N cards (for testing)
  --card-id UUID      Process only one specific card
  --deck-name NAME    Process only cards in this deck (exact name match)
  --words w1,w2,...   Process only these specific words (comma-separated, requires --deck-name)
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
  The TARGET WORD must appear in the MAIN CLAUSE of the sentence — already filled in.
  NEVER put the target word in the blank or omit it from the sentence.
  NEVER start a sentence with the target word itself.

Format rules:
1. Subject = person (I / She / He / My friend / We / etc.) — ALWAYS.
2. Target word appears in the MAIN CLAUSE as something the person did, felt, or showed.
3. Blank ___ is at the SITUATION/CONTEXT position — after: when, after, because, \
since, so that, until, while, as, if.
4. The blank must require a PHRASE or CLAUSE — a student cannot fill it with \
a single word.
5. The blank must come at the END of the sentence (after the connector). \
NEVER split the blank mid-sentence or put words after ___.
6. Sentences should feel natural and relatable to Singapore teens \
(school, friends, family, exams, daily life).
7. Keep language simple enough for a 13-year-old.
8. Vary the subject and connector across the 3 starters.

SPECIAL RULE for ADVERB target words (carefully, suddenly, etc.):
  The adverb must appear in the MAIN CLAUSE modifying the verb.
  Pattern: "[Subject] [verb] [adverb] when/after/because ___."
  GOOD: "She suddenly stopped when ___."
  GOOD: "I read the questions carefully because ___."
  BAD: "Suddenly, my friend ___." (adverb at start, no blank context)
  BAD: "I felt surprised when ___ suddenly." (adverb after blank)

FORBIDDEN patterns (never generate these):
  "[Word] is important because ___."
  "[Word] helps us when ___."
  "[Word] can be difficult after ___."
  "[Word] became a problem because ___."
  Any sentence where the target word itself is the grammatical subject.
  Any sentence where words appear AFTER the ___ blank.

GOOD examples by part of speech:
  verb      -> "My friend tried to describe the scene after ___."
  verb      -> "She suggested a new plan because ___."
  noun      -> "I showed great effort when ___."
  noun      -> "She used the opportunity to improve after ___."
  adjective -> "He felt curious when ___."
  adjective -> "I was confident because ___."
  adverb    -> "She suddenly stopped talking when ___."
  adverb    -> "I carefully checked my work after ___."

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
        if not all("___" in s for s in starters):
            continue

        # All 3 must contain the target word (case-insensitive)
        word_lower = word.lower()
        if not all(word_lower in s.lower() for s in starters):
            bad = [s for s in starters if word_lower not in s.lower()]
            print(f"    [retry] word '{word}' missing from: {bad}")
            continue

        return starters

    raise ValueError(f"could not generate valid starters with ___ after {max_attempts} attempts")


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run",   action="store_true")
    parser.add_argument("--limit",     type=int, default=None)
    parser.add_argument("--card-id",   type=str, default=None)
    parser.add_argument("--deck-name", type=str, default=None,
                        help="Exact deck name — only cards in this deck are processed")
    parser.add_argument("--words",     type=str, default=None,
                        help="Comma-separated word list (requires --deck-name)")
    args = parser.parse_args()

    db_url  = os.environ.get("DATABASE_URL")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not db_url:
        sys.exit("ERROR: DATABASE_URL not set")
    if not api_key:
        sys.exit("ERROR: OPENAI_API_KEY not set")

    if args.words and not args.deck_name:
        sys.exit("ERROR: --words requires --deck-name")

    model  = os.environ.get("LLM_MODEL_PROMPT", "gpt-4o-mini")
    client = AsyncOpenAI(api_key=api_key)
    conn   = await asyncpg.connect(db_url)

    if args.card_id:
        rows = await conn.fetch(
            "SELECT c.id, c.word, c.definition, c.part_of_speech "
            "FROM cards c WHERE c.id = $1",
            uuid.UUID(args.card_id),
        )
    elif args.deck_name:
        # Verify the deck exists before proceeding
        deck = await conn.fetchrow("SELECT id, name FROM decks WHERE name = $1", args.deck_name)
        if not deck:
            sys.exit(f"ERROR: deck '{args.deck_name}' not found in DB")
        print(f"Target deck: \"{deck['name']}\" (id: {deck['id']})")

        if args.words:
            word_list = [w.strip().lower() for w in args.words.split(",") if w.strip()]
            rows = await conn.fetch(
                "SELECT c.id, c.word, c.definition, c.part_of_speech "
                "FROM cards c "
                "JOIN decks d ON c.deck_id = d.id "
                "WHERE d.name = $1 AND LOWER(c.word) = ANY($2::text[]) "
                "ORDER BY c.word",
                args.deck_name, word_list,
            )
        else:
            rows = await conn.fetch(
                "SELECT c.id, c.word, c.definition, c.part_of_speech "
                "FROM cards c "
                "JOIN decks d ON c.deck_id = d.id "
                "WHERE d.name = $1 "
                "ORDER BY c.word",
                args.deck_name,
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
