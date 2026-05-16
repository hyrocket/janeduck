# JaneDuck - CLAUDE.md

> Claude Code가 이 프로젝트의 전체 컨텍스트를 파악하기 위한 문서입니다.

## 프로젝트 한 줄 정의

**싱가포르 중학생을 위한 AI Micro Writing Coach** — 단어를 익히고 짧은 문장으로 직접 써보며 작문 기초를 빌딩하는 학습 도구.

## 무엇을 하는 도구인가

영어 단어를 학습하고, 그 단어로 짧은 문장을 직접 써보며, AI가 즉시 피드백을 주는 학습 루프를 제공한다. 단어 학습과 작문 훈련이 하나의 흐름으로 이어지는 매일의 학습 도구.

---

## 핵심 철학

### "평가는 작문에서 일어난다"

JaneDuck은 일반 단어 앱과 본질적으로 다르다.

| 일반 SRS 단어 앱 (Anki, Quizlet) | JaneDuck |
|---|---|
| 평가 = 자가 평가 ("내가 안다고 생각함") | 평가 = AI 작문 평가 ("실제로 쓸 수 있나") |
| Flashcard = 학습 자체 | Flashcard = 단어 노출 / 작문 진입 전 워밍업 |
| 주관적, 학생 정직성에 의존 | 객관적 측정 |

자가 평가는 보조 입력으로만 사용. 메인 평가는 학생이 실제 작문을 했을 때 AI가 판단.

---

## 타겟

- 싱가포르 Secondary School Sec 1~2 학생
- 영어 기초 빌딩 단계
- 시험 대비가 아닌 매일 꾸준한 어휘·작문 근육 빌딩

---

## 학습 모드 2가지

### Mode 1: Quick Review (Flashcard)
- 단어 / 뜻 / 예문 / collocation 카드로 확인
- 워밍업 / 단어 노출 단계
- Involvement Load Index: 1

### Mode 2: Writing Mode (핵심 차별화)
Echo Writing과 Quick Sentence Writing을 **단일 Writing Mode + scaffold_level**로 통합.

| scaffold_level | 스타일 | 제공 정보 | ILI |
|---|---|---|---|
| high | Echo Writing | reference_starter (모범 문장) + prompt_topic | 5 |
| medium | Guided Writing | prompt_topic + collocation 힌트 | 5.5 |
| low | Free Writing | prompt_topic만 | 6 |

- scaffold_level은 학생 mastery_level + SRS 상태에 따라 자동 결정
- AI Devil's Advocate: 약점 지적 후 재작문 유도 (모든 레벨)
- `writing_attempts` 테이블에 `scaffold_level`, `reference_starter`, `prompt_topic` 저장

### 학습 흐름
```
Quick Review → Writing Mode (scaffold_level 자동 조정)
   (워밍업)         (핵심 평가)
```

---

## 학술적 근거

- **Output Hypothesis** (Swain, 1985): 출력 행위 자체가 언어 학습의 일부
- **Involvement Load Hypothesis** (Laufer & Hulstijn, 2001): Sentence writing이 단어장보다 높은 retention
- **Modified Output / Reformulation** (Nobuyoshi & Ellis, 1993): 재작문 유도가 학습 효과 증대

---

## 기술 스택

```yaml
Frontend: Next.js 14 (App Router) + TypeScript + Tailwind CSS
  Deploy: Vercel Pro
  
Backend: FastAPI + LangGraph (Python)
  Deploy: Vercel Python Functions

Database: Neon PostgreSQL (Vercel 통합)

Auth: NextAuth.js v5 + Google OAuth
  - MoniBee 프로젝트 코드 재사용

AI: OpenAI API (gpt-4o-mini) via langchain-openai
  - LangGraph 워크플로우로 평가 → 분기 → 재작문 루프 구현
  - Python FastAPI + LangGraph → Vercel Python Functions (/api/python/)
  - Phase 0에서 의존성 번들 500MB 한도 검증 완료 (307MB)

Domain: Cloudflare DNS
```

**MoniBee 프로젝트와 동일 인프라.** 새로 배울 것 없음.

---

## AI 워크플로우 — LangGraph 활용 전략

JaneDuck은 LangGraph를 단순 호출 도구가 아닌 핵심 학습 메커니즘 표현 수단으로 사용.

### LangGraph 사용 이유
1. 학습 루프의 분기/cycle을 그래프로 명확히 표현
2. 노드별 독립 테스트/교체 가능
3. State 자동 관리
4. LangSmith로 학생 학습 패턴 분석/디버깅
5. Phase 2 확장 시 노드 추가만으로 가능

