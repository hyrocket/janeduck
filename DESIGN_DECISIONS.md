# JaneDuck — Design Decisions

> **이 문서의 목적**
> 이 문서는 "무엇을 만들어라"가 아니라 **"시스템이 이렇게 동작해야 한다"**를 정의하는 동작 명세입니다.
> 구현 task 분할은 Claude Code가 자유롭게 하되, 아래 정책·구조·스키마는 명세로 따릅니다.
> 문서 끝의 **Open Questions**는 아직 미확정이므로 임의 구현하지 말고 질문할 것.

---

## 0. 프로젝트 한 줄 정의

싱가포르 중학생을 위한 **AI Micro Writing Coach**.
단어 학습(플래시카드) + 짧은 문장 작문 + AI 피드백. 상용화 목표 MVP.

**스택:** Next.js 14 (TS/Tailwind, Vercel) · FastAPI + LangGraph (Vercel Python Functions) · Neon PostgreSQL (Pooled).
**LLM:** MVP는 OpenAI mini 계열 (기존 API 키). 공급자·모델은 설정값이며 호출 지점별 교체 가능 — §11-1.

---

## 1. 학습 모드 구조

두 개의 학습 모드가 있으며, **각각 독립된 풀스크린 페이지**다.

| 모드 | 역할 | UI 스타일 |
|---|---|---|
| Quick Review | 단어 워밍업, 플래시카드 | 일반 학습 UI (카드형) |
| Writing Mode | 짧은 문장 작문 + AI 피드백 | 메신저 UI (JaneDuck 대화) |

- 두 페이지는 **수직 swipe로 전환**한다.
  - 카드 모드에서 **swipe up** → 그 단어의 Writing Mode 진입
  - Writing Mode에서 **swipe down** → 카드 모드로 복귀
- **swipe는 모드 전환만 한다.** 다음 카드로의 진행은 swipe가 아니라 사용자의 명시적 액션(자가평가 버튼, 또는 Writing Mode의 `next_word` 버튼)으로만 일어난다.
- Writing Mode는 **바텀 모달이 아니다.** 풀스크린 페이지다. (바텀 모달은 "임시" 느낌이라 진지한 코칭 정체성과 안 맞음)

---

## 2. 세션 정의 — 두 가지 단위를 분리

"세션"이라는 단어가 두 맥락에서 다르게 쓰인다. 혼동 금지.

### 2-1. LLM 컨텍스트 단위 = **단어별 작문 1회**
- AI 평가(`evaluate_writing`) 호출 시, LLM에게 주는 대화 컨텍스트는 **그 단어에 대한, 그 학습 세션 내의 이전 시도들**만 포함한다.
- 다른 단어의 대화는 컨텍스트에 넣지 않는다. (비용 통제 + 평가 독립성)
- 같은 단어를 `try_again` / `master_challenge`로 재시도하면, 그 단어의 이전 시도들은 LLM이 메시지 형태로 참고한다 → "아까는 'in'을 썼는데 이번엔 'about'으로 잘 고쳤네" 같은 연결 가능.

### 2-2. UI 누적 단위 = **학습 세션**
- 화면 표시상으로는, 한 학습 세션 동안 한 모든 단어의 Writing 대화가 메신저 화면에 누적되어 보인다. (학생이 위로 스크롤하면 이전 단어 대화 확인 가능)
- 학습 세션 정의: **앱 진입 ~ 종료**. 보조 안전망으로 24시간 경과 시 자동 종료.
- Writing Mode 첫 화면은 **현재 단어 대화만 펼쳐서** 보여주고, 이전 단어 대화는 collapsed ("N earlier conversations today" 형태). 무한 스크롤.

### 핸드오프 메모
`chat_messages` 별도 테이블은 **만들지 않는다.** Writing 대화는 `writing_attempts` 레코드들로부터 UI가 재구성한다. (한 attempt = writing_prompt + user_text + ai_feedback)

---

## 3. 아키텍처 경계 — FastAPI vs LangGraph

| 영역 | 처리 방식 | 이유 |
|---|---|---|
| 카드 학습 흐름 전체 | FastAPI 일반 엔드포인트 | LLM 호출 0회. DB CRUD/큐 관리. 속도 우선 |
| Writing Mode 평가 파이프라인 | LangGraph 워크플로우 | 분기·루프·상태 추적이 실제로 필요한 곳 |
| 주간 분석 (Phase 2) | 별도 배치 LangGraph | MVP 아님. 인프라만 준비 |

**LangGraph는 Writing Mode에만 쓴다.** 카드 흐름을 LangGraph로 감싸면 노드 라우팅/상태 직렬화 오버헤드 + cold start로 카드 넘김이 느려진다.

