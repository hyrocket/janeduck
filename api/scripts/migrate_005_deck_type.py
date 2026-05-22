"""
Migration 005 — deck_type / library 구조 전환

1. decks에 deck_type, is_default 컬럼 추가
2. 기존 null-owner 덱 → library 덱으로 전환 (SYSTEM_OWNER_ID, is_default=true, "(test)" 제거)
3. user_cards가 있는 각 user_id마다:
   - library 덱 복사본(user 덱) 생성 (새 deck_id)
   - 카드 전체 복사 (새 card_id)
   - user_cards.card_id를 새 card_id로 UPDATE
"""
import asyncio, asyncpg, os, uuid, sys
from pathlib import Path
from dotenv import load_dotenv

sys.stdout.reconfigure(encoding="utf-8")

load_dotenv(Path(__file__).parent.parent.parent / ".env.local", override=False)

SYSTEM_OWNER_ID = "00000000-0000-0000-0000-000000000001"


async def run():
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])

    async with conn.transaction():
        # ── 1. 컬럼 추가 ────────────────────────────────────────────────────
        await conn.execute("""
            ALTER TABLE decks
              ADD COLUMN IF NOT EXISTS deck_type TEXT
                NOT NULL DEFAULT 'user'
                CHECK (deck_type IN ('library', 'user')),
              ADD COLUMN IF NOT EXISTS is_default BOOLEAN
                NOT NULL DEFAULT false
        """)
        print("✓ 컬럼 추가 완료")

        # ── 2. 기존 null-owner 덱 → library 전환 ────────────────────────────
        updated = await conn.execute("""
            UPDATE decks SET
              deck_type = 'library',
              owner_id  = $1,
              is_default = true,
              name = REPLACE(name, ' (test)', '')
            WHERE owner_id IS NULL
        """, uuid.UUID(SYSTEM_OWNER_ID))
        print(f"✓ library 전환: {updated}")

        # ── 3. library 덱 목록 ───────────────────────────────────────────────
        lib_decks = await conn.fetch("SELECT * FROM decks WHERE deck_type = 'library'")
        print(f"✓ library 덱 {len(lib_decks)}개")

        for lib_deck in lib_decks:
            lib_deck_id = lib_deck["id"]

            # 해당 library 덱의 카드 전체
            lib_cards = await conn.fetch(
                "SELECT * FROM cards WHERE deck_id = $1 ORDER BY order_in_deck",
                lib_deck_id,
            )
            if not lib_cards:
                print(f"  [{lib_deck['name']}] 카드 없음 — skip")
                continue

            old_card_ids = [c["id"] for c in lib_cards]

            # user_cards가 있는 user_id 목록
            user_rows = await conn.fetch("""
                SELECT DISTINCT user_id FROM user_cards
                WHERE card_id = ANY($1::uuid[])
            """, old_card_ids)

            print(f"  [{lib_deck['name']}] 카드 {len(lib_cards)}개 / 유저 {len(user_rows)}명")

            for ur in user_rows:
                user_id = ur["user_id"]

                # 3-a. 새 user 덱 생성
                new_deck_id = uuid.uuid4()
                await conn.execute("""
                    INSERT INTO decks
                      (id, name, description, level, card_count, source,
                       owner_id, deck_type, is_default, is_public, created_at, updated_at)
                    SELECT $1, name, description, level, card_count, source,
                           $2, 'user', false, false, NOW(), NOW()
                    FROM decks WHERE id = $3
                """, new_deck_id, user_id, lib_deck_id)

                # 3-b. 카드 복사 + old→new card_id 매핑
                card_id_map: dict[uuid.UUID, uuid.UUID] = {}
                for card in lib_cards:
                    new_card_id = uuid.uuid4()
                    card_id_map[card["id"]] = new_card_id
                    await conn.execute("""
                        INSERT INTO cards
                          (id, deck_id, word, definition, part_of_speech, pronunciation,
                           collocations, example_sentences, starter_templates, topic_hints,
                           translations, level, difficulty_band, tags,
                           order_in_deck, source, source_id, created_at)
                        SELECT $1, $2, word, definition, part_of_speech, pronunciation,
                               collocations, example_sentences, starter_templates, topic_hints,
                               translations, level, difficulty_band, tags,
                               order_in_deck, source, source_id, NOW()
                        FROM cards WHERE id = $3
                    """, new_card_id, new_deck_id, card["id"])

                # 3-c. user_cards card_id 업데이트
                for old_id, new_id in card_id_map.items():
                    await conn.execute("""
                        UPDATE user_cards SET card_id = $1
                        WHERE user_id = $2 AND card_id = $3
                    """, new_id, user_id, old_id)

                print(f"    user={str(user_id)[:8]}... → deck={str(new_deck_id)[:8]}... 카드 {len(card_id_map)}개 이전")

        # ── 4. 결과 확인 ─────────────────────────────────────────────────────
        print("\n=== 최종 decks ===")
        all_decks = await conn.fetch(
            "SELECT deck_type, name, owner_id FROM decks ORDER BY deck_type, name"
        )
        for d in all_decks:
            print(f"  [{d['deck_type']:7}] {d['name']:40} owner={str(d['owner_id'])[:8]}...")

        uc_count = await conn.fetchval("SELECT COUNT(*) FROM user_cards")
        print(f"\nuser_cards 총 {uc_count}행 (삭제 없음)")

    print("\n✅ Migration 005 완료")


asyncio.run(run())
