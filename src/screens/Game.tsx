import { useEffect, useMemo, useState } from "react";
import type { PublicPlayer, RevealItem, View } from "../../shared/engine";
import { LIMITS } from "../../shared/engine";
import type { Action, Conn } from "../conn";
import { Mascot, type MascotMood } from "../mascot/Mascot";

interface Props {
  view: View;
  conn: Conn;
  offset: number;
  status: "connecting" | "online" | "offline";
  onLeave: () => void;
}

function useNow(ms = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function Dot({ p, size = 34 }: { p: { name: string; color: string }; size?: number }) {
  const ch = [...p.name.replace("🤖", "")][0] ?? "?";
  return (
    <span className="dot" style={{ background: p.color, width: size, height: size, fontSize: size * 0.46 }} title={p.name}>
      {ch}
    </span>
  );
}

export function GameScreen({ view, conn, offset, status, onLeave }: Props) {
  const [toast, setToast] = useState("");
  const isHost = view.me === view.hostId;

  async function act(a: Action) {
    const r = await conn.send(a);
    if (!r.ok && r.error) {
      setToast(r.error);
      setTimeout(() => setToast(""), 2600);
    }
    return r;
  }

  const body = (() => {
    switch (view.phase) {
      case "lobby":
        return <Lobby view={view} isHost={isHost} act={act} online={conn.online} />;
      case "write":
        return <Write view={view} act={act} />;
      case "pick":
        return <Pick view={view} act={act} />;
      case "reveal":
        return <Reveal view={view} act={act} />;
      case "round":
        return <RoundResult view={view} isHost={isHost} act={act} offset={offset} />;
      case "final":
        return <Final view={view} isHost={isHost} act={act} onLeave={onLeave} />;
    }
  })();

  return (
    <main className={`page phase-${view.phase}`}>
      <TopBar view={view} offset={offset} onLeave={onLeave} online={conn.online} />
      {status === "offline" && conn.online && <div className="banner">연결이 끊겼어요. 다시 잇는 중…</div>}
      {body}
      {toast && <div className="toast">{toast}</div>}
    </main>
  );
}

function TopBar({ view, offset, onLeave, online }: { view: View; offset: number; onLeave: () => void; online: boolean }) {
  const now = useNow();
  const left = view.deadline ? Math.max(0, Math.ceil((view.deadline - (now + offset)) / 1000)) : null;
  const total = view.phase === "write" ? view.settings.writeSec : view.phase === "pick" ? view.settings.pickSec : 12;
  const showTimer = left !== null && (view.phase === "write" || view.phase === "pick");
  const [armed, setArmed] = useState(false);
  return (
    <header className="topbar">
      <button
        className={`ghost ${armed ? "armed" : ""}`}
        onClick={() => {
          // 게임 중엔 두 번 눌러야 나감 (실수 방지, confirm 창 대신)
          if (view.phase === "lobby" || view.phase === "final" || armed) return onLeave();
          setArmed(true);
          setTimeout(() => setArmed(false), 2500);
        }}
        aria-label="나가기"
      >
        {armed ? "한 번 더 누르면 나가요" : "←"}
      </button>
      <div className="topmid">
        {view.phase === "lobby" ? (
          <span className="chip">{online ? `방 ${view.code}` : "혼자 해보기"}</span>
        ) : view.phase === "final" ? (
          <span className="chip">최종 결과</span>
        ) : (
          <span className="chip">
            라운드 {view.round}/{view.totalRounds}
            {view.doubleRound && <b className="x2"> 점수 2배</b>}
          </span>
        )}
      </div>
      <div className={`timer ${showTimer && left! <= 5 ? "hurry" : ""}`}>{showTimer ? left : ""}</div>
      {showTimer && (
        <div className="timebar">
          <i style={{ width: `${Math.min(100, (left! / total) * 100)}%` }} />
        </div>
      )}
    </header>
  );
}

function QuestionCard({ view, mood = "inspect", small }: { view: View; mood?: MascotMood; small?: boolean }) {
  if (!view.question) return null;
  return (
    <section className={`qcard ${small ? "small" : ""}`}>
      <Mascot mood={mood} size={small ? 56 : 84} />
      <div className="qbody">
        <span className="qcat">{view.question.category}</span>
        <p className="qtext">{view.question.q}</p>
      </div>
    </section>
  );
}

function Waiting({ players, label }: { players: PublicPlayer[]; label: string }) {
  const done = players.filter((p) => p.done).length;
  const active = players.filter((p) => p.online || p.isBot);
  return (
    <div className="waiting">
      <p>
        {label} <b>{done}</b>/{active.length}
      </p>
      <div className="dots">
        {players.map((p) => (
          <span key={p.id} className={`wdot ${p.done ? "on" : ""} ${!p.online && !p.isBot ? "away" : ""}`}>
            <Dot p={p} size={30} />
            {p.done && <i>✓</i>}
          </span>
        ))}
      </div>
    </div>
  );
}

// ───────── 로비 ─────────
function Lobby({ view, isHost, act, online }: { view: View; isHost: boolean; act: (a: Action) => Promise<unknown>; online: boolean }) {
  const link = `${location.origin}${location.pathname}?room=${view.code}`;
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: "왜무새 파티", text: `왜무새 파티 방 ${view.code}에 들어와!`, url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* 취소 */
    }
  }
  return (
    <div className="stack">
      {online && (
        <section className="card center">
          <p className="hint">친구에게 코드를 알려 주세요</p>
          <div className="bigcode">
            {view.code.split("").map((c, i) => (
              <span key={i}>{c}</span>
            ))}
          </div>
          <button className="btn soft" onClick={share}>
            {copied ? "링크 복사됨!" : "🔗 초대 링크 보내기"}
          </button>
        </section>
      )}

      <section className="card">
        <div className="cardhead">
          <h3>모인 사람 {view.players.length}명</h3>
          {isHost && view.players.length < LIMITS.maxPlayers && (
            <button className="btn tiny" onClick={() => act({ type: "addBot" })}>
              + 봇
            </button>
          )}
        </div>
        <ul className="plist">
          {view.players.map((p) => (
            <li key={p.id} className={!p.online && !p.isBot ? "away" : ""}>
              <Dot p={p} />
              <span className="pname">
                {p.name}
                {p.id === view.me && <em> (나)</em>}
              </span>
              {p.id === view.hostId && <span className="crown">방장</span>}
              {isHost && p.id !== view.me && (
                <button className="ghost x" onClick={() => act({ type: "kick", playerId: p.id })} aria-label="내보내기">
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isHost ? (
        <section className="card stack">
          <div className="setting">
            <span>라운드</span>
            <Seg options={[3, 5, 7]} value={view.settings.rounds} onPick={(n) => act({ type: "settings", settings: { rounds: n } })} suffix="판" />
          </div>
          <div className="setting">
            <span>쓰는 시간</span>
            <Seg options={[30, 45, 60]} value={view.settings.writeSec} onPick={(n) => act({ type: "settings", settings: { writeSec: n } })} suffix="초" />
          </div>
          <button className="btn primary big" onClick={() => act({ type: "start" })} disabled={view.players.length < 2}>
            {view.players.length < 2 ? "두 명 이상 모이면 시작" : "시작하기"}
          </button>
        </section>
      ) : (
        <div className="waitmsg">
          <Mascot mood="thinking" size={70} />
          <p>방장이 시작하길 기다리는 중…</p>
        </div>
      )}
    </div>
  );
}

function Seg({ options, value, onPick, suffix }: { options: number[]; value: number; onPick: (n: number) => void; suffix: string }) {
  return (
    <div className="seg">
      {options.map((n) => (
        <button key={n} className={n === value ? "on" : ""} onClick={() => onPick(n)}>
          {n}
          {suffix}
        </button>
      ))}
    </div>
  );
}

// ───────── 쓰기 ─────────
function Write({ view, act }: { view: View; act: (a: Action) => Promise<{ ok: boolean; text?: string }> }) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(!view.myAnswer);
  useEffect(() => {
    if (!view.myAnswer) {
      setEditing(true);
      setText("");
    }
  }, [view.round, view.myAnswer]);

  async function submit() {
    const r = await act({ type: "answer", text });
    if (r.ok) setEditing(false);
  }

  async function suggest() {
    const r = await act({ type: "suggest" });
    if (r.ok && r.text) setText(r.text);
  }

  return (
    <div className="stack">
      <QuestionCard view={view} />
      {editing ? (
        <section className="card stack">
          <p className="lead">
            친구들이 믿을 만한 <b>가짜 이유</b>를 써 주세요
          </p>
          <textarea
            value={text}
            maxLength={LIMITS.maxAnswer}
            rows={2}
            autoFocus
            placeholder="예) ○○이 ○○해서"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                e.preventDefault();
                if (text.trim()) submit();
              }
            }}
          />
          <span className="hint right count">
            {text.length}/{LIMITS.maxAnswer}
          </span>
          <div className="row between">
            <button className="btn tiny soft" onClick={suggest}>
              💡 거짓말 추천받기
            </button>

            <button className="btn primary" disabled={!text.trim()} onClick={submit}>
              이걸로 속이기
            </button>
          </div>
        </section>
      ) : (
        <section className="card center stack">
          <p className="hint">내 거짓말</p>
          <p className="myanswer">“{view.myAnswer}”</p>
          <button
            className="btn tiny soft"
            onClick={() => {
              setText(view.myAnswer ?? "");
              setEditing(true);
            }}
          >
            고치기
          </button>
        </section>
      )}
      <Waiting players={view.players} label="다 쓴 사람" />
    </div>
  );
}

