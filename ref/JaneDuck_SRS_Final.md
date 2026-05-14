# JaneDuck SRS 최종 설계안

## 핵심 철학

JaneDuck의 SRS는 두 가지를 결합한다:

1. **검증된 알고리즘**: Anki SM-2 기반 (수십 년 검증됨)
2. **JaneDuck만의 차별점**: AI 작문 평가가 메인 입력

핵심 원칙:
> **"평가는 작문에서 일어난다. 자가 평가는 보조다."**

이게 일반 SRS 단어 앱과 JaneDuck의 본질적 차이다.

---

## 1. SRS State

```
new        → 한 번도 학습 안 함
learning   → 첫 학습 단계 (간격 짧음)
review     → 정상 복습 단계
relearning → 까먹어서 재학습 중
mastered   → 장기 기억 안정 단계
```

### 상태 전이 다이어그램

```
new → learning → review → relearning → review
                    ↓
                mastered (90일 이상 안정)
```

---

## 2. 핵심 변수 (user_cards 테이블)

| 필드 | 타입 | 기본값 | 의미 |
|------|------|--------|------|
| `srs_state` | enum | "new" | 현재 학습 단계 |
| `ease_factor` | float | 2.5 | 카드 난이도 계수 (1.3~3.0) |
| `interval_days` | int | 0 | 다음 복습까지 며칠 |
| `previous_interval_days` | int | 0 | 직전 interval (relearning 복귀용) |
| `lapse_count` | int | 0 | Again 받은 누적 횟수 |
| `next_review_at` | timestamp | now | 실제 다음 복습 시각 |
| `last_reviewed_at` | timestamp | null | 마지막 학습 시각 |
| `last_rating` | enum | null | 마지막 평가 (again/hard/good/easy) |
| `last_rating_source` | enum | null | "writing" or "self_eval" |
| `writing_count` | int | 0 | 누적 작문 시도 횟수 |
| `self_eval_count` | int | 0 | 누적 자가 평가 횟수 |

**핵심 추가:**
- `previous_interval_days`: relearning에서 복귀 시 사용
- `last_rating_source`: 평가가 어디서 왔는지 추적
- `writing_count` vs `self_eval_count`: 두 경로 구분

---

## 3. Rating 정의

| Rating | 의미 |
|--------|------|
| **again** | 사용 실패 / 기억 못함 |
| **hard** | 어렵게 사용 / 어색함 |
| **good** | 자연스럽게 사용 가능 |
| **easy** | 매우 자연스럽고 안정적 |

### Rating 입력 경로 (두 가지)

```
경로 1 (메인): AI 작문 평가 → Rating 변환
경로 2 (보조): 사용자 명시 자가 평가
```

**좌우 스와이프는 단순 네비게이션이며 SRS에 영향 없음.**

---

## 4. AI 평가 → SRS Rating 변환

### 변환 공식

```python
def ai_score_to_srs_rating(ai_evaluation):
    """
    JaneDuck의 핵심 변환 함수.
    AI 작문 평가 결과를 SRS rating으로 매핑.
    """
    # Gate 1: 단어를 사용하지 않았으면 무조건 again
    if not ai_evaluation.used_target_word:
        return "again"
    
    # Gate 2: 의미가 틀리면 again
    if not ai_evaluation.meaning_correct:
        return "again"
    
    # Gate 3: 점수 기반 매핑 (완화된 임계값)
    score = ai_evaluation.score  # 1~10
    
    if score >= 9:
        return "easy"
    elif score >= 6:      # 6점부터 good (이전 7점에서 완화)
        return "good"
    elif score >= 4:
        return "hard"
    else:
        return "again"
```

**임계값 완화 이유:**
- 6-7점 = "잘 썼지만 더 좋아질 수 있다" → 이건 good
- 너무 엄격한 임계값은 학생을 좌절시키고 ease_factor를 영구 하락시킴

### 재작문(Devil's Advocate) 처리

학생이 1차 답변 → AI 피드백 → 재작문하는 경우:

```python
def calculate_final_rating(attempts):
    """
    여러 시도 중 최종 평가.
    """
    # 최고 점수를 최종 결과로 사용
    final_score = max(attempt.score for attempt in attempts)
    final_rating = ai_score_to_srs_rating_from_score(final_score)
    
    # 재작문이 있었으면 ease_factor 변화는 보수적으로
    if len(attempts) > 1:
        return {
            "rating": final_rating,
            "ease_factor_modifier": 0.5  # 변화량 절반만 적용
        }
    
    return {
        "rating": final_rating,
        "ease_factor_modifier": 1.0
    }
```

이유: 재작문으로 점수를 올렸다고 "쉬운 카드"로 분류하면 안 됨. 학습은 됐지만 즉각적 mastery는 아님.

