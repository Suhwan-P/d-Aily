// 「진짜 이유를 찾아라」 게임 엔진 — 서버와 '혼자 해보기'(브라우저)가 같은 코드를 쓴다.
import { QUESTIONS, type WaeQuestion } from "./questions";

export type Phase = "lobby" | "write" | "pick" | "reveal" | "round" | "final";

export const POINTS = { truth: 1000, fool: 500 };
export const LIMITS = { maxPlayers: 10, maxAnswer: 40, maxName: 10 };
export const COLORS = ["#a9b6f5", "#ffbfd0", "#ffe48f", "#b6ebd4", "#cdbcff", "#ffcf9e", "#9fe3f0", "#f5b0e8", "#c8e89a", "#d6c6b8"];

export interface Settings {
  rounds: number;
  writeSec: number;
  pickSec: number;
}

interface Player {
  id: string;
  name: string;
  color: string;
  isBot: boolean;
  online: boolean;
  truth: number; // 간파 점수
  fool: number; // 속임 점수
  likesGot: number;
  hits: number; // 진짜를 맞힌 횟수
  fooled: number; // 내 거짓말에 속은 사람 수
}

interface Option {
  id: string;
  text: string;
  isTruth: boolean;
  isHouse: boolean;
  authors: string[];
  pickers: string[];
  likes: string[];
}

export interface PublicPlayer {
  id: string;
  name: string;
  color: string;
  isBot: boolean;
  online: boolean;
  truth: number;
  fool: number;
  score: number;
  done: boolean; // 이번 단계 제출 완료
}

export interface RevealItem {
  optionId: string;
  text: string;
  isTruth: boolean;
  isHouse: boolean;
  authors: { id: string; name: string; color: string }[];
  pickers: { id: string; name: string; color: string }[];
  points: number; // 작성자(가짜) 또는 고른 사람(진짜)이 받은 점수
  likes: number;
}

export interface RoundDelta {
  id: string;
  truth: number;
  fool: number;
}

export interface Award {
  title: string;
  emoji: string;
  name: string;
  color: string;
  detail: string;
}

export interface View {
  code: string;
  me: string;
  hostId: string;
  phase: Phase;
  round: number;
  totalRounds: number;
  doubleRound: boolean;
  settings: Settings;
  players: PublicPlayer[];
  question?: { q: string; category: string; answer?: string; explain?: string };
  myAnswer?: string;
  options?: { id: string; text: string; mine: boolean }[];
  myPick?: string;
  myLikes: string[];
  reveal?: { items: RevealItem[]; index: number };
  deltas?: RoundDelta[];
  awards?: Award[];
  bestLine?: { text: string; name: string; color: string; likes: number; q: string };
  deadline: number | null;
  serverNow: number;
}

export interface EngineHooks {
  /** 상태가 바뀔 때마다 호출 */
  onChange: () => void;
  /** 선택: AI(Claude)로 왜무새 가짜 이유 만들기. 실패하면 null → 문제 은행 가짜 사용 */
  makeHouseFake?: (q: WaeQuestion, avoid: string[]) => Promise<string | null>;
  /** 봇 행동 지연 배율 (테스트에서 0으로) */
  botSpeed?: number;
  /** 공개 한 장당 시간(ms) */
  revealMs?: number;
  /** 라운드 결과 화면 자동 넘김(ms) */
  roundMs?: number;
}

const BOT_NAMES = ["콩떡", "모찌", "두부", "호떡", "감자", "깨비", "보리", "율무"];

