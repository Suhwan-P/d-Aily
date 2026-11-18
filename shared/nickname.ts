// 왜무새 파티 랜덤 닉네임: 형용사 + 명사 (붙여 쓰기, 10자 이내)
const ADJ = [
  "궁금한", "엉뚱한", "수상한", "능청맞은", "뻔뻔한", "의심많은", "진지한", "졸린",
  "배고픈", "수다쟁이", "눈치빠른", "시치미뗀", "갸우뚱한", "아는척하는", "당당한",
  "허둥대는", "몰래온", "반짝이는", "음흉한", "솔직한", "그럴듯한", "속닥이는", "말랑한", "꾀많은",
];
const NOUN = [
  "왜무새", "앵무새", "펭귄", "부엉이", "참새", "병아리", "오리", "해달", "웜뱃", "문어",
  "나무늘보", "코알라", "하마", "벌새", "개구리", "비둘기", "염소", "북극곰", "새우", "물음표",
  "탐정", "깃털", "쇠똥구리", "거미",
];

export const NAME_MAX = 10;

export function randomNickname(avoid: string[] = []): string {
  const taken = new Set(avoid);
  for (let i = 0; i < 50; i++) {
    const a = ADJ[Math.floor(Math.random() * ADJ.length)];
    const n = NOUN[Math.floor(Math.random() * NOUN.length)];
    const name = a + n;
    if (name.length <= NAME_MAX && !taken.has(name)) return name;
  }
  return "궁금한왜무새";
}
