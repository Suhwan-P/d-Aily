// 하루 정리 앱에서 쓰는 데이터 타입들을 모아두는 파일
// (Todo 앱에서 Todo 타입 만들었던 것과 같은 개념)

// 질문 하나에 대한 답변
export type Answer = {
  question: string; // AI가 던진 질문
  response: string; // 사용자가 입력한 답변
};

// 하루치 기록 전체
export type JournalEntry = {
  id: string; // 고유 id (Date.now().toString() 등으로 생성)
  date: string; // 'YYYY-MM-DD' 형식
  answers: Answer[]; // 오늘의 문답 목록
  summary: string; // AI가 만들어준 하루 요약 (지금은 mock으로 대체)
  createdAt: number; // 정렬용 타임스탬프
};
