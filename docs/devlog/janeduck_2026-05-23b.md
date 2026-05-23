# JaneDuck 업무일지 — 2026-05-23 (2회차)

## 주요 진행

### 사용자 단어장 편집 기능 (카드 추가/수정/삭제)

#### 설계 결정

- **필수값:** word, definition
- **부가값:** part_of_speech, pronunciation, example_sentences, collocations, starter_templates, topic_hints
  - 직접 입력 또는 AI 생성 버튼 (재생성 가능)
- **카드 수정 시 학습기록 처리 (하이브리드 정책):**
  - word 또는 definition 변경 → 새 card_id 생성, CASCADE로 user_cards + writing_attempts 자동 삭제 (기록 초기화)
  - 메타데이터만 변경 → 제자리 UPDATE, 학습기록 유지
  - 이유: 단어 정체성이 바뀌면 기존 마스터리 기록이 무의미해짐; 발음 수정 등 사소한 편집에서 기록이 날아가면 UX 손상
- **편집 권한:** user 덱 전체 (library에서 복사된 카드 포함)

#### 신규 파일

| 파일 | 역할 |
|---|---|
| `app/api/cards/[id]/route.ts` | PATCH (하이브리드 수정) + DELETE |
| `app/api/decks/[id]/cards/route.ts` | POST 추가 (기존 GET 유지) |
| `app/api/ai/card-meta/route.ts` | AI 부가값 생성 (pronunciation, example_sentences, collocations, starter_templates, topic_hints) |
| `components/cards/CardEditSheet.tsx` | 카드 추가/수정 바텀 시트 |

#### 수정 파일

- `app/(learn)/deck/[deckId]/page.tsx` — deck_type, owner_id 조회 → isOwner 계산
- `app/(learn)/deck/[deckId]/DeckDetailClient.tsx` — isOwner prop 추가, 카드 편집 UI

---

### 덱 상세 페이지 UX 개편

#### 편집 모드 (Edit Mode)

- 헤더 우상단 연필 아이콘 — 탭하면 편집 모드 ON/OFF (노란 배경으로 활성 표시)
- **편집 모드 OFF (기본):** 카드 탭 → Quick Review 이동
- **편집 모드 ON:**
  - 덱 제목/설명 옆 작은 연필 아이콘 노출 → 탭하면 DeckInfoEditSheet 열림
  - 각 카드 row 우측에 [수정] 버튼 항상 표시 (hover 아님 → 모바일 친화)
- 헤더 좌측 카드 모양 + 아이콘 → 편집 모드 없이 빠른 카드 추가

#### 신규 컴포넌트

| 파일 | 역할 |
|---|---|
| `components/cards/DeckInfoEditSheet.tsx` | 덱 이름/설명 수정 시트 |

#### 덱 이름 중복 체크

- `PATCH /api/decks/[id]` — 같은 owner의 user 덱 중 동일 이름 있으면 409 반환

---

### 덱 아이콘 기능 (Migration 006)

#### DB 변경

- `decks.icon TEXT` 컬럼 추가 (nullable)
- Migration 006 Python 스크립트로 적용

#### 기능

- 덱 상세 헤더 좌측에 48×48 아이콘 박스 표시
  - null → 레벨별 그라디언트 + 기본 이모지
  - 이모지 문자 → 그라디언트 배경 + 이모지
  - data URI → 이미지 표시
- 오너만 아이콘 탭 가능 → DeckIconPicker 시트 열림
  - 이모지 16개 그리드 선택
  - 이미지 업로드 → Canvas로 80×80 center-crop + JPEG base64 변환 → DB 저장
  - Reset → null 복원 (기본값으로)
- 덱 목록 페이지에도 동일하게 반영

#### 신규 컴포넌트

| 파일 | 역할 |
|---|---|
| `components/cards/DeckIconPicker.tsx` | 이모지 선택 + 이미지 업로드 피커 |
| `api/scripts/migrate_006_deck_icon.py` | Migration 006 |

---

### Quick Review 백 버튼 수정

- 카드 학습 후 뒤로 가기 → `/decks` (전체 목록) → `/deck/${deckId}` (덱 상세)로 변경
- `app/(learn)/quick-review/page.tsx` — `backHref` prop에 deckId 포함

---

### 덱 목록 UX 개선

- My Decks 하단에 "Add deck from Library" 점선 버튼 추가 → 탭하면 `/library`
- `app/decks/page.tsx` — DeckCover에 icon prop 전달, 덱 목록 SQL에 icon 컬럼 추가

---

### 헤더 레이아웃 정렬 개선

- 덱 상세 헤더: `items-start` + 중첩 flex 구조로 변경
  - 아이콘 오른쪽에 제목·설명·진행도가 세로 정렬
  - `pl-16` 하드코딩 방식 제거

---

## 커밋 목록 (예정)

- `feat: card add/edit/delete with hybrid history-reset policy`
- `feat: deck edit mode, deck info edit, deck icon picker`
- `feat: quick review back to deck detail, add-from-library CTA`