---

## UI 원칙

### 모바일/태블릿 우선

- 요즘 중학생들은 모바일과 태블릿 소유가 많음
- 태블릿이 메인 학습 디바이스 (책상에서 집중 학습)
- 모바일은 보조 (이동 중)
- 데스크탑은 모바일/태블릿 레이아웃의 확장
- 중학교 여학생과 JaneDuck 테마에 맞는 귀여운 노란색 컬러 테마 

### Tailwind Breakpoint 전략

```
모바일 기본 → sm:/md:/lg: 단계적 확장
- sm: 640px (대형 모바일)
- md: 768px (태블릿 세로)
- lg: 1024px (태블릿 가로 / 작은 데스크탑)
```

---

## DB 스키마 (5개 테이블)

### 1. `decks` (단어장)
```sql
- id: uuid (PK)
- name: text
- description: text
- level: int (1~4, Sec level)
- card_count: int (캐시)
- source: enum ('janeduck' | 'quizlet' | 'user')
- source_id: text (Quizlet 원본 ID 등)
- owner_id: uuid (null = 시스템 Deck)
- is_public: boolean
- created_at, updated_at
```

**MVP 단계:**
- 시스템 Deck 2개 (Sec 1 Essential, Sec 1 Advanced 등)
- `owner_id = null`, `is_public = true`

### 2. `cards` (단어 자체)
```sql
- id: uuid (PK)
- deck_id: uuid (FK → decks)

-- Quizlet 호환 필수
- term: text
- definition: text

-- JaneDuck 학습용 (nullable)
- part_of_speech: text
- pronunciation: text
- collocations: jsonb (["reluctant to + verb"])
- example_sentences: jsonb ([{sentence, context}])

-- 다국어 확장 (Phase 2+)
- translations: jsonb ({ko: null, zh: null, ms: null})

-- 시스템
- level: int (Sec 1~4)
- difficulty: int (1~5)
- tags: jsonb
- order_in_deck: int
- source: enum
- source_id: text

- created_at: timestamp
```

**중요:**
- Quizlet에서 import 시 `term`, `definition`만 채워짐
- 나머지는 AI 생성 또는 큐레이션으로 점진적 채움
- Rich text, 이미지, 오디오는 MVP에서 무시

### 3. `user_cards` (사용자별 학습/SRS)
```sql
- user_id: uuid (FK)
- card_id: uuid (FK)
- PRIMARY KEY (user_id, card_id)

-- 마스터리
- mastery_score: float (0~1)
- mastery_level: int (1~4)

-- 통계
- review_count: int (카드 노출 횟수)
- writing_count: int (작문 시도 횟수)
- self_eval_count: int (자가 평가 횟수)

-- SRS (Anki SM-2)
- srs_state: enum ('new' | 'learning' | 'review' | 'relearning' | 'mastered')
- ease_factor: float (1.3~3.0, 기본 2.5)
- interval_days: int (0~365)
- previous_interval_days: int (relearning 복귀용)
- lapse_count: int

-- 시간
- last_reviewed_at: timestamp
- next_review_at: timestamp

-- 마지막 평가 추적
- last_rating: enum ('again' | 'hard' | 'good' | 'easy')
- last_rating_source: enum ('writing' | 'self_eval')

- created_at, updated_at
```

### 4. `writing_attempts` (작문 이력)
```sql
- id: uuid (PK)
- user_id: uuid (FK)
- card_id: uuid (FK)

-- Scaffold (단일 Writing Mode)
- scaffold_level: enum ('high' | 'medium' | 'low') NOT NULL
- reference_starter: text (nullable) -- high: 학생에게 보여준 모범/예시 문장
- prompt_topic: text (nullable)      -- 학생에게 준 주제/상황 프롬프트

-- 학생이 쓴 것
- user_sentence: text

-- AI 평가
- ai_score: int (1~10)
- ai_feedback: jsonb {
    feedback_text: text,
    improved_version: text,
    issues: [{type, original, suggested}]
  }
- used_target_word: boolean
- meaning_correct: boolean

-- 재작문 추적
- attempt_number: int (1차, 2차, 3차...)
- parent_attempt_id: uuid (재작문이면 원본 ID)

- created_at: timestamp
```

