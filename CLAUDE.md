# JaneDuck — CLAUDE.md

> Claude Code 작업용 문서. **"어떻게 일하는가(HOW)"**만 담는다.
> 학습 로직·모드·신호·scaffold·DB 스키마 등 **"무엇이 어떻게 동작하는가(WHAT)"는 `DESIGN_DECISIONS.md`가 단일 출처(single source of truth)**다.
> 두 문서가 어긋나면 `DESIGN_DECISIONS.md`를 따른다.

---

## 프로젝트 한 줄 정의

싱가포르 중학생을 위한 **AI Micro Writing Coach** — 단어를 익히고 짧은 문장으로 직접 써보며 AI 피드백을 받는 매일의 학습 도구.

핵심 차별점: 평가가 자가평가가 아니라 **실제 작문**에서 일어난다. (상세 — `DESIGN_DECISIONS.md`)

---

## 동작 명세 — DESIGN_DECISIONS.md 참조

아래 주제는 **전부 `DESIGN_DECISIONS.md`에 정의**돼 있다. CLAUDE.md는 이를 중복 서술하지 않는다.

- 학습 모드 구조 / UI 정책 / 세션 정의
- 세 가지 학습 신호 (Score / Self-eval / Mastery)
- Scaffold (high/medium/low) 정의 및 결정 룰
- 재작문 / 마스터 챌린지 정책
- Writing Mode LangGraph 워크플로우
- evaluate_writing 출력 스키마 / suggested_actions 룰
- JaneDuck 페르소나
- 판단 모듈 모듈화 / LLM 공급자 추상화
- **DB 스키마 (5개 테이블)**

구현 전 해당 명세를 확인할 것. `DESIGN_DECISIONS.md`의 **Open Questions** 항목은 임의 구현하지 말고 질문할 것.

---

## 기술 스택

```yaml
Frontend: Next.js 14 (App Router) + TypeScript + Tailwind CSS
  Deploy: Vercel Pro

Backend: FastAPI + LangGraph (Python)
  Deploy: Vercel Python Functions (/api/python/)

Database: Neon PostgreSQL (Pooled, Vercel 통합)

Auth: NextAuth.js v5 + Google OAuth
  - MoniBee 프로젝트 코드 재사용

LLM: 설정 기반 추상화 — 공급자·모델은 호출 지점별 교체 가능 (정책: DESIGN_DECISIONS.md §11-1)
  - MVP 기본값: OpenAI gpt-4o-mini (보유 API 키)
  - 호출 지점별 모델 설정: LLM_MODEL_EVALUATE / LLM_MODEL_EXPLAIN / LLM_MODEL_CARD_META

Domain: Cloudflare DNS
```

**MoniBee 프로젝트와 동일 인프라.** 새로 배울 것 없음.

---

## 코드 작성 원칙

### 모바일/태블릿 우선
- 태블릿이 메인 학습 디바이스, 모바일 보조, 데스크탑은 확장.
- Tailwind는 모바일 기본부터 단계적 확장 (`p-4 md:p-8`). 브레이크포인트: sm 640 / md 768 / lg 1024.
- 터치 인터랙션 우선 (탭·스와이프). 호버는 보조.
- 중학교 여학생 + JaneDuck 테마에 맞는 노란색 컬러 테마.

### 로직 분리 / 모듈화
- SRS 로직, 판단 모듈(MasteryUpdater / ScaffoldDecider / ActionSuggester)은 **인터페이스 뒤에 두고 순수 함수로**. DB 호출과 분리. (모듈화 상세: `DESIGN_DECISIONS.md` §11)
  - SRS는 mastery 기반 노출 우선순위 모델 (§4-4) — 전통 SM-2 아님. `review_priority` 계산식·큐 비율은 `SRS_SPEC.md`에 정의됨, 그 명세를 따를 것. SM-2 필드(state enum, ease_factor, interval_days 등) 생성 금지.
- LLM 호출은 단일 LLM 클라이언트 추상을 거친다. 특정 공급자 SDK 직접 호출 금지.
- AI 평가 흐름은 LangGraph 워크플로우로 구조화 (Writing Mode에 한함 — 카드 흐름은 일반 FastAPI 엔드포인트).

