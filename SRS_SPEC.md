# JaneDuck — SRS_SPEC.md

> **SRS 노출 우선순위 명세.** `DESIGN_DECISIONS.md` §4-4의 `review_priority` 계산식과 §3 큐 비율의 구체 수치를 정의한다.
> SRS 모델 자체(왜 SM-2가 아닌가, 단어가 드는 필드)는 `DESIGN_DECISIONS.md` §4-4가 출처다. 이 문서는 그 위의 **계산식**만 다룬다.
>
> **이 문서의 모든 수치(가중치·곡선 계수·단계값·비율)는 가설이다.** 검증된 정답이 아니라 설계 원칙으로 조립한 출발점이다. MVP 출시 후 실제 학습 데이터로 검증·조정한다. 그래서 **모든 수치는 코드 상수로 분리**하고, 계산 로직은 모듈 인터페이스 뒤에 둔다 (`DESIGN_DECISIONS.md` §11).

---

## 1. review_priority — 단어 개별 노출 우선순위

각 `user_cards` 행(사용자 × 단어)에 대해 "지금 이 단어가 얼마나 복습이 급한가"를 매번 계산한다.
**달력상 마감일 개념이 없다.** 학생이 며칠 만에 와도 그 시점에 다시 계산할 뿐 — 폭탄도 늪도 없다.

### 1-1. 공식

```
review_priority =
    w_mastery  × mastery_factor
  + w_recency  × recency_factor
  + w_selfeval × selfeval_factor
  + w_practice × practice_factor
```

- 각 `*_factor`는 0~100.
- 가중치 합 = 1.0. → `review_priority`도 0~100 범위.
- 점수가 높을수록 복습이 급하다.

### 1-2. 가중치 (튜닝 상수)

```
W_MASTERY   = 0.40
W_RECENCY   = 0.30
W_SELFEVAL  = 0.15
W_PRACTICE  = 0.15
```

근거: mastery가 JaneDuck의 중심 신호 → 최고. recency 다음. selfeval은 선택사항(미입력 학생 많음)이라 낮게. practice는 보조.

### 1-3. 요인 1 — mastery_factor

mastery가 낮을수록 급하다. 역방향 선형.

```
mastery_factor = (5 - mastery_level) / 5 × 100
```

| mastery_level | mastery_factor |
|---|---|
| 0 | 100 |
| 1 | 80 |
| 2 | 60 |
| 3 | 40 |
| 4 | 20 |
| 5 | 0 |

mastery 5(완전 익힘)는 이 요인 0 — 다른 요인으로만 가끔 떠오른다.

### 1-4. 요인 2 — recency_factor

마지막 학습 후 경과 시간. 선형이 아니라 **로그 곡선** (잊혀가는 곡선과 일치 — 초반 급상승, 후반 완만).

```
days = (now - last_reviewed_at) 의 일(day) 수

# mastery 보정: 잘 아는 단어일수록 천천히 잊힌다
adjusted_days = days / (1 + mastery_level × MASTERY_DECAY_COEF)

recency_factor = min(100, log2(adjusted_days + 1) × RECENCY_COEF)
```

튜닝 상수:
```
MASTERY_DECAY_COEF = 0.5
RECENCY_COEF       = 25
```

보정 없는 경우(mastery 0) 기준값:

| days | recency_factor |
|---|---|
| 0 | 0 |
| 1 | 25 |
| 3 | 50 |
| 7 | 75 |
| 15 | 100 |
| 15+ | 100 (상한) |

- `days = 0`(같은 날)이면 factor 0 → 같은 세션 재등장 안 함.
- **mastery 보정**이 SM-2의 `ease_factor`를 대체한다. mastery 5면 `adjusted_days = days / 3.5` → 같은 경과 시간이라도 우선순위가 천천히 오른다 = 잘 아는 단어는 간격이 길어진다. 별도 `ease_factor` 필드 불필요 — mastery 하나로 해결.

### 1-5. 요인 3 — selfeval_factor

학생 자가평가. **자가평가는 선택사항**(`DESIGN_DECISIONS.md` §4-4) — 미입력이면 0.

| last_self_eval_rating | selfeval_factor |
|---|---|
| `dont_know` | 100 |
| `unsure` | 60 |
| `know` | 20 |
| `know_well` | 0 |
| null (미평가) | 0 |

핵심: **mastery가 높아도 자가평가가 "어렵다"면 우선순위가 올라간다.** mastery 5 단어라도 학생이 `dont_know`를 누르면 이 요인 100 → 가중치(0.15)만큼 우선순위 상승.

### 1-6. 요인 4 — practice_factor

작문 시도 누적 횟수(`writing_attempts_count`). mastery와 비슷해 보이나 다르다 — **자가평가만 하고 작문은 안 한 단어**를 잡아내는 요인이다.

| writing_attempts_count | practice_factor |
|---|---|
| 0 | 100 |
| 1 | 60 |
| 2 | 30 |
| 3+ | 0 |

작문 3회 이상 한 단어는 이 요인 0 — "실제로 써봤다"가 핵심 신호.

### 1-7. 계산 예시 (검증용)

