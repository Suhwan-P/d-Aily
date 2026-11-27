import { useEffect, useRef, useState } from "react";
import { LIMITS, PASS, type PublicPlayer, type View } from "../../shared/intro/engine";
import { randomNickname } from "../../shared/nickname";
import { Mascot } from "../mascot/Mascot";
import { Dot } from "../screens/Game";
import { connectOnline, createLocal, savedSession, type Action, type Conn } from "./conn";

type Act = (a: Action) => Promise<{ ok: boolean; error?: string }>;

function useNow(ms = 250) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export default function IntroApp() {
  const [conn, setConn] = useState<Conn | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [status, setStatus] = useState<"connecting" | "online" | "offline">("online");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const offset = useRef(0);
  const roomFromUrl = new URLSearchParams(location.search).get("room")?.toUpperCase() ?? "";

  useEffect(() => {
    const s = savedSession();
    if (!s || (roomFromUrl && roomFromUrl !== s.code)) return;
    setBusy(true);
    connectOnline({ kind: "resume", ...s }, setStatus)
      .then(attach)
      .catch(() => {})
      .finally(() => setBusy(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function attach(c: Conn) {
    setConn(c);
    c.subscribe((v) => {
      offset.current = v.serverNow - Date.now();
      setView(v);
    });
  }

  async function go(kind: "create" | "join" | "solo", code?: string) {
    const n = name.trim();
    if (!n) return setError("이름이나 별명을 먼저 써 주세요");
    setError("");
    if (kind === "solo") return attach(createLocal(n, 3));
    setBusy(true);
    setStatus("connecting");
    try {
      attach(await connectOnline(kind === "create" ? { kind, name: n } : { kind, code: code ?? "", name: n }, setStatus));
      const url = new URL(location.href);
      url.searchParams.delete("room");
      history.replaceState(null, "", url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function leave() {
    conn?.close();
    setConn(null);
    setView(null);
  }

  if (conn && view) return <Table view={view} conn={conn} offset={offset.current} status={status} onLeave={leave} />;
  return (
    <Home
      name={name}
      setName={setName}
      initialCode={roomFromUrl}
      busy={busy}
      error={error}
      onCreate={() => go("create")}
      onJoin={(c) => go("join", c)}
      onSolo={() => go("solo")}
    />
  );
}

// ───────── 홈 ─────────
function Home(p: {
  name: string;
  setName: (s: string) => void;
  initialCode: string;
  busy: boolean;
  error: string;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onSolo: () => void;
}) {
  const [code, setCode] = useState(p.initialCode);
  return (
    <main className="page home intro">
      <div className="hero">
        <div className="bubble pop">넌 누구야?</div>
        <Mascot mood="inspect" size={124} />
        <p className="kicker">왜무새 테이블</p>
        <h1 className="title">처음 만난 사이</h1>
        <p className="sub">
          왜무새가 <b>가벼운 질문</b>을 던지면 다 같이 짧게 답하고,
          <br />그 자리에서 <b>서로를 알아가요.</b> (2~6명)
        </p>
      </div>

      <section className="card stack">
        <div className="field">
          <span>이름 · 실명도 별명도 OK</span>
          <div className="row">
            <input className="grow" value={p.name} maxLength={LIMITS.maxName} placeholder="예) 수환, 또는 별명" onChange={(e) => p.setName(e.target.value)} autoComplete="off" />
            <button className="btn dice" onClick={() => p.setName(randomNickname([p.name]))} aria-label="별명 뽑기" title="익명으로 하고 싶으면 별명 뽑기">
              🎲
            </button>
          </div>
        </div>
        {p.initialCode ? (
          <button className="btn primary big" disabled={p.busy} onClick={() => p.onJoin(code)}>
            {code} 테이블 앉기
          </button>
        ) : (
          <button className="btn primary big" disabled={p.busy} onClick={p.onCreate}>
            테이블 만들기
          </button>
        )}
        <div className="row">
          <input className="code-input" value={code} maxLength={4} placeholder="방 코드" onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} />
          <button className="btn" disabled={p.busy || code.length !== 4} onClick={() => p.onJoin(code)}>
            코드로 참여
          </button>
        </div>
        <button className="btn soft" disabled={p.busy} onClick={p.onSolo}>
          🤖 혼자 미리 해보기 (봇 3명과)
        </button>
        {p.busy && <p className="hint">서버에 연결하는 중… 무료 서버가 자고 있으면 1분쯤 걸려요</p>}
        {p.error && <p className="error">{p.error}</p>}
      </section>

      <section className="howto">
        <h2>이렇게 진행돼요</h2>
        <ol>
          <li>
            <b>소개 모으기</b> 왜무새가 짧은 질문 5개를 해요. 답은 바로 공개되지 않고 게임 중에 하나씩 나와요.
          </li>
          <li>
            <b>테이블 질문</b> 다 같이 한 줄로 답하면 한꺼번에 공개! 왜무새가 한 명에게 <b>"왜?"</b>를 물어요. 폰은 내려놓고 얘기해요.
          </li>
          <li>
            <b>맞혀 봐요</b> 사이사이 "누구 답일까?", "같은 답을 한 사람은?" 같은 퀴즈가 나와요.
          </li>
          <li>
            <b>오늘의 우리</b> 마지막에 모두의 소개 카드와 공통점이 정리돼요.
          </li>
        </ol>
        <p className="hint">모든 질문은 '패스'할 수 있어요. 답은 방이 끝나면 사라져요.</p>
      </section>
      <p className="hint center">
        <a href="/">← 왜무새 파티(진짜 이유를 찾아라)로</a>
      </p>
    </main>
  );
}

// ───────── 게임 ─────────
function Table({ view, conn, offset, status, onLeave }: { view: View; conn: Conn; offset: number; status: string; onLeave: () => void }) {
  const [toast, setToast] = useState("");
  const isHost = view.me === view.hostId;
  const act: Act = async (a) => {
    const r = await conn.send(a);
    if (!r.ok && r.error) {
      setToast(r.error);
      setTimeout(() => setToast(""), 2600);
    }
    return r;
  };
  const body = (() => {
    switch (view.phase) {
      case "lobby": return <Lobby view={view} isHost={isHost} act={act} online={conn.online} />;
      case "profile": return <Profile view={view} act={act} isHost={isHost} />;
      case "ask": return <Ask view={view} act={act} isHost={isHost} />;
      case "share": return <Share view={view} act={act} isHost={isHost} offset={offset} />;
      case "mini": return <Mini view={view} act={act} />;
      case "miniReveal": return <MiniReveal view={view} act={act} isHost={isHost} offset={offset} />;
      case "final": return <Final view={view} act={act} isHost={isHost} onLeave={onLeave} />;
    }
  })();
  return (
    <main className={`page intro phase-${view.phase}`}>
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
  const total = view.phase === "ask" ? view.settings.answerSec : view.phase === "mini" ? 20 : 0;
  const [armed, setArmed] = useState(false);
  const label =
    view.phase === "lobby" ? (online ? `테이블 ${view.code}` : "혼자 해보기")
    : view.phase === "profile" ? "소개 모으는 중"
    : view.phase === "final" ? "오늘의 우리"
    : `질문 ${view.round}/${view.totalRounds}`;
  const showTimer = left !== null && (view.phase === "ask" || view.phase === "mini" || view.phase === "profile");
  return (
    <header className="topbar">
      <button
        className={`ghost ${armed ? "armed" : ""}`}
        onClick={() => {
          if (view.phase === "lobby" || view.phase === "final" || armed) return onLeave();
          setArmed(true);
          setTimeout(() => setArmed(false), 2500);
        }}
        aria-label="나가기"
      >
        {armed ? "한 번 더 누르면 나가요" : "←"}
      </button>
      <div className="topmid">
        <span className="chip">{label}</span>
      </div>
      <div className={`timer ${showTimer && left! <= 5 ? "hurry" : ""}`}>{showTimer ? left : ""}</div>
      {showTimer && total > 0 && (
        <div className="timebar">
          <i style={{ width: `${Math.min(100, (left! / total) * 100)}%` }} />
        </div>
      )}
    </header>
  );
}

function Waiting({ players, label }: { players: PublicPlayer[]; label: string }) {
  const active = players.filter((p) => p.online || p.isBot);
  return (
    <div className="waiting">
      <p>
        {label} <b>{players.filter((p) => p.done).length}</b>/{active.length}
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

function Bird({ text, mood = "inspect" }: { text: React.ReactNode; mood?: "inspect" | "thinking" | "happy" | "cheer" | "wow" }) {
  return (
    <section className="birdsay">
      <Mascot mood={mood} size={64} />
      <div className="say">{text}</div>
    </section>
  );
}

function HostNext({ isHost, act, label, left }: { isHost: boolean; act: Act; label: string; left?: number | null }) {
  if (!isHost) return <p className="hint center">방장이 넘기면 다음으로 가요{left != null ? ` (${left}초)` : ""}</p>;
  return (
    <button className="btn primary big" onClick={() => act({ type: "advance" })}>
      {label} {left != null && <small>({left})</small>}
    </button>
  );
}

// ───────── 로비 ─────────
function Lobby({ view, isHost, act, online }: { view: View; isHost: boolean; act: Act; online: boolean }) {
  const link = `${location.origin}/intro.html?room=${view.code}`;
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: "왜무새 테이블", text: `왜무새 테이블 ${view.code}에 앉아요!`, url: link });
      else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* 취소 */
    }
  }
  const s = view.settings;
  return (
    <div className="stack">
      {online && (
        <section className="card center">
          <p className="hint">같은 테이블 사람들에게 코드를 알려 주세요</p>
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
          <h3>
            앉은 사람 {view.players.length}/{LIMITS.maxPlayers}
          </h3>
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
            <span>분위기</span>
            <div className="seg">
              {(["light", "deep"] as const).map((lv) => (
                <button key={lv} className={s.level === lv ? "on" : ""} onClick={() => act({ type: "settings", settings: { level: lv } })}>
                  {lv === "light" ? "가볍게" : "조금 깊게"}
                </button>
              ))}
            </div>
          </div>
          <div className="setting">
            <span>질문 수</span>
            <div className="seg">
              {[3, 4, 5].map((n) => (
                <button key={n} className={s.rounds === n ? "on" : ""} onClick={() => act({ type: "settings", settings: { rounds: n } })}>
                  {n}개
                </button>
              ))}
            </div>
          </div>
          <div className="setting">
            <span>답하는 시간</span>
            <div className="seg">
              {[30, 40, 60].map((n) => (
                <button key={n} className={s.answerSec === n ? "on" : ""} onClick={() => act({ type: "settings", settings: { answerSec: n } })}>
                  {n}초
                </button>
              ))}
            </div>
          </div>
          <div className="setting">
            <span>주제</span>
            <span className="chip soon">자유 · 주제 고르기는 준비 중</span>
          </div>
          <button className="btn primary big" onClick={() => act({ type: "start" })} disabled={view.players.length < LIMITS.minPlayers}>
            {view.players.length < LIMITS.minPlayers ? "두 명 이상 모이면 시작" : "시작하기"}
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

// ───────── 소개 모으기 ─────────
function Profile({ view, act, isHost }: { view: View; act: Act; isHost: boolean }) {
  const pf = view.profile!;
  const idx = pf.mine.findIndex((a) => a === null);
  const q = idx >= 0 ? pf.questions[idx] : null;
  const [text, setText] = useState("");
  useEffect(() => setText(""), [idx]);
  const send = (t: string) => act({ type: "profile", index: idx, text: t });

  if (!q)
    return (
      <div className="stack">
        <Bird mood="happy" text={<>고마워요! 답은 아직 비밀이에요 🤫<br />게임 중에 하나씩 꺼낼게요.</>} />
        <Waiting players={view.players} label="소개 다 한 사람" />
        {isHost && (
          <button className="btn soft" onClick={() => act({ type: "advance" })}>
            기다리지 않고 시작하기
          </button>
        )}
      </div>
    );
  return (
    <div className="stack">
      <div className="steps">
        {pf.questions.map((_, i) => (
          <i key={i} className={i < idx ? "done" : i === idx ? "now" : ""} />
        ))}
      </div>
      <Bird text={q.q} />
      <section className="card stack">
        {q.kind === "choice" ? (
          <div className="options">
            {q.options!.map((o, i) => (
              <button key={o} className="opt" style={{ animationDelay: `${i * 50}ms` }} onClick={() => send(o)}>
                {o}
              </button>
            ))}
          </div>
        ) : (
          <>
            <input
              value={text}
              maxLength={20}
              autoFocus
              placeholder={q.placeholder ?? "짧게 한 단어로"}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing && text.trim()) send(text);
              }}
            />
            <button className="btn primary" disabled={!text.trim()} onClick={() => send(text)}>
              다음
            </button>
          </>
        )}
        <button className="btn tiny soft passbtn" onClick={() => send(PASS)}>
          이건 패스
        </button>
      </section>
      <p className="hint center">
        {idx + 1} / {pf.questions.length}
      </p>
    </div>
  );
}

// ───────── 테이블 질문 ─────────
function Ask({ view, act, isHost }: { view: View; act: Act; isHost: boolean }) {
  const a = view.ask!;
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(!a.mine);
  useEffect(() => {
    if (!a.mine) {
      setEditing(true);
      setText("");
    }
  }, [view.round, a.mine]);
  async function submit(t: string) {
    const r = await act({ type: "answer", text: t });
    if (r.ok) setEditing(false);
  }
  return (
    <div className="stack">
      <Bird text={a.q} />
      {editing ? (
        <section className="card stack">
          <p className="lead">한 줄로 짧게! 답은 다 같이 한꺼번에 공개돼요</p>
          <input
            value={text}
            maxLength={LIMITS.maxAnswer}
            autoFocus
            placeholder={a.placeholder ?? "짧게 한 줄"}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing && text.trim()) submit(text);
            }}
          />
          <div className="row between">
            <button className="btn tiny soft" onClick={() => submit(PASS)}>
              패스
            </button>
            <button className="btn primary" disabled={!text.trim()} onClick={() => submit(text)}>
              답하기
            </button>
          </div>
        </section>
      ) : (
        <section className="card center stack">
          <p className="hint">내 답</p>
          <p className="myanswer">“{a.mine}”</p>
          <button
            className="btn tiny soft"
            onClick={() => {
              setText(a.mine === PASS ? "" : (a.mine ?? ""));
              setEditing(true);
            }}
          >
            고치기
          </button>
        </section>
      )}
      <Waiting players={view.players} label="답한 사람" />
      {isHost && (
        <button className="btn tiny soft" onClick={() => act({ type: "advance" })}>
          지금 공개하기
        </button>
      )}
    </div>
  );
}

// ───────── 공개 + 왜? ─────────
function Share({ view, act, isHost, offset }: { view: View; act: Act; isHost: boolean; offset: number }) {
  const s = view.share!;
  const now = useNow(500);
  const left = view.deadline ? Math.max(0, Math.ceil((view.deadline - (now + offset)) / 1000)) : null;
  const me = s.why?.id === view.me;
  const [reply, setReply] = useState("");
  const [sent, setSent] = useState(false);
  useEffect(() => {
    setSent(false);
    setReply("");
  }, [view.round]);
  return (
    <div className="stack">
      <p className="qsmall">{s.q}</p>
      <div className="answers">
        {s.answers.map((a, i) => (
          <div key={a.id} className={`acard ${a.text === PASS ? "pass" : ""} ${s.why?.id === a.id ? "picked" : ""}`} style={{ animationDelay: `${i * 140}ms` }}>
            <span className="who">
              <Dot p={a} size={24} /> {a.name}
            </span>
            <p>{a.text === PASS ? "패스 🙈" : a.text}</p>
          </div>
        ))}
        {!s.answers.length && <p className="hint">아무도 답하지 않았어요. 말로 해 봐요!</p>}
      </div>

      {s.why ? (
        <section className="why pop">
          <Mascot mood="inspect" size={58} />
          <div>
            <p className="whyto">
              <Dot p={s.why} size={22} /> <b>{s.why.name}</b>님, “{s.why.answer}”
            </p>
            <p className="whyq">{s.why.question}</p>
            {s.why.reply && <p className="whyreply">“{s.why.reply}”</p>}
          </div>
        </section>
      ) : (
        <Bird mood="thinking" text="흠… 누구한테 물어볼까?" />
      )}

      {me && !s.why?.reply && !sent && (
        <section className="card stack">
          <p className="hint">말로 해도 되고, 한 줄로 남겨도 돼요</p>
          <div className="row">
            <input className="grow" value={reply} maxLength={40} placeholder="한 줄 답 (선택)" onChange={(e) => setReply(e.target.value)} />
            <button
              className="btn"
              disabled={!reply.trim()}
              onClick={async () => {
                if ((await act({ type: "reply", text: reply })).ok) setSent(true);
              }}
            >
              남기기
            </button>
          </div>
        </section>
      )}

      <p className="talk">🗣️ 폰은 내려놓고, 서로 답에 대해 얘기해 봐요</p>
      <HostNext isHost={isHost} act={act} label="다음으로" left={left} />
    </div>
  );
}

// ───────── 맞히기 ─────────
function Mini({ view, act }: { view: View; act: Act }) {
  const m = view.mini!;
  return (
    <div className="stack">
      <div className="center">
        <span className="chip minichip">🎯 {m.title}</span>
      </div>
      <Bird mood="thinking" text={m.prompt} />
      {m.quote && <p className="quote">“{m.quote}”</p>}
      {m.isSubject ? (
        <section className="card center">
          <p className="lead">내 얘기예요 🤫</p>
          <p className="hint">다른 사람들이 맞히는 동안 표정 관리!</p>
        </section>
      ) : (
        <div className={`options ${m.kind === "guess" ? "" : "people"}`}>
          {m.options.map((o, i) => (
            <button
              key={o.id}
              className={`opt ${m.myPick === o.id ? "picked" : ""}`}
              disabled={o.id === view.me}
              style={{ animationDelay: `${i * 50}ms` }}
              onClick={() => act({ type: "pick", optionId: o.id })}
            >
              {o.color && <Dot p={{ name: o.label, color: o.color }} size={26} />} {o.label}
              {o.id === view.me && <span className="minetag">나</span>}
            </button>
          ))}
        </div>
      )}
      <Waiting players={view.players} label="고른 사람" />
    </div>
  );
}

function MiniReveal({ view, act, isHost, offset }: { view: View; act: Act; isHost: boolean; offset: number }) {
  const m = view.miniReveal!;
  const now = useNow(500);
  const left = view.deadline ? Math.max(0, Math.ceil((view.deadline - (now + offset)) / 1000)) : null;
  const mine = m.picks.find((p) => p.id === view.me);
  return (
    <div className="stack">
      <div className="center">
        <span className="chip minichip">🎯 {m.title}</span>
      </div>
      <p className="qsmall">{m.prompt}</p>
      {m.quote && m.kind === "who" && <p className="quote">“{m.quote}”</p>}
      <section className="reveal is-truth">
        <p className="hint">정답</p>
        <p className="rtext">{m.answerLabel}</p>
        {m.subject && m.kind !== "who" && (
          <p className="hint">
            <Dot p={m.subject} size={20} /> {m.subject.name}님 이야기
          </p>
        )}
        <div className="dots">
          {m.picks.map((p) => (
            <span key={p.id} className={`pin ${p.ok ? "ok" : "no"}`}>
              <Dot p={p} size={30} />
              <small>
                {p.ok ? "⭕" : "❌"} {p.name}
              </small>
            </span>
          ))}
        </div>
        <p className="lead">{m.line}</p>
        {mine && <p className={`me ${mine.ok ? "good" : "bad"}`}>{mine.ok ? "눈치 +1 👀" : "아깝다!"}</p>}
      </section>
      <p className="talk">🗣️ 주인공에게 한마디 더 물어봐요</p>
      <HostNext isHost={isHost} act={act} label={view.round >= view.totalRounds ? "오늘의 우리 보기" : "다음 질문"} left={left} />
    </div>
  );
}

// ───────── 오늘의 우리 ─────────
function Final({ view, act, isHost, onLeave }: { view: View; act: Act; isHost: boolean; onLeave: () => void }) {
  const f = view.final!;
  const [copied, setCopied] = useState(false);
  const text = [
    "🦜 왜무새 테이블 — 오늘의 우리",
    ...f.cards.map((c) => `\n${c.name}${c.summary ? ` — ${c.summary}` : ""}\n${c.items.map((x) => `· ${x.q} ${x.a}`).join("\n")}`),
    f.commons.length ? `\n🤝 공통점\n${f.commons.map((c) => `· ${c}`).join("\n")}` : "",
  ].join("\n");
  return (
    <div className="stack">
      <div className="finalhero">
        <Mascot mood="cheer" size={90} />
        <h2 className="title">오늘의 우리</h2>
        <p className="hint">이제 조금은 아는 사이 🙌</p>
      </div>

      {f.commons.length > 0 && (
        <section className="card">
          <h3>🤝 우리의 공통점</h3>
          <ul className="commons">
            {f.commons.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </section>
      )}

      {f.awards.length > 0 && (
        <section className="awards">
          {f.awards.map((a) => (
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

      <div className="pcards">
        {f.cards.map((c) => (
          <section key={c.id} className={`card pcard ${c.id === view.me ? "me" : ""}`} style={{ borderTopColor: c.color }}>
            <div className="row">
              <Dot p={c} size={34} />
              <b className="grow">{c.name}</b>
            </div>
            {c.summary && <p className="summary">{c.summary}</p>}
            <ul>
              {c.items.map((x) => (
                <li key={x.q}>
                  <span>{x.q}</span> <b>{x.a}</b>
                </li>
              ))}
              {!c.items.length && <li className="hint">비밀이 많은 사람 🤫</li>}
            </ul>
          </section>
        ))}
      </div>

      <button
        className="btn soft"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
          } catch {
            /* 복사 불가 */
          }
        }}
      >
        {copied ? "복사됨!" : "📋 오늘의 우리 복사 (단톡방에 붙여넣기)"}
      </button>
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
