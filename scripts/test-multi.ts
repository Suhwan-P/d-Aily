// 서버를 띄운 상태에서 실행: 3명이 접속해 3라운드를 끝까지 플레이한다.
import { io, type Socket } from "socket.io-client";
import type { View } from "../shared/engine";

const URL = process.env.URL ?? "http://localhost:3000";
type Ack = { ok: boolean; error?: string; code?: string; token?: string };
const call = (s: Socket, ev: string, p: unknown) => new Promise<Ack>((r) => s.emit(ev, p, r));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
function assert(c: unknown, m: string) { if (!c) { console.error("❌", m); process.exit(1); } console.log("✅", m); }

async function client(name: string) {
  const s = io(URL, { transports: ["websocket"] });
  await new Promise<void>((r) => s.once("connect", () => r()));
  const c = { s, name, view: null as View | null };
  s.on("view", (v: View) => (c.view = v));
  return c;
}

const A = await client("민수"), B = await client("지아"), C = await client("현우");
const made = await call(A.s, "create", { name: A.name });
assert(made.ok && made.code?.length === 4, `방 생성 ${made.code}`);
assert((await call(B.s, "join", { code: made.code, name: B.name })).ok, "B 참여");
assert((await call(C.s, "join", { code: made.code!.toLowerCase(), name: C.name })).ok, "C 소문자 코드로 참여");
assert(!(await call(B.s, "action", { type: "start" })).ok, "방장 아니면 시작 불가");
await call(A.s, "action", { type: "settings", settings: { rounds: 3 } });
assert((await call(A.s, "action", { type: "start" })).ok, "시작");
await wait(200);

let lastRound = 0;
for (let guard = 0; guard < 400; guard++) {
  const v = A.view!;
  if (v.phase === "final") break;
  if (v.phase === "write" && v.round !== lastRound) {
    lastRound = v.round;
    const sug = await call(C.s, "action", { type: "suggest" });
    assert(sug.ok && (sug as { text?: string }).text, `R${v.round} 거짓말 추천: ${(sug as { text?: string }).text}`);
    const near = await call(B.s, "action", { type: "answer", text: "x" });
    assert(!near.ok, `R${v.round} 너무 짧은 답 거절`);
    for (const c of [A, B, C]) {
      const r = await call(c.s, "action", { type: "answer", text: `${c.name}가 지어낸 이유 ${v.round}` });
      assert(r.ok, `R${v.round} ${c.name} 거짓말 제출`);
    }
  }
  if (v.phase === "pick" && !v.myPick) {
    for (const c of [A, B, C]) {
      const cv = c.view!;
      const mine = cv.options!.find((o) => o.mine)!;
      const self = await call(c.s, "action", { type: "pick", optionId: mine.id });
      assert(!self.ok, `${c.name} 내 거짓말은 못 고름`);
      const other = cv.options!.find((o) => !o.mine)!;
      assert((await call(c.s, "action", { type: "pick", optionId: other.id })).ok, `${c.name} 고름`);
    }
  }
  if (v.phase === "reveal") {
    const it = v.reveal!.items.at(-1)!;
    if (!it.isTruth) await call(B.s, "action", { type: "like", optionId: it.optionId });
    await call(A.s, "action", { type: "advance" });
  }
  if (v.phase === "round") {
    const sum = v.players.reduce((s, p) => s + p.score, 0);
    assert(sum >= 0 && v.question?.answer, `R${v.round} 결과: 총점 ${sum}, 정답 "${v.question?.answer}"`);
    await call(A.s, "action", { type: "advance" });
  }
  await wait(150);
}
const f = A.view!;
assert(f.phase === "final", "최종 결과 도달");
console.log("점수:", f.players.map((p) => `${p.name} ${p.score}(간파 ${p.truth}/속임 ${p.fool})`).join(", "));
console.log("상:", f.awards?.map((a) => `${a.title}=${a.name}`).join(", "), "| 명대사:", f.bestLine?.text);

// 재접속: 새 소켓 + 기존 토큰
const D = await client("재접속");
const bad = await call(D.s, "resume", { code: made.code, token: "nope" });
assert(!bad.ok, "잘못된 토큰 거절");
const good = await call(D.s, "resume", { code: made.code, token: made.token });
await wait(150);
assert(good.ok && D.view?.me === A.view?.me, "같은 토큰으로 같은 자리 복귀");
for (const c of [A, B, C, D]) c.s.close();
process.exit(0);