### 카드 모드 — FastAPI 엔드포인트 (LLM 없음)
- `POST /sessions/start` → 학습 큐 생성 (`build_session_queue`)
- `GET /sessions/:id/next-card` → 큐에서 카드 pop
- `POST /cards/:id/self-eval` → 자가평가 저장 + SRS 갱신
- `POST /cards/:id/star` → 별표 토글

### 학습 큐 정책 (`build_session_queue`)
- 매 카드마다 다음 카드를 계산하지 않는다. **세션 시작 시 10~20장 큐를 미리 만든다.**
- 20장 기준 구성 비율 (가이드):
  - relearning + due review: 10장
  - weak productive (self/writing 점수 약한 것): 4장
  - starred due (별표 + 복습 시기 도래): 3장
  - new cards: 3장
- 별표만 모아 보는 별도 필터 학습 모드도 가능해야 한다.

---

## 4. 세 가지 학습 신호 — 핵심 데이터 모델

JaneDuck은 **세 개의 독립된 신호**를 추적한다. 이게 핵심 차별점이다.
(다른 단어장 앱은 self-eval 하나로만 동작 → "안다고 착각" 문제를 못 잡음)

| 신호 | 무엇 | 단위 | 누가 결정 | 저장 위치 |
|---|---|---|---|---|
| **Score** | 이 작문이 얼마나 잘 됐나 | 시도(attempt)별 | AI 평가 | `writing_attempts.ai_score` |
| **Self-evaluation** | 학생이 이 단어를 안다고 느끼는 정도 | 단어 × 시점 | 학생 본인 | `user_cards.last_self_eval_rating` |
| **Mastery** | 이 단어를 실제로 사용할 수 있는가 | 단어별 누적 | 시스템 (score 집계) | `user_cards.mastery_level` |

세 신호 간 **gap이 학습 인사이트**다. (예: self_eval="잘 안다" + mastery 낮음 → 과대평가. Phase 2 분석에서 활용)

### 4-1. Score
- 매 작문 시도마다 AI가 0~10 정수로 평가.
- **AI 평가 시점에 즉시 확정**된다. `next_word`를 눌러도 그 점수는 그대로 저장·반영된다.
- `try_again`은 점수를 "갱신할 기회"를 줄 뿐 — 새 시도는 새 score로 기록되고, 그게 최신값이 된다.
- 모든 시도는 `writing_attempts`에 빠짐없이 저장된다 (Phase 2 분석용).

### 4-2. Self-evaluation
- 학생이 카드에서 누르는 주관 평가. enum: `dont_know` / `unsure` / `know` / `know_well`.
- 학생이 다시 평가하면 갱신된다.
- Mastery와 **완전히 독립**이다. self-eval을 바꿔도 mastery는 영향 없음.

### 4-3. Mastery
- **0~5 정수.** (소수 아님)
- 라벨은 코드 상수로 매핑하며, **현재는 3단계**로 운영 (scaffold 분기가 3개라서):
  - `0` → untouched
  - `1~2` → familiar
  - `3~4` → productive
  - `5` → mastered
- **숫자 공간(0-5)은 고정.** 나중에 중간 단계를 추가하고 싶으면 라벨/경계 상수만 바꾸면 되고, DB 스키마·기존 데이터는 불변이다. (이게 숫자로 두는 이유)

#### Mastery 갱신 룰 (MVP)
매 작문 시도가 끝날 때, 그 시도의 `ai_score`로 mastery를 갱신:
- `ai_score ≥ 8` → mastery **+1** (상한 5)
- `ai_score 5~7` → mastery **유지**
- `ai_score ≤ 4` → mastery **-1** (하한 1 — untouched(0)으로는 내려가지 않음)

- 한 번 잘했다고 점프하지 않음 (+1씩만). hysteresis가 스텝 자체에 내장됨.
- mastery는 떨어질 수도 있다 (정직한 신호).
- **`master_challenge` 시도는 mastery 갱신 계산에서 제외**한다 (§6 참조).
- 같은 세션·같은 단어에서 `try_again`을 여러 번 하면, mastery 반영은 **그 단어의 마지막 시도 점수 1개만** 사용한다 (try_again은 학습 기회이므로 중간 실패에 페널티 없음).

---

## 5. Scaffold (작문 보조 수준)

Writing Mode 진입 시 제공하는 보조 수준. 3단계.

