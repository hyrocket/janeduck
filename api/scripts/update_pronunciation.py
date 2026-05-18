"""
Update cards.pronunciation from a deck JSON file.
Matches cards by (deck_name, word) — only updates rows where pronunciation is NULL or differs.

Usage (run from api/ directory):
  python scripts/update_pronunciation.py ../../data/deck_sec1_essentials.json
  python scripts/update_pronunciation.py ../../data/deck_sec1_essentials.json --dry-run
"""
import argparse
import asyncio
import io
import json
import os
import sys
from pathlib import Path

# Force UTF-8 output on Windows to handle IPA characters
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env.local", override=False)
load_dotenv(Path(__file__).parent.parent.parent / ".env", override=False)

import asyncpg


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("json_file", help="Path to deck JSON file")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        sys.exit("ERROR: DATABASE_URL not set")

    json_path = Path(args.json_file)
    if not json_path.exists():
        sys.exit(f"ERROR: file not found: {json_path}")

    data = json.loads(json_path.read_text(encoding="utf-8"))
    deck_name = data["deck"]["name"]
    cards = data["cards"]

    conn = await asyncpg.connect(db_url)

    deck = await conn.fetchrow("SELECT id FROM decks WHERE name = $1", deck_name)
    if not deck:
        await conn.close()
        sys.exit(f"ERROR: deck '{deck_name}' not found in DB")

    deck_id = deck["id"]
    print(f"Deck: \"{deck_name}\" (id: {deck_id})")
    print(f"Cards in JSON: {len(cards)}")
    print(f"Dry run: {args.dry_run}\n")

    updated = skipped = missing = 0

    for card in cards:
        word = card["word"]
        pronunciation = card.get("pronunciation")
        if not pronunciation:
            print(f"  SKIP  {word:25s} — no pronunciation in JSON")
            skipped += 1
            continue

        row = await conn.fetchrow(
            "SELECT id, pronunciation FROM cards WHERE deck_id = $1 AND LOWER(word) = LOWER($2)",
            deck_id, word,
        )
        if not row:
            print(f"  MISS  {word:25s} — not found in DB")
            missing += 1
            continue

        if row["pronunciation"] == pronunciation:
            skipped += 1
            continue

        if not args.dry_run:
            await conn.execute(
                "UPDATE cards SET pronunciation = $1 WHERE id = $2",
                pronunciation, row["id"],
            )
        print(f"  {'DRY ' if args.dry_run else ''}OK    {word:25s} {pronunciation}")
        updated += 1

    await conn.close()

    flag = "DRY RUN — " if args.dry_run else ""
    print(f"\n{flag}Done: {updated} updated, {skipped} skipped (same/no value), {missing} not found in DB")


asyncio.run(main())
