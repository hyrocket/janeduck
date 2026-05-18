# JaneDuck 업무일지 — 2026-05-18 (오후 세션)

## 주요 진행

### Quick Review 헤더 추가

- 기존: deckName + "1/20" 단순 텍스트 헤더
- 변경: Writing Mode와 동일한 sticky 헤더 구조로 통일
  - 좌: ← 뒤로가기 (`/decks` 이동)
  - 중: 덱 이름(bold) + `1 / 20` 진행도 (작은 회색)
  - 우: 게스트 → 노란색 `Sign in` 링크 / 로그인 → `Sign out` 버튼
- "Sign in to save progress" 반복 텍스트 제거 (헤더가 대체)

### logo-small.png 교체

- `/decks`, `/login` 헤더의 🦆 이모지 → `logo-small.png` 이미지로 교체
- 원본 128×128 → 표시 36×36 (텍스트 옆 인라인)

### /decks 덱 카드 진행 바 추가

- 로그인 시: `studied / card_count` 비율로 진행 바 + `🎖️ N mastered` 텍스트
  - 진행 바: user_cards 행 수 / 전체 카드 수 (한 번이라도 손댄 카드 기준)
  - mastered: mastery_level = 5인 카드 수 (Writing Mode 기준)
  - mastered > 0일 때만 🎖️ 표시
- 게스트: `N words` 텍스트만
- 집계 쿼리: `COUNT(*) studied + SUM(mastery_level=5) mastered` — decks 쿼리와 Promise.all 병렬 실행
- 진행 텍스트 색상: `text-gray-300` → `text-gray-500` (가독성 개선)

### Writing Mode 안내 문구 톤 수정

- `"Complete this sentence:"` → `"Let's finish this sentence:"` (권유형)
- `"Fill in the blank with a phrase or clause."` → `"Add a phrase to the blank — make it yours."` (친근한 격려)

### Writing Mode scaffold 라벨 항상 표시

- 기존: `is_master_challenge`일 때만 모드 라벨 표시
- 변경: 모든 prompt bubble에 항상 표시, 로켓 수로 난이도 구분
  - high → `🚀 Guided Writing`
  - medium → `🚀🚀 Practice Writing`
  - low → `🚀🚀🚀 Extended Writing`

### Quick Review 카드 네비게이션 개선

- 기존: 하단 회색 "← prev / next →" 텍스트 버튼
- 변경: 카드 좌우 양옆 원형 화살표 버튼 (w-10 h-10, 흰 배경 + 그림자)
  - 호버: 노란색 전환 + scale-110
  - 비활성: opacity-20
- Write 버튼 강조:
  - 텍스트: `✏️ Write` → `✏️ Write it!`
  - 노란 solid pill 버튼 + pulse glow 애니메이션 (2초 주기)
  - 호버: scale-105 + shadow 강화

### 화면 전환 애니메이션 + 레이아웃 통일

- 카드 → 작문 슬라이드업 / 작문 → 카드 슬라이드다운 속도: `0.35s` → `0.5s`
- `router.back()` 타이머도 `350ms` → `500ms` 동기화
- Writing Mode 레이아웃을 Quick Review와 통일:
  - `writing/page.tsx`에 `max-w-lg mx-auto` 래퍼 추가
  - `WritingClient` 배경 `bg-gray-50` → `bg-yellow-50`
  - `WritingClient` 루트 `h-screen` → `h-full` (래퍼가 높이 관리)

### GitHub public 전환 보안 점검

- 코드 하드코딩 비밀값: 없음 (전부 `process.env.*` 참조)
- git 추적 파일: `.env`, `.env.local`, `vercel-env.txt` 없음
- git 히스토리 전체 스캔 (`postgresql://`, `neon.tech`, `sk-proj`, `AUTH_SECRET=` 등): 히트 없음
- **결론: public 전환 안전** ✅

### README.md 전면 재작성 (영문)

- 기존: create-next-app 기본 템플릿
- 변경: 프로젝트 소개, 두 모드 설명, scaffold 표, 기술 스택, 로컬 실행 가이드, 폴더 구조, 설계 노트

---

## 추가 세션 (2026-05-18 저녁)

### UI 정리 — 완료 확인

- 항목 3 (카드↔작문 폭 통일): 이미 `max-w-lg` 동일 → 추가 작업 없음
- 항목 4 (슬라이드 애니메이션): `animate-slide-up-enter` / `animate-slide-down-exit` 이미 구현됨
- 항목 5 (SRS 재검토): `lib/srs/update.ts` SRS_SPEC.md 기반으로 이미 재작성·커밋됨

### /starred 헤더 개선

- JaneDuck 로고 헤더(상단) + `← Starred Words / N words` 섹션(하단) 두 층 구조로 확정
- 기존 인라인 헤더 → decks 페이지와 동일한 스타일로 통일

### 화살표 SVG chevron 통일

- `←` 텍스트: starred, WritingClient "Back to cards" → SVG chevron left
- `→` 텍스트: "Go to decks", "Try without signing in", "Next Challenge", "Next Word" → SVG chevron right (ActionButton에 trailing chevron 컴포넌트 추가)
- 유지: `Level {from} → {to}` (레벨 변화 표시), `→ {w}` weakness 뱃지 (불릿 역할)

### JaneDuck 로고 홈 링크

- /decks, /starred 상단 JaneDuck 로고 → `<Link href="/">` 래핑

### Sec 1 Essentials (test) 덱 추가

- 60개 단어 (동사 20 / 형용사 20 / 부사 12 / 명사 8), Sec 1 수준 필수 어휘
- `data/deck_sec1_essentials.json` 생성 → `seed_deck.ts` 시드 → `enrich_cards.ts` starter_templates + topic_hints 60/60 생성
- DB deck id: `7872d5d1-fdab-408e-8d6a-2090350aea4e`
- Writing Mode (Guided/Practice/Challenge) 즉시 작동

### Quick Review 카드 앞면 mastery dots 추가

- Write it! 버튼 바로 위에 🎖️ × 5 표시 (획득/미획득 opacity 구분)
- 로그인 상태에서만 표시 (`isAuthed` 조건)
- 낮은 mastery → Write it! 로 시선 자연스럽게 유도하는 흐름

---

## 남은 작업 (Phase 4~5)

- [ ] 대시보드 (학습 진도)
- [ ] 세션 시작 화면 (Deck/모드 선택)
- [ ] PWA 설정 (manifest, service worker)
- [ ] 모바일/태블릿 반응형 UI
- [ ] 실제 사용자 테스트

---

## 주요 결정사항

| 항목 | 결정 | 이유 |
|---|---|---|
| 진행 바 분모 | studied(손댄 카드) / card_count(전체) | mastered/studied는 분모 흔들려 오해 소지 |
| mastered 기준 | mastery_level = 5 (Writing Mode 전용) | 자가평가는 mastery에 영향 없음 |
| Write 버튼 | pulse glow + "Write it!" | 중학생 타깃 — 부담 없이 행동 유도 |
| 화면 전환 | CSS transform 슬라이드 0.5s, 제스처 없음 | 채팅 스크롤과 스와이프 충돌 방지 |