> **핵심 설계 원칙:** Scaffold는 단순한 "난이도 슬라이더"가 아니라 **"표현 단위가 커지는 progression"**이다.
> 단계가 오를수록 보조가 줄어드는 게 아니라, **요구되는 산출의 표현 단위 자체가 커진다.**
> `word usage → sentence production → connected expression`
> 이는 제2언어 작문 발달 단계(단어 → 문장 → 문장 간 연결/cohesion)와 일치한다.
> 그래서 `low`는 "도움 없는 빈 화면"이 아니라 "한 단계 위의 표현 능력"을 요구하는 단계다.

| Scaffold | 명칭 | 표현 단위 | 학생에게 제공되는 것 | 산출 기대 | AI 평가 엄격도 |
|---|---|---|---|---|---|
| `high` | Structure Scaffold | 단어 → 문장 | 뜻 + 예문 + sentence starter("My friend is ___ when ___") + topic hints | 1문장 (starter 완성) | 관대 (작은 문법 실수 봐줌) |
| `medium` | Semantic Scaffold | 의미 있는 문장 | 단어 + topic/keyword hint | 1문장 (자력) | 표준 |
| `low` | Micro Story Scaffold | 연결된 표현 | 단어 + 소재 제안 + 구조 가이드 (§5-1) | **정확히 2문장, 서로 연결** | 엄격 (자연스러움 + coherence) |

**공통 절대 제약 — 모든 scaffold에서 최대 2문장.** paragraph / essay / 장문 작문은 **절대 금지**.
JaneDuck의 정체성(speed, low friction, mobile friendliness)을 지키기 위한 불변 제약이다.

**High scaffold의 목적**은 "회피 막기" — 빈 화면 공포(blank page paralysis)를 없애 "틀려도 좋으니 일단 쓰게" 만드는 것. (Vygotsky ZPD)
HIGH의 고정적 구조(starter 등)는 의도된 비계(scaffold)다. 회피 방지가 최우선이므로 예측 가능한 구조가 자산이 된다.
반대로 LOW 단계 학생은 이미 산출 능력이 있으므로, LOW에 내용을 고정하면 비계가 아니라 족쇄가 된다 — 그래서 LOW는 내용을 고정하지 않는다 (§5-1).

### 5-1. LOW scaffold — 가이드 정책 (문제집화 방지)

LOW는 "자유 작문"이 아니라 **"구조화된 2문장 과제"**다. 단, **내용은 학생, 구조만 가이드**한다.

- **상황(내용)을 카드에 사전 저장하지 않는다.** 단어별 고정 상황 = 문제집화. 금지.
- LOW 작문 과제는 런타임에 **세 요소**로 조립된다:
  1. **목표 단어** — `cards`에서 옴.
  2. **구조 가이드** — 두 번째 문장이 무엇을 해야 하는지. (필수) 학생의 상황 선택은 자유롭게 두되, 두 문장이 의미적으로 연결되도록 강제하는 장치.
  3. **소재 제안** — 출발점. 문제 단위로 어느 정도 소재를 제시하되(중학생에게는 명확한 소재 제시가 실제로 작문을 돕는다), **소재 풀은 다양**해야 하고 매번 변주된다.
- 학생에게 보이는 LOW 프롬프트 예시:
  > "'reluctant'로 두 문장을 써볼래?
  > 두 번째 문장에서는 *왜 그랬는지* 이유를 말해줘.
  > 소재: 학교생활"

#### 소재 풀 / 구조 가이드 풀 — 위치
- **둘 다 앱 전역 상수/설정**이다. 단어별도, 덱별도 아니다.
  - 이유: "학교생활"이라는 소재는 어떤 단어에도 쓸 수 있다 — 소재는 단어의 속성이 아니다. 또한 12~15세 학생의 삶의 반경은 덱(난이도)이 바뀐다고 달라지지 않는다.
- `cards`, `decks` 테이블에 소재/구조 관련 저장 항목을 **두지 않는다.**
- **소재 풀 (예시):** 학교생활, 가족, 친구, 취미, 주말, 감정/기분, 작은 사건 … (최종 항목은 콘텐츠 결정 — 실제 학생 반응 보고 다듬음. 문서엔 예시만.)
- **구조 가이드 풀 (예시):** 이유 / 결과 / 감정 / 대조 (3~4종, 변주)
- 런타임 `generate_writing_prompt`(또는 해당 역할 함수)가 풀에서 선택한다. 단순 랜덤으로 시작하되, **그 학생이 그 단어에 대해 직전에 받은 소재·구조는 회피**한다 (`writing_attempts`의 이전 기록 참조 — §12).
- 같은 단어를 여러 소재/구조로 산출 → productive vocabulary 학습의 핵심 (한 단어를 한 맥락에서만 쓰는 것 방지).