---

## 5. SRS 업데이트 공식

### Case 1: state = "new" 또는 "learning"

```python
def update_srs_initial_learning(user_card, rating):
    """첫 학습 단계 - ease_factor 변경 없음"""
    
    if rating == "again":
        user_card.srs_state = "learning"
        user_card.interval_days = 0
        
    elif rating == "hard":
        user_card.srs_state = "learning"
        user_card.interval_days = 1
        
    elif rating == "good":
        user_card.srs_state = "review"
        user_card.interval_days = 1
        
    elif rating == "easy":
        user_card.srs_state = "review"
        user_card.interval_days = 4
    
    # ease_factor는 2.5 유지
```

### Case 2: state = "review" (정상 복습 중)

```python
def update_srs_review(user_card, rating, ease_factor_modifier=1.0):
    """정상 복습 단계"""
    
    if rating == "again":
        # 까먹음 → relearning으로 이동
        user_card.srs_state = "relearning"
        user_card.previous_interval_days = user_card.interval_days  # 저장!
        user_card.interval_days = 0
        user_card.ease_factor = max(
            1.3,
            user_card.ease_factor - 0.20 * ease_factor_modifier
        )
        user_card.lapse_count += 1
        
    elif rating == "hard":
        user_card.srs_state = "review"
        user_card.interval_days = max(1, round(user_card.interval_days * 1.2))
        user_card.ease_factor = max(
            1.3,
            user_card.ease_factor - 0.15 * ease_factor_modifier
        )
        
    elif rating == "good":
        user_card.srs_state = "review"
        user_card.interval_days = round(
            user_card.interval_days * user_card.ease_factor
        )
        # ease_factor 변경 없음
        
    elif rating == "easy":
        user_card.srs_state = "review"
        # easy 보너스 1.3 → 1.15로 완화 (interval 폭발 방지)
        user_card.interval_days = round(
            user_card.interval_days * user_card.ease_factor * 1.15
        )
        user_card.ease_factor = min(
            3.0,
            user_card.ease_factor + 0.15 * ease_factor_modifier
        )
```

### Case 3: state = "relearning" (재학습 중)

```python
def update_srs_relearning(user_card, rating):
    """까먹어서 재학습 중"""
    
    if rating == "again":
        user_card.interval_days = 0
        # 같은 세션 또 다시
        
    elif rating == "hard":
        user_card.srs_state = "review"
        user_card.interval_days = 1
        
    elif rating == "good":
        # 이전 interval의 50%로 복귀
        user_card.srs_state = "review"
        user_card.interval_days = max(
            1,
            round(user_card.previous_interval_days * 0.5)
        )
        
    elif rating == "easy":
        # 이전 interval의 70%로 복귀
        user_card.srs_state = "review"
        user_card.interval_days = max(
            1,
            round(user_card.previous_interval_days * 0.7)
        )
```

### Case 4: mastered 상태 진입 조건

```python
def check_mastered_state(user_card):
    """
    매번 SRS 업데이트 후 호출.
    조건 만족 시 mastered로 전환.
    """
    if (
        user_card.srs_state == "review" and
        user_card.interval_days >= 90 and
        user_card.ease_factor >= 2.5 and
        user_card.lapse_count <= 1
    ):
        user_card.srs_state = "mastered"
```

`mastered` 카드는 학습 큐에서 빈도 낮추지만, 완전히 빼지는 않음 (장기 retention 확인).

---

## 6. 자가 평가 제한 (JaneDuck 핵심 차별점)

```python
def apply_self_eval_constraints(user_card, rating, source):
    """
    자가 평가만으로는 interval이 충분히 늘지 않도록 제한.
    "작문이 진짜 평가"라는 철학 반영.
    """
    
    if source == "self_eval":
        # 작문 한 번도 안 했으면 interval 상한 적용
        if user_card.writing_count == 0:
            user_card.interval_days = min(user_card.interval_days, 3)
            # 최대 3일까지만. 작문해야 더 늘어남
        
        # 작문 비중이 낮으면 부분 제한
        elif user_card.writing_count < 3:
            user_card.interval_days = min(user_card.interval_days, 14)
            # 최대 14일까지. 작문 3회 이상부터 자유
        
        # ease_factor 증가 폭도 보수적
        # (이건 update 공식에서 modifier로 처리)
    
    return user_card
```

**효과:**
- 학생이 매일 "Good" 버튼만 누르면 → 최대 3일 간격으로 계속 반복됨
- 작문을 시작하면 → interval이 정상적으로 늘어남
- 자연스럽게 작문을 유도하는 메커니즘

---

## 7. Same-Session 중복 처리

