// 왜무새 테이블 — Socket.IO 네임스페이스 "/intro" (왜무새 파티와 방이 섞이지 않게 따로)
import { randomBytes } from "node:crypto";
import type { Server, Socket } from "socket.io";
import { IntroGame } from "../shared/intro/engine";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AI_MODEL = process.env.AI_MODEL ?? "claude-haiku-5-5";

async function claude(system: string, user: string, maxTokens: number, timeoutMs = 6000): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    return data.content?.find((c) => c.type === "text")?.text?.trim().replace(/^["'“]|["'”]$/g, "") ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** 답 하나에 붙일 가벼운 '왜?' 꼬리 질문 */
async function followUp(q: string, answer: string, name: string) {
  const t = await claude(
    "너는 처음 만난 사람들의 자리를 진행하는 앵무새 '왜무새'야. 누군가의 답을 듣고, 그 사람이 30초쯤 이야기할 수 있는 가볍고 다정한 꼬리 질문을 한국어 한 문장(30자 이내)으로만 써. 반말 말고 '~요' 체. 사생활(나이·직장·연애·돈·외모·가족)은 묻지 마. 따옴표·설명 없이 질문만.",
    `질문: ${q}\n${name}님의 답: ${answer}\n꼬리 질문:`,
    60,
  );
  return t && t.length <= 45 && t.endsWith("?") ? t : null;
}

/** 소개 카드 한 줄 요약 */
async function summarize(name: string, items: { q: string; a: string }[]) {
  const t = await claude(
    "너는 처음 만난 사람들의 자리를 진행하는 앵무새 '왜무새'야. 한 사람이 짧은 질문에 답한 내용을 보고, 그 사람을 소개하는 따뜻하고 재치 있는 한 줄(35자 이내)을 써. 답에 없는 사실은 지어내지 마. 평가·외모·성격 단정 금지. 따옴표·설명 없이 한 줄만.",
    `${name}님의 답\n${items.map((x) => `- ${x.q}: ${x.a}`).join("\n")}\n소개 한 줄:`,
    80,
  );
  return t && t.length <= 50 ? t : null;
}

interface Room {
  game: IntroGame;
  tokens: Map<string, string>;
  sockets: Map<string, Socket>;
}

export function setupIntro(io: Server) {
  const rooms = new Map<string, Room>();
  const nsp = io.of("/intro");

  const newCode = () => {
    const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    for (;;) {
      const c = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
      if (!rooms.has(c)) return c;
    }
  };
  const broadcast = (room: Room) => {
    for (const [pid, s] of room.sockets) s.emit("view", room.game.viewFor(pid));
  };
  const createRoom = () => {
    const code = newCode();
    const room: Room = {
      tokens: new Map(),
      sockets: new Map(),
      game: new IntroGame(code, { onChange: () => broadcast(room), followUp, summarize }),
    };
    rooms.set(code, room);
    return room;
  };
  const bind = (socket: Socket, room: Room, pid: string) => {
    // 새 소켓을 먼저 등록해야, 옛 소켓이 끊길 때 '나갔다'로 처리되지 않는다 (방장이 바뀌는 문제)
    const old = room.sockets.get(pid);
    room.sockets.set(pid, socket);
    if (old && old.id !== socket.id) old.disconnect(true);
    socket.data.code = room.game.code;
    socket.data.playerId = pid;
    room.game.setOnline(pid, true);
  };
  type Ack = (r: { ok: boolean; error?: string; code?: string; token?: string }) => void;

  nsp.on("connection", (socket) => {
    const join = (room: Room, name: string, ack: Ack) => {
      const r = room.game.addPlayer(String(name ?? ""));
      if (!r.id) return ack({ ok: false, error: r.error });
      const token = randomBytes(16).toString("hex");
      room.tokens.set(token, r.id);
      bind(socket, room, r.id);
      ack({ ok: true, code: room.game.code, token });
    };
    socket.on("create", ({ name }: { name: string }, ack: Ack) => {
      const room = createRoom();
      join(room, name, (r) => {
        if (!r.ok) rooms.delete(room.game.code);
        ack(r);
      });
    });
    socket.on("join", ({ code, name }: { code: string; name: string }, ack: Ack) => {
      const room = rooms.get(String(code ?? "").toUpperCase().trim());
      if (!room) return ack({ ok: false, error: "그런 방이 없어요. 코드를 다시 확인해 주세요" });
      join(room, name, ack);
    });
    socket.on("resume", ({ code, token }: { code: string; token: string }, ack: Ack) => {
      const room = rooms.get(String(code ?? "").toUpperCase());
      const pid = room?.tokens.get(String(token ?? ""));
      if (!room || !pid || !room.game.players.some((p) => p.id === pid)) return ack({ ok: false, error: "방이 끝났거나 사라졌어요" });
      bind(socket, room, pid);
      ack({ ok: true, code: room.game.code, token });
    });
    socket.on("action", (a: { type: string; [k: string]: unknown }, ack?: Ack) => {
      const room = rooms.get(socket.data.code);
      const me = socket.data.playerId as string | undefined;
      if (!room || !me) return ack?.({ ok: false, error: "방에 연결돼 있지 않아요" });
      const g = room.game;
      let r: { error?: string } = {};
      switch (a.type) {
        case "start": r = g.start(me); break;
        case "advance": r = g.advance(me); break;
        case "profile": r = g.answerProfile(me, Number(a.index), String(a.text ?? "")); break;
        case "answer": r = g.submitAnswer(me, String(a.text ?? "")); break;
        case "reply": r = g.reply(me, String(a.text ?? "")); break;
        case "pick": r = g.pick(me, String(a.optionId ?? "")); break;
        case "addBot": r = g.addBot(me); break;
        case "kick": r = g.removePlayer(me, String(a.playerId ?? "")); break;
        case "settings": r = g.updateSettings(me, (a.settings ?? {}) as object); break;
        case "leave":
          r = g.removePlayer(me, me);
          room.sockets.delete(me);
          socket.data.code = undefined;
          break;
        default: r = { error: "알 수 없는 동작" };
      }
      ack?.({ ok: !r.error, error: r.error });
    });
    socket.on("disconnect", () => {
      const room = rooms.get(socket.data.code);
      const pid = socket.data.playerId as string | undefined;
      if (!room || !pid || room.sockets.get(pid)?.id !== socket.id) return;
      room.sockets.delete(pid);
      room.game.setOnline(pid, false);
    });
  });

  setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms)
      if (room.sockets.size === 0 && now - room.game.lastActive > 30 * 60_000) {
        room.game.dispose();
        rooms.delete(code);
      }
  }, 60_000).unref();

  return { rooms };
}