### Scaffold 결정 룰 (다음에 그 단어를 만났을 때의 시작 scaffold)
- `mastery 0~2` → `high`
- `mastery 3~4` → `medium`
- `mastery 5` → `low`

scaffold는 **언제나 mastery 기반**이다. self_eval은 scaffold 결정에 쓰지 않는다 (주관적 인지 ≠ 산출 능력). self_eval의 용도는 카드 큐 정렬·Phase 2 분석·UI 표시.
처음 만나는 단어(mastery 0)도 high에서 시작 — 작문 능력은 self_eval로 측정 불가하므로. 잘하는 학생은 첫 시도 8+점이면 mastery가 올라 다음 만남부터 medium이 된다.

### Scaffold 변경의 두 가지 개념 — 혼동 금지
- **영구 scaffold** (`user_cards.current_scaffold`): 다음에 그 단어를 만났을 때 시작할 scaffold. mastery 기반으로 위 룰에 따라 결정. 신중하게 바뀜.
- **일시적 scaffold** (master_challenge): 이번 한 시도만 scaffold를 올려서 도전. `user_cards`에 저장 안 됨. (§6)

---

## 6. 재작문 / 마스터 챌린지 정책

### 강제 재작문 없음
- 점수가 낮아도 시스템이 강제로 재작문시키지 않는다.
- AI가 피드백을 준 뒤, 학생이 버튼으로 다음 행동을 **스스로 선택**한다.
- `writing_rating`의 `again` 등급은 **SRS 알고리즘 신호일 뿐**, UX상의 강제 행동이 아니다.

### try_again
- 같은 scaffold로 같은 단어를 다시 작문.
- 새 시도 = 새 score. 최신 시도가 그 단어의 현재 평가가 된다.
- 같은 단어·같은 세션에서 **최대 3회**까지. 3회 도달 후에는 `suggested_actions`에서 `try_again` 제거, `next_word`만 노출. (좌절감 방지 — SRS가 어차피 나중에 다시 보여줌)

### master_challenge
- 점수가 높을 때 학생에게 제공되는 선택지. 누르면 **scaffold를 한 단계 올려서**(high→medium, medium→low) 같은 단어를 재작문.
- 이 시도의 scaffold 상승은 **일시적**이다. `user_cards.current_scaffold`를 바꾸지 않는다.
- master_challenge 시도의 점수는 `writing_attempts`에 저장은 되지만, **mastery 갱신 계산에서는 제외**된다.
- master_challenge에서 낮은 점수를 받아도 영구 scaffold·mastery에 페널티 없음. "도전 자체"가 손해가 되지 않도록.
- 단, JaneDuck의 chat_message는 결과를 정직하게 전달하되 도전을 인정하는 톤으로 풀어준다.
  - 예: "Master challenge is tough — that's the point. You did well at the medium level, and this just tells us where to focus next."

---

## 7. Writing Mode LangGraph 워크플로우

사용자 주도 분기 구조 (v3). 노드 목록:

```
START
 → determine_scaffold        (router, rule 기반)
 → prompt_high / prompt_medium / prompt_low   (3갈래, scaffold별 prompt 생성)
 → [pause: user writes]
 → validate_input            (rule: 빈 답변/gibberish/언어 체크. invalid면 재요청 루프)
 → check_target_word         (rule: 목표 단어 사용 여부. lemma/regex, LLM 아님)
 → evaluate_writing          (LLM 호출 — 이 그래프의 유일한 핵심 LLM 호출)
 → update_srs_mastery        (DB: writing_attempt 저장 + mastery/SRS 갱신)
 → present_feedback          (점수 기반으로 suggested_actions 결정, chat_message 전달)
 → [pause: user chooses]
 → (try_again → 같은 scaffold로 재진입 / master_challenge → scaffold↑ 재진입 / next_word → END)
```

- LLM 호출은 `evaluate_writing` 한 곳에 집중.
- `try_again` / `master_challenge` 선택 시 워크플로우는 state의 scaffold를 갱신하고 재진입한다.
- LangGraph state가 들고 다녀야 할 것: `card_id`, `current_scaffold`, `attempt_count`, `recent_scores`, `target_word_used`, `last_score`, `is_master_challenge`, `topic_used`, `structure_guide_used`.

### prompt 노드 (`prompt_high` / `prompt_medium` / `prompt_low`)
- `prompt_high`: `cards.starter_templates` 배열에서 하나 선택 + `topic_hints`. LLM 호출 없음 (DB 조회).
- `prompt_medium`: 단어 + 가벼운 topic hint.
- `prompt_low`: **3요소 조립** (§5-1) — 목표 단어 + 구조 가이드(풀에서 선택) + 소재 제안(풀에서 선택). 직전 시도의 소재·구조는 회피. 선택된 `topic_used` / `structure_guide_used`는 state에 실려 `evaluate_writing`과 `writing_attempts` 저장까지 전달된다.

