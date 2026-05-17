"""
Verify that writing_attempts and user_cards were written after API test.
Run from api/ directory: python scripts/verify_db.py
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env.local", override=False)
load_dotenv(Path(__file__).parent.parent.parent / ".env", override=False)

import asyncpg
import uuid

CARD_ID = "041bb82e-7d10-4290-93da-cc14238cf8e8"
USER_ID = "d962d19d-960d-4925-ba1d-22c4bc04ec56"


async def main():
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("ERROR: DATABASE_URL not set")
        return

    conn = await asyncpg.connect(url)

    print("--- writing_attempts (latest 3) ---")
    rows = await conn.fetch(
        """
        SELECT id, ai_score, writing_rating, scaffold_used, attempt_number,
               reference_starter, user_text, created_at
        FROM writing_attempts
        ORDER BY created_at DESC
        LIMIT 3
        """
    )
    for r in rows:
        print(dict(r))

    print("\n--- user_cards ---")
    uc = await conn.fetchrow(
        """
        SELECT mastery_level, current_scaffold, writing_attempts_count,
               last_writing_score, last_writing_at, recent_scores
        FROM user_cards
        WHERE card_id = $1 AND user_id = $2
        """,
        uuid.UUID(CARD_ID),
        uuid.UUID(USER_ID),
    )
    if uc:
        print(dict(uc))
    else:
        print("No user_cards row found for this (user_id, card_id)")

    await conn.close()


asyncio.run(main())
