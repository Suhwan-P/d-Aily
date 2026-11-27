// 왜무새 테이블 — 처음 만난 사이 자기소개 게임 엔진 (서버·혼자 해보기 공용)
//
// 한 판 흐름
//   lobby → profile(왜무새가 짧은 질문으로 소개 정보 모으기)
//   → [ask(테이블 질문에 다 같이 답) → share(한꺼번에 공개 + 왜무새가 한 명에게 "왜?")
//      → mini(모은 소개 정보로 맞히기) → miniReveal] × 라운드
//   → final(오늘의 우리: 소개 카드 + 공통점)
//
// 원칙: AI는 질문만 한다. 답과 대화와 판단은 사람이 한다. 모든 질문은 '패스' 가능.
import { BOT_TABLE_ANSWERS, PROFILE_QS, TABLE_QS, WHY_FALLBACKS, type ProfileQ, type TableQ } from "./questions";

export type Phase = "lobby" | "profile" | "ask" | "share" | "mini" | "miniReveal" | "final";
export type Level = "light" | "deep";
export type MiniKind = "who" | "guess" | "pair";

export const LIMITS = { maxPlayers: 6, minPlayers: 2, maxAnswer: 30, maxName: 10 };
export const PASS = "패스";
export const COLORS = ["#a9b6f5", "#ffbfd0", "#ffe48f", "#b6ebd4", "#cdbcff", "#ffcf9e"];

export interface Settings {
  rounds: number; // 테이블 질문 수
  answerSec: number;
  level: Level;
}

interface Player {
  id: string;
  name: string;
  color: string;
  isBot: boolean;
  online: boolean;
  profile: (string | null)[]; // profileQs 순서대로, null = 아직
  hits: number; // 맞히기 성공
  whyCount: number; // 왜무새에게 지목된 횟수
}

export interface PublicPlayer {
  id: string;
  name: string;
  color: string;
  isBot: boolean;
  online: boolean;
  done: boolean;
  hits: number;
}

export interface Who {
  id: string;
  name: string;
  color: string;
}

export interface ShareView {
  q: string;
  answers: (Who & { text: string })[];
  why: (Who & { answer: string; question: string; reply?: string }) | null;
}

export interface MiniView {
  kind: MiniKind;
  title: string;
  prompt: string;
  quote?: string;
  subject?: Who;
  isSubject: boolean;
  options: { id: string; label: string; color?: string }[];
  myPick?: string;
}

export interface MiniRevealView extends MiniView {
  correct: string[]; // 정답 option id
  answerLabel: string;
  picks: (Who & { optionId: string; ok: boolean })[];
  line: string;
}

export interface FinalCard extends Who {
  summary: string | null;
  items: { q: string; a: string }[];
}

export interface View {
  code: string;
  me: string;
  hostId: string;
  phase: Phase;
  round: number;
  totalRounds: number;
  settings: Settings;
  players: PublicPlayer[];
  deadline: number | null;
  serverNow: number;
  profile?: { questions: { q: string; kind: "choice" | "text"; options?: string[]; placeholder?: string }[]; mine: (string | null)[] };
  ask?: { q: string; placeholder?: string; mine?: string };
  share?: ShareView;
  mini?: MiniView;
  miniReveal?: MiniRevealView;
  final?: { cards: FinalCard[]; commons: string[]; awards: { emoji: string; title: string; name: string; color: string; detail: string }[] };
}

export interface EngineHooks {
  onChange: () => void;
  /** 선택: 답 하나에 붙일 짧은 '왜?' 꼬리 질문 (Claude). 실패하면 null → 기본 질문 */
  followUp?: (q: string, answer: string, name: string) => Promise<string | null>;
  /** 선택: 소개 카드 한 줄 요약 (Claude). 실패하면 null → 요약 없이 카드만 */
  summarize?: (name: string, items: { q: string; a: string }[]) => Promise<string | null>;
  botSpeed?: number;
  /** 각 단계 시간(ms) 덮어쓰기 — 테스트용 */
  times?: Partial<{ profile: number; share: number; mini: number; miniReveal: number; aiWait: number }>;
}

const BOT_NAMES = ["콩떡", "모찌", "두부", "호떡", "감자"];
let seq = 0;
const uid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const pickOne = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const clean = (s: string, max = LIMITS.maxAnswer) => s.trim().replace(/\s+/g, " ").slice(0, max);
const isAnswer = (a: string | null | undefined): a is string => !!a && a !== PASS;