### 별도 엔드포인트 (LangGraph 밖)
- `POST /writing/explain` — 학생이 피드백 중 특정 부분을 탭하고 "왜?"를 물을 때. 단발성 LLM 호출. LangGraph 안 거침.
  - 요청에 컨텍스트 동봉 필요: `user_text`, `ai_feedback`, `specific_part`(학생이 클릭한 부분), `question_type`(why/example/more).

---

## 8. evaluate_writing 출력 스키마

LLM이 매번 출력하는 JSON. 세 그룹으로 구성.

### 그룹 A — 학생에게 직접 보여줄 것 (UI 사용)
- `overall_score`: int, 0~10
- `chat_message`: string. JaneDuck이 말하는 자연어 피드백. 2~3 짧은 문단. (§9 페르소나)
- `suggested_actions`: array. UI 하단 버튼 결정. (§8-1 룰)

### 그룹 B — 시스템 라우팅용 (LangGraph 내부)
- `target_word_used`: boolean
- `target_word_used_correctly`: boolean

### 그룹 C — SRS / Phase 2 분석용 (DB 저장)
- `writing_rating`: enum `again` / `hard` / `good` / `easy` (§8-2 매핑)
- `strengths`: array of string (짧은 자연어 구. enum 강제 안 함)
- `weakness_signals`: array of string (짧은 자연어 구. enum 강제 안 함)

> **중요:** Phase 2 약점 분석을 위해 오류를 미리 정해진 taxonomy enum으로 분류하지 **않는다.**
> 원본 텍스트 + score + feedback + 자유 서술 strengths/weakness만 저장하고,
> 주간 분석 시점에 LLM이 누적 히스토리를 보고 그때 패턴을 도출한다.
> (사후 분석 방식 — taxonomy를 미리 만드는 것은 over-engineering, 유연성도 떨어짐)

### 8-0. scaffold별 평가 기준 차이

evaluate_writing 프롬프트는 scaffold에 따라 평가 기준이 달라진다.

- **HIGH:** 관대. 단어를 맞는 맥락에 썼는지 위주. 작은 문법 실수는 봐줌. 산출 = 1문장.
- **MEDIUM:** 표준. 문법 + 단어 사용 + 자연스러움. 산출 = 1문장.
- **LOW:** 엄격 + **2문장 구조 평가**. 단일 문장 기준에 더해:
  - 두 문장이 실제로 의미적으로 **연결되는가** (coherence). 주어진 구조 가이드(이유/결과/감정/대조)를 두 번째 문장이 실제로 수행하는가.
  - 같은 표현을 반복하지 않았는가.
  - **문장 수 처리:** 학생이 1문장만 쓰면 → 점수보다 "두 문장으로 이어볼래?" 방향 제시(가벼운 감점). 3문장 이상이면 → 길게 쓴 것을 칭찬하되 "JaneDuck은 짧고 단단한 글을 연습해 — 두 문장으로 압축해볼래?"로 essay화 방지. **2문장 제약을 평가가 명확히 인지해야 한다.**

### 8-1. suggested_actions 결정 룰

| Score | 현재 scaffold | suggested_actions |
|---|---|---|
| ≤ 4 | any | `[try_again, next_word]` |
| 5~7 | any | `[try_again, next_word]` |
| 8~10 | high 또는 medium | `[master_challenge, next_word]` |
| 8~10 | low (더 올릴 단계 없음) | `[next_word]` |
| 목표 단어 미사용 | any | `[try_again, next_word]` |

- `try_again`: 같은 scaffold, 새 시도.
- `master_challenge`: scaffold 한 단계 상승.
- 같은 단어 3회 시도 후: `try_again` 제거, `[next_word]`만.
- 버튼 순서: primary action 먼저(왼쪽), `next_word`는 보조.

### 8-2. score → writing_rating 매핑

| overall_score | writing_rating | SRS 효과 |
|---|---|---|
| 0~3 | `again` | interval 리셋 |
| 4~6 | `hard` | interval 단축 |
| 7~8 | `good` | 표준 interval |
| 9~10 | `easy` | interval 연장 |

---

## 9. JaneDuck 페르소나 (chat_message 작성 지침)

