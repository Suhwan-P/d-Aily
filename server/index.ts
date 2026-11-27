// 왜무새 파티 서버 — Express(정적 파일) + Socket.IO(실시간 방)
import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Server, type Socket } from "socket.io";
import { Game } from "../shared/engine";
import type { WaeQuestion } from "../shared/questions";
import { setupIntro } from "./intro";

const PORT = Number(process.env.PORT ?? 3000);
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const AI_MODEL = process.env.AI_MODEL ?? "claude-haiku-5-5";

interface Room {
  game: Game;
  tokens: Map<string, string>; // token → playerId
  sockets: Map<string, Socket>; // playerId → socket
}
const rooms = new Map<string, Room>();

const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: process.env.CORS_ORIGIN?.split(",") ?? false } });

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(here, "../dist/client");
app.get("/healthz", (_req, res) => res.json({ ok: true, rooms: rooms.size }));
// 왜무새 테이블(자기소개 모드): /intro 로 들어와도 intro.html 로
app.get(["/intro", "/intro/"], (req, res) => res.redirect(302, "/intro.html" + (req.url.includes("?") ? req.url.slice(req.url.indexOf("?")) : "")));
app.use(express.static(clientDir, { maxAge: "1h", index: false }));
app.get(/.*/, (_req, res) => res.sendFile(path.join(clientDir, "index.html")));

// ───────── 왜무새 가짜 이유 (Claude, 선택) ─────────
async function makeHouseFake(q: WaeQuestion, avoid: string[]): Promise<string | null> {
  if (!ANTHROPIC_API_KEY) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: ctrl.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        max_tokens: 60,
        system:
          "너는 파티 게임 '진짜 이유를 찾아라'의 출제자 왜무새야. 질문에 대해 그럴듯하지만 사실이 아닌 '가짜 이유'를 한국어 한 구절(25자 이내)로만 답해. 설명·따옴표·마침표 없이, '~해서/~라서/~려고'로 끝내.",
        messages: [
          {
            role: "user",
            content: `질문: ${q.q}\n진짜 이유(이것과 비슷하면 안 됨): ${avoid.join(" / ")}\n가짜 이유:`,
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === "text")?.text?.trim().replace(/^["'“]|["'”.]$/g, "");
    return text && text.length <= 40 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ───────── 방 ─────────
function newCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  for (;;) {
    const c = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
    if (!rooms.has(c)) return c;
  }
}

function broadcast(room: Room) {
  for (const [pid, s] of room.sockets) s.emit("view", room.game.viewFor(pid));
}

function createRoom() {
  const code = newCode();
  const room: Room = {
    tokens: new Map(),
    sockets: new Map(),
    game: new Game(code, { onChange: () => broadcast(room), makeHouseFake }),
  };
  rooms.set(code, room);
  return room;
}

function bind(socket: Socket, room: Room, playerId: string) {
  // 새 소켓을 먼저 등록해야, 옛 소켓이 끊길 때 '나갔다'로 처리되지 않는다 (방장이 바뀌는 문제)
  const old = room.sockets.get(playerId);
  room.sockets.set(playerId, socket);
  if (old && old.id !== socket.id) old.disconnect(true);
  socket.data.code = room.game.code;
  socket.data.playerId = playerId;
  room.game.setOnline(playerId, true);
}

type Ack = (r: { ok: boolean; error?: string; code?: string; token?: string; text?: string }) => void;

io.on("connection", (socket) => {
  socket.on("create", ({ name }: { name: string }, ack: Ack) => {
    const room = createRoom();
    const r = room.game.addPlayer(String(name ?? ""));
    if (!r.id) {
      rooms.delete(room.game.code);
      return ack({ ok: false, error: r.error });
    }
    const token = randomBytes(16).toString("hex");
    room.tokens.set(token, r.id);
    bind(socket, room, r.id);
    ack({ ok: true, code: room.game.code, token });
  });

  socket.on("join", ({ code, name }: { code: string; name: string }, ack: Ack) => {
    const room = rooms.get(String(code ?? "").toUpperCase().trim());
    if (!room) return ack({ ok: false, error: "그런 방이 없어요. 코드를 다시 확인해 주세요" });
    const r = room.game.addPlayer(String(name ?? ""));
    if (!r.id) return ack({ ok: false, error: r.error });
    const token = randomBytes(16).toString("hex");
    room.tokens.set(token, r.id);
    bind(socket, room, r.id);
    ack({ ok: true, code: room.game.code, token });
  });

  socket.on("resume", ({ code, token }: { code: string; token: string }, ack: Ack) => {
    const room = rooms.get(String(code ?? "").toUpperCase());
    const pid = room?.tokens.get(String(token ?? ""));
    if (!room || !pid || !room.game.players.some((p) => p.id === pid)) return ack({ ok: false, error: "방이 끝났거나 사라졌어요" });
    bind(socket, room, pid);
    ack({ ok: true, code: room.game.code, token });
  });

  socket.on("action", (a: { type: string; [k: string]: unknown }, ack: Ack) => {
    const room = rooms.get(socket.data.code);
    const me = socket.data.playerId as string | undefined;
    if (!room || !me) return ack?.({ ok: false, error: "방에 연결돼 있지 않아요" });
    const g = room.game;
    let r: { error?: string; text?: string } = {};
    switch (a.type) {
      case "start": r = g.start(me); break;
      case "advance": r = g.advance(me); break;
      case "answer": r = g.submitAnswer(me, String(a.text ?? "")); break;
      case "suggest": r = g.suggestLie(me); break;
      case "pick": r = g.submitPick(me, String(a.optionId ?? "")); break;
      case "like": r = g.like(me, String(a.optionId ?? "")); break;
      case "addBot": r = g.addBot(me); break;
      case "kick": r = g.removePlayer(me, String(a.playerId ?? "")); break;
      case "settings": r = g.updateSettings(me, a.settings as object); break;
      case "leave":
        r = g.removePlayer(me, me);
        room.sockets.delete(me);
        socket.data.code = undefined;
        break;
      default: r = { error: "알 수 없는 동작" };
    }
    ack?.({ ok: !r.error, error: r.error, text: r.text });
  });

  socket.on("disconnect", () => {
    const room = rooms.get(socket.data.code);
    const pid = socket.data.playerId as string | undefined;
    if (!room || !pid || room.sockets.get(pid)?.id !== socket.id) return;
    room.sockets.delete(pid);
    room.game.setOnline(pid, false);
  });
});

// 30분 동안 아무도 없는 방 정리
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (room.sockets.size === 0 && now - room.game.lastActive > 30 * 60_000) {
      room.game.dispose();
      rooms.delete(code);
    }
  }
}, 60_000).unref();

setupIntro(io);

http.listen(PORT, () => {
  console.log(`왜무새 파티 서버: http://localhost:${PORT}  (AI 가짜: ${ANTHROPIC_API_KEY ? AI_MODEL : "문제 은행"})`);
});