### 5. `study_sessions` (세션 상태)
```sql
- id: uuid (PK)
- user_id: uuid (FK)
- deck_id: uuid (FK)
- mode: enum ('quick_review' | 'writing')
- status: enum ('in_progress' | 'completed' | 'abandoned')

-- 세션 통계
- cards_studied_count: int
- self_evaluations_count: int
- writings_completed: int

- started_at: timestamp
- last_active_at: timestamp
- ended_at: timestamp

- created_at: timestamp
```

**중요:** 카드 큐는 저장하지 않음. 세션 시작할 때마다 그 시점의 학습 우선순위에 맞춰 새 큐 생성.

---

## 카드 선정 알고리즘

새 세션 시작 시 학습할 카드를 동적으로 선정.

### 카드 풀 3가지

1. **Due Cards**: `next_review_at <= now()` 인 카드 (복습 시점 도래)
2. **New Cards**: 한 번도 학습 안 한 카드
3. **Weak Cards**: 학습했으나 `mastery_level <= 2` 인 카드

### 학습 진행도에 따른 비율

```python
progress = total_user_cards / deck_total

if progress < 0.2:
    ratio = {"due": 0.3, "new": 0.6, "weak": 0.1}  # 초기: 새 카드 위주
elif progress < 0.7:
    ratio = {"due": 0.5, "new": 0.3, "weak": 0.2}  # 중간: 균형
else:
    ratio = {"due": 0.7, "new": 0.1, "weak": 0.2}  # 후기: 복습 중심
```

### Interleaving 정렬

큐 내 카드는 종류별로 섞어서 배치 (relearning → learning → new → review 인터리브).

---

## SRS 설계 (Hybrid SM-2 + AI)

### Rating 4단계
- **again**: 사용 실패 / 기억 못함
- **hard**: 어렵게 사용 / 어색함
- **good**: 자연스럽게 사용 가능
- **easy**: 매우 자연스럽고 안정적

### Rating 입력 두 가지 경로

**경로 1 (메인): AI 작문 평가 → Rating**
```python
def ai_score_to_srs_rating(ai_eval):
    if not ai_eval.used_target_word:
        return "again"
    if not ai_eval.meaning_correct:
        return "again"
    if ai_eval.score >= 9:
        return "easy"
    elif ai_eval.score >= 6:
        return "good"
    elif ai_eval.score >= 4:
        return "hard"
    else:
        return "again"
```

**경로 2 (보조): 명시 자가 평가**
- 학생이 하단 버튼 탭 (Again/Hard/Good/Easy)
- 좌우 스와이프는 평가 영향 없음 (단순 네비게이션)

### SRS 업데이트 핵심 공식 (review state)

```python
if rating == "again":
    state = "relearning"
    previous_interval_days = interval_days  # 보관
    interval_days = 0
    ease_factor = max(1.3, ease_factor - 0.20)
    lapse_count += 1

elif rating == "hard":
    interval_days = max(1, round(interval_days * 1.2))
    ease_factor = max(1.3, ease_factor - 0.15)

elif rating == "good":
    interval_days = round(interval_days * ease_factor)

elif rating == "easy":
    interval_days = round(interval_days * ease_factor * 1.15)  # 1.3에서 완화
    ease_factor = min(3.0, ease_factor + 0.15)
```

### 자가 평가 제한 (JaneDuck 핵심 차별점)

```python
if source == "self_eval":
    if writing_count == 0:
        interval_days = min(interval_days, 3)  # 작문 없으면 최대 3일
    elif writing_count < 3:
        interval_days = min(interval_days, 14)  # 작문 3회 미만 최대 14일
```

자연스럽게 작문을 유도하는 메커니즘.

### Mastery Level 산출

```python
if writing_count == 0:
    # 작문 한 적 없으면 최대 Level 2
    if mastery_score < 0.3: return 1  # Recognized
    else: return 2  # Familiar

if mastery_score >= 0.85 and writing_count >= 5: return 4  # Mastered
elif mastery_score >= 0.6: return 3  # Productive
elif mastery_score >= 0.3: return 2  # Familiar
else: return 1  # Recognized
```

---

## UI 인터랙션 매핑 (Mode 1: Quick Review)

| 액션 | 동작 | SRS 영향 |
|------|------|---------|
| 카드 탭 | 앞면 ↔ 뒷면 토글 | ❌ |
| 좌 스와이프 | 이전 카드 | ❌ |
| 우 스와이프 | 다음 카드 | ❌ |
| 위 스와이프 | Mode 2 (Writing Mode) 진입 | ❌ (작문 결과로 업데이트) |
| 아래 스와이프 | 히스토리/통계/팁 패널 | ❌ |
| 하단 평가 버튼 | 자가 평가 | ✅ `source="self_eval"` |

