# JaneDuck 업무일지 — 2026-05-17 (오후 세션)

## 주요 진행

### 작업 2 완료 — starter_templates / topic_hints 배치 생성

- `scripts/enrich_cards.ts` 신규 작성 (OpenAI gpt-4o-mini, 병렬 배치 5장씩)
- Neon DB 직삽 완료: **99/99 성공, 0 실패**
- `package.json`에 `db:enrich` 스크립트 추가

### 작업 3 완료 — Quick Review UI (Mode 1)

구현 파일:
| 파일 | 역할 |
|---|---|
| `lib/srs/update.ts` | SM-2 기반 SRS 업데이트 로직 (pure function) |
| `app/api/decks/route.ts` | GET 덱 목록 |
| `app/api/decks/[id]/cards/route.ts` | GET 카드 + 사용자 학습 상태 (큐 조합 포함) |
| `app/api/cards/[id]/self-eval/route.ts` | POST 자가평가 → SRS 갱신 |
| `components/Card/FlashCard.tsx` | 탭 flip + 좌우/위 스와이프 제스처 |
| `components/Card/CardFront.tsx` | 앞면: word + POS |
| `components/Card/CardBack.tsx` | 뒷면: word + definition + example_sentences (collocations 제외) |
| `components/Card/SelfEvalButtons.tsx` | 4단계 자가평가 버튼 |
| `app/(learn)/quick-review/QuickReviewClient.tsx` | 클라이언트 상태 관리 + 렌더링 |
| `app/(learn)/quick-review/page.tsx` | 서버 컴포넌트 (DB 조회 + 큐 생성) |
| `app/page.tsx` | 홈 → 덱 선택 화면으로 교체 |

**동작 확인:** 빌드 통과, 덱 목록 렌더링, 카드 20장 로딩 정상.

**카드 뒷면 스펙 결정:**
- 노출: word / definition / example_sentences (첫 번째)
- DB 유지 but UI 미노출: collocations (Writing Mode 대화 중 노출 예정)

**내비게이션 구현:**
- 탭: 앞/뒷면 flip
- 좌우 스와이프 (카드 위): 이전/다음 (SRS 무관)
- "← prev" / "next →" 탭 버튼: 클릭 이동
- 위 스와이프: Writing Mode (현재 "coming soon" 토스트)

**로그인 상태:**
- 미로그인: 카드 열람 가능, self-eval 저장 불가 → "Sign in to save progress" 안내
- 로그인 후: self-eval → user_cards INSERT/UPDATE + SRS 갱신

---

## 버그 / 이슈

### .next 빌드 캐시 충돌
- 원인: `npm run build` (프로덕션 빌드)와 `npm run dev` (dev 서버)를 동시에 실행하면서 `.next` 캐시 충돌 발생
- 증상: `layout.css`, `main-app.js` 등 정적 자산 **404**, `Cannot find module './948.js'` 에러
- 해결: `.next` 폴더 삭제 후 `npm run dev` 재시작

### pb-safe 클래스 오류
- `pb-safe`는 Tailwind 표준 클래스가 아님 (safe area inset용 플러그인 클래스)
- `pb-5`로 수정

---

## CLAUDE.md 리뉴얼 확인

Hoon이 CLAUDE.md를 전면 개편함. 핵심 변화:
1. **역할 분리 확립:** CLAUDE.md = HOW(작업 방식), DESIGN_DECISIONS.md = WHAT(동작 명세). 두 문서 충돌 시 DESIGN_DECISIONS.md 우선.
2. **SRS interval 임의 구현 금지:** "SRS interval 알고리즘 상세는 아직 미정 — SRS_SPEC.md(작성 예정) 참조. 그 전까지 interval 로직 임의 구현 금지."
3. **LLM 추상화 강제:** 특정 공급자 SDK 직접 호출 금지. 단일 LLM 클라이언트 추상 경유.

⚠️ **주의:** `lib/srs/update.ts`는 오늘 구 CLAUDE.md 기반으로 구현한 SM-2 interval 로직 포함. SRS_SPEC.md 확정 후 재검토 필요.

---

## 남은 작업

- [ ] `.next` 삭제 후 `npm run dev` 재시작 → UI 정상 확인
- [ ] Google OAuth 설정 완료 → NextAuth 연결
- [ ] SRS_SPEC.md 작성 확정 → lib/srs/update.ts 검토
- [ ] Writing Mode (Phase 3) — Q3/Q4 확정 후 착수