- **정체성:** JaneDuck — 싱가포르 중학생을 위한 친근한 영어 코치.
- **톤:** 따뜻하되 과장하지 않음. 진솔함. 칭찬은 진짜 잘했을 때만.
- **길이:** 2~3 짧은 문단 최대. 중학생이 다 읽을 수 있어야 함.
- **언어:** 영어 (학생이 영어 학습 중). Singapore-friendly English — 과한 미국 슬랭 회피.
- **호칭:** 학생을 직접 "you"로 부름.
- **원칙:**
  - **한 번에 하나만 짚기.** 실수가 5개여도 가장 중요한 1~2개만. 나머지는 다음 시도 때.
  - **Strength 먼저, weakness 다음.** 항상 잘한 점 인정 후 개선점.
  - **구체적 수정 예시 제공.** "틀렸어"가 아니라 "이렇게 써봐: ___".
  - **앞으로 향하는 초대로 마무리.** ("다시 해볼래?" / "마스터 도전?")

### 점수대별 톤
- **9~10 (easy):** 진심 어린 축하. 무엇이 숙련을 보여주는지 짚음. → master challenge 권유.
- **7~8 (good):** 따뜻한 격려. 작은 다듬기 하나. → master 또는 넘어가기 권유.
- **4~6 (hard):** 시도를 인정. 핵심 이슈 1~2개 + 수정. → 다시 해보기 권유.
- **0~3 (again):** 지지적, 부끄럽지 않게. 모델을 단순화해 보여줌. 긴 오류 목록 금지. → 부드러운 권유.

---

## 10. 카드 메타데이터 생성 (starter_templates)

- High scaffold의 sentence starter, topic hints는 **단어 등록 시점에 미리 LLM이 생성**해 DB에 저장한다 (옵션 B).
- 런타임에는 DB에서 조회만 — `evaluate_writing` 그래프 안에서 prompt 생성을 위한 LLM 호출은 없다.
- `cards.starter_templates`는 **배열** (단어당 2~3개). 학생이 같은 카드를 다시 만나도 다른 starter가 나와 단조로움 감소.
- 생성은 단어 시드 파이프라인 단계에서 함께 수행 (또는 admin 스크립트). 일회성 비용.

### LOW scaffold 관련 — 카드에 저장하지 않음
- LOW의 소재·구조 가이드는 **단어별로 사전 생성하지 않는다.** (§5-1)
- `cards`, `decks` 테이블에 LOW 관련 필드를 두지 않는다. 소재 풀 / 구조 가이드 풀은 앱 전역 상수/설정이며, 런타임에 선택된다.
- 이유: 단어별 고정 상황 = 문제집화. JaneDuck의 차별점은 "구조는 가르치되 내용은 학생 삶에서"이다.

---

## 11. 판단 모듈 — 모듈화 / 교체 가능 구조

아래 세 "판단 모듈"은 **인터페이스 뒤에 두고, 입력/출력 객체 형태를 고정**한다.
구현은 MVP에서 전부 룰 기반. 나중에 AI 구현체로 모듈 단위 교체가 가능해야 한다.

| 모듈 | 입력 | 출력 | MVP 구현 | 나중 |
|---|---|---|---|---|
| `MasteryUpdater` | 현재 mastery, 최근 ai_score(들) | 새 mastery (0~5) | 룰 (+1/유지/-1) | AI 판단 |
| `ScaffoldDecider` | mastery, self_eval, recent_scores, attempt_count | scaffold (high/medium/low) | 룰 | AI 판단 |
| `ActionSuggester` | score, scaffold, attempt_count | suggested_actions[] | 룰 (§8-1 표) | AI 판단 |

### 설계 원칙
- **입력은 명시적 객체 하나로 묶는다.** 나중에 "000도 고려해라"의 000은 입력 객체에 필드를 추가하는 것으로 끝 — 함수 시그니처 불변.
- **출력 객체에 `reason` 필드를 포함**한다. 룰 버전은 "rule: mastery=2" 같은 값, AI 버전은 AI가 설명한 근거. 로깅·디버깅·학부모 리포트에 공통 사용.
- **인터페이스 1개 + 구현 2개(룰/AI) + 설정으로 선택** (Strategy 패턴). `SCAFFOLD_DECIDER=rule|ai` 같은 config로 교체.
- **AI 구현체 안전장치:** 정해진 JSON만 출력하도록 프롬프트 강제 + 출력 형태 검증 + 검증 실패 시 룰 구현으로 fallback.
- **MVP 범위:** 인터페이스는 셋 다 설계. 구현은 전부 룰. AI 구현체는 "룰로 부족한 게 확인된" 모듈만 나중에 추가. (모듈화는 보험이지 당장 쓸 무기가 아님)

### 11-1. LLM 공급자 / 모델 — 추상화 및 교체 가능 구조

