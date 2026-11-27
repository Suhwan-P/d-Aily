// 서버를 띄운 상태에서 실행: 4명이 왜무새 테이블에 앉아 끝까지 진행한다.
import { io, type Socket } from "socket.io-client";
import type { View } from "../shared/intro/engine";

const URL = (process.env.URL ?? "http://localhost:3000") + "/intro";
type Ack = { ok: boolean; error?: string; code?: string; token?: string };
const call = (s: Socket, ev: string, p: unknown) => new Promise<Ack>((r) => s.emit(ev, p, r));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
function assert(c: unknown, m: string) {
  if (!c) {
    console.error("❌", m);
    process.exit(1);
  }
  console.log("✅", m);
}
async function client(name: string) {
  const s = io(URL, { transports: ["websocket"] });
  await new Promise<void>((r) => s.once("connect", () => r()));
  const c = { s, name, view: null as View | null };
  s.on("view", (v: View) => (c.view = v));
  return c;
}

const A = await client("수환"), B = await client("지아"), C = await client("현우"), D = await client("모모");
const all = [A, B, C, D];
const made = await call(A.s, "create", { name: A.name });
assert(made.ok && made.code?.length === 4, `테이블 생성 ${made.code}`);
for (const c of [B, C, D]) assert((await call(c.s, "join", { code: made.code, name: c.name })).ok, `${c.name} 참여`);
assert(!(await call(B.s, "action", { type: "start" })).ok, "방장 아니면 시작 불가");
await call(A.s, "action", { type: "settings", settings: { rounds: 3, level: "deep" } });
assert((await call(A.s, "action", { type: "start" })).ok, "시작");
await wait(200);
assert(A.view?.phase === "profile" && A.view.profile?.questions.length === 5, "소개 질문 5개");

// 소개 모으기: choice는 첫 보기(공통점이 생기게), text는 각자, D는 한 개 패스
for (const c of all) {
  const qs = c.view!.profile!.questions;
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i];
    const text = c === D && i === 1 ? "패스" : q.kind === "choice" ? q.options![c === C ? 1 : 0] : `${c.name}의 답${i}`;
    if (q.kind === "choice" && i === 0) assert(!(await call(c.s, "action", { type: "profile", index: i, text: "보기에 없는 답" })).ok, `${c.name} 보기 밖 답 거절`);
    assert((await call(c.s, "action", { type: "profile", index: i, text })).ok, `${c.name} 소개 ${i + 1}: ${text}`);
  }
}
await wait(1300);
assert(A.view?.phase === "ask", "모두 답하면 첫 테이블 질문으로");

const seen = new Set<string>();
for (let guard = 0; guard < 300; guard++) {
  const v = A.view!;
  if (v.phase === "final") break;
  const key = `${v.phase}:${v.round}`;
  if (v.phase === "ask" && !seen.has(key)) {
    seen.add(key);
    console.log(`   Q${v.round}: ${v.ask!.q}`);
    for (const c of all) assert((await call(c.s, "action", { type: "answer", text: c === B && v.round === 2 ? "패스" : `${c.name}표 답 ${v.round}` })).ok, `R${v.round} ${c.name} 답`);
  }
  if (v.phase === "share" && v.share?.why && !seen.has(key)) {
    seen.add(key);
    const w = v.share.why;
    assert(v.share.answers.length === 4, `R${v.round} 답 4개 공개`);
    assert(w.answer !== "패스", `R${v.round} 왜무새 → ${w.name}: "${w.question}"`);
    const target = all.find((c) => c.view?.me === w.id)!;
    const other = all.find((c) => c !== target)!;
    assert(!(await call(other.s, "action", { type: "reply", text: "나도!" })).ok, `R${v.round} 지목 안 된 사람은 답 못 남김`);
    assert((await call(target.s, "action", { type: "reply", text: "그냥 좋아서요" })).ok, `R${v.round} ${target.name} 한 줄 답`);
    await wait(100);
    await call(A.s, "action", { type: "advance" });
  }
  if (v.phase === "mini" && !seen.has(key)) {
    seen.add(key);
    console.log(`   🎯 ${v.mini!.title}: ${v.mini!.prompt} ${v.mini!.quote ?? ""}`);
    for (const c of all) {
      const m = c.view!.mini!;
      if (m.isSubject) {
        assert(!(await call(c.s, "action", { type: "pick", optionId: m.options[0].id })).ok, `${c.name}(주인공)은 못 고름`);
        continue;
      }
      const opt = m.options.find((o) => o.id !== c.view!.me)!;
      assert((await call(c.s, "action", { type: "pick", optionId: opt.id })).ok, `${c.name} 고름`);
    }
  }
  if (v.phase === "miniReveal" && !seen.has(key)) {
    seen.add(key);
    assert(v.miniReveal!.picks.length === 3, `R${v.round} 정답 "${v.miniReveal!.answerLabel}" · ${v.miniReveal!.line}`);
    await call(A.s, "action", { type: "advance" });
  }
  await wait(120);
}
const f = A.view!;
assert(f.phase === "final" && f.final, "오늘의 우리 도달");
assert(f.final!.cards.length === 4, "소개 카드 4장");
assert(f.final!.cards.find((c) => c.name === "모모")!.items.length === 4, "패스한 항목은 카드에서 빠짐");
assert(f.final!.commons.length >= 1, `공통점: ${f.final!.commons.join(" | ")}`);
console.log("   상:", f.final!.awards.map((a) => `${a.title}=${a.name}`).join(", "));

const E = await client("재접속");
assert(!(await call(E.s, "resume", { code: made.code, token: "nope" })).ok, "잘못된 토큰 거절");
assert((await call(E.s, "resume", { code: made.code, token: made.token })).ok, "같은 토큰으로 복귀");
await wait(150);
assert(E.view?.me === A.view?.me, "같은 자리로 복귀");
const again = await call(E.s, "action", { type: "start" });
assert(again.ok, `한 판 더 ${again.error ?? ""}`);
for (const c of [...all, E]) c.s.close();
process.exit(0);
