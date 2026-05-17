"""
Test idempotency: same attempt_id -> ON CONFLICT DO NOTHING.
Calls save_attempt_and_mastery twice with the same attempt_id.
writing_attempts count should not increase on second call.
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
from workflows.db import save_attempt_and_mastery

ATTEMPT_ID = "bbbbbbbb-0000-0000-0000-000000000002"
CARD_ID    = "041bb82e-7d10-4290-93da-cc14238cf8e8"
USER_ID    = "d962d19d-960d-4925-ba1d-22c4bc04ec56"


async def main():
    url = os.environ.get("DATABASE_URL")
    conn = await asyncpg.connect(url)

    count_before = await conn.fetchval(
        "SELECT COUNT(*) FROM writing_attempts WHERE id = $1",
        asyncpg.pgproto.pgproto.UUID(ATTEMPT_ID)
    )
    print(f"Count before: {count_before}")

    kwargs = dict(
        attempt_id=ATTEMPT_ID, user_id=USER_ID, card_id=CARD_ID,
        session_id=None, scaffold_used="high", is_master_challenge=False,
        reference_starter="Test starter", topic_used=None, structure_guide_used=None,
        user_text="Idempotency test sentence.", ai_score=7, ai_feedback="Good try!",
        ai_strengths=["clear"], ai_weakness_signals=[], writing_rating="good",
        target_word_used=True, target_word_correctly=True,
        attempt_number=2, new_mastery=1, new_scaffold="high",
    )

    await save_attempt_and_mastery(**kwargs)
    count_after_first = await conn.fetchval(
        "SELECT COUNT(*) FROM writing_attempts WHERE id = $1",
        asyncpg.pgproto.pgproto.UUID(ATTEMPT_ID)
    )
    print(f"Count after 1st call: {count_after_first}")

    await save_attempt_and_mastery(**kwargs)
    count_after_second = await conn.fetchval(
        "SELECT COUNT(*) FROM writing_attempts WHERE id = $1",
        asyncpg.pgproto.pgproto.UUID(ATTEMPT_ID)
    )
    print(f"Count after 2nd call (must still be 1): {count_after_second}")

    if count_after_first == 1 and count_after_second == 1:
        print("PASS: idempotent insert confirmed")
    else:
        print("FAIL: duplicate row detected")

    await conn.close()


asyncio.run(main())