**MVP LLM 공급자: OpenAI mini 계열** (기존 보유 API 키 사용). 단, 공급자·모델은 **고정이 아니라 설정값**이다.

#### 원칙
- 모든 LLM 호출은 **단일 LLM 클라이언트 추상**을 거친다. `evaluate_writing` 노드, `/writing/explain`, 카드 메타데이터 생성 — 어느 것도 특정 공급자 SDK를 직접 부르지 않는다.
- 공급자 교체(OpenAI ↔ Anthropic 등)가 **호출 지점 코드를 바꾸지 않고** 가능해야 한다. 공급자는 구현 디테일이지 동작 명세가 아니다.
- **LLM 호출 지점별로 모델을 개별 지정**할 수 있어야 한다. "전부 mini"가 아니라, 호출 지점마다 설정으로 모델 선택:

| 호출 지점 | 작업 성격 | MVP 모델 (기본) | 비고 |
|---|---|---|---|
| 카드 메타데이터 생성 | 단순 생성 (starter 등) | mini로 충분 | 일회성 배치 |
| `/writing/explain` | 단발 설명 | mini | 단순 Q&A |
| `evaluate_writing` | 핵심 평가 (페르소나 + 구조화 출력) | mini로 시작, **교체 가능하게** | 품질 검증 필요 — 아래 |

#### 목적 — JaneDuck에 맞는 모델을 실측으로 찾기 위함
모듈화의 실용적 이유는 "나중에 바꿀 수도 있으니"가 아니라, **어떤 모델이 JaneDuck 평가 품질에 맞는지 실제로 비교·측정하기 위함**이다. 그래서 모델 교체가 설정값 변경만으로 되어야 한다 (코드 재배포 없이 A/B 비교 가능하면 더 좋음).

#### evaluate_writing — mini 모델 리스크 대응 (필수)
소형 모델은 두 가지 리스크가 있다. 구현 시 반드시 대응:
1. **JSON 출력 안정성** — mini는 형식을 어길 수 있다. §8 출력 스키마(그룹 A/B/C)를 강제할 때 공급자의 structured output / JSON mode 기능을 사용하고, **파싱 실패 시 재시도 → 그래도 실패 시 안전한 fallback** 경로를 둔다.
2. **피드백 품질** — §9 페르소나(한 번에 하나만 짚기, strength 먼저, 구체적 수정 예시)는 정교한 지시다. mini가 이를 충분히 따르는지 실측해야 한다. 품질이 부족하면 `evaluate_writing`만 상위 모델로 올린다 (호출 지점별 모델 지정이 가능하므로 다른 지점은 그대로 mini 유지).

#### 설정 형태 (예시)
```
LLM_PROVIDER          = "openai"          # 공급자
LLM_MODEL_EVALUATE    = "gpt-4o-mini"     # evaluate_writing 용
LLM_MODEL_EXPLAIN     = "gpt-4o-mini"     # /writing/explain 용
LLM_MODEL_CARD_META   = "gpt-4o-mini"     # 카드 메타데이터 생성 용
```
공급자/모델 상수는 한 곳(설정·환경변수)에서 관리. 호출 지점은 "어떤 용도의 모델"인지만 알고, 실제 모델 문자열은 모른다.

---

## 12. DB 스키마 (개요)

5개 테이블. (`chat_messages`는 만들지 않음 — §2-3)

> **이 스키마는 최소 요구사항이다.** 여기 명시된 필드/제약은 반드시 반영한다.
> 명세가 명시적으로 "두지 않는다 / 만들지 않는다"고 한 것만 금지다.
> 명세가 단지 언급하지 않은 기존 필드는 삭제 근거가 아니다 — 기존 스키마에 있으면 그대로 둔다.
> 조정은 충돌 시에만: 이름이 다름 / 타입이 다름 / 명세가 명시적으로 금지한 경우.

### `decks`
단어 묶음(덱). 소재/구조 가이드 관련 필드를 두지 않는다 (§5-1 — 소재 풀은 앱 전역 상수).

### `cards`
- `word`, `definition`, `part_of_speech`
- `example_sentences`: array — 예문 (복수. 같은 단어 재학습 시 다른 예문 노출로 단조로움 감소)
- `starter_templates`: array — 사전 LLM 생성 (§10), HIGH scaffold용
- `topic_hints`: array — 사전 LLM 생성
- `difficulty_band`: enum (예: common / uncommon / advanced)
- `deck_id`
- **LOW scaffold 관련 필드는 두지 않는다** (§5-1, §10 — 단어별 고정 상황 = 문제집화).

