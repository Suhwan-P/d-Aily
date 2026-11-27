// 왜무새 테이블 — 질문 은행 (모두 직접 쓴 문장)
// 원칙: ① 처음 만난 사이에서도 부담 없는 질문 ② 나이·직장·연봉·연애사·외모처럼 민감한 건 묻지 않기
//       ③ 답은 짧게 (한 단어 ~ 한 줄) ④ 언제든 '패스' 가능

export interface ProfileQ {
  id: string;
  q: string;
  kind: "choice" | "text";
  options?: string[]; // choice 전용
  placeholder?: string; // text 전용
  botAnswers: string[]; // 봇·테스트용 답
}

/** 자기소개 정보 모으기 — 게임마다 choice 2개 + text 3개를 뽑는다 */
export const PROFILE_QS: ProfileQ[] = [
  { id: "c-morning", q: "나는 아침형? 저녁형?", kind: "choice", options: ["아침형", "저녁형", "그때그때"], botAnswers: ["아침형", "저녁형", "그때그때"] },
  { id: "c-dayoff", q: "쉬는 날의 나는?", kind: "choice", options: ["집콕", "무조건 밖으로", "반반"], botAnswers: ["집콕", "무조건 밖으로", "반반"] },
  { id: "c-travel", q: "여행 갈 때 나는?", kind: "choice", options: ["계획 꼼꼼히", "발길 닿는 대로"], botAnswers: ["계획 꼼꼼히", "발길 닿는 대로"] },
  { id: "c-tangsu", q: "탕수육 소스는?", kind: "choice", options: ["부먹", "찍먹", "상관없음"], botAnswers: ["부먹", "찍먹", "상관없음"] },
  { id: "c-reply", q: "메시지 답장 스타일은?", kind: "choice", options: ["바로바로", "몰아서 한 번에"], botAnswers: ["바로바로", "몰아서 한 번에"] },
  { id: "c-mintchoco", q: "민트초코는?", kind: "choice", options: ["최고야", "치약 맛", "먹어 본 적 없음"], botAnswers: ["최고야", "치약 맛", "먹어 본 적 없음"] },
  { id: "c-pet", q: "고양이파? 강아지파?", kind: "choice", options: ["고양이", "강아지", "둘 다", "식물파"], botAnswers: ["고양이", "강아지", "둘 다", "식물파"] },
  { id: "c-season", q: "제일 좋아하는 계절은?", kind: "choice", options: ["봄", "여름", "가을", "겨울"], botAnswers: ["봄", "여름", "가을", "겨울"] },
  { id: "c-coffee", q: "카페에서 주로 시키는 건?", kind: "choice", options: ["아아", "따뜻한 라떼", "달달한 음료", "커피 안 마심"], botAnswers: ["아아", "따뜻한 라떼", "달달한 음료", "커피 안 마심"] },

  { id: "t-into", q: "요즘 빠져 있는 것 하나", kind: "text", placeholder: "예) 러닝, 뜨개질, 어떤 드라마", botAnswers: ["러닝", "뜨개질", "보드게임", "베이킹", "필름 카메라", "식물 키우기"] },
  { id: "t-word", q: "나를 한 단어로 소개하면?", kind: "text", placeholder: "예) 호기심, 감자, 느긋함", botAnswers: ["호기심", "감자", "느긋함", "에너자이저", "집순이", "탐험가"] },
  { id: "t-buy", q: "최근에 제일 잘 산 물건", kind: "text", placeholder: "예) 무선 이어폰, 전기장판", botAnswers: ["전기장판", "무선 청소기", "러닝화", "목베개", "에어프라이어"] },
  { id: "t-kid", q: "어릴 때 장래희망", kind: "text", placeholder: "예) 우주비행사, 떡볶이집 사장", botAnswers: ["우주비행사", "떡볶이집 사장", "과학자", "축구 선수", "만화가"] },
  { id: "t-food", q: "평생 하나만 먹어야 한다면?", kind: "text", placeholder: "예) 김치찌개", botAnswers: ["김치찌개", "떡볶이", "치킨", "초밥", "라면"] },
  { id: "t-song", q: "요즘 자주 듣는 노래나 가수", kind: "text", placeholder: "제목이나 가수 이름", botAnswers: ["잔잔한 플레이리스트", "아이돌 노래", "인디 밴드", "재즈", "라디오"] },
  { id: "t-skill", q: "나의 숨은 특기", kind: "text", placeholder: "예) 길 찾기, 성대모사", botAnswers: ["길 찾기", "성대모사", "종이접기", "빨리 잠들기", "맛집 찾기"] },
];