interface Mini {
  kind: MiniKind;
  subjectId: string;
  qIndex: number;
  prompt: string;
  title: string;
  quote?: string;
  options: { id: string; label: string; color?: string }[];
  correct: string[];
  answerLabel: string;
  picks: Map<string, string>;
}

export class IntroGame {
  readonly code: string;
  hostId = "";
  phase: Phase = "lobby";
  settings: Settings = { rounds: 4, answerSec: 40, level: "light" };
  round = 0;
  players: Player[] = [];
  deadline: number | null = null;
  lastActive = Date.now();

  private profileQs: ProfileQ[] = [];
  private tableQ: TableQ | null = null;
  private usedTable = new Set<string>();
  private answers = new Map<string, string>();
  private share: ShareView | null = null;
  private mini: Mini | null = null;
  private usedMini = new Set<string>();
  private featured = new Map<string, number>();
  private summaries = new Map<string, string>();
  private timers: ReturnType<typeof setTimeout>[] = [];
  private hooks: EngineHooks;

  constructor(code: string, hooks: EngineHooks) {
    this.code = code;
    this.hooks = hooks;
  }

  private t(k: "profile" | "share" | "mini" | "miniReveal" | "aiWait") {
    const def = { profile: 150_000, share: 75_000, mini: 20_000, miniReveal: 10_000, aiWait: 3500 }[k];
    return this.hooks.times?.[k] ?? def;
  }

  // ───────── 사람 ─────────
  addPlayer(name: string, isBot = false): { id?: string; error?: string } {
    const n = name.trim().slice(0, LIMITS.maxName);
    if (!n) return { error: "이름을 써 주세요 (별명도 괜찮아요)" };
    if (this.players.length >= LIMITS.maxPlayers) return { error: `방이 꽉 찼어요 (최대 ${LIMITS.maxPlayers}명)` };
    if (this.phase !== "lobby") return { error: "이미 시작했어요. 다음 판에 함께해요" };
    let finalName = n;
    let k = 2;
    while (this.players.some((p) => p.name === finalName)) finalName = `${n}${k++}`;
    const used = new Set(this.players.map((p) => p.color));
    const color = COLORS.find((c) => !used.has(c)) ?? COLORS[this.players.length % COLORS.length];
    const p: Player = { id: uid("p"), name: finalName, color, isBot, online: true, profile: [], hits: 0, whyCount: 0 };
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
    if (this.phase !== "lobby" && byId !== targetId) return { error: "진행 중엔 내보낼 수 없어요" };
    this.players = this.players.filter((p) => p.id !== targetId);
    if (this.hostId === targetId) this.pickNewHost();
    this.checkAllDone();
    this.touch();
    return {};
  }

  setOnline(id: string, online: boolean) {
    const p = this.players.find((x) => x.id === id);
    if (!p) return;
    p.online = online;
    if (!online && this.hostId === id) this.pickNewHost();
    if (online && !this.players.some((x) => x.id === this.hostId && x.online)) this.hostId = id;
    if (!online && this.phase === "lobby")
      this.later(() => {
        const q = this.players.find((x) => x.id === id);
        if (q && !q.online && this.phase === "lobby") {
          this.players = this.players.filter((x) => x.id !== id);
          this.touch();
        }
      }, 60_000);
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
    if (this.phase !== "lobby" && this.phase !== "final") return { error: "진행 중엔 바꿀 수 없어요" };
    if (s.rounds && [3, 4, 5].includes(s.rounds)) this.settings.rounds = s.rounds;
    if (s.answerSec && [30, 40, 60].includes(s.answerSec)) this.settings.answerSec = s.answerSec;
    if (s.level === "light" || s.level === "deep") this.settings.level = s.level;
    this.touch();
    return {};
  }