### `user_cards` — 사용자 × 단어. 세 신호의 "현재 상태"를 들고 있음
- `user_id`, `card_id`
- `last_self_eval_rating`: enum (`dont_know`/`unsure`/`know`/`know_well`), `last_self_eval_at`
- `mastery_level`: int 0~5
- `recent_scores`: array (최근 3개 — mastery 갱신/scaffold 결정용)
- `writing_attempts_count`: int
- `last_writing_score`: int, `last_writing_at`: timestamp
- `current_scaffold`: enum (`high`/`medium`/`low`)
- `is_starred`: boolean default false, `starred_at`: timestamp nullable
- SRS 필드 (interval, ease factor, due date 등 — Hybrid SM-2). interval 알고리즘 상세는 `SRS_SPEC.md`(작성 예정 — Q6) 참조.

### `writing_attempts` — 모든 작문 시도. 갱신 없이 누적
- `id`, `user_id`, `card_id`, `session_id`
- `scaffold_used`: enum
- `is_master_challenge`: boolean
- `topic_used`: string nullable — 이 시도에 제시된 소재 (LOW에서 사용. 다음 소재 선택 시 직전 회피용 + Phase 2 분석)
- `structure_guide_used`: string nullable — 이 시도에 제시된 구조 가이드 (이유/결과/감정/대조 등. LOW에서 사용)
- `user_text`: text
- `ai_score`: int 0~10
- `ai_feedback`: text (= chat_message)
- `ai_strengths`: array, `ai_weakness_signals`: array
- `writing_rating`: enum (`again`/`hard`/`good`/`easy`)
- `created_at`

### `study_sessions`
- `id`, `user_id`, `deck_id`
- `started_at`, `ended_at` (nullable)
- `session_type`: enum (`mixed`/`starred_only`/`weak_only` 등 — 별표 필터 학습 대비)

---

## 13. Phase 2 (MVP 아님 — 인프라만 의식)

- **주간 리뷰 / Mistake Pattern 분석:** 학생 버튼 또는 자동 주기. `writing_attempts` 누적 데이터를 LLM이 분석 → 약점 요약 + 약점 기반 추가 단어 추천. 별도 배치 LangGraph 워크플로우.
- **Adaptive Coach (다중 턴 평가):** 옵션 "Deep mode". `WritingEvaluator` 인터페이스를 추상화해두면 그래프 갈아엎지 않고 추가 가능.
- **결제 시스템, 다중 사용자 대시보드, Sec 2~4 단어 확장, 네이티브 앱.**

MVP에서 할 것: `writing_attempts`가 분석 가능한 형태로 누적되도록만 보장 (이미 §8 그룹 C가 충족). 주간 분석기·`weekly_reports` 테이블은 만들지 않음.

---

## Open Questions (미확정 — 임의 구현 금지, 질문할 것)

- **Q2. mastery 5(mastered) 도달 조건에 "low scaffold 1회 이상 통과"를 추가 조건으로 넣을지** — §4-3 갱신 룰은 현재 점수만 봄. low 통과 요건을 넣을지 미정.
- **Q3. 판단 모듈 3종의 입력/출력 객체 필드 상세** — §11은 개요만. 각 필드 확정 필요.
- **Q4. evaluate_writing LLM 프롬프트 전문** — 시스템 프롬프트 / few-shot 예시 / 출력 JSON 강제 방식 미작성. (scaffold별 평가 기준 §8-0 반영 필요.)
- **Q5. 소재 풀 / 구조 가이드 풀의 최종 항목** — §5-1은 예시만 제시. 구체 항목 확정은 콘텐츠 결정 사항이며 실제 학생 반응 보고 다듬음. 풀의 "형태"(앱 전역 상수)는 확정, "내용"은 미확정.
- **Q6. SRS interval 알고리즘** — Hybrid SM-2의 상세(interval 업데이트 공식, ease_factor, 자가평가 제한 등)는 **별도 문서 `SRS_SPEC.md`로 작성 예정.** 작성 전까지 SRS interval 로직을 임의 구현하지 말 것. (mastery 갱신 룰 §4-3은 SRS interval과 별개이며 이미 확정.)

---

## 부록 — 합의 시 적용한 설계 원칙 (참고)

- **MVP는 단순함이 미덕.** 화려한 구조(예: FinLit식 Meta Agent)를 따라하지 않음 — JaneDuck은 입력 의도가 명확해 라우팅 에이전트가 불필요.
- **over-engineering 경계.** 아키텍처 envy로 노드/테이블을 늘리지 않음. 필요해질 때 추가.
- **academic grounding.** 제품 결정은 가능한 한 연구 기반 (Output Hypothesis, Involvement Load, ZPD 등).
- **확장은 인터페이스 추상화로 대비, 구현은 MVP에 집중.**