// ───────── 고르기 ─────────
function Pick({ view, act }: { view: View; act: (a: Action) => Promise<unknown> }) {
  return (
    <div className="stack">
      <QuestionCard view={view} mood="thinking" small />
      <p className="lead center">
        이 중 <b>진짜 이유</b>는 딱 하나!
      </p>
      <div className="options">
        {view.options?.map((o, i) => (
          <button
            key={o.id}
            className={`opt ${view.myPick === o.id ? "picked" : ""} ${o.mine ? "mine" : ""}`}
            disabled={o.mine}
            onClick={() => act({ type: "pick", optionId: o.id })}
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {o.text}
            {o.mine && <span className="minetag">내 거짓말</span>}
          </button>
        ))}
      </div>
      <Waiting players={view.players} label="고른 사람" />
    </div>
  );
}

// ───────── 공개 ─────────
function Reveal({ view, act }: { view: View; act: (a: Action) => Promise<unknown> }) {
  const items = view.reveal?.items ?? [];
  const item = items[items.length - 1] as RevealItem | undefined;
  const iPicked = !!item?.pickers.some((p) => p.id === view.me);
  const iWrote = !!item?.authors.some((a) => a.id === view.me);

  useEffect(() => {
    if (!item || !iPicked) return;
    try {
      navigator.vibrate?.(item.isTruth ? 60 : [30, 40, 30]);
    } catch {
      /* 진동 미지원 */
    }
  }, [item?.optionId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;
  const mood: MascotMood = item.isTruth ? "wow" : item.pickers.length >= 2 ? "cheer" : "happy";

  return (
    <div className="stack">
      <QuestionCard view={view} mood={mood} small />
      <div className="progress">
        {items.map((it, i) => (
          <i key={it.optionId} className={i === items.length - 1 ? "now" : ""} />
        ))}
      </div>
      <RevealCard key={item.optionId} item={item} view={view} act={act} iPicked={iPicked} iWrote={iWrote} />
    </div>
  );
}

function RevealCard({
  item,
  view,
  act,
  iPicked,
  iWrote,
}: {
  item: RevealItem;
  view: View;
  act: (a: Action) => Promise<unknown>;
  iPicked: boolean;
  iWrote: boolean;
}) {
  const liked = view.myLikes.includes(item.optionId);
  return (
    <section className={`reveal ${item.isTruth ? "is-truth" : "is-fake"}`}>
      <p className="rtext">“{item.text}”</p>
      <div className="pickers">
        <span className="hint">{item.pickers.length ? "이걸 고른 사람" : "아무도 안 골랐어요"}</span>
        <div className="dots">
          {item.pickers.map((p, i) => (
            <span key={p.id} className="pin" style={{ animationDelay: `${300 + i * 120}ms` }}>
              <Dot p={p} size={30} />
              <small>{p.name}</small>
            </span>
          ))}
        </div>
      </div>

      <div className="stamp">{item.isTruth ? "진짜!" : "거짓말!"}</div>

      <div className="verdict">
        {item.isTruth ? (
          <>
            <p>
              맞힌 사람 <b>+{item.points.toLocaleString()}</b>
            </p>
            {view.question?.explain && <p className="explain">{view.question.explain}</p>}
            {iPicked && <p className="me good">간파 성공! 🔍</p>}
          </>
        ) : item.isHouse ? (
          <>
            <p>
              <b>왜무새</b>의 거짓말이었어요 🦜
            </p>
            {iPicked && <p className="me bad">왜무새한테 속았다!</p>}
          </>
        ) : (
          <>
            <p className="authors">
              {item.authors.map((a) => (
                <span key={a.id} className="author">
                  <Dot p={a} size={26} /> {a.name}
                </span>
              ))}
              의 거짓말 <b>+{item.points.toLocaleString()}</b>
            </p>
            {iWrote && <p className="me good">{item.pickers.length}명을 속였어요 😎</p>}
            {iPicked && <p className="me bad">속았다…!</p>}
          </>
        )}
        {!item.isTruth && !iWrote && (
          <button className={`lol ${liked ? "on" : ""}`} onClick={() => act({ type: "like", optionId: item.optionId })}>
            ㅋㅋ {item.likes > 0 ? item.likes : ""}
          </button>
        )}
      </div>
    </section>
  );
}

// ───────── 라운드 결과 ─────────
function RoundResult({ view, isHost, act, offset }: { view: View; isHost: boolean; act: (a: Action) => Promise<unknown>; offset: number }) {
  const now = useNow(500);
  const left = view.deadline ? Math.max(0, Math.ceil((view.deadline - (now + offset)) / 1000)) : 0;
  const deltas = new Map(view.deltas?.map((d) => [d.id, d]));
  const sorted = useMemo(() => view.players.slice().sort((a, b) => b.score - a.score), [view.players]);
  const last = view.round >= view.totalRounds;
  const fakes = (view.reveal?.items ?? []).filter((i) => !i.isTruth && !i.isHouse);
  const funniest = fakes.slice().sort((a, b) => b.likes - a.likes)[0];

  return (
    <div className="stack">
      <section className="card truthcard">
        <span className="qcat">진짜 이유</span>
        <p className="qtext">{view.question?.q}</p>
        <p className="answer">{view.question?.answer}</p>
        <p className="explain">{view.question?.explain}</p>
      </section>

      {funniest && funniest.likes > 0 && (
        <section className="card lolcard">
          <span>이번 판 ㅋㅋ 1위</span>
          <p>
            “{funniest.text}” <small>— {funniest.authors.map((a) => a.name).join(", ")}</small>
          </p>
        </section>
      )}

      <section className="card">
        <h3>순위</h3>
        <ol className="board">
          {sorted.map((p, i) => {
            const d = deltas.get(p.id);
            return (
              <li key={p.id} className={p.id === view.me ? "me" : ""}>
                <span className="rank">{i + 1}</span>
                <Dot p={p} size={30} />
                <span className="who">
                  <span className="pname">{p.name}</span>
                  <span className="deltas">
                  {!!d?.truth && <span className="tag truth">간파 +{d.truth}</span>}
                  {!!d?.fool && <span className="tag fool">속임 +{d.fool}</span>}
                  </span>
                </span>
                <span className="score">{p.score.toLocaleString()}</span>
              </li>
            );
          })}
        </ol>
      </section>

      {isHost ? (
        <button className="btn primary big" onClick={() => act({ type: "advance" })}>
          {last ? "최종 결과 보기" : "다음 라운드"} <small>({left})</small>
        </button>
      ) : (
        <p className="hint center">
          {left}초 뒤 {last ? "최종 결과" : "다음 라운드"}…
        </p>
      )}
    </div>
  );
}

// ───────── 최종 ─────────
function Final({ view, isHost, act, onLeave }: { view: View; isHost: boolean; act: (a: Action) => Promise<unknown>; onLeave: () => void }) {
  const sorted = view.players.slice().sort((a, b) => b.score - a.score);
  const podium = [sorted[1], sorted[0], sorted[2]];
  const winners = sorted.filter((p) => p.score === sorted[0]?.score && p.score > 0);
  return (
    <div className="stack">
      <div className="finalhero">
        <Mascot mood="cheer" size={96} />
        <h2 className="title">
          {winners.length > 1 ? `공동 우승! ${winners.map((w) => w.name).join(", ")}` : `오늘의 우승은 ${sorted[0]?.name}!`}
        </h2>
      </div>

      <div className="podium">
        {podium.map((p, i) =>
          p ? (
            <div key={p.id} className={`pod pod${i}`}>
              <Dot p={p} size={i === 1 ? 52 : 42} />
              <b>{p.name}</b>
              <span>{p.score.toLocaleString()}</span>
              <div className="block">{i === 1 ? 1 : i === 0 ? 2 : 3}</div>
            </div>
          ) : (
            <div key={i} className="pod empty" />
          ),
        )}
      </div>

      {view.awards && view.awards.length > 0 && (
        <section className="awards">
          {view.awards.map((a) => (
            <div key={a.title} className="award">
              <span className="aemoji">{a.emoji}</span>
              <div>
                <b>{a.title}</b> · {a.name}
                <p>{a.detail}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {view.bestLine && (
        <section className="card lolcard">
          <span>오늘의 명대사</span>
          <p className="hint">{view.bestLine.q}</p>
          <p>
            “{view.bestLine.text}” <small>— {view.bestLine.name}</small>
          </p>
        </section>
      )}

      <section className="card">
        <ol className="board">
          {sorted.map((p, i) => (
            <li key={p.id} className={p.id === view.me ? "me" : ""}>
              <span className="rank">{i + 1}</span>
              <Dot p={p} size={30} />
              <span className="who">
                <span className="pname">{p.name}</span>
                <span className="deltas">
                  <span className="tag truth">간파 {p.truth.toLocaleString()}</span>
                  <span className="tag fool">속임 {p.fool.toLocaleString()}</span>
                </span>
              </span>
              <span className="score">{p.score.toLocaleString()}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="row">
        {isHost ? (
          <button className="btn primary big grow" onClick={() => act({ type: "start" })}>
            한 판 더!
          </button>
        ) : (
          <p className="hint grow center">방장이 한 판 더 할지 고르는 중…</p>
        )}
        <button className="btn" onClick={onLeave}>
          나가기
        </button>
      </div>
    </div>
  );
}
