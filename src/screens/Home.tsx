import { useState } from "react";
import { Mascot } from "../mascot/Mascot";

interface Props {
  name: string;
  setName: (s: string) => void;
  onReroll: () => void;
  initialCode: string;
  busy: boolean;
  error: string;
  soloOnly: boolean;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onSolo: () => void;
}

export function Home({ name, setName, onReroll, initialCode, busy, error, soloOnly, onCreate, onJoin, onSolo }: Props) {
  const [code, setCode] = useState(initialCode);
  const joining = !!initialCode;

  return (
    <main className="page home">
      <div className="hero">
        <div className="bubble pop">왜?</div>
        <Mascot mood="inspect" size={132} />
        <p className="kicker">왜무새 파티</p>
        <h1 className="title">진짜 이유를 찾아라</h1>
        <p className="sub">
          왜무새의 질문에 <b>그럴듯한 가짜 이유</b>를 쓰고,
          <br />
          친구들의 거짓말 사이에서 <b>진짜</b>를 골라내세요.
        </p>
      </div>

      <section className="card stack">
        <div className="field">
          <span>닉네임 (🎲로 다시 뽑기)</span>
          <div className="row">
            <input
              className="grow"
              value={name}
              maxLength={10}
              placeholder="최대 10자"
              onChange={(e) => setName(e.target.value)}
              autoComplete="off"
            />
            <button className="btn dice" onClick={onReroll} aria-label="닉네임 다시 뽑기">
              🎲
            </button>
          </div>
        </div>

        {!soloOnly && (
          <>
            {joining ? (
              <button className="btn primary big" disabled={busy} onClick={() => onJoin(code)}>
                {code} 방 들어가기
              </button>
            ) : (
              <button className="btn primary big" disabled={busy} onClick={onCreate}>
                방 만들기
              </button>
            )}
            <div className="row">
              <input
                className="code-input"
                value={code}
                maxLength={4}
                placeholder="방 코드"
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
              />
              <button className="btn" disabled={busy || code.length !== 4} onClick={() => onJoin(code)}>
                코드로 참여
              </button>
            </div>
          </>
        )}

        <button className={`btn ${soloOnly ? "primary big" : "soft"}`} disabled={busy} onClick={onSolo}>
          🤖 혼자 해보기 (봇 3마리와)
        </button>
        {busy && <p className="hint">서버에 연결하는 중… 무료 서버가 자고 있으면 1분쯤 걸려요</p>}
        {error && <p className="error">{error}</p>}
        {soloOnly && <p className="hint">미리보기 버전이에요. 친구와 하는 온라인 방은 배포한 주소에서 열 수 있어요.</p>}
      </section>

      <section className="howto">
        <h2>이렇게 놀아요</h2>
        <ol>
          <li>
            <b>속이기</b> 왜무새가 "왜?" 질문을 던지면, 진짜처럼 들리는 가짜 이유를 써요. 정답을 몰라도 괜찮아요, 그럴듯하면 돼요! 막히면 💡 추천받기.
          </li>
          <li>
            <b>고르기</b> 진짜 이유 + 모두의 거짓말 + 왜무새의 거짓말이 섞여 나와요. 진짜를 골라요.
          </li>
          <li>
            <b>공개</b> 진짜를 맞히면 <span className="tag truth">간파 +1000</span>, 내 거짓말에 한 명 속을 때마다{" "}
            <span className="tag fool">속임 +500</span>. 마지막 라운드는 2배!
          </li>
        </ol>
      </section>
    </main>
  );
}