**단어 A** — mastery 1, 5일 전 학습, 자가평가 `unsure`, 작문 2회
```
mastery_factor  = 80
adjusted_days   = 5 / (1 + 1×0.5) = 3.33
recency_factor  = log2(4.33) × 25 ≈ 53
selfeval_factor = 60
practice_factor = 30

review_priority = 0.40×80 + 0.30×53 + 0.15×60 + 0.15×30
                = 32 + 15.9 + 9 + 4.5 ≈ 61.4
```

**단어 B** — mastery 5, 20일 전 학습, 자가평가 없음, 작문 6회
```
mastery_factor  = 0
adjusted_days   = 20 / (1 + 5×0.5) = 5.71
recency_factor  = log2(6.71) × 25 ≈ 69
selfeval_factor = 0
practice_factor = 0

review_priority = 0.40×0 + 0.30×69 + 0 + 0 ≈ 20.7
```

A(61) > B(21) — 약하고 덜 써본 단어 A가 훨씬 급하게 노출. 의도대로.

---

## 2. 카드 큐 — 세션마다 단어 선별

`review_priority`는 단어 *개별* 점수다. 한 세션에 어떤 단어 N장(기본 20)을 뽑을지는 큐가 결정한다.
(`DESIGN_DECISIONS.md` §3 학습 큐 정책의 구체 수치 보강.)

### 2-1. 3개 풀

- **Review**: 이미 학습한 단어(`user_cards` 레코드 있음). `review_priority` 높은 순.
- **New**: 아직 학습 안 한 단어(`user_cards` 레코드 없음).
- **Starred**: 별표 단어. (`review_priority` 높은 순)

### 2-2. 진행도별 비율 (튜닝 상수)

```
progress = 학습 시작한 단어 수 / 덱 전체 단어 수
```

| progress | New | Review | Starred |
|---|---|---|---|
| < 0.3 (초반) | 60% | 30% | 10% |
| 0.3 ~ 0.7 (중반) | 30% | 50% | 20% |
| > 0.7 (후반) | 10% | 70% | 20% |

20장 세션 환산 예: 초반 New 12 / Review 6 / Starred 2 — 후반 New 2 / Review 14 / Starred 4.

### 2-3. 큐 구성 규칙

- **규칙 1 — "복습만 나오지 않는다":** New 단어가 남아 있는 한, 큐가 Review로만 채워지면 안 된다. 위 비율의 New 몫을 보장한다.
- **규칙 2 — 풀 부족 시 에러 없이 처리:** 어떤 풀이 목표 수량보다 적어도 오류를 내지 않는다. 부족분은 다른 풀에서 채우거나, 그만큼 적은 큐로 진행한다.
  - 예: New가 동났으면 New 몫을 Review로 채운다 → **Review 100%도 정상**(새로 배울 게 없으면 복습만 하는 게 맞다).
  - 예: Starred 풀이 비었으면 그 몫을 Review로.
- **규칙 3 — interleaving:** 큐 N장은 종류별로 섞어 배치한다 (New만 몰리거나 Review만 몰리지 않게).
- 큐는 저장하지 않는다. 세션 시작마다 그 시점 상태로 새로 조립한다.

### 2-4. due 폭탄 / 늪 방지

이 모델에서는 옛 SM-2식 "밀린 due 폭탄"이 **구조적으로 발생하지 않는다.**
`review_priority`는 "마감일 지난 카드"가 아니라 연속 점수다. 30일 밀린 단어든 3일 밀린 단어든 점수로 줄 세워 상위 N장만 뽑으므로, 밀린 단어가 쌓여도 큐는 늘 적정량이다.
→ **별도 강등(relearning) 메커니즘은 MVP에서 만들지 않는다.** priority 정렬 자체가 늪을 막는다.

---

## 3. 갱신 시점

- **작문 시도 종료 시:** `mastery_level` 갱신(`DESIGN_DECISIONS.md` §4-3), `last_reviewed_at` = now, `writing_attempts_count` += 1.
- **자가평가 입력 시:** `last_self_eval_rating`, `last_self_eval_at` 갱신. `last_reviewed_at`도 now로 갱신(카드를 봤으므로). mastery는 자가평가로 바뀌지 않는다.
- `user_cards` 갱신은 한 트랜잭션으로 (`CLAUDE.md` 데이터 무결성).
- `review_priority`는 **저장하지 않는다** — 큐 생성 시점에 계산한다 (now에 의존하므로).

---

## 4. 튜닝 대상 상수 (전부 코드 상수로 분리)

| 상수 | 시작값 | 용도 |
|---|---|---|
| `W_MASTERY` | 0.40 | mastery 요인 가중치 |
| `W_RECENCY` | 0.30 | recency 요인 가중치 |
| `W_SELFEVAL` | 0.15 | 자가평가 요인 가중치 |
| `W_PRACTICE` | 0.15 | 작문 횟수 요인 가중치 |
| `MASTERY_DECAY_COEF` | 0.5 | recency의 mastery 보정 강도 |
| `RECENCY_COEF` | 25 | recency 로그 곡선 계수 |
| factor 단계값 | §1-3~1-6 표 | 각 요인의 구간별 점수 |
| 진행도 비율 | §2-2 표 | New/Review/Starred 비율 |

검증 지표: 재학습 시 작문 점수가 오르는가 / 학생이 "복습만 한다"고 느끼지 않는가 / 약한 단어가 실제로 자주 노출되는가.

---

*SRS 모델 정의: `DESIGN_DECISIONS.md` §4-4 · §3. 이 문서는 그 계산식 명세다.*
