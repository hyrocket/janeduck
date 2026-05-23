# JaneDuck 업무일지 — 2026-05-23 (3회차)

## 주요 진행

### 벌크 단어 임포트 (텍스트 붙여넣기)

#### 설계 결정

- Quizlet 방식 텍스트 붙여넣기 (엑셀 업로드는 추후)
- 진입점: [+] 버튼 → Add Word 시트 → "Import list" 버튼으로 전환
  - 별도 헤더 아이콘 없이 단일 진입점([+])으로 통일
- 구분자: Tab(기본) / Comma / Semicolon 선택
- 잘못된 행(구분자 없음) → 미리보기에서 orange 표시 후 자동 스킵
- 최대 200장 제한

#### 신규 파일

| 파일 | 역할 |
|---|---|
| `app/api/decks/[id]/cards/bulk/route.ts` | POST: 벌크 카드 INSERT + card_count 업데이트 (최대 200장) |
| `components/cards/BulkImportSheet.tsx` | 임포트 바텀시트 — 구분자 선택, textarea, 실시간 파싱 미리보기 |

#### 수정 파일

- `components/cards/CardEditSheet.tsx` — `onSwitchToBulk` prop 추가, Add 모드 시 "Import list" 버튼 노출
- `app/(learn)/deck/[deckId]/DeckDetailClient.tsx` — `BulkImportSheet` 연결, 시트 전환 로직

#### UX 흐름

```
[+] → Add Word 시트
         ↓ Import list 탭
      Import Words 시트
        구분자 선택 (Tab / Comma / Semicolon)
        텍스트 붙여넣기 → 실시간 파싱 미리보기
        ✓ N ready / M skipped 표시
        [Import N cards] → DB 저장 → 페이지 새로고침
```

---

## 커밋 목록

- `feat: bulk word import via text paste`
