import { useEffect, useRef, useState } from "react";
import type { View } from "../shared/engine";
import { connectOnline, createLocal, savedSession, type Conn } from "./conn";
import { Home } from "./screens/Home";
import { GameScreen } from "./screens/Game";
import { randomNickname } from "../shared/nickname";

export default function App() {
  const [conn, setConn] = useState<Conn | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [status, setStatus] = useState<"connecting" | "online" | "offline">("online");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 들어올 때마다 형용사+명사 닉네임을 새로 뽑아 준다 (원하면 고쳐 쓰기)
  const [name, setName] = useState(() => randomNickname());
  const offset = useRef(0);

  const roomFromUrl = new URLSearchParams(location.search).get("room")?.toUpperCase() ?? "";

  // 새로고침·폰 잠금 뒤 같은 방으로 복귀
  useEffect(() => {
    if (__SOLO_ONLY__) return;
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
    if (!n) return setError("닉네임을 먼저 써 주세요");
    setError("");
    if (kind === "solo") return attach(createLocal(n, 3));
    setBusy(true);
    setStatus("connecting");
    try {
      const c = await connectOnline(kind === "create" ? { kind, name: n } : { kind, code: code ?? "", name: n }, setStatus);
      attach(c);
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

  if (conn && view)
    return <GameScreen view={view} conn={conn} offset={offset.current} status={status} onLeave={leave} />;

  return (
    <Home
      name={name}
      setName={setName}
      onReroll={() => setName(randomNickname([name]))}
      initialCode={roomFromUrl}
      busy={busy}
      error={error}
      soloOnly={__SOLO_ONLY__}
      onCreate={() => go("create")}
      onJoin={(code) => go("join", code)}
      onSolo={() => go("solo")}
    />
  );
}
