# 하루 정리 AI 저널 앱 (가칭)

짧은 문답으로 하루를 정리해주는 개인용 저널 앱입니다.
긴 일기나 독후감을 쓰기 어려워하는 현대인을 위해, AI가 짧은 질문 2~3개를 던지고
사용자는 한 단어~한 문장으로 답하면 하루 요약을 만들어줍니다.
소셜 기능 없이 개인 디바이스에만 데이터를 저장하는 것을 목표로 합니다.

## 개발 환경

- Node.js: v24.18.0
- Expo SDK: 54 (`blank` 템플릿, TypeScript)
- 실행 방식: Expo Go 앱으로 테스트 (SDK 버전이 Expo Go 앱 버전과 반드시 일치해야 함)

## 실행 방법

```bash
# 패키지 설치
npm install

# 개발 서버 실행
npx expo start
```

터미널에 뜬 QR 코드를 Expo Go 앱으로 스캔하면 됩니다.
웹에서 확인하려면 서버 실행 후 터미널에서 `w` 키를 누르면 됩니다.

### 주의사항

- 폰의 **Expo Go 앱 버전**과 프로젝트의 **Expo SDK 버전**이 다르면
  `Project is incompatible with this version of Expo Go` 에러가 발생합니다.
  이 경우 Expo Go 앱을 최신 버전으로 업데이트하거나,
  프로젝트 SDK 버전을 폰과 맞춰야 합니다.

## 폴더 구조

```
App.tsx              # 화면 조립 (로직 없이 컴포넌트 배치)
components/
  QuestionCard.tsx    # 질문 + 답변 입력 카드
  SummaryView.tsx     # 하루 요약 표시
  HistoryList.tsx     # 지난 기록 목록
hooks/
  useJournalStorage.ts  # 로컬 저장(AsyncStorage) 로직
types/
  journal.ts            # 데이터 타입 정의 (Answer, JournalEntry)
```

## 현재 상태 (진행 중)

- [x] 질문 → 답변 → 요약 → 저장 기본 흐름 구현
- [x] 로컬 저장(AsyncStorage) 연동
- [x] 지난 기록 히스토리 목록 표시
- [ ] AI(OpenAI API) 연동 — 현재는 질문/요약 모두 mock 데이터
  - 질문: `MOCK_QUESTIONS` 고정 배열
  - 요약: 답변들을 단순히 이어붙이는 방식(`join`)

## 다음 할 일

1. OpenAI API로 매일 다른 질문 생성하기
2. OpenAI API로 답변들을 자연스러운 요약 문장으로 정리하기
3. (선택) 주간/월간 감정 패턴을 그래프로 보여주기

## 기술 스택

- Expo (React Native)
- TypeScript
- AsyncStorage (로컬 저장)
- OpenAI API (예정)