---

## MVP 범위

### 포함
- Google OAuth 로그인 (NextAuth)
- 시스템 Deck 2개 (Sec 1 단어 50~100개씩)
- 5개 DB 테이블
- Mode 1: Quick Review (Flashcard + 스와이프)
- Mode 2: Writing Mode (scaffold_level: high/medium/low) + AI 피드백
- SRS (Hybrid SM-2)
- Productive Mastery 추적
- LangGraph 워크플로우 (평가 → 분기 → 재작문) — Vercel Python Functions
- 모바일/태블릿 반응형 UI

### MVP 제외 (Phase 2 이후)
- 결제
- 다른 학년 Deck (Sec 2~4)
- Active Reuse 자동 감지
- Teacher/Parent Dashboard
- 통계 리포트
- 네이티브 앱
- TTS / 오디오
- Rich Text 지원
- 이미지
- 다국어 (한국어/중국어 등)
- Quizlet 실시간 import (수동 CSV는 가능)

---

## 개발 우선순위

### Phase 0: 셋업 (Day 1)
1. Next.js 프로젝트 초기화 (Vercel 연결)
2. Neon PostgreSQL 연결
3. DB 마이그레이션 (5개 테이블)
4. NextAuth + Google OAuth
5. Anthropic API 키 등록
6. **Vercel Python Functions 배포 테스트** (`/api/python/health`)
   - 의존성: langgraph + langchain-anthropic + fastapi + mangum
   - Vercel 500MB 번들 한도 검증
   - 검증 실패 시 대안:
     - 옵션 A: 의존성 슬림화 (langchain 제거 후 anthropic SDK 직접 호출)
     - 옵션 B: Railway/Render 별도 호스팅 (FastAPI 서버 분리)
     - 옵션 C: LangGraph 단순 구현 (StateGraph 최소화)

### Phase 1: 데이터 준비 (Day 2)
1. Sec 1 단어 50개 큐레이션 (Quizlet 또는 Cambridge VP에서)
2. 단어 메타데이터 AI 생성 + 검수
3. 시스템 Deck 2개 시드 데이터

### Phase 2: Mode 1 구현 (Day 3)
1. 카드 컴포넌트 (앞면/뒷면)
2. 스와이프 제스처 (좌우/상하)
3. 카드 선정 알고리즘 (Due + New + Weak)
4. 자가 평가 버튼 → SRS 업데이트
5. 히스토리/통계 패널

### Phase 3: Writing Mode 구현 (Day 4~5)
1. Writing 화면 (scaffold_level 기반 단일 UI)
2. scaffold_level 자동 결정 로직 (mastery_level + writing_count 기반)
3. LangGraph 워크플로우 (FastAPI + Vercel Python Functions)
4. AI 평가 + Devil's Advocate 재작문
5. writing_attempts 기록

### Phase 4: 마무리 (Day 6)
1. Mastery Score 통합
2. 대시보드 (학습 진도)
3. 세션 시작 화면 (Deck 선택 + 모드 선택)
4. PWA 설정 (manifest.json, service worker, 홈 화면 추가)
5. 모바일/태블릿 UI 폴리시 (터치 영역, 애니메이션, 안전 영역)

### Phase 5: 검증 (Day 7)
1. 실제 사용자 테스트
2. 버그 수정
3. UI 미세 조정

---

## 주요 폴더 구조 (제안)

```
janeduck/
├── app/                        # Next.js App Router
│   ├── (auth)/
│   │   ├── login/
│   │   └── api/auth/[...nextauth]/
│   ├── (learn)/
│   │   ├── deck/[deckId]/
│   │   ├── quick-review/
│   │   └── writing/
│   ├── dashboard/
│   └── api/
│       ├── cards/
│       ├── sessions/
│       └── srs/
│
├── api/                        # FastAPI + LangGraph (Python)
│   ├── index.py
│   ├── workflows/
│   │   ├── evaluate_writing.py
│   │   └── devils_advocate.py
│   ├── models/
│   │   └── card.py
│   └── requirements.txt
│
├── lib/                        # 공유 유틸
│   ├── srs/
│   │   ├── update.ts          # SRS 업데이트 로직
│   │   └── queue.ts           # 카드 선정 알고리즘
│   ├── db/
│   │   └── schema.sql
│   └── ai/
│       └── prompts.ts
│
├── components/                 # React 컴포넌트
│   ├── Card/
│   │   ├── FlashCard.tsx
│   │   ├── CardFront.tsx
│   │   └── CardBack.tsx
│   ├── Writing/
│   │   ├── WritingMode.tsx
│   │   ├── ScaffoldPrompt.tsx
│   │   └── FeedbackPanel.tsx
│   └── ui/
│
├── data/                       # 시드 데이터
│   ├── deck_sec1_essential.json
│   └── deck_sec1_advanced.json
│
├── CLAUDE.md                   # 이 파일
├── package.json
├── tsconfig.json
└── tailwind.config.ts
```