같은 세션 내 같은 카드 여러 번 학습 시 SRS 업데이트 규칙:

```python
def should_update_srs(user_card, last_session_update):
    """
    동일 세션(30분) 내 중복 업데이트 방지.
    """
    SESSION_WINDOW_MINUTES = 30
    
    if last_session_update is None:
        return True
    
    time_since_last = now() - last_session_update
    
    if time_since_last.total_minutes() < SESSION_WINDOW_MINUTES:
        # 30분 내 중복 → 마지막 결과만 반영
        # (이미 업데이트된 값을 덮어씀)
        return "overwrite"
    
    return True
```

**규칙:**
- 30분 내 같은 카드 학습 = 마지막 결과로 덮어쓰기
- 30분 후 = 새로운 평가로 정상 업데이트

이게 없으면 한 세션 안에 같은 단어 5번 학습하면 interval이 5번 곱해져서 폭발.

---

## 8. 통합 메인 함수

```python
def update_card_srs(user_card, rating, source, attempts=None):
    """
    JaneDuck SRS 메인 업데이트 함수.
    
    Parameters:
        user_card: user_cards 테이블의 row
        rating: "again" | "hard" | "good" | "easy"
        source: "writing" | "self_eval"
        attempts: 작문 시도 리스트 (writing source만)
    """
    
    # 1. Same-session 중복 체크
    session_action = should_update_srs(
        user_card, 
        user_card.last_reviewed_at
    )
    if session_action == "overwrite":
        # 이전 세션 업데이트 되돌리기 (선택사항)
        pass
    
    # 2. ease_factor modifier 계산 (재작문 시 보수적)
    ease_modifier = 1.0
    if source == "writing" and attempts and len(attempts) > 1:
        ease_modifier = 0.5
    
    # 3. State별 업데이트 적용
    if user_card.srs_state in ["new", "learning"]:
        update_srs_initial_learning(user_card, rating)
    elif user_card.srs_state == "review":
        update_srs_review(user_card, rating, ease_modifier)
    elif user_card.srs_state == "relearning":
        update_srs_relearning(user_card, rating)
    elif user_card.srs_state == "mastered":
        # mastered도 평가 들어오면 일반 review로 처리
        update_srs_review(user_card, rating, ease_modifier)
    
    # 4. 자가 평가 제한 적용
    user_card = apply_self_eval_constraints(user_card, rating, source)
    
    # 5. 제약 적용
    user_card.ease_factor = max(1.3, min(3.0, user_card.ease_factor))
    user_card.interval_days = min(user_card.interval_days, 365)
    
    # 6. next_review_at 계산
    if user_card.interval_days == 0:
        user_card.next_review_at = now() + timedelta(minutes=10)
    else:
        user_card.next_review_at = now() + timedelta(days=user_card.interval_days)
    
    # 7. 메타데이터 업데이트
    user_card.last_reviewed_at = now()
    user_card.last_rating = rating
    user_card.last_rating_source = source
    
    if source == "writing":
        user_card.writing_count += 1
    elif source == "self_eval":
        user_card.self_eval_count += 1
    
    # 8. Mastered 상태 진입 체크
    check_mastered_state(user_card)
    
    return user_card
```

---

## 9. 마스터리 점수 계산

SRS와 별개로 학생의 단어 마스터리를 계산:

```python
def calculate_mastery_score(user_card, recent_writing_attempts):
    """
    Productive Mastery Score (0~1).
    JaneDuck은 작문 능력 중심이므로 출력 품질에 큰 비중.
    """
    
    # 1. 작문 품질 (메인, 85%)
    if user_card.writing_count > 0:
        # 최근 5회 작문 평균 점수
        recent_scores = [a.ai_score for a in recent_writing_attempts[-5:]]
        avg_writing = sum(recent_scores) / len(recent_scores) / 10  # 0~1
    else:
        avg_writing = 0
    
    # 2. SRS 안정성 (보조, 15%)
    # interval이 길수록 잘 기억
    self_eval_factor = min(1.0, user_card.interval_days / 90)
    
    # 3. 가중 평균
    mastery_score = avg_writing * 0.85 + self_eval_factor * 0.15
    
    return mastery_score


def determine_mastery_level(mastery_score, writing_count):
    """
    Productive Mastery Level 1~4 산출.
    """
    if writing_count == 0:
        # 작문 한 적 없으면 최대 Level 2
        if mastery_score < 0.3:
            return 1  # Recognized
        else:
            return 2  # Familiar
    
    if mastery_score >= 0.85 and writing_count >= 5:
        return 4  # Mastered
    elif mastery_score >= 0.6:
        return 3  # Productive
    elif mastery_score >= 0.3:
        return 2  # Familiar
    else:
        return 1  # Recognized
```