### 데이터 무결성
- `user_cards` 업데이트(mastery + SRS + 카운트)는 한 트랜잭션으로. 실패 시 롤백.
- 값 범위·enum은 `DESIGN_DECISIONS.md` 스키마 명세를 따른다.

---

## 개발 우선순위 (1주 MVP)

### Phase 0 — 셋업 (Day 1)
1. Next.js 프로젝트 초기화 (Vercel 연결)
2. Neon PostgreSQL 연결
3. DB 마이그레이션 (스키마 — `DESIGN_DECISIONS.md` §12)
4. NextAuth + Google OAuth
5. LLM API 키 등록 (MVP 기본: OpenAI)
6. **Vercel Python Functions 배포 테스트** (`/api/python/health`)
   - 의존성: langgraph + langchain + fastapi + mangum
   - Vercel 500MB 번들 한도 검증
   - 검증 실패 시 대안: (A) 의존성 슬림화 — SDK 직접 호출 / (B) Railway·Render 분리 호스팅 / (C) StateGraph 최소 구현

### Phase 1 — 데이터 준비 (Day 2)
1. Sec 1 단어 50개 큐레이션 (Quizlet / Cambridge VP)
2. 단어 메타데이터 + starter_templates AI 생성 + 검수
3. 시스템 Deck 2개 시드 데이터

### Phase 2 — Quick Review 구현 (Day 3)
1. 카드 컴포넌트 (앞면/뒷면)
2. 스와이프 제스처 (좌우: 카드 이동 / 위: Writing Mode / 아래: 패널)
3. 카드 선정 알고리즘 (카드 큐 생성)
4. 자가평가 → SRS 업데이트
5. 히스토리/통계 패널

### Phase 3 — Writing Mode 구현 (Day 4~5)
1. Writing Mode 페이지 (메신저 UI, scaffold별 화면)
2. scaffold 결정 로직 (`DESIGN_DECISIONS.md` §5)
3. LangGraph 워크플로우 (FastAPI + Vercel Python Functions)
4. evaluate_writing + suggested_actions
5. writing_attempts 기록

### Phase 4 — 마무리 (Day 6)
1. Mastery 통합
2. 대시보드 (학습 진도)
3. 세션 시작 화면 (Deck/모드 선택)
4. PWA 설정 (manifest, service worker)
5. 모바일/태블릿 UI 폴리시

### Phase 5 — 검증 (Day 7)
실제 사용자 테스트 / 버그 수정 / UI 미세 조정

---

## 폴더 구조 (제안)

```
janeduck/
├── app/                    # Next.js App Router
│   ├── (auth)/             # login, api/auth/[...nextauth]
│   ├── (learn)/            # deck/[deckId], quick-review, writing
│   ├── dashboard/
│   └── api/                # cards, sessions, srs
├── api/                    # FastAPI + LangGraph (Python)
│   ├── index.py
│   ├── workflows/          # evaluate_writing 등
│   ├── models/
│   └── requirements.txt
├── lib/
│   ├── srs/                # update.ts, queue.ts (순수 함수)
│   ├── db/                 # schema.sql
│   └── ai/                 # prompts, LLM 클라이언트 추상
├── components/             # Card/, Writing/, ui/
├── data/                   # 시드 데이터 (deck JSON)
├── CLAUDE.md
├── DESIGN_DECISIONS.md
└── SRS_SPEC.md
```

---

## Sub-Agent 활용

병렬화 가능 시점:
- Phase 1: 단어 큐레이션 ∥ DB 마이그레이션
- Phase 2~3: Quick Review ∥ Writing Mode (별도 worktree)
- Phase 4: 대시보드 ∥ 통계

**메인 Claude Code 역할:** 작업 분할 / sub-agent에 컨텍스트·범위·완료기준 전달 / 결과 통합·머지·충돌 해결.

**병렬 작업 전 메인에서 확정할 공유 자원:** DB 스키마, SRS·판단 모듈 로직, 공통 타입, 환경 변수, 의존성. 이후 sub-agent는 비즈니스 로직만.

---

## 참고

### MoniBee 프로젝트 (동일 인프라)
- 위치: `D:\dev_projects\002_monibee`
- 재사용: Vercel 배포 설정, NextAuth Google OAuth, Neon DB 연결 패턴

---

*WHAT(동작 명세)은 DESIGN_DECISIONS.md. CLAUDE.md는 HOW만 유지한다.*
