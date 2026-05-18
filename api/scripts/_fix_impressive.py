import asyncio, asyncpg, json, os, sys
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env.local", override=False)
load_dotenv(Path(__file__).parent.parent.parent / ".env", override=False)

STARTERS = [
    "I thought her science project was impressive when ___.",
    "She found his presentation impressive because ___.",
    "My friend felt the performance was impressive after ___.",
]

async def run():
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    result = await conn.execute(
        """UPDATE cards SET starter_templates = $1::jsonb
           WHERE LOWER(word) = 'impressive'
           AND deck_id = (SELECT id FROM decks WHERE name = 'Sec 1 Essentials (test)')""",
        json.dumps(STARTERS),
    )
    print("Result:", result)
    row = await conn.fetchrow(
        """SELECT word, starter_templates FROM cards
           WHERE LOWER(word) = 'impressive'
           AND deck_id = (SELECT id FROM decks WHERE name = 'Sec 1 Essentials (test)')"""
    )
    if row:
        print("Verified starters for:", row["word"])
        for s in json.loads(row["starter_templates"]):
            print(" -", s)
    await conn.close()

asyncio.run(run())
