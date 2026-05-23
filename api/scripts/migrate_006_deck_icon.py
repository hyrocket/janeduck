"""Migration 006 — decks.icon 컬럼 추가"""
import asyncio, asyncpg, os, sys
from pathlib import Path
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding="utf-8")
load_dotenv(Path(__file__).parent.parent.parent / ".env.local", override=False)

async def run():
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])
    async with conn.transaction():
        await conn.execute("""
            ALTER TABLE decks ADD COLUMN IF NOT EXISTS icon TEXT;
        """)
        print("Migration 006 완료: decks.icon 컬럼 추가됨")
    await conn.close()

asyncio.run(run())
