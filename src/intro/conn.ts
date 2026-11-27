// 왜무새 테이블 연결 — 온라인(Socket.IO "/intro")이든 혼자 해보기(브라우저 안 엔진)든 같은 모양
import { IntroGame, type Settings, type View } from "../../shared/intro/engine";

export type Action =
  | { type: "start" }
  | { type: "advance" }
  | { type: "profile"; index: number; text: string }
  | { type: "answer"; text: string }
  | { type: "reply"; text: string }
  | { type: "pick"; optionId: string }
  | { type: "addBot" }
  | { type: "kick"; playerId: string }
  | { type: "settings"; settings: Partial<Settings> }
  | { type: "leave" };

export interface Result {
  ok: boolean;
  error?: string;
}

export interface Conn {
  send(a: Action): Promise<Result>;
  subscribe(cb: (v: View) => void): () => void;
  online: boolean;
  close(): void;
}

function run(g: IntroGame, me: string, a: Action): { error?: string } {
  switch (a.type) {
    case "start": return g.start(me);
    case "advance": return g.advance(me);
    case "profile": return g.answerProfile(me, a.index, a.text);
    case "answer": return g.submitAnswer(me, a.text);
    case "reply": return g.reply(me, a.text);
    case "pick": return g.pick(me, a.optionId);
    case "addBot": return g.addBot(me);
    case "kick": return g.removePlayer(me, a.playerId);
    case "settings": return g.updateSettings(me, a.settings);
    case "leave": g.dispose(); return {};
  }
}

// ───────── 혼자 해보기 (봇 3명) ─────────
export function createLocal(name: string, bots = 3): Conn {
  const subs = new Set<(v: View) => void>();
  let me = "";
  const game = new IntroGame("SOLO", {
    onChange: () => {
      if (!me) return;
      const v = game.viewFor(me);
      subs.forEach((cb) => cb(v));
    },
    botSpeed: 0.6,
  });
  me = game.addPlayer(name || "나").id!;
  for (let i = 0; i < bots; i++) game.addBot(me);
  return {
    online: false,
    async send(a) {
      const r = run(game, me, a);
      return { ok: !r.error, error: r.error };
    },
    subscribe(cb) {
      subs.add(cb);
      cb(game.viewFor(me));
      return () => subs.delete(cb);
    },
    close() {
      game.dispose();
      subs.clear();
    },
  };
}

// ───────── 온라인 ─────────
const SESSION_KEY = "wae.intro.session";
export function savedSession(): { code: string; token: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function saveSession(s: { code: string; token: string } | null) {
  try {
    if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    /* 저장 불가 환경 */
  }
}

type Intent = { kind: "create"; name: string } | { kind: "join"; code: string; name: string } | { kind: "resume"; code: string; token: string };

export async function connectOnline(intent: Intent, onStatus: (s: "connecting" | "online" | "offline") => void): Promise<Conn> {
  const { io } = await import("socket.io-client");
  const socket = io("/intro", { transports: ["websocket", "polling"], reconnectionDelayMax: 3000 });
  const subs = new Set<(v: View) => void>();
  let last: View | null = null;
  let session: { code: string; token: string } | null = null;
  socket.on("view", (v: View) => {
    last = v;
    subs.forEach((cb) => cb(v));
  });
  const emit = <T,>(ev: string, payload: unknown) =>
    new Promise<T>((resolve) => socket.timeout(8000).emit(ev, payload, (err: unknown, r: T) => resolve(err ? ({ ok: false, error: "서버 응답이 늦어요. 다시 시도해 주세요" } as T) : r)));
  type Ack = Result & { code?: string; token?: string };
  const first = await new Promise<Ack>((resolve) => {
    socket.once("connect", async () => {
      resolve(
        intent.kind === "create"
          ? await emit<Ack>("create", { name: intent.name })
          : intent.kind === "join"
            ? await emit<Ack>("join", { code: intent.code, name: intent.name })
            : await emit<Ack>("resume", { code: intent.code, token: intent.token }),
      );
    });
    socket.once("connect_error", () => resolve({ ok: false, error: "서버에 연결할 수 없어요. (무료 서버가 깨어나는 데 1분쯤 걸릴 수 있어요)" }));
  });
  if (!first.ok || !first.code || !first.token) {
    socket.close();
    if (intent.kind === "resume") saveSession(null);
    throw new Error(first.error ?? "연결 실패");
  }
  session = { code: first.code, token: first.token };
  saveSession(session);
  onStatus("online");
  socket.on("disconnect", () => onStatus("offline"));
  socket.io.on("reconnect", async () => {
    if (!session) return;
    const r = await emit<Ack>("resume", session);
    onStatus(r.ok ? "online" : "offline");
  });
  return {
    online: true,
    send: (a) => emit<Result>("action", a),
    subscribe(cb) {
      subs.add(cb);
      if (last) cb(last);
      return () => subs.delete(cb);
    },
    close() {
      saveSession(null);
      session = null;
      socket.emit("action", { type: "leave" }, () => socket.close());
      setTimeout(() => socket.close(), 500);
    },
  };
}
