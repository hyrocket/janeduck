# JaneDuck 업무일지 — 2026-05-17 (저녁 세션)

## 주요 진행

### SRS_SPEC.md 작성 완료 + lib/srs/update.ts 교체

- `SRS_SPEC.md` 신규 작성 — mastery 기반 `review_priority` 계산식 및 큐 비율 정의
  - 전통 SM-2(interval_days, ease_factor, state enum) 완전 폐기
  - mastery 0~5 기반 노출 우선순위 모델 (§4-4)
- `lib/srs/update.ts`: SM-2 interval 로직 → mastery 기반 `review_priority` 계산으로 전면 교체 (`3b2260f`)
- `ref/JaneDuck_SRS_Final.md` 참고 문서 추가

### Decks UI 리디자인

- `/decks` 페이지 전면 개편: 덱 커버 이미지 + starred 버튼 + 덱 설명 (`2b82459`)
- starred 카드 전용 페이지 추가 + /decks 진입점 연결 (`6d8efc2`)
- 로고 추가: `public/logo.png` + 랜딩 페이지 로고/태그라인 업데이트 (`4829431`, `dfdb49c`)
- 카드 슬라이드 애니메이션 개선 + self-eval 하이라이트 + IPA 발음 표기 (`5c6290f`)

### CLAUDE.md / DESIGN_DECISIONS.md 갱신

- CLAUDE.md + DESIGN_DECISIONS.md 내용 최신화 (Writing Mode 섹션, SRS 명세 연동) (`92e22c8`)

### Phase 3 — Writing Mode 백엔드 착수

#### evaluate_writing + ActionSuggester 구현 (`934d3a3`)
- `api/workflows/judgers.py`: `MasteryUpdater`, `ScaffoldDecider`, `ActionSuggester` 구현
- `api/workflows/llm.py`: LLM 클라이언트 추상 (OpenAI gpt-4o-mini / gpt-4.1-mini)
- evaluate_writing: strict JSON schema 출력, writing_rating (again/hard/good/easy)
- ActionSuggester: §8-1 룰 기반 suggested_actions 결정

#### LangGraph 워크플로우 스켈레톤 (`bb55185`)
- `api/workflows/writing_graph.py`: 전체 그래프 노드 stub 정의
- FastAPI 엔드포인트 3개: `/start`, `/submit`, `/action`
- `api/index.py` 구조 확립

#### Writing Mode UI — 메신저 채팅 (`db9765f`)
- `app/(learn)/writing/WritingClient.tsx`: 메신저 UI (intro/prompt/user/feedback 4종 버블)
- 3-endpoint LangGraph 연동 (start → submit → action)

#### 버그 수정
- LangGraph Studio 로드 오류: absolute imports + MemorySaver 제거 (`c2a55d0`)
- `api/index.py` 로컬 uvicorn 절대 경로 임포트 수정 (`a9b63f2`)
- `studio_graph` / `writing_graph` 분리 — checkpointer 유무만 다른 이중 컴파일 (`a97cc09`)

---

## 남은 작업

- [ ] Writing Mode 노드 stub → real 교체 (load_context, evaluate_writing 등 전체)
- [ ] MemorySaver → AsyncPostgresSaver (Neon checkpointer) 전환 — Vercel serverless 필수
- [ ] Vercel 배포 검증 — Python Functions 정상 동작 확인
- [ ] Google OAuth 운영 환경 설정

---

## 주요 결정사항

| 항목 | 결정 | 이유 |
|---|---|---|
| SRS 모델 | SM-2 완전 폐기 → mastery 기반 review_priority | DESIGN_DECISIONS.md §4-4, SRS_SPEC.md 명세 |
| evaluate 모델 | gpt-4.1-mini | gpt-4o-mini 대비 구조화 출력 안정성 우위 |
| LangGraph checkpointer | MemorySaver (임시) → Neon 전환 예정 | Vercel serverless는 in-memory 상태 유지 불가 |