  start(byId: string) {
    if (byId !== this.hostId) return { error: "방장만 시작할 수 있어요" };
    if (this.phase !== "lobby" && this.phase !== "final") return { error: "이미 진행 중이에요" };
    if (this.players.length < LIMITS.minPlayers) return { error: "두 명 이상 있어야 해요 (봇도 괜찮아요)" };
    this.clearTimers();
    const choice = shuffle(PROFILE_QS.filter((q) => q.kind === "choice")).slice(0, 2);
    const text = shuffle(PROFILE_QS.filter((q) => q.kind === "text")).slice(0, 3);
    this.profileQs = [choice[0], text[0], choice[1], text[1], text[2]];
    for (const p of this.players) Object.assign(p, { profile: this.profileQs.map(() => null), hits: 0, whyCount: 0 });
    this.round = 0;
    this.usedMini.clear();
    this.featured.clear();
    this.summaries.clear();
    this.phase = "profile";
    this.deadline = Date.now() + this.t("profile");
    this.later(() => this.phase === "profile" && this.nextRound(), this.t("profile"));
    for (const b of this.players.filter((p) => p.isBot))
      this.profileQs.forEach((q, i) =>
        this.botLater(() => {
          if (this.phase !== "profile") return;
          b.profile[i] = pickOne(q.kind === "choice" ? q.options! : q.botAnswers);
          this.checkAllDone();
          this.touch();
        }, 1500 + i * 1800 + Math.random() * 2500),
      );
    this.touch();
    return {};
  }

  answerProfile(id: string, index: number, raw: string) {
    if (this.phase !== "profile") return { error: "지금은 소개 질문 시간이 아니에요" };
    const p = this.players.find((x) => x.id === id);
    const q = this.profileQs[index];
    if (!p || !q) return { error: "없는 질문이에요" };
    let a = raw === PASS ? PASS : clean(raw, 20);
    if (!a) return { error: "한 단어라도 써 주세요 (패스도 돼요)" };
    if (q.kind === "choice" && a !== PASS && !q.options!.includes(a)) return { error: "보기 중에서 골라 주세요" };
    p.profile[index] = a;
    this.checkAllDone();
    this.touch();
    return {};
  }

  /** 방장 '다음' */
  advance(byId: string) {
    if (byId !== this.hostId) return { error: "방장만 넘길 수 있어요" };
    if (this.phase === "profile") this.nextRound();
    else if (this.phase === "ask") this.toShare();
    else if (this.phase === "share") this.afterShare();
    else if (this.phase === "mini") this.toMiniReveal();
    else if (this.phase === "miniReveal") this.nextRound();
    else if (this.phase === "final") {
      this.phase = "lobby";
      this.deadline = null;
      this.touch();
    }
    return {};
  }

  private pickTable(): TableQ {
    const lv = this.settings.level;
    // '조금 깊게'여도 가벼운 질문을 섞어 분위기가 무거워지지 않게
    let pool = TABLE_QS.filter((q) => !this.usedTable.has(q.id) && (lv === "deep" ? true : q.level === "light"));
    if (lv === "deep" && this.round % 2 === 0) pool = pool.filter((q) => q.level === "deep").length ? pool.filter((q) => q.level === "deep") : pool;
    if (!pool.length) {
      this.usedTable.clear();
      pool = TABLE_QS.filter((q) => lv === "deep" || q.level === "light");
    }
    const q = pickOne(pool);
    this.usedTable.add(q.id);
    return q;
  }

  private nextRound() {
    this.clearTimers();
    if (this.round >= this.settings.rounds) return this.finish();
    this.round++;
    this.tableQ = this.pickTable();
    this.answers.clear();
    this.share = null;
    this.mini = null;
    this.phase = "ask";
    this.deadline = Date.now() + this.settings.answerSec * 1000;
    this.later(() => this.phase === "ask" && this.toShare(), this.settings.answerSec * 1000 + 300);
    const round = this.round;
    for (const b of this.players.filter((p) => p.isBot))
      this.botLater(() => {
        if (this.phase !== "ask" || this.round !== round) return;
        const taken = new Set(this.answers.values());
        this.answers.set(b.id, pickOne(BOT_TABLE_ANSWERS.filter((a) => !taken.has(a))) ?? "음… 비밀");
        this.checkAllDone();
        this.touch();
      }, 2500 + Math.random() * 7000);
    this.touch();
  }

  submitAnswer(id: string, raw: string) {
    if (this.phase !== "ask") return { error: "지금은 답하는 시간이 아니에요" };
    const a = raw === PASS ? PASS : clean(raw);
    if (!a) return { error: "한 단어라도 써 주세요 (패스도 돼요)" };
    this.answers.set(id, a);
    this.checkAllDone();
    this.touch();
    return {};
  }

  private who(p: Player): Who {
    return { id: p.id, name: p.name, color: p.color };
  }