export interface TableQ {
  id: string;
  q: string;
  level: "light" | "deep";
  placeholder?: string;
}

/** 테이블 질문 — 다 같이 짧게 답하고 그 자리에서 공유 */
export const TABLE_QS: TableQ[] = [
  { id: "l-holiday", q: "지금 당장 하루 휴가가 생기면 뭐 할래요?", level: "light" },
  { id: "l-island", q: "무인도에 딱 하나만 가져간다면?", level: "light" },
  { id: "l-small", q: "요즘 나의 소소한 행복은?", level: "light" },
  { id: "l-laugh", q: "최근에 크게 웃었던 일은?", level: "light" },
  { id: "l-nick", q: "학창 시절 별명이 있었다면?", level: "light", placeholder: "없으면 지금 하나 지어도 OK" },
  { id: "l-store", q: "편의점에서 늘 집는 것 하나", level: "light" },
  { id: "l-reborn", q: "다시 태어나면 해 보고 싶은 일은?", level: "light" },
  { id: "l-power", q: "초능력 하나를 고른다면?", level: "light" },
  { id: "l-useless", q: "최근에 산 가장 쓸데없는 물건은?", level: "light" },
  { id: "l-photo", q: "내 사진첩 최근 사진 한 장을 말로 설명하면?", level: "light" },
  { id: "l-sunday", q: "나에게 완벽한 일요일은?", level: "light" },
  { id: "l-app", q: "요즘 제일 많이 여는 앱은?", level: "light" },
  { id: "l-believe", q: "어릴 때 진짜라고 믿었던 이상한 것", level: "light" },
  { id: "l-menu", q: "나만 아는 맛있는 메뉴 하나 추천해 주세요", level: "light" },
  { id: "l-sleep", q: "어디서든 잘 자는 편? 내 최고 기록은?", level: "light" },
  { id: "l-rich", q: "갑자기 1억이 생기면 제일 먼저 할 일", level: "light" },
  { id: "l-trip", q: "가장 기억에 남는 여행지 한 곳", level: "light" },
  { id: "l-movie", q: "몇 번이고 다시 볼 수 있는 영화나 드라마", level: "light" },
  { id: "l-habit", q: "나만의 사소한 습관 하나", level: "light" },
  { id: "l-time", q: "타임머신이 있다면 언제로 가 볼래요?", level: "light" },

  { id: "d-worry", q: "요즘 제일 많이 생각하는 것 하나", level: "deep" },
  { id: "d-proud", q: "올해 스스로 잘했다 싶은 일", level: "deep" },
  { id: "d-nextyear", q: "1년 뒤 나는 뭘 하고 있을까?", level: "deep" },
  { id: "d-praise", q: "들었던 칭찬 중 오래 기억나는 것", level: "deep" },
  { id: "d-learn", q: "요즘 새로 배워 보고 싶은 것", level: "deep" },
  { id: "d-changed", q: "최근에 생각이 바뀐 것 하나", level: "deep" },
  { id: "d-energy", q: "지칠 때 나를 충전해 주는 것", level: "deep" },
  { id: "d-friend", q: "같이 있으면 편한 사람의 특징은?", level: "deep" },
];

/** 봇이 테이블 질문에 쓰는 답 (테스트·혼자 해보기용) */
export const BOT_TABLE_ANSWERS = [
  "늦잠 자고 산책", "라면 한 봉지", "고양이 영상 보기", "친구랑 떡볶이", "바다 보러 가기", "순간이동",
  "아무것도 안 하기", "보드게임", "새로운 카페 찾기", "잠은 어디서나 꿀잠", "강아지 산책", "노래방",
];

/** AI가 없을 때 쓰는 '왜?' 꼬리 질문 */
export const WHY_FALLBACKS = [
  "왜 하필 그거예요?",
  "그거 언제부터였어요?",
  "그 얘기, 30초만 더 들려줄래요?",
  "그거 처음 알게 된 계기가 궁금해요!",
  "다른 사람들은 들어 본 적 있어요?",
  "그거 했을 때 제일 좋았던 순간은?",
];