**핵심 규칙:**
- 작문 0회 → 최대 Level 2까지만 (Productive 도달 불가)
- 작문 5회 + 평균 85% 이상 → Level 4 Mastered

---

## 10. 학습 큐 우선순위

오늘 학생에게 보여줄 카드 선정:

```python
def get_due_cards(user_id, deck_id, limit=20):
    """
    오늘 학습할 카드 큐.
    """
    cards = user_cards.where(
        user_id=user_id,
        deck_id=deck_id,
        next_review_at <= now()
    )
    
    # 우선순위 정렬
    # 1. relearning (까먹은 거 먼저)
    # 2. learning (학습 중)
    # 3. review (정상 복습)
    # 4. mastered (가끔만)
    # 5. new (새 카드)
    
    state_priority = {
        "relearning": 1,
        "learning": 2,
        "review": 3,
        "new": 4,
        "mastered": 5,
    }
    
    return cards.order_by(state_priority, next_review_at).limit(limit)
```

**Mastered 카드 처리:**
```python
# Mastered 카드는 5번에 1번 정도만 큐에 포함
if random() > 0.2 and state == "mastered":
    skip()
```

---

## 11. 핵심 차별화 요약

### 일반 SRS 앱 (Anki, Quizlet)
```
사용자 자가 평가 → SRS 업데이트
```

### JaneDuck SRS
```
작문 시도
   ↓
AI 평가 (객관적)
   ↓
Rating 변환
   ↓
SRS 업데이트 (메인)

+ 보조: 자가 평가 (제한적 영향)
```

### 기술적 차이점

| 항목 | 일반 SRS | JaneDuck |
|------|---------|----------|
| 평가 주체 | 학생 자가 | AI (객관) + 학생 (보조) |
| 평가 기준 | "기억나나?" | "쓸 수 있나?" |
| Easy 보너스 | 1.3 | 1.15 (보수적) |
| 작문 미실시 | 제한 없음 | interval 상한 적용 |
| 재작문 처리 | 없음 | ease_factor 변화 절반 |
| Mastered state | 정의 안 됨 | interval≥90일, lapse≤1 |

---

## 12. MVP 단순화 옵션

처음 구현 시 복잡도를 줄이고 싶다면:

### MVP-Lite (선택)
- Mastered state 생략 (review로 유지)
- ease_factor_modifier 적용 안 함
- self_eval 제한만 적용 (작문 유도 핵심 메커니즘)

### MVP-Full (권장)
- 위 모든 공식 적용
- 실 데이터로 임계값 조정 (Phase 2)

---

## 13. Phase 2 확장 방향

### FSRS-style Adaptive
현재 SM-2는 고정된 공식이지만, FSRS는 사용자별 학습 패턴 학습:
- 사용자별 평균 forgetting curve 계산
- 동적 ease_factor 조정
- 머신러닝 기반 next_review_at 예측

JaneDuck Phase 2에 적용 가능한 추가 신호:
- 작문 점수 trend (상승/하락)
- 같은 collocation 패턴 반복 오류
- 응답 시간 (latency)
- 단어 reuse 빈도 (자발적 사용)

### 통계 기반 조정
- A/B 테스트로 임계값 최적화
- 학생 그룹별 다른 공식 (Sec 1 vs Sec 3)

---

## 14. 데이터 무결성 체크

구현 시 반드시 검증:

```python
def validate_user_card(user_card):
    """SRS 상태 무결성 체크"""
    
    assert 1.3 <= user_card.ease_factor <= 3.0
    assert 0 <= user_card.interval_days <= 365
    assert user_card.lapse_count >= 0
    assert user_card.srs_state in [
        "new", "learning", "review", "relearning", "mastered"
    ]
    
    # 상태별 제약
    if user_card.srs_state == "new":
        assert user_card.last_reviewed_at is None
        assert user_card.writing_count == 0
    
    if user_card.srs_state == "mastered":
        assert user_card.interval_days >= 90
        assert user_card.lapse_count <= 1
```

---

## 결론

이 SRS 설계의 핵심:

1. **검증된 Anki SM-2 기반** — 안정적
2. **AI 작문 평가가 메인** — JaneDuck의 정체성
3. **자가 평가 제한 메커니즘** — 학생에게 자연스럽게 작문 유도
4. **재작문 보수적 처리** — 학습은 인정하지만 즉각 mastery는 아님
5. **Mastered state** — 장기 retention 추적

**JaneDuck의 SRS는 단순한 Anki 복제가 아니라, 작문 학습에 최적화된 Hybrid SRS다.**

---

*Project: JaneDuck*
*Document: SRS Final Design*