---

## Sub-Agent 활용 전략

### 병렬 개발 시점

다음 작업들은 sub-agent로 병렬화 가능:

**Phase 1 (Day 2)와 동시 진행 가능:**
- 단어 큐레이션 (sub-agent A)
- DB 스키마 마이그레이션 (sub-agent B)

**Phase 2-3 (Day 3-5):**
- Mode 1: Quick Review (sub-agent A, worktree: feature/mode1)
- Mode 2: Writing Mode (sub-agent B, worktree: feature/writing-mode)

**Phase 4 (Day 6):**
- 통합/대시보드 (sub-agent A)
- 통합/통계 대시보드 (sub-agent B)

### 메인 Claude Code의 역할

1. 작업 단위 분할
2. 각 sub-agent에게 명확한 컨텍스트 + 작업 지시
3. 결과 통합 + 머지
4. 충돌 해결
5. 사용자에게 보고

### Sub-Agent 작업 지시 시 필수 전달 사항

각 sub-agent에게 작업 위임할 때 반드시 포함:

1. CLAUDE.md의 관련 섹션
2. 작업 범위 (어디부터 어디까지)
3. 다른 worktree와의 의존성 (있다면)
4. 완료 기준
5. 머지 시 주의 사항

### 공유 자원 충돌 방지

병렬 작업 시 다음 파일은 메인에서 미리 확정:

- DB 스키마 (`lib/db/schema.sql`)
- SRS 로직 (`lib/srs/update.ts`)
- 공통 타입 정의 (`lib/types.ts`)
- 환경 변수 (`.env.local`)
- 의존성 (`package.json`)

이후 sub-agent들은 비즈니스 로직만 작업.

### 머지 흐름

```
sub-agent A 완료 → 메인 검토 → main 브랜치 머지
sub-agent B 완료 → 메인 검토 → main 브랜치 머지
충돌 발생 시 → 메인이 해결
```
## 코드 작성 시 주의 사항


### 1. 모바일/태블릿 우선
- Tailwind 클래스는 모바일 기본부터 시작 (`p-4 md:p-8`)
- 터치 인터랙션 우선 (탭, 스와이프)
- 호버 효과는 보조적으로만

### 2. SRS 로직은 라이브러리화
- `lib/srs/update.ts`에 모든 SRS 공식 통합
- 테스트 가능한 순수 함수로
- DB 호출과 분리

### 3. AI 호출은 LangGraph 워크플로우로
- 직접 Claude API 호출 X
- LangGraph 노드로 구조화
- 평가 → 분기 → 재작문 흐름이 그래프로 명확히 보이게

### 4. user_cards 업데이트는 트랜잭션으로
- mastery 계산 + SRS 업데이트 + 카운트 증가는 한 트랜잭션
- 중간에 실패하면 롤백

### 5. 데이터 무결성 체크
- `ease_factor`: 1.3 ~ 3.0
- `interval_days`: 0 ~ 365
- `mastery_score`: 0 ~ 1
- `srs_state`: ENUM 값만

---

## 참고 자료

### MoniBee 프로젝트 (동일 인프라)
- 프로젝트위치 :  D:\dev_projects\002_monibee
- Vercel 배포 설정
- NextAuth Google OAuth 코드
- Neon DB 연결 패턴

### 학술 논문
- Swain, M. (1985). Communicative competence: Some roles of comprehensible input and comprehensible output.
- Hulstijn, J. H., & Laufer, B. (2001). Some empirical evidence for the involvement load hypothesis.
- Nobuyoshi, J., & Ellis, R. (1993). Focused communication tasks and second language acquisition.

---

## 핵심 차별화 한 줄

> 단어를 익히고, 그 단어로 직접 써보고, AI가 다시 써보라고 하는 학습 도구.

---

*Last Updated: 2026-05-15 (v3 — 폴더 구조·용어 정리, Vercel 대안 추가, Phase 4 보강)*
*Maintainer: Hoon*