let seq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** 비교용 정규화: 공백·문장부호 제거, 소문자 */
export function norm(s: string) {
  return s.toLowerCase().replace(/[\s.,!?~'"`·…\-_()[\]{}:;]/g, "").replace(/(이라서|라서|해서|어서|아서|서|때문에|때문|려고|하려고)$/g, "");
}

function bigrams(s: string) {
  const out: string[] = [];
  for (let i = 0; i < s.length - 1; i++) out.push(s.slice(i, i + 2));
  return out;
}

/** 0~1 유사도 (글자 2개씩 묶어 겹치는 비율) */
export function similarity(a: string, b: string) {
  const x = bigrams(norm(a));
  const y = bigrams(norm(b));
  if (!x.length || !y.length) return norm(a) === norm(b) ? 1 : 0;
  const pool = [...y];
  let hit = 0;
  for (const g of x) {
    const i = pool.indexOf(g);
    if (i >= 0) {
      hit++;
      pool.splice(i, 1);
    }
  }
  return (2 * hit) / (x.length + y.length);
}

export class Game {
  readonly code: string;
  hostId = "";
  phase: Phase = "lobby";
  settings: Settings = { rounds: 5, writeSec: 45, pickSec: 25 };
  round = 0;
  players: Player[] = [];
  private question: WaeQuestion | null = null;
  private used = new Set<string>();
  private answers = new Map<string, string>();
  private options: Option[] = [];
  private houseFake: string | null = null;
  private fakePool: string[] = []; // 이번 라운드에 아직 안 쓴 가짜 이유 (봇·추천·왜무새가 나눠 씀)
  private suggested = new Map<string, string[]>(); // 사람별로 추천받은 가짜
  private revealItems: RevealItem[] = [];
  private revealIndex = 0;
  private deltas: RoundDelta[] = [];
  private bestLines: { text: string; author: string; likes: number; picks: number; q: string }[] = [];
  deadline: number | null = null;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private hooks: EngineHooks;
  lastActive = Date.now();

  constructor(code: string, hooks: EngineHooks) {
    this.code = code;
    this.hooks = hooks;
  }

  // ───────── 사람 관리 ─────────
  addPlayer(name: string, isBot = false): { id?: string; error?: string } {
    const clean = name.trim().slice(0, LIMITS.maxName);
    if (!clean) return { error: "닉네임을 써 주세요" };
    if (this.players.length >= LIMITS.maxPlayers) return { error: `방이 꽉 찼어요 (최대 ${LIMITS.maxPlayers}명)` };
    if (this.phase !== "lobby") return { error: "이미 게임이 시작됐어요. 다음 판에 들어와 주세요" };
    let finalName = clean;
    let n = 2;
    while (this.players.some((p) => p.name === finalName)) finalName = `${clean}${n++}`;
    const used = new Set(this.players.map((p) => p.color));
    const color = COLORS.find((c) => !used.has(c)) ?? COLORS[this.players.length % COLORS.length];
    const p: Player = { id: uid("p"), name: finalName, color, isBot, online: true, truth: 0, fool: 0, likesGot: 0, hits: 0, fooled: 0 };
    this.players.push(p);
    if (!this.hostId && !isBot) this.hostId = p.id;
    this.touch();
    return { id: p.id };
  }

  addBot(byId: string) {
    if (byId !== this.hostId) return { error: "방장만 봇을 넣을 수 있어요" };
    const used = new Set(this.players.map((p) => p.name));
    const name = BOT_NAMES.find((n) => !used.has(`🤖${n}`)) ?? "봇";
    return this.addPlayer(`🤖${name}`, true);
  }

  removePlayer(byId: string, targetId: string) {
    if (byId !== this.hostId && byId !== targetId) return { error: "권한이 없어요" };
    if (this.phase !== "lobby" && byId !== targetId) return { error: "게임 중엔 내보낼 수 없어요" };
    this.players = this.players.filter((p) => p.id !== targetId);
    if (this.hostId === targetId) this.pickNewHost();
    this.touch();
    return {};
  }

  setOnline(id: string, online: boolean) {
    const p = this.players.find((x) => x.id === id);
    if (!p) return;
    p.online = online;
    if (!online && this.hostId === id) this.pickNewHost();
    if (online && !this.players.some((x) => x.id === this.hostId && x.online)) this.hostId = id;
    if (!online && this.phase === "lobby") {
      // 로비에서 나간 사람은 잠깐 기다렸다 정리
      this.later(() => {
        const q = this.players.find((x) => x.id === id);
        if (q && !q.online && this.phase === "lobby") {
          this.players = this.players.filter((x) => x.id !== id);
          this.touch();
        }
      }, 60_000);
    }
    this.checkAllDone();
    this.touch();
  }

  private pickNewHost() {
    const next = this.players.find((p) => !p.isBot && p.online) ?? this.players.find((p) => !p.isBot);
    this.hostId = next?.id ?? "";
  }

  get humansOnline() {
    return this.players.filter((p) => !p.isBot && p.online).length;
  }

  // ───────── 진행 ─────────
  updateSettings(byId: string, s: Partial<Settings>) {
    if (byId !== this.hostId) return { error: "방장만 바꿀 수 있어요" };
    if (this.phase !== "lobby" && this.phase !== "final") return { error: "게임 중엔 바꿀 수 없어요" };
    if (s.rounds && [3, 5, 7].includes(s.rounds)) this.settings.rounds = s.rounds;
    if (s.writeSec && [30, 45, 60].includes(s.writeSec)) this.settings.writeSec = s.writeSec;
    this.touch();
    return {};
  }

  start(byId: string) {
    if (byId !== this.hostId) return { error: "방장만 시작할 수 있어요" };
    if (this.phase !== "lobby" && this.phase !== "final") return { error: "이미 진행 중이에요" };
    if (this.players.length < 2) return { error: "두 명 이상 있어야 해요 (봇도 괜찮아요)" };
    for (const p of this.players) Object.assign(p, { truth: 0, fool: 0, likesGot: 0, hits: 0, fooled: 0 });
    this.round = 0;
    this.bestLines = [];
    this.nextRound();
    return {};
  }

  /** 방장이 결과 화면에서 '다음' */
  advance(byId: string) {
    if (byId !== this.hostId) return { error: "방장만 넘길 수 있어요" };
    if (this.phase === "round") this.nextRound();
    else if (this.phase === "reveal") this.finishReveal();
    else if (this.phase === "final") {
      this.phase = "lobby";
      this.deadline = null;
      this.touch();
    }
    return {};
  }

  private pickQuestion() {
    let pool = QUESTIONS.filter((q) => !this.used.has(q.id));
    if (!pool.length) {
      this.used.clear();
      pool = QUESTIONS;
    }
    const q = pool[Math.floor(Math.random() * pool.length)];
    this.used.add(q.id);
    return q;
  }

  private nextRound() {
    this.clearTimers();
    if (this.round >= this.settings.rounds) return this.finish();
    this.round++;
    this.question = this.pickQuestion();
    this.answers.clear();
    this.options = [];
    this.revealItems = [];
    this.revealIndex = 0;
    this.deltas = [];
    this.houseFake = null;
    this.fakePool = shuffle(this.question.fakes);
    this.suggested.clear();
    this.phase = "write";
    this.deadline = Date.now() + this.settings.writeSec * 1000;
    this.later(() => this.toPick(), this.settings.writeSec * 1000 + 300);

    // 왜무새 가짜: AI가 있으면 AI, 없으면 문제 은행
    const q = this.question;
    const round = this.round;
    if (this.hooks.makeHouseFake) {
      this.hooks
        .makeHouseFake(q, [q.answer])
        .then((t) => {
          if (t && this.round === round && this.phase === "write" && similarity(t, q.answer) < 0.55) this.houseFake = t;
        })
        .catch(() => {});
    }

    // 봇은 몇 초 뒤 가짜 이유 제출
    for (const b of this.players.filter((p) => p.isBot)) {
      this.botLater(() => {
        if (this.phase !== "write" || this.round !== round) return;
        const pick = this.takeFake() ?? `${q.fakes[Math.floor(Math.random() * q.fakes.length)]} 같아서`;
        this.answers.set(b.id, pick);
        this.checkAllDone();
        this.touch();
      }, 4000 + Math.random() * 12000);
    }
    this.touch();
  }

  /** 남은 가짜 이유 하나 꺼내기 (이미 제출된 답과 겹치지 않게) */
  private takeFake(): string | null {
    const taken = new Set([...this.answers.values()].map(norm));
    const i = this.fakePool.findIndex((f) => !taken.has(norm(f)));
    if (i < 0) return null;
    return this.fakePool.splice(i, 1)[0];
  }

  /** 거짓말 추천받기: 막힌 사람에게 그럴듯한 가짜 하나 (최대 2번) */
  suggestLie(id: string): { error?: string; text?: string } {
    if (this.phase !== "write") return { error: "지금은 추천받을 수 없어요" };
    const mine = this.suggested.get(id) ?? [];
    if (mine.length >= 2) return { error: "추천은 한 라운드에 두 번까지예요. 직접 지어내 봐요!" };
    const text = this.takeFake();
    if (!text) return { error: "추천할 거짓말이 다 떨어졌어요 😅" };
    this.suggested.set(id, [...mine, text]);
    return { text };
  }

  submitAnswer(id: string, raw: string): { error?: string } {
    if (this.phase !== "write" || !this.question) return { error: "지금은 쓸 수 없어요" };
    const text = raw.trim().replace(/\s+/g, " ").slice(0, LIMITS.maxAnswer);
    if (text.length < 2) return { error: "조금만 더 써 주세요" };
    if (similarity(text, this.question.answer) >= 0.55)
      return { error: "앗, 그건 진짜 이유랑 너무 비슷해요! 다른 가짜 이유를 써 주세요 🤫" };
    this.answers.set(id, text);
    this.checkAllDone();
    this.touch();
    return {};
  }

  private toPick() {
    if (this.phase !== "write" || !this.question) return;
    this.clearTimers();
    const q = this.question;
    const opts: Option[] = [{ id: uid("o"), text: q.answer, isTruth: true, isHouse: false, authors: [], pickers: [], likes: [] }];
    // 같은 거짓말은 하나로 합치고 작성자를 함께 기록
    for (const [pid, text] of this.answers) {
      const dup = opts.find((o) => !o.isTruth && norm(o.text) === norm(text));
      if (dup) dup.authors.push(pid);
      else opts.push({ id: uid("o"), text, isTruth: false, isHouse: false, authors: [pid], pickers: [], likes: [] });
    }
    // 왜무새 가짜 1개 (사람 답이 적으면 2개)
    const taken = new Set(opts.map((o) => norm(o.text)));
    const houseNeeded = opts.length < 4 ? 2 : 1;
    const houseTexts = [this.houseFake, ...this.fakePool, ...shuffle(q.fakes)].filter((t): t is string => !!t && !taken.has(norm(t)));
    for (const t of houseTexts.slice(0, houseNeeded)) {
      opts.push({ id: uid("o"), text: t, isTruth: false, isHouse: true, authors: [], pickers: [], likes: [] });
      taken.add(norm(t));
    }
    this.options = shuffle(opts);
    this.phase = "pick";
    this.deadline = Date.now() + this.settings.pickSec * 1000;
    this.later(() => this.toReveal(), this.settings.pickSec * 1000 + 300);

    const round = this.round;
    for (const b of this.players.filter((p) => p.isBot)) {
      this.botLater(() => {
        if (this.phase !== "pick" || this.round !== round) return;
        const choices = this.options.filter((o) => !o.authors.includes(b.id));
        const truth = choices.find((o) => o.isTruth)!;
        const pick = Math.random() < 0.4 ? truth : choices[Math.floor(Math.random() * choices.length)];
        this.submitPick(b.id, pick.id);
      }, 3000 + Math.random() * 9000);
    }
    this.touch();
  }

  submitPick(id: string, optionId: string): { error?: string } {
    if (this.phase !== "pick") return { error: "지금은 고를 수 없어요" };
    const o = this.options.find((x) => x.id === optionId);
    if (!o) return { error: "없는 보기예요" };
    if (o.authors.includes(id)) return { error: "내가 쓴 거짓말은 고를 수 없어요 😏" };
    for (const x of this.options) x.pickers = x.pickers.filter((p) => p !== id);
    o.pickers.push(id);
    this.checkAllDone();
    this.touch();
    return {};
  }

  like(id: string, optionId: string): { error?: string } {
    if (this.phase !== "reveal" && this.phase !== "round") return {};
    const o = this.options.find((x) => x.id === optionId);
    if (!o || o.isTruth || o.authors.includes(id)) return {};
    if (o.likes.includes(id)) o.likes = o.likes.filter((x) => x !== id);
    else o.likes.push(id);
    const item = this.revealItems.find((r) => r.optionId === optionId);
    if (item) item.likes = o.likes.length;
    this.touch();
    return {};
  }

  private toReveal() {
    if (this.phase !== "pick") return;
    this.clearTimers();
    const mult = this.isDouble() ? 2 : 1;
    const deltas = new Map<string, RoundDelta>(this.players.map((p) => [p.id, { id: p.id, truth: 0, fool: 0 }]));
    for (const o of this.options) {
      if (o.isTruth)
        for (const pid of o.pickers) {
          deltas.get(pid)!.truth += POINTS.truth * mult;
          const p = this.players.find((x) => x.id === pid);
          if (p) p.hits++;
        }
      else if (!o.isHouse)
        for (const a of o.authors) {
          const d = deltas.get(a);
          if (d) d.fool += Math.round((POINTS.fool * mult * o.pickers.length) / o.authors.length);
          const p = this.players.find((x) => x.id === a);
          if (p) p.fooled += o.pickers.length;
        }
    }
    for (const p of this.players) {
      const d = deltas.get(p.id)!;
      p.truth += d.truth;
      p.fool += d.fool;
    }
    this.deltas = [...deltas.values()];

    // 공개 순서: 고른 사람이 있는 가짜(적은 순) → 진짜는 맨 마지막
    const fakes = this.options.filter((o) => !o.isTruth && o.pickers.length > 0).sort((a, b) => a.pickers.length - b.pickers.length);
    const truth = this.options.find((o) => o.isTruth)!;
    this.revealItems = [...fakes, truth].map((o) => this.toRevealItem(o, mult));
    this.revealIndex = 0;
    this.phase = "reveal";
    this.scheduleRevealStep();
    this.touch();
  }

  private toRevealItem(o: Option, mult: number): RevealItem {
    const who = (id: string) => {
      const p = this.players.find((x) => x.id === id);
      return { id, name: p?.name ?? "?", color: p?.color ?? "#ccc" };
    };
    return {
      optionId: o.id,
      text: o.text,
      isTruth: o.isTruth,
      isHouse: o.isHouse,
      authors: o.authors.map(who),
      pickers: o.pickers.map(who),
      points: o.isTruth ? POINTS.truth * mult : o.isHouse ? 0 : Math.round((POINTS.fool * mult * o.pickers.length) / Math.max(1, o.authors.length)),
      likes: o.likes.length,
    };
  }

  private scheduleRevealStep() {
    const ms = this.hooks.revealMs ?? 4200;
    const isLast = this.revealIndex >= this.revealItems.length - 1;
    this.deadline = null;
    this.later(
      () => {
        if (this.phase !== "reveal") return;
        if (isLast) return this.finishReveal();
        this.revealIndex++;
        this.scheduleRevealStep();
        this.touch();
      },
      isLast ? ms + 2600 : ms,
    );
  }

  private finishReveal() {
    if (this.phase !== "reveal") return;
    this.clearTimers();
    // 명대사 후보 기록 (사람이 쓴 가짜만)
    for (const o of this.options)
      if (!o.isTruth && !o.isHouse && o.authors.length)
        this.bestLines.push({ text: o.text, author: o.authors[0], likes: o.likes.length, picks: o.pickers.length, q: this.question!.q });
    for (const o of this.options) for (const a of o.authors) {
      const p = this.players.find((x) => x.id === a);
      if (p) p.likesGot += o.likes.length;
    }
    this.phase = "round";
    const ms = this.hooks.roundMs ?? 12000;
    this.deadline = Date.now() + ms;
    this.later(() => this.phase === "round" && this.nextRound(), ms);
    this.touch();
  }

  private finish() {
    this.clearTimers();
    this.phase = "final";
    this.deadline = null;
    this.touch();
  }

  isDouble() {
    return this.settings.rounds > 1 && this.round === this.settings.rounds;
  }

  private checkAllDone() {
    const active = this.players.filter((p) => p.online || p.isBot);
    if (!active.length) return;
    if (this.phase === "write" && active.every((p) => this.answers.has(p.id))) {
      this.clearTimers();
      this.later(() => this.toPick(), 700);
    }
    if (this.phase === "pick" && active.every((p) => this.options.some((o) => o.pickers.includes(p.id)))) {
      this.clearTimers();
      this.later(() => this.toReveal(), 700);
    }
  }

  // ───────── 화면용 상태 ─────────
  viewFor(me: string): View {
    const done = (p: Player) =>
      this.phase === "write" ? this.answers.has(p.id) : this.phase === "pick" ? this.options.some((o) => o.pickers.includes(p.id)) : false;
    const players: PublicPlayer[] = this.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      isBot: p.isBot,
      online: p.online,
      truth: p.truth,
      fool: p.fool,
      score: p.truth + p.fool,
      done: done(p),
    }));
    const v: View = {
      code: this.code,
      me,
      hostId: this.hostId,
      phase: this.phase,
      round: this.round,
      totalRounds: this.settings.rounds,
      doubleRound: this.isDouble(),
      settings: this.settings,
      players,
      myLikes: this.options.filter((o) => o.likes.includes(me)).map((o) => o.id),
      deadline: this.deadline,
      serverNow: Date.now(),
    };
    if (this.question && this.phase !== "lobby" && this.phase !== "final") {
      v.question = { q: this.question.q, category: this.question.category };
      if (this.phase === "round" || (this.phase === "reveal" && this.revealIndex >= this.revealItems.length - 1)) {
        v.question.answer = this.question.answer;
        v.question.explain = this.question.explain;
      }
    }
    if (this.phase === "write") v.myAnswer = this.answers.get(me);
    if (this.phase === "pick" || this.phase === "reveal" || this.phase === "round") {
      v.options = this.options.map((o) => ({ id: o.id, text: o.text, mine: o.authors.includes(me) }));
      v.myPick = this.options.find((o) => o.pickers.includes(me))?.id;
    }
    if (this.phase === "reveal") v.reveal = { items: this.revealItems.slice(0, this.revealIndex + 1), index: this.revealIndex };
    if (this.phase === "round") {
      v.reveal = { items: this.revealItems, index: this.revealItems.length - 1 };
      v.deltas = this.deltas;
    }
    if (this.phase === "final") {
      v.awards = this.awards();
      const best = this.bestLines.slice().sort((a, b) => b.likes - a.likes || b.picks - a.picks)[0];
      const bp = best && this.players.find((p) => p.id === best.author);
      if (best && bp && (best.likes > 0 || best.picks > 0)) v.bestLine = { text: best.text, name: bp.name, color: bp.color, likes: best.likes, q: best.q };
    }
    return v;
  }

  private awards(): Award[] {
    const out: Award[] = [];
    const top = (k: "hits" | "fooled" | "likesGot") => this.players.slice().sort((a, b) => b[k] - a[k])[0];
    const t = top("hits");
    if (t && t.hits > 0) out.push({ title: "간파왕", emoji: "🔍", name: t.name, color: t.color, detail: `진짜 이유를 ${t.hits}번 찾아냈어요` });
    const f = top("fooled");
    if (f && f.fooled > 0) out.push({ title: "거짓말왕", emoji: "🎭", name: f.name, color: f.color, detail: `${f.fooled}번이나 속였어요` });
    const l = top("likesGot");
    if (l && l.likesGot > 0) out.push({ title: "웃음 제조기", emoji: "😂", name: l.name, color: l.color, detail: `ㅋㅋ ${l.likesGot}개를 받았어요` });
    return out;
  }

  // ───────── 타이머 ─────────
  private later(fn: () => void, ms: number) {
    this.timers.push(setTimeout(fn, ms));
  }
  private botLater(fn: () => void, ms: number) {
    const speed = this.hooks.botSpeed ?? 1;
    this.later(fn, ms * speed);
  }
  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }
  dispose() {
    this.clearTimers();
  }
  private touch() {
    this.lastActive = Date.now();
    this.hooks.onChange();
  }
}
