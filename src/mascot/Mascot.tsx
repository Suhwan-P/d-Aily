import { useId } from "react";
import css from "./Mascot.module.css";

/**
 * 왜무새 — 뭐든 "왜?"라고 묻는 동글동글 파스텔 앵무새.
 * 기존 Mascot과 같은 이름·속성으로 바꿔 끼울 수 있게 유지한다.
 * inspect = 부리를 벌리고 "왜?" 묻는 얼굴
 */
export type MascotMood = "idle" | "happy" | "cheer" | "wow" | "thinking" | "sad" | "inspect";

interface Props {
  mood?: MascotMood;
  size?: number; // 너비(px). 높이 = 너비 × 1.1
  className?: string;
}

const C = {
  line: "#56558f",
  body: "#a9b6f5",
  bodyDeep: "#8f9ce8",
  cream: "#fffaf0",
  beak: "#ffd67a",
  beakLine: "#d9a441",
  mouth: "#f39aa6",
  eye: "#4a4878",
  blush: "#ffc4cc",
  spark: "#ffd96b",
};

export function Mascot({ mood = "idle", size = 120, className }: Props) {
  const uid = useId().replace(/:/g, "");
  const clip = `wm-body-${uid}`;

  const open = mood === "inspect" || mood === "wow" || mood === "cheer";
  const closedEyes = mood === "happy" || mood === "cheer";

  const bodyAnim = mood === "cheer" ? css.cheer : mood === "sad" ? css.sad : mood === "thinking" ? css.think : css.bob;

  // 날개: [cx, cy, 회전각]
  const leftWing: [number, number, number] = mood === "cheer" ? [16, 58, 35] : [17, 88, 14];
  const rightWing: [number, number, number] =
    mood === "cheer" ? [104, 58, -35] : mood === "thinking" ? [88, 84, -38] : [103, 88, -14];

  return (
    <svg
      className={className}
      width={size}
      height={size * 1.1}
      viewBox="0 0 120 132"
      role="img"
      aria-label="왜무새"
      style={{ overflow: "visible", flex: "none" }}
    >
      <defs>
        <clipPath id={clip}>
          <path d="M60 22c-28 0-48 22-48 52 0 30 20 48 48 48s48-18 48-48c0-30-20-52-48-52z" />
        </clipPath>
      </defs>

      {/* 바닥 그림자 */}
      <ellipse cx="60" cy="126" rx="38" ry="5" fill="#d9d6f5" opacity="0.7" />

      <g className={bodyAnim}>
        {/* 발 */}
        <g fill={C.beak} stroke={C.beakLine} strokeWidth="2.5" strokeLinejoin="round">
          <path d="M40 116c-6 0-9 4-7 7h14c2-3-1-7-7-7z" />
          <path d="M80 116c-6 0-9 4-7 7h14c2-3-1-7-7-7z" />
        </g>

        {/* 머리 깃털 */}
        <g fill={C.body} stroke={C.line} strokeWidth="3" strokeLinejoin="round">
          <path d="M50 28c-4-10 2-17 9-15-1 5 0 10 3 13z" />
          <path d="M58 26c0-11 9-16 16-12-3 4-4 9-3 14z" />
        </g>

        {/* 몸 */}
        <path
          d="M60 22c-28 0-48 22-48 52 0 30 20 48 48 48s48-18 48-48c0-30-20-52-48-52z"
          fill={C.body}
          stroke={C.line}
          strokeWidth="3"
        />
        <g clipPath={`url(#${clip})`}>
          {/* 얼굴 크림 */}
          <path d="M60 40c-20 0-32 12-32 26 0 13 13 20 32 20s32-7 32-20c0-14-12-26-32-26z" fill={C.cream} />
          {/* 배 */}
          <ellipse cx="60" cy="108" rx="30" ry="22" fill={C.cream} />
          {/* 몸 아래쪽 음영 */}
          <path d="M12 96c10 18 28 26 48 26s38-8 48-26v40H12z" fill={C.bodyDeep} opacity="0.25" />
        </g>
        <path
          d="M60 22c-28 0-48 22-48 52 0 30 20 48 48 48s48-18 48-48c0-30-20-52-48-52z"
          fill="none"
          stroke={C.line}
          strokeWidth="3"
        />

        {/* 볼 */}
        <ellipse cx="36" cy="72" rx="7" ry="4.5" fill={C.blush} opacity="0.9" />
        <ellipse cx="84" cy="72" rx="7" ry="4.5" fill={C.blush} opacity="0.9" />

        {/* 눈 */}
        {closedEyes ? (
          <g fill="none" stroke={C.eye} strokeWidth="3.2" strokeLinecap="round">
            <path d="M40 62q6-7 12 0" />
            <path d="M68 62q6-7 12 0" />
          </g>
        ) : mood === "sad" ? (
          <g>
            <ellipse cx="46" cy="62" rx="4.6" ry="5.6" fill={C.eye} />
            <ellipse cx="74" cy="62" rx="4.6" ry="5.6" fill={C.eye} />
            <path d="M39 56l9-3M81 56l-9-3" stroke={C.eye} strokeWidth="2.4" strokeLinecap="round" />
          </g>
        ) : (
          <g>
            {[46, 74].map((cx) => (
              <ellipse key={cx} cx={cx} cy="60" rx={mood === "wow" ? 5.6 : 5} ry={mood === "wow" ? 7.4 : 6.8} fill={C.eye}>
                <animate
                  attributeName="ry"
                  values={mood === "wow" ? "7.4;7.4;0.8;7.4" : "6.8;6.8;0.8;6.8"}
                  keyTimes="0;0.93;0.96;1"
                  dur="4.2s"
                  repeatCount="indefinite"
                />
              </ellipse>
            ))}
            {[47.6, 75.6].map((cx) => (
              <circle key={cx} cx={cx} cy="57" r="1.8" fill="#fff">
                <animate attributeName="opacity" values="1;1;0;1" keyTimes="0;0.93;0.96;1" dur="4.2s" repeatCount="indefinite" />
              </circle>
            ))}
          </g>
        )}

        {/* 부리 */}
        {open ? (
          <g stroke={C.beakLine} strokeWidth="2.4" strokeLinejoin="round">
            <path d="M51 66c0-5 4-8 9-8s9 3 9 8z" fill={C.beak} />
            <path d="M52 67h16c0 7-4 12-8 12s-8-5-8-12z" fill={C.mouth} />
          </g>
        ) : (
          <path
            d="M52 66c0-5 4-8 8-8s8 3 8 8c0 5-4 9-8 11-4-2-8-6-8-11z"
            fill={C.beak}
            stroke={C.beakLine}
            strokeWidth="2.4"
            strokeLinejoin="round"
          />
        )}

        {/* 날개 */}
        {[leftWing, rightWing].map(([cx, cy, r], i) => (
          <ellipse
            key={i}
            cx={cx}
            cy={cy}
            rx="8.5"
            ry="14"
            transform={`rotate(${r} ${cx} ${cy})`}
            fill={C.body}
            stroke={C.line}
            strokeWidth="3"
          />
        ))}
      </g>

      {/* 감정 표시 */}
      {(mood === "inspect" || mood === "wow") && (
        <g
          stroke={C.spark}
          strokeWidth="3.4"
          strokeLinecap="round"
        >
          <path d="M100 24l6-7M106 34l9-2M96 16l1-9" />
        </g>
      )}
      {mood === "thinking" && (
        <text x="96" y="22" fontSize="22" fontWeight="900" fill="#a596f2" className={css.floatQ}>
          ?
        </text>
      )}
      {mood === "cheer" && (
        <g fill="#ffb3c7">
          <path d="M14 22c-3-4 2-8 5-4 3-4 8 0 5 4l-5 5z" />
          <path d="M100 14c-2-3 1-6 4-3 2-3 6 0 4 3l-4 4z" />
        </g>
      )}
    </svg>
  );
}
