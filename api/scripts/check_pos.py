import asyncio, os, sys, uuid
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env.local", override=False)
load_dotenv(Path(__file__).parent.parent.parent / ".env", override=False)
import asyncpg

async def main():
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    rows = await conn.fetch(
        "SELECT part_of_speech, COUNT(*) FROM cards GROUP BY part_of_speech ORDER BY count DESC"
    )
    print("part_of_speech breakdown:")
    for r in rows:
        print(f"  {r['part_of_speech'] or 'NULL':20s}  {r['count']}")
    adj_rows = await conn.fetch(
        "SELECT id, word FROM cards WHERE part_of_speech ILIKE '%adj%' LIMIT 3"
    )
    verb_rows = await conn.fetch(
        "SELECT id, word FROM cards WHERE part_of_speech ILIKE '%verb%' LIMIT 3"
    )
    print(f"\nSample adjectives: {[r['word'] for r in adj_rows]}")
    print(f"Sample verbs:      {[r['word'] for r in verb_rows]}")
    if adj_rows:
        print(f"Adj card-id for test: {adj_rows[0]['id']}")
    if verb_rows:
        print(f"Verb card-id for test: {verb_rows[0]['id']}")
    await conn.close()

asyncio.run(main())