  private toShare() {
    if (this.phase !== "ask" || !this.tableQ) return;
    this.clearTimers();
    const answers = this.players
      .filter((p) => this.answers.has(p.id))
      .map((p) => ({ ...this.who(p), text: this.answers.get(p.id)! }));
    this.share = { q: this.tableQ.q, answers, why: null };
    this.phase = "share";
    this.deadline = Date.now() + this.t("share");
    this.later(() => this.phase === "share" && this.afterShare(), this.t("share"));
    this.touch();

    // 왜무새가 한 명을 골라 '왜?' — 덜 지목된 사람, 패스 안 한 사람 우선
    const cands = this.players.filter((p) => isAnswer(this.answers.get(p.id)));
    if (!cands.length) return;
    const min = Math.min(...cands.map((p) => p.whyCount));
    const target = pickOne(cands.filter((p) => p.whyCount === min && !p.isBot).length ? cands.filter((p) => p.whyCount === min && !p.isBot) : cands.filter((p) => p.whyCount === min));
    target.whyCount++;
    const answer = this.answers.get(target.id)!;
    const round = this.round;
    const fallback = pickOne(WHY_FALLBACKS);
    const ai = this.hooks.followUp
      ? Promise.race([
          this.hooks.followUp(this.tableQ.q, answer, target.name).catch(() => null),
          new Promise<null>((r) => setTimeout(() => r(null), this.t("aiWait"))),
        ])
      : Promise.resolve(null);
    // 답이 다 보이고 잠깐 뒤에 왜무새가 등장 (AI 대기 시간과 겹침)
    const shownAt = Date.now() + 1800 * (this.hooks.botSpeed ?? 1);
    ai.then((q) => {
      const go = () => {
        if (this.phase !== "share" || this.round !== round || !this.share) return;
        this.share.why = { ...this.who(target), answer, question: q || fallback };
        this.touch();
      };
      const wait = shownAt - Date.now();
      if (wait > 0) this.later(go, wait);
      else go();
    });
  }

  /** 지목된 사람이 '왜?'에 짧게 답하기 (선택 — 말로 해도 됨) */
  reply(id: string, raw: string) {
    if (this.phase !== "share" || !this.share?.why || this.share.why.id !== id) return { error: "지금은 답할 차례가 아니에요" };
    const a = clean(raw, 40);
    if (!a) return { error: "한 줄만 써 주세요" };
    this.share.why.reply = a;
    this.touch();
    return {};
  }

  private afterShare() {
    if (this.phase !== "share") return;
    this.clearTimers();
    const m = this.makeMini();
    if (!m) return this.nextRound();
    this.mini = m;
    this.phase = "mini";
    this.deadline = Date.now() + this.t("mini");
    this.later(() => this.phase === "mini" && this.toMiniReveal(), this.t("mini"));
    const round = this.round;
    for (const b of this.players.filter((p) => p.isBot && p.id !== m.subjectId))
      this.botLater(() => {
        if (this.phase !== "mini" || this.round !== round || !this.mini) return;
        const opts = this.mini.options.filter((o) => o.id !== b.id);
        this.pick(b.id, (Math.random() < 0.45 ? opts.find((o) => this.mini!.correct.includes(o.id)) : null)?.id ?? pickOne(opts).id);
      }, 2000 + Math.random() * 6000);
    this.touch();
  }

  /** 모은 소개 정보로 맞히기 문제 만들기 — 종류를 돌아가며, 덜 나온 사람을 주인공으로 */
  private makeMini(): Mini | null {
    const ps = this.players;
    const order: MiniKind[] = (["who", "guess", "pair"] as MiniKind[]).map((_, i, a) => a[(i + this.round - 1) % a.length]);
    const kinds = ps.length >= 3 ? order : order.filter((k) => k === "guess");
    const subjects = shuffle(ps).sort((a, b) => (this.featured.get(a.id) ?? 0) - (this.featured.get(b.id) ?? 0));
    for (const kind of kinds)
      for (const s of subjects)
        for (const i of shuffle(this.profileQs.map((_, k) => k))) {
          const q = this.profileQs[i];
          const a = s.profile[i];
          const key = `${kind}:${s.id}:${i}`;
          if (this.usedMini.has(key) || !isAnswer(a)) continue;
          let m: Mini | null = null;
          if (kind === "who" && q.kind === "text") {
            m = {
              kind, subjectId: s.id, qIndex: i, title: "누구 답일까?", prompt: `「${q.q}」에 이렇게 답한 사람은?`, quote: a,
              options: ps.map((p) => ({ id: p.id, label: p.name, color: p.color })), correct: [s.id], answerLabel: s.name, picks: new Map(),
            };
          } else if (kind === "guess" && q.kind === "choice") {
            m = {
              kind, subjectId: s.id, qIndex: i, title: "맞혀 봐요", prompt: `${s.name}님은 「${q.q}」에 뭐라고 답했을까?`,
              options: q.options!.map((o) => ({ id: o, label: o })), correct: [a], answerLabel: a, picks: new Map(),
            };
          } else if (kind === "pair" && q.kind === "choice") {
            const same = ps.filter((p) => p.id !== s.id && p.profile[i] === a);
            if (!same.length || same.length === ps.length - 1) continue; // 다 같으면 재미없음
            m = {
              kind, subjectId: s.id, qIndex: i, title: "공통점 찾기", prompt: `「${q.q}」에 ${s.name}님과 같은 답을 한 사람은?`, quote: a,
              options: ps.filter((p) => p.id !== s.id).map((p) => ({ id: p.id, label: p.name, color: p.color })),
              correct: same.map((p) => p.id), answerLabel: same.map((p) => p.name).join(", "), picks: new Map(),
            };
          }
          if (m) {
            this.usedMini.add(key);
            this.featured.set(s.id, (this.featured.get(s.id) ?? 0) + 1);
            return m;
          }
        }
    return null;
  }

  pick(id: string, optionId: string) {
    if (this.phase !== "mini" || !this.mini) return { error: "지금은 고를 수 없어요" };
    if (id === this.mini.subjectId) return { error: "내 얘기라서 이번엔 구경만 해요 🤫" };
    if (!this.mini.options.some((o) => o.id === optionId)) return { error: "없는 보기예요" };
    if (optionId === id) return { error: "나 말고 다른 사람을 골라 주세요" };
    this.mini.picks.set(id, optionId);
    this.checkAllDone();
    this.touch();
    return {};
  }

  private toMiniReveal() {
    if (this.phase !== "mini" || !this.mini) return;
    this.clearTimers();
    let ok = 0;
    for (const [pid, o] of this.mini.picks)
      if (this.mini.correct.includes(o)) {
        ok++;
        const p = this.players.find((x) => x.id === pid);
        if (p) p.hits++;
      }
    const n = this.mini.picks.size;
    (this.mini as Mini & { line?: string }).line =
      n === 0 ? "아무도 안 골랐어요. 직접 물어봐요!" : ok === n ? "전원 정답! 벌써 잘 아는 사이?" : ok === 0 ? "아무도 못 맞혔어요. 반전 매력!" : `${n}명 중 ${ok}명이 맞혔어요`;
    this.phase = "miniReveal";
    this.deadline = Date.now() + this.t("miniReveal");
    this.later(() => this.phase === "miniReveal" && this.nextRound(), this.t("miniReveal"));
    this.touch();
  }

  private finish() {
    this.clearTimers();
    this.phase = "final";
    this.deadline = null;
    this.touch();
    if (this.hooks.summarize)
      for (const p of this.players) {
        const items = this.itemsOf(p);
        if (items.length < 2) continue;
        this.hooks
          .summarize(p.name, items)
          .then((s) => {
            if (s && this.phase === "final") {
              this.summaries.set(p.id, s);
              this.touch();
            }
          })
          .catch(() => {});
      }
  }

  private itemsOf(p: Player) {
    return this.profileQs.map((q, i) => ({ q: q.q, a: p.profile[i] })).filter((x): x is { q: string; a: string } => isAnswer(x.a));
  }

  private commons(): string[] {
    const out: string[] = [];
    this.profileQs.forEach((q, i) => {
      if (q.kind !== "choice") return;
      const groups = new Map<string, string[]>();
      for (const p of this.players) {
        const a = p.profile[i];
        if (isAnswer(a)) groups.set(a, [...(groups.get(a) ?? []), p.name]);
      }
      for (const [a, names] of groups) if (names.length >= 2) out.push(`${names.join(" · ")} → 「${q.q}」 ${a}`);
    });
    return out;
  }

  private checkAllDone() {
    const active = this.players.filter((p) => p.online || p.isBot);
    if (!active.length) return;
    if (this.phase === "profile" && active.every((p) => p.profile.every((a) => a !== null))) {
      this.clearTimers();
      this.later(() => this.phase === "profile" && this.nextRound(), 900);
    }
    if (this.phase === "ask" && active.every((p) => this.answers.has(p.id))) {
      this.clearTimers();
      this.later(() => this.toShare(), 700);
    }
    if (this.phase === "mini" && this.mini) {
      const need = active.filter((p) => p.id !== this.mini!.subjectId);
      if (need.every((p) => this.mini!.picks.has(p.id))) {
        this.clearTimers();
        this.later(() => this.toMiniReveal(), 700);
      }
    }
  }

  // ───────── 화면용 ─────────
  viewFor(me: string): View {
    const mp = this.players.find((p) => p.id === me);
    const done = (p: Player) =>
      this.phase === "profile"
        ? p.profile.every((a) => a !== null)
        : this.phase === "ask"
          ? this.answers.has(p.id)
          : this.phase === "mini"
            ? !!this.mini && (this.mini.picks.has(p.id) || p.id === this.mini.subjectId)
            : false;
    const v: View = {
      code: this.code,
      me,
      hostId: this.hostId,
      phase: this.phase,
      round: this.round,
      totalRounds: this.settings.rounds,
      settings: this.settings,
      players: this.players.map((p) => ({ id: p.id, name: p.name, color: p.color, isBot: p.isBot, online: p.online, done: done(p), hits: p.hits })),
      deadline: this.deadline,
      serverNow: Date.now(),
    };
    if (this.phase === "profile")
      v.profile = {
        questions: this.profileQs.map((q) => ({ q: q.q, kind: q.kind, options: q.options, placeholder: q.placeholder })),
        mine: mp?.profile ?? [],
      };
    if (this.phase === "ask" && this.tableQ) v.ask = { q: this.tableQ.q, placeholder: this.tableQ.placeholder, mine: this.answers.get(me) };
    if (this.phase === "share" && this.share) v.share = this.share;
    if ((this.phase === "mini" || this.phase === "miniReveal") && this.mini) {
      const s = this.players.find((p) => p.id === this.mini!.subjectId);
      const base: MiniView = {
        kind: this.mini.kind,
        title: this.mini.title,
        prompt: this.mini.prompt,
        quote: this.mini.quote,
        subject: s ? this.who(s) : undefined,
        isSubject: me === this.mini.subjectId,
        options: this.mini.options,
        myPick: this.mini.picks.get(me),
      };
      // '누구 답일까'는 문제 중엔 주인공을 숨긴다
      if (this.phase === "mini" && this.mini.kind === "who") base.subject = undefined;
      if (this.phase === "mini") v.mini = base;
      else
        v.miniReveal = {
          ...base,
          correct: this.mini.correct,
          answerLabel: this.mini.answerLabel,
          picks: [...this.mini.picks].map(([pid, o]) => {
            const p = this.players.find((x) => x.id === pid);
            return { id: pid, name: p?.name ?? "?", color: p?.color ?? "#ccc", optionId: o, ok: this.mini!.correct.includes(o) };
          }),
          line: (this.mini as Mini & { line?: string }).line ?? "",
        };
    }
    if (this.phase === "final") {
      const awards: NonNullable<View["final"]>["awards"] = [];
      const hit = this.players.slice().sort((a, b) => b.hits - a.hits)[0];
      if (hit && hit.hits > 0) awards.push({ emoji: "👀", title: "눈치왕", name: hit.name, color: hit.color, detail: `${hit.hits}번 맞혔어요` });
      const star = this.players.slice().sort((a, b) => b.whyCount - a.whyCount)[0];
      if (star && star.whyCount > 1) awards.push({ emoji: "🦜", title: "왜무새 단골", name: star.name, color: star.color, detail: `"왜?"를 ${star.whyCount}번 받았어요` });
      v.final = {
        cards: this.players.map((p) => ({ ...this.who(p), summary: this.summaries.get(p.id) ?? null, items: this.itemsOf(p) })),
        commons: this.commons(),
        awards,
      };
    }
    return v;
  }

  // ───────── 타이머 ─────────
  private later(fn: () => void, ms: number) {
    this.timers.push(setTimeout(fn, ms));
  }
  private botLater(fn: () => void, ms: number) {
    this.later(fn, ms * (this.hooks.botSpeed ?? 1));
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
