/* Skill Tree — a personal leveling app.
   All data lives in one JSON object (state) saved to localStorage.
   Back it up from Settings > Export. */

const RANKS = ["E", "D", "C", "B", "A", "S"];
const RANK_XP = { E: 10, D: 15, C: 20, B: 25, A: 30, S: 50 };
const CAPSTONE_XP = 100;
const XP_PER_LEVEL = 50;
const STORE_KEY = "skilltree-app-v1";

const uid = () => Math.random().toString(36).slice(2, 10);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ---------- starter content ---------- */
function makeTree(name, desc, branches, capstone) {
  return {
    id: uid(), name, desc,
    capstone: { text: capstone || "", done: false },
    branches: branches.map(([bName, bDesc, nodes]) => ({
      id: uid(), name: bName, desc: bDesc,
      nodes: nodes.map(([rank, nName, quests]) => ({
        id: uid(), rank, name: nName,
        quests: quests.map((t) => ({ id: uid(), text: t, done: false })),
      })),
    })),
  };
}

function seedPO() {
  return makeTree("Product Owner", "Become the PO teams trust to decide what's worth building.", [
    ["Backlog Craft", "Closest to your Scrum Master roots. Quick wins live here.", [
      ["E", "Story Writing", ["Rewrite 3 backlog items with a clear user, need, and \"so that\" value statement", "Learn the INVEST criteria and audit 5 stories against it", "Split one oversized story into thin vertical slices"]],
      ["C", "Prioritization", ["Score your top 10 features with WSJF", "Try RICE or MoSCoW on one epic and compare the result", "Write a one-paragraph rationale for your #1 priority"]],
      ["A", "Backlog Ownership", ["Run a refinement session as the PO, not the facilitator", "Prune the backlog: archive anything untouched for 6+ months", "Agree on a Definition of Ready with the team"]],
    ]],
    ["Customer Discovery", "Know who you build for and what they actually need.", [
      ["E", "Know Your User", ["Name your 3 main user types and write a short persona for each", "Sit with or shadow one real user for 30 minutes", "List the top 5 pain points you've heard from users"]],
      ["C", "Interviewing", ["Read The Mom Test by Rob Fitzpatrick", "Run 2 user interviews using only open-ended questions", "Turn your interview notes into 3 to 5 themes"]],
      ["A", "Validation", ["Write a testable hypothesis for one upcoming feature", "Get user feedback on a mockup before anything is built", "Kill or reshape one idea based on what you learned"]],
    ]],
    ["Vision & Strategy", "Decide what is worth building, and why.", [
      ["E", "Product Why", ["Write your product's purpose in one sentence", "Read Escaping the Build Trap by Melissa Perri", "Map how your team's current work ties to a PI objective"]],
      ["C", "Roadmapping", ["Draft a Now / Next / Later roadmap", "Write outcome-based PI objectives for your team", "Walk one peer through your roadmap and collect feedback"]],
      ["A", "The Art of No", ["Defer or decline one request with a clear rationale", "Write a short trade-off doc for two competing priorities", "Write a product vision statement and share it with the team"]],
    ]],
    ["Stakeholders & Influence", "Lead without authority. Build trust before you need it.", [
      ["E", "Stakeholder Map", ["Build a power / interest grid of your stakeholders", "Hold a 1:1 with your top 2 stakeholders: \"What does success look like?\"", "Write down your business owner's top 3 goals"]],
      ["C", "Communication", ["Send an update that leads with outcomes, not tasks", "Run a sprint or system demo as the PO, framed around value", "Explain one technical item in plain business terms"]],
      ["A", "Negotiation", ["Facilitate a priority conflict between two stakeholders", "Lead your team's PI Planning breakout as the PO", "Get a stakeholder to agree to a scope trade-off"]],
    ]],
    ["Metrics & Outcomes", "Prove value with evidence, not velocity.", [
      ["E", "Measure What Matters", ["Learn the difference between outputs and outcomes", "Define one success metric for a feature in flight", "Find out where your product's usage data lives"]],
      ["C", "Data-Informed Decisions", ["Set up a simple tracked metric or dashboard", "Check a shipped feature against its success metric", "Use data to argue for one priority"]],
      ["A", "Value Delivery", ["Write a release retro: did it deliver the value we expected?", "Define outcome goals for your next PI", "Report outcomes, not velocity, to leadership"]],
    ]],
  ], "Own one feature end to end: discover the problem, prioritize it, ship it, and report the measured outcome.");
}

/* ---------- state ---------- */
let state;
// updatedAt 0 = untouched starter data, so cloud data always wins over it.
/* ---------- daily discipline: one area per weekday ---------- */
const DISC_XP = 15;
const DEFAULT_DISC = [
  [1, "Leadership", "LDR", "crown", ["Write down the one outcome that would make this week a win, and share it with your team", "Give one person specific, genuine recognition", "Ask someone, \"What's one thing I could do better?\" and just listen", "Make one decision you've been putting off"]],
  [2, "Intellect", "INT", "book", ["Read 20 pages of a nonfiction book", "Learn one new concept and explain it in 3 sentences", "Watch one talk or lecture and take notes", "Write down a question you're curious about and spend 15 minutes researching it"]],
  [3, "Physical", "STR", "dumbbell", ["Take a 20-minute walk with no phone", "Stretch for 10 minutes", "Do a bodyweight circuit: squats, push-ups, planks", "Drink water with every meal and get to bed 30 minutes earlier tonight"]],
  [4, "Communication", "CHA", "chat", ["Rewrite one email or message to be half as long", "In one conversation, ask a follow-up question before giving your opinion", "Explain something technical to someone non-technical", "Reach out to someone you haven't talked to in a while"]],
  [5, "Creativity", "CRE", "pen", ["Write 300 words of fiction, even bad ones", "Sketch, journal, or work on your craft for 15 minutes", "Collect 3 story ideas from your day", "Make something with your hands"]],
  [6, "Wisdom", "WIS", "bulb", ["Write down one mistake from this week and what it taught you", "Read one chapter of philosophy or a biography", "Spend 10 minutes in silence or meditation", "Ask yourself: \"What would the person I want to be do differently this week?\""]],
  [0, "Emotional", "EQ", "heart", ["Journal for 10 minutes: what drained you this week, and what filled you up", "Write down 3 specific things you're grateful for", "Name one feeling you avoided this week and why", "Plan one thing next week just for joy"]],
];
const seedDisciplines = () => ({ areas: DEFAULT_DISC.map(([day, name, stat, icon, tasks]) => ({ id: uid(), day, name, stat, icon, tasks: [...tasks] })), log: {}, swaps: {} });

function freshState() { return { version: 1, trees: [seedPO()], days: [], updatedAt: 0, disciplines: seedDisciplines(), sideQuests: [], events: [] }; }
function normalize(s) {
  const out = { version: 1, days: [], updatedAt: 0, ...s, trees: Array.isArray(s.trees) ? s.trees : [] };
  if (!out.disciplines || !Array.isArray(out.disciplines.areas)) out.disciplines = seedDisciplines();
  out.disciplines.log ||= {}; out.disciplines.swaps ||= {};
  if (!Array.isArray(out.sideQuests)) out.sideQuests = [];
  if (!Array.isArray(out.events)) out.events = [];
  return out;
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    if (s && Array.isArray(s.trees)) return normalize(s);
  } catch (e) {}
  return freshState();
}
function writeLocal() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }
function save() { state.updatedAt = Date.now(); writeLocal(); schedulePush(); }
state = load();

/* ---------- cloud sync (Supabase) ---------- */
const CFG = window.SKILLTREE_CONFIG || {};
const META_KEY = "skilltree-sync-meta";
let meta = {};
try { meta = JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch (e) {}
const saveMeta = () => { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {} };
let sb = null, session = null, syncStatus = "off", pulling = false, pushTimer = null, acctMsg = "";
const syncConfigured = () => !!(CFG.supabaseUrl && CFG.supabaseKey);

const STATUS_TEXT = { off: "", signedout: "Not syncing", syncing: "Syncing…", synced: "Synced", offline: "Offline · saved here", error: "Sync problem" };
function setStatus(s) {
  syncStatus = s;
  document.querySelectorAll(".sync-pill").forEach((el) => { el.textContent = STATUS_TEXT[s]; el.dataset.s = s; el.hidden = s === "off"; });
  const st = document.getElementById("acct-status"); if (st) st.textContent = STATUS_TEXT[s];
}
const syncPill = () => `<button class="sync-pill" type="button" data-action="settings" data-s="${syncStatus}" ${syncStatus === "off" ? "hidden" : ""}>${STATUS_TEXT[syncStatus]}</button>`;

const doneCount = (s) => s.trees.reduce((a, t) => a + t.branches.reduce((b, br) => b + br.nodes.reduce((c, n) => c + n.quests.filter((q) => q.done).length, 0), 0), 0);
const hasProgress = (s) => doneCount(s) > 0 || (s.days || []).length > 0;

function initSync() {
  if (!syncConfigured()) return setStatus("off");
  if (!window.supabase) return setStatus("offline");
  try {
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } });
  } catch (e) { return setStatus("error"); }
  sb.auth.getSession().then(({ data }) => {
    session = data.session;
    if (session) pull(); else { setStatus("signedout"); if (ui.view === "settings") render(); }
  });
  sb.auth.onAuthStateChange((evt, s) => {
    const had = !!session; session = s;
    if (evt === "SIGNED_IN" && !had) { acctMsg = ""; pull(); render(); pushRefresh(); }
    if (evt === "SIGNED_OUT") { setStatus("signedout"); render(); }
  });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && session) pull(); });
  window.addEventListener("online", () => { if (session) pull(); });
  window.addEventListener("offline", () => { if (session) setStatus("offline"); });
}

async function pull() {
  if (!sb || !session || pulling) return;
  pulling = true; setStatus("syncing");
  try {
    const { data, error } = await sb.from("skill_state").select("data").eq("user_id", session.user.id).maybeSingle();
    if (error) throw error;
    if (!data) { pulling = false; return push(); }
    const remote = normalize(data.data || {});
    const rU = remote.updatedAt || 0, lU = state.updatedAt || 0;
    if (!meta.synced && lU > 0 && hasProgress(state) && rU !== lU) { pulling = false; setStatus("synced"); return askWhichToKeep(remote); }
    if (rU > lU || !meta.synced) {
      state = remote; writeLocal(); meta.synced = true; saveMeta(); render(); setStatus("synced");
    } else if (lU > rU) { pulling = false; return push(); }
    else { meta.synced = true; saveMeta(); setStatus("synced"); }
  } catch (e) { setStatus(navigator.onLine ? "error" : "offline"); }
  pulling = false;
}

async function push() {
  if (!sb || !session) return;
  clearTimeout(pushTimer); setStatus("syncing");
  try {
    const { error } = await sb.from("skill_state").upsert({ user_id: session.user.id, data: state, updated_at: new Date().toISOString() });
    if (error) throw error;
    meta.synced = true; saveMeta(); setStatus("synced");
  } catch (e) { setStatus(navigator.onLine ? "error" : "offline"); }
}
function schedulePush() {
  if (!sb || !session || !meta.synced) return;
  clearTimeout(pushTimer); pushTimer = setTimeout(push, 1200);
}

function askWhichToKeep(remote) {
  openModal({
    title: "Which progress should we keep?",
    text: "This device has progress that isn't in your account yet. Choose one; the other will be replaced.",
    fields: [{ id: "keep", label: "Keep", type: "select", value: "cloud", options: [
      { value: "cloud", label: `Account progress (${doneCount(remote)} quests, ${remote.trees.length} trees)` },
      { value: "device", label: `This device's progress (${doneCount(state)} quests, ${state.trees.length} trees)` },
    ] }],
    confirm: "Keep it",
    onSubmit: (v) => { if (v.keep === "cloud") state = remote; meta.synced = true; saveMeta(); },
  });
}

async function accountAction(kind) {
  const email = (document.getElementById("acct-email")?.value || "").trim();
  const password = document.getElementById("acct-pass")?.value || "";
  if (!sb) { acctMsg = "Sync isn't available right now. Check your connection."; return render(); }
  if (kind !== "out" && (!email || password.length < 6)) { acctMsg = "Enter your email and a password of at least 6 characters."; return render(); }
  acctMsg = "Working…"; render();
  try {
    if (kind === "in") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      acctMsg = "";
    } else if (kind === "up") {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      acctMsg = data.session ? "" : "Account created. Check your email to confirm it, then come back and sign in.";
    } else if (kind === "out") {
      await sb.auth.signOut(); meta.synced = false; saveMeta(); session = null; acctMsg = "Signed out. Your data stays on this device.";
    }
  } catch (e) {
    const m = String(e.message || e);
    acctMsg = /confirm/i.test(m) ? "Confirm your email first (check your inbox), then sign in."
      : /invalid login/i.test(m) ? "That email and password don't match. Try again, or create an account."
      : /registered|exists/i.test(m) ? "That email already has an account. Tap Sign in instead."
      : m;
  }
  render();
}

const ui = { view: "home", treeId: null, edit: false, expanded: {}, mode: "map", zoom: null, sheet: null, recenter: false, notesOpen: {}, pendingDel: null };

/* ---------- lookups & math ---------- */
const getTree = (id) => state.trees.find((t) => t.id === id);
function find(tree, kind, id) {
  for (const b of tree.branches) {
    if (kind === "branch" && b.id === id) return { branch: b };
    for (const n of b.nodes) {
      if (kind === "node" && n.id === id) return { branch: b, node: n };
      for (const q of n.quests) if (kind === "quest" && q.id === id) return { branch: b, node: n, quest: q };
    }
  }
  return {};
}
function findQuest(qid) {
  for (const tree of state.trees) { const r = find(tree, "quest", qid); if (r.quest) return { tree, ...r }; }
  const sq = (state.sideQuests || []).find((x) => x.id === qid);
  return sq ? { quest: sq, side: true } : {};
}
const nodeDone = (n) => n.quests.length > 0 && n.quests.every((q) => q.done);
const nodeOpen = (b, i) => i === 0 || nodeDone(b.nodes[i - 1]);
const treeAllDone = (t) => t.branches.some((b) => b.nodes.length) && t.branches.every((b) => b.nodes.every(nodeDone));
function treeStats(t) {
  let xp = 0, max = 0, done = 0, total = 0;
  t.branches.forEach((b) => b.nodes.forEach((n) => n.quests.forEach((q) => {
    total++; max += RANK_XP[n.rank];
    if (q.done) { done++; xp += RANK_XP[n.rank]; }
  })));
  if (t.capstone.text) { total++; max += CAPSTONE_XP; if (t.capstone.done) { done++; xp += CAPSTONE_XP; } }
  return { xp, max, done, total, pct: max ? xp / max : 0 };
}
const totalXP = () => Math.max(0, state.trees.reduce((a, t) => a + treeStats(t).xp, 0) + Object.keys(state.disciplines?.log || {}).length * DISC_XP + sideXPNet() + eventXP());
const levelFor = (xp) => 1 + Math.floor(xp / XP_PER_LEVEL);
function rankFor(t) {
  const { pct } = treeStats(t);
  if (t.capstone.done) return ["S", "Capstone cleared. Mastery."];
  if (pct >= 0.75) return ["A", "Elite. The capstone awaits."];
  if (pct >= 0.5) return ["B", "Others trust your calls."];
  if (pct >= 0.3) return ["C", "Solid fundamentals, growing judgment."];
  if (pct >= 0.12) return ["D", "The awakening is real."];
  return ["E", "Clear quests to rank up."];
}

/* ---------- daily streak ---------- */
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const today = () => dayKey(new Date());
function streak() {
  const set = new Set(state.days); let s = 0; const d = new Date();
  if (!set.has(today())) d.setDate(d.getDate() - 1);
  while (set.has(dayKey(d))) { s++; d.setDate(d.getDate() - 1); }
  return s;
}

/* ---------- toast ---------- */
let toastTimer;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

/* ---------- modal ---------- */
let modalSubmit = null;
function openModal({ title, text, fields = [], confirm = "Save", danger = false, onSubmit }) {
  const html = `
  <div class="modal-bg" data-action="modal-bg">
    <form class="modal" id="modal-form" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <h2 id="modal-title">${esc(title)}</h2>
      ${text ? `<p>${esc(text)}</p>` : ""}
      ${fields.map((f) => f.type === "heading" ? `<div class="field-head"><b>${esc(f.label)}</b>${f.hint ? `<small>${esc(f.hint)}</small>` : ""}</div>` : f.type === "checks" ? `
        <fieldset class="field checks"><legend>${esc(f.label)}</legend><div class="check-grid">${f.options.map((o) => `<label class="check-pill"><input type="checkbox" name="${f.id}" value="${esc(o.value)}" ${(f.value || []).includes(o.value) ? "checked" : ""}><span>${esc(o.label)}</span></label>`).join("")}</div></fieldset>` : `
        <div class="field">
          <label for="f-${f.id}">${esc(f.label)}</label>
          ${f.type === "textarea"
            ? `<textarea id="f-${f.id}" name="${f.id}" placeholder="${esc(f.placeholder || "")}">${esc(f.value || "")}</textarea>`
            : f.type === "select"
            ? `<select id="f-${f.id}" name="${f.id}">${f.options.map((o) => `<option value="${esc(o.value)}" ${o.value === f.value ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`
            : `<input id="f-${f.id}" name="${f.id}" type="${f.type === "date" || f.type === "time" ? f.type : "text"}" value="${esc(f.value || "")}" placeholder="${esc(f.placeholder || "")}" ${f.required ? "required" : ""}>`}
        </div>`).join("")}
      <div class="btnrow">
        <button type="button" class="btn ghost" data-action="modal-close">Cancel</button>
        <button type="submit" class="btn ${danger ? "danger" : ""}">${esc(confirm)}</button>
      </div>
    </form>
  </div>`;
  document.getElementById("modal").innerHTML = html;
  modalSubmit = onSubmit;
  const first = document.querySelector("#modal input, #modal textarea, #modal select");
  if (first) setTimeout(() => first.focus(), 30);
}
function closeModal() { document.getElementById("modal").innerHTML = ""; modalSubmit = null; ui.sheet = null; }
document.addEventListener("submit", (e) => {
  if (e.target.dataset?.areaNote) {
    e.preventDefault();
    const a = state.disciplines.areas.find((x) => x.id === e.target.dataset.areaNote);
    const text = (e.target.elements.note.value || "").trim();
    if (!a || !text) return;
    (a.notes ||= []).push({ id: uid(), text, at: Date.now() });
    save(); render(); toast("Added to journal"); return;
  }
  if (e.target.dataset?.discNote) {
    e.preventDefault();
    const entry = state.disciplines.log[today()]; if (!entry) return;
    entry.note = (e.target.elements.note.value || "").trim();
    save(); render(); toast("Reflection saved"); return;
  }
  if (e.target.dataset?.stepAdd) {
    e.preventDefault();
    const q = state.sideQuests.find((x) => x.id === e.target.dataset.stepAdd), text = (e.target.elements.step.value || "").trim();
    if (!q || !text) return;
    (q.checklist ||= []).push({ id: uid(), text, done: false });
    save(); render(); document.getElementById(`sa-${q.id}`)?.focus(); return;
  }
  const qid = e.target.dataset?.questNote;
  if (qid) {
    e.preventDefault();
    const text = (e.target.elements.note.value || "").trim();
    if (!text) return;
    const { quest } = findQuest(qid); if (!quest) return;
    (quest.notes ||= []).push({ id: uid(), text, at: Date.now() });
    save(); render(); toast("Note saved");
    const ta = document.getElementById(`nt-${qid}`); if (ta) ta.focus();
    return;
  }
  if (e.target.id !== "modal-form") return;
  e.preventDefault();
  const fd = new FormData(e.target), vals = {};
  for (const [k, v] of fd.entries()) vals[k] = typeof v === "string" ? v.trim() : v;
  e.target.querySelectorAll("fieldset.checks").forEach((fs) => { const n = fs.querySelector("input")?.name; if (n) vals[n] = fd.getAll(n); });
  const fn = modalSubmit; closeModal();
  if (fn) { fn(vals); save(); render(); }
});
document.addEventListener("toggle", (e) => { if (e.target.matches?.("details[data-backlog]")) ui.backlogOpen = e.target.open; }, true);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { closeModal(); return; }
  if ((e.key === "Enter" || e.key === " ") && e.target.matches?.("g[data-action], [role=button][data-action]:not(button)")) { e.preventDefault(); e.target.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
});

/* ---------- views ---------- */
/* ---------- side quests: your own real-life quests ---------- */
const SIDE_RANKS = ["E", "C", "A", "S"];
const DAY_MS = 86400000;
const REPEATS = [["", "Doesn't repeat"], ["daily", "Every day"], ["weekdays", "Every weekday (Mon–Fri)"], ["weekly", "Every week"], ["biweekly", "Every 2 weeks"], ["monthly", "Every month"]];
const sideBonusXP = (q) => (q.dueAt ? Math.round(RANK_XP[q.rank] * 1.1) : RANK_XP[q.rank]);
function sidePenalty(q, now = Date.now()) {
  // timed quests only: after 24h overdue and still not done, -10 XP per day
  if (!q.dueAt) return 0;
  const end = q.done ? q.completedAt : now, over = end - q.dueAt;
  return over >= DAY_MS ? Math.floor(over / DAY_MS) * 10 : 0;
}
const sideXPNet = () => (state.sideQuests || []).reduce((a, q) => a + (q.done ? q.xp || 0 : 0) - sidePenalty(q), 0);
const isOverdue = (q, now = Date.now()) => !q.done && !!q.dueAt && q.dueAt < now;
const isStarted = (q) => !q.startDate || q.startDate <= today();
const DEADLINE_OPTS = [["1w", "1 week before"], ["3d", "3 days before"], ["1d", "1 day before"], ["4h", "4 hours before"], ["1h", "1 hour before"], ["due", "At due time"]];
const DEFAULT_DEADLINE = ["4h", "1h", "due"];
const deadlineOf = (q) => (q.reminders ? q.reminders.deadline || [] : DEFAULT_DEADLINE);
const stepsOf = (q) => q.checklist || [];
const stepCount = (q) => { const c = stepsOf(q); return c.length ? `${c.filter((x) => x.done).length}/${c.length}` : ""; };
function nextDue(ms, rep) {
  const d = new Date(ms);
  if (rep === "daily") d.setDate(d.getDate() + 1);
  else if (rep === "weekdays") { do d.setDate(d.getDate() + 1); while (d.getDay() === 0 || d.getDay() === 6); }
  else if (rep === "weekly") d.setDate(d.getDate() + 7);
  else if (rep === "biweekly") d.setDate(d.getDate() + 14);
  else if (rep === "monthly") { const day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + 1); d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); }
  return d.getTime();
}
function spawnNext(q) {
  if (!q.repeat || !q.dueAt) return null;
  let due = nextDue(q.dueAt, q.repeat);
  while (due <= Date.now()) due = nextDue(due, q.repeat);
  const n = { id: uid(), title: q.title, desc: q.desc, rank: q.rank, repeat: q.repeat, dueAt: due, createdAt: Date.now(), done: false,
    reminders: q.reminders ? JSON.parse(JSON.stringify(q.reminders)) : undefined,
    checklist: stepsOf(q).map((c) => ({ id: uid(), text: c.text, done: false })) };
  state.sideQuests.push(n);
  return n;
}
function completeSide(q) {
  if (q.done) return;
  const before = levelFor(totalXP());
  q.done = true; q.completedAt = Date.now(); q.pinned = false;
  q.xp = !q.dueAt ? RANK_XP[q.rank] : q.completedAt <= q.dueAt ? sideBonusXP(q) : 0;
  const n = spawnNext(q);
  toast(!q.dueAt ? `Side Quest complete · +${q.xp} XP` : q.xp ? `Side Quest complete · +${q.xp} XP (early bonus)` : "Side Quest complete · overdue, no XP");
  if (n) setTimeout(() => toast(`Next one: ${fmtDue(n.dueAt)}`), 1400);
  const after = levelFor(totalXP());
  if (after > before) setTimeout(() => toast(`LEVEL UP! You are now Level ${after}`), 2600);
}
function uncompleteSide(q) {
  q.done = false; delete q.completedAt; delete q.xp;
}
const timeStr = (ms) => new Date(ms).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
function fmtDue(ms) {
  if (!ms) return "No due date";
  const d = new Date(ms), k = dayKey(d), t = new Date(), tm = new Date(t); tm.setDate(t.getDate() + 1);
  const day = k === dayKey(t) ? "Today" : k === dayKey(tm) ? "Tomorrow" : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return `${day} · ${timeStr(ms)}`;
}
function relTime(ms) {
  const diff = ms - Date.now(), a = Math.abs(diff), h = Math.floor(a / 3600000), m = Math.floor((a % 3600000) / 60000);
  const str = h >= 48 ? `${Math.floor(h / 24)}d` : h ? `${h}h ${m}m` : `${m}m`;
  return diff >= 0 ? `in ${str}` : `${str} ago`;
}
const fmtDay = (k) => new Date(`${k}T12:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
function sideStatus(q) {
  if (q.done) return { cls: "done", label: q.xp ? `Done · +${q.xp} XP` : "Done late · 0 XP" };
  if (isOverdue(q)) { const pen = sidePenalty(q); return { cls: "overdue", label: `Overdue${pen ? ` · −${pen} XP` : ""}` }; }
  if (!q.dueAt) return { cls: "open backlog", label: `+${RANK_XP[q.rank]} XP` };
  return { cls: "open", label: `+${sideBonusXP(q)} XP if done on time` };
}
const hasReminders = (q) => (q.dueAt && deadlineOf(q).length) || (q.reminders && q.reminders.nudge);
function sideItem(q) {
  const st = sideStatus(q), steps = stepCount(q), notes = (q.notes || []).length;
  const when = q.done ? `Completed ${timeStr(q.completedAt)}` : !isStarted(q) ? `Starts ${fmtDay(q.startDate)}` : q.dueAt ? `${fmtDue(q.dueAt)} · ${relTime(q.dueAt)}` : "Backlog";
  return `
  <li class="sq ${st.cls}">
    <label class="sq-check" for="sq-c-${q.id}"><input type="checkbox" id="sq-c-${q.id}" data-side="${q.id}" ${q.done ? "checked" : ""}></label>
    <button type="button" class="sq-body" data-action="sheet-side" data-id="${q.id}">
      <span class="sq-top"><b class="sq-rank r-${q.rank}">${q.rank}</b><span class="sq-title">${esc(q.title)}</span>${q.repeat ? `<span class="sq-rep" title="Repeats">↻</span>` : ""}${hasReminders(q) ? `<span class="sq-rep" title="Reminders on">🔔</span>` : ""}</span>
      ${steps ? `<span class="sq-steps"><span class="bar"><i style="width:${(stepsOf(q).filter((x) => x.done).length / stepsOf(q).length) * 100}%"></i></span><small>${steps} steps</small></span>` : ""}
      <span class="sq-meta"><span>${when}${notes ? ` · ${notes} note${notes === 1 ? "" : "s"}` : ""}</span><span class="sq-state">${st.label}</span></span>
    </button>
    ${q.done ? "" : `<button type="button" class="pin sq-pin ${q.pinned ? "on" : ""}" data-action="pin" data-id="${q.id}" aria-pressed="${!!q.pinned}" aria-label="${q.pinned ? "Remove from Focus" : "Add to Focus"}">${q.pinned ? "★" : "☆"}</button>`}
  </li>`;
}
const hhmmOf = (d) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
function sideFormFields(q = {}, presetDate, backlog) {
  const isNew = !q.id;
  const base = q.dueAt ? new Date(q.dueAt) : (() => { const d = new Date(); d.setMinutes(0, 0, 0); d.setHours(d.getHours() + 2); return d; })();
  const dateVal = q.id ? (q.dueAt ? dayKey(base) : "") : backlog ? "" : presetDate || dayKey(base);
  const nudge = q.reminders?.nudge;
  return [
    { id: "title", label: "Quest title", value: q.title || "", required: true, placeholder: "e.g. Renew car registration" },
    { id: "desc", label: "Description (optional)", type: "textarea", value: q.desc || "", placeholder: "Details, links…" },
    { id: "rank", label: "Difficulty", type: "select", value: q.rank || "C", options: SIDE_RANKS.map((r) => ({ value: r, label: `${r}-Rank · ${RANK_XP[r]} XP` })) },
    { type: "heading", label: "When", hint: "Leave the due date blank to keep it in your Backlog." },
    { id: "date", label: "Due date (optional)", type: "date", value: dateVal },
    { id: "time", label: "Due time", type: "time", value: hhmmOf(base) },
    { id: "start", label: "Start date (optional · hidden until then)", type: "date", value: q.startDate || "" },
    { id: "repeat", label: "Repeat (needs a due date)", type: "select", value: q.repeat || "", options: REPEATS.map(([v, l]) => ({ value: v, label: l })) },
    ...(isNew ? [{ id: "steps", label: "Checklist steps (optional, one per line)", type: "textarea", value: "", placeholder: "Gather documents\nBook appointment\nSubmit form" }] : []),
    { type: "heading", label: "Reminders", hint: "Optional. Deadline alerts need a due date; nudges work on any quest." },
    { id: "deadline", label: "Deadline alerts", type: "checks", value: q.id ? deadlineOf(q) : backlog ? [] : DEFAULT_DEADLINE, options: DEADLINE_OPTS.map(([v, l]) => ({ value: v, label: l })) },
    { id: "nudge", label: "Nudge me until it's done", type: "select", value: nudge ? nudge.freq : "", options: [{ value: "", label: "Off" }, { value: "daily", label: "Every day" }, { value: "weekly", label: "Every week" }] },
    { id: "ndow", label: "Nudge day (weekly)", type: "select", value: String(nudge?.dow ?? new Date().getDay()), options: DAY_NAMES.map((d, i) => ({ value: String(i), label: d })) },
    { id: "ntime", label: "Nudge time", type: "time", value: nudge?.time || "19:00" },
  ];
}
const parseDue = (v) => new Date(`${v.date}T${v.time || "09:00"}`).getTime();
function openSideForm(q, presetDate, backlog) {
  openModal({
    title: q ? "Edit Side Quest" : backlog ? "New Backlog Quest" : "New Side Quest",
    text: q ? "" : "Finish timed quests early for +10% XP. Backlog quests have no deadline or penalties.",
    fields: sideFormFields(q || {}, presetDate, backlog), confirm: q ? "Save" : "Accept quest",
    onSubmit: (v) => {
      if (!v.title) return;
      const due = v.date ? parseDue(v) : null;
      if (v.date && isNaN(due)) { toast("Pick a valid date and time"); return; }
      const reminders = { deadline: due ? v.deadline || [] : [], nudge: v.nudge ? { freq: v.nudge, time: v.ntime || "19:00", dow: Number(v.ndow) } : null };
      const repeat = due ? v.repeat || "" : "";
      if (v.repeat && !due) setTimeout(() => toast("Repeat needs a due date, so it was turned off"), 1500);
      const data = { title: v.title, desc: v.desc, rank: v.rank, repeat, dueAt: due, startDate: v.start || "", reminders };
      if (q) {
        const moved = q.dueAt !== due;
        Object.assign(q, data);
        if (moved) { const old = q.id; q.id = uid(); q.createdAt = Date.now(); if (ui.sheet && ui.sheet.id === old) ui.sheet.id = q.id; }
        toast("Side Quest updated");
      } else {
        const checklist = (v.steps || "").split("\n").map((x) => x.trim()).filter(Boolean).map((text) => ({ id: uid(), text, done: false }));
        state.sideQuests.push({ id: uid(), ...data, checklist, notes: [], createdAt: Date.now(), done: false });
        toast(due ? `Side Quest accepted · due ${fmtDue(due)}` : "Added to your Backlog");
      }
    },
  });
}
function reminderSummary(q) {
  const parts = [];
  if (q.dueAt) { const d = deadlineOf(q); if (d.length) parts.push(DEADLINE_OPTS.filter(([v]) => d.includes(v)).map(([, l]) => l.replace(" before", "").replace("At due time", "at due time")).join(", ")); }
  const n = q.reminders?.nudge;
  if (n) parts.push(`Nudge ${n.freq === "daily" ? "daily" : `every ${DAY_NAMES[n.dow]}`} at ${fmtHM(n.time)}`);
  return parts.length ? parts.join(" · ") : "Off";
}
function sideSheetHtml(q) {
  const st = sideStatus(q), rep = REPEATS.find(([v]) => v === (q.repeat || ""))[1], steps = stepsOf(q);
  return `
    <div class="sheet-head">
      <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true"><polygon class="s-hex ${q.done ? "done" : isOverdue(q) ? "over" : "open"}" points="${hexPts(23, 23, 20)}"/><text x="23" y="28" text-anchor="middle" class="s-rank ${q.done ? "done" : "open"}">${q.rank}</text></svg>
      <div style="flex:1"><div class="sys-label" style="color:var(--gold)">${q.dueAt ? "Side Quest" : "Backlog Quest"}</div><h2>${esc(q.title)}</h2></div>
      ${q.done ? "" : `<button type="button" class="pin big ${q.pinned ? "on" : ""}" data-action="pin" data-id="${q.id}" aria-pressed="${!!q.pinned}" aria-label="${q.pinned ? "Remove from Focus" : "Add to Focus"}">${q.pinned ? "★" : "☆"}</button>`}
    </div>
    <div class="chiprow"><span class="state ${st.cls === "overdue" ? "over" : st.cls.split(" ")[0]}">${esc(st.label)}</span>${q.repeat ? `<span class="state open">↻ ${esc(rep)}</span>` : ""}${q.pinned ? `<span class="state" style="color:var(--gold)">★ Focus</span>` : ""}</div>
    <div class="sq-facts">
      <div><span>Due</span><b>${q.dueAt ? fmtDue(q.dueAt) : "Backlog"}</b><small>${q.done || !q.dueAt ? (q.startDate ? `Starts ${fmtDay(q.startDate)}` : "") : relTime(q.dueAt)}</small></div>
      <div><span>Reward</span><b>${RANK_XP[q.rank]} XP</b><small>${q.dueAt ? `${sideBonusXP(q)} if early` : "No deadline"}</small></div>
    </div>
    <div class="sq-rem"><span>🔔 Reminders</span><b>${esc(reminderSummary(q))}</b></div>
    ${q.desc ? `<p class="sq-desc">${esc(q.desc)}</p>` : ""}
    ${isOverdue(q) ? `<p class="sheet-note" style="color:var(--danger)">Overdue quests earn no XP. After 24 hours overdue, you lose 10 XP per day until it's done.</p>` : ""}
    <section class="sq-sec">
      <h3>Checklist ${steps.length ? `<small>${stepCount(q)}</small>` : ""}</h3>
      ${steps.length ? `<div class="bar"><i style="width:${(steps.filter((x) => x.done).length / steps.length) * 100}%"></i></div>` : ""}
      <ul class="steps">${steps.map((c) => `
        <li><label for="st-${c.id}"><input type="checkbox" id="st-${c.id}" data-step="${c.id}" data-q="${q.id}" ${c.done ? "checked" : ""}><span>${esc(c.text)}</span></label>
          <button type="button" class="note-del ${ui.pendingDel === c.id ? "arm" : ""}" data-action="del-step" data-id="${q.id}" data-note="${c.id}" aria-label="Delete step">${ui.pendingDel === c.id ? "Delete?" : "✕"}</button></li>`).join("")}</ul>
      <form class="step-form" data-step-add="${q.id}"><label class="sr" for="sa-${q.id}">New step</label><input id="sa-${q.id}" name="step" type="text" placeholder="Add a step"><button class="btn ghost" type="submit">Add</button></form>
    </section>
    <section class="sq-sec">
      <h3>Progress notes</h3>
      ${notesBlockOpen(q)}
    </section>
    <div class="btnrow">
      ${q.done ? `<button class="btn ghost" type="button" data-action="side-undo" data-id="${q.id}">Mark not done</button>`
        : `<button class="btn" type="button" data-action="side-done" data-id="${q.id}">Complete quest</button>`}
      <button class="btn ghost" type="button" data-action="side-edit" data-id="${q.id}">Edit</button>
      ${q.repeat && !q.done ? `<button class="btn ghost" type="button" data-action="side-skip" data-id="${q.id}">Skip this one</button>` : ""}
      <button class="btn danger" type="button" data-action="side-del" data-id="${q.id}">Delete</button>
    </div>`;
}
function notesBlockOpen(q) {
  const notes = q.notes || [];
  return `<div class="notes open-notes">
    ${notes.slice().reverse().map((n) => `
      <div class="note"><time>${fmtDate(n.at)}</time><p>${esc(n.text)}</p>
        <button type="button" class="note-del ${ui.pendingDel === n.id ? "arm" : ""}" data-action="del-note" data-id="${q.id}" data-note="${n.id}" aria-label="Delete note">${ui.pendingDel === n.id ? "Delete?" : "✕"}</button></div>`).join("")}
    <form class="note-form" data-quest-note="${q.id}">
      <label class="sr" for="nt-${q.id}">New note</label>
      <textarea id="nt-${q.id}" name="note" rows="2" placeholder="What progress did you make?"></textarea>
      <button class="btn" type="submit">Add note</button>
    </form></div>`;
}

/* ---------- events: meetings (3 XP) and time blocks on the day timeline ---------- */
const MEETING_XP = 3;
const EV_COLORS = [["#4fc3ff", "Blue"], ["#5ee6a8", "Green"], ["#f2c14e", "Gold"], ["#c58bff", "Purple"], ["#ff8fb1", "Pink"], ["#ff8a65", "Coral"], ["#9fb0d6", "Slate"]];
const EV_TYPES = [["meeting", "Meeting · 3 XP"], ["block0", "Time block · no XP"], ["block3", "Time block · 3 XP"], ["block5", "Time block · 5 XP"], ["block10", "Time block · 10 XP"]];
const evType = (e) => (e.kind === "meeting" ? "meeting" : `block${e.xp || 0}`);
const evXP = (e) => (e.kind === "meeting" ? MEETING_XP : e.xp || 0);
const keyToUTC = (k) => { const [y, m, d] = k.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const toMin = (hhmm) => { const [h, m] = (hhmm || "0:0").split(":").map(Number); return h * 60 + m; };
function occursOn(e, k) {
  if (k < e.date || (e.skips || []).includes(k)) return false;
  if (!e.repeat) return k === e.date;
  const a = keyToUTC(e.date), b = keyToUTC(k), dow = new Date(b).getUTCDay(), diff = Math.round((b - a) / DAY_MS);
  if (e.repeat === "daily") return true;
  if (e.repeat === "weekdays") return dow >= 1 && dow <= 5;
  if (e.repeat === "weekly") return diff % 7 === 0;
  if (e.repeat === "biweekly") return diff % 14 === 0;
  if (e.repeat === "monthly") return new Date(a).getUTCDate() === new Date(b).getUTCDate();
  return false;
}
const eventsOn = (k) => (state.events || []).filter((e) => occursOn(e, k)).sort((x, y) => toMin(x.start) - toMin(y.start));
const eventXP = () => (state.events || []).reduce((a, e) => a + Object.keys(e.done || {}).length * evXP(e), 0);
const evStartMs = (e, k) => new Date(`${k}T${e.start}`).getTime();
const evStarted = (e, k) => Date.now() >= evStartMs(e, k);
const fmtHM = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); const d = new Date(); d.setHours(h, m, 0, 0); return timeStr(d.getTime()); };
const durLabel = (min) => { const h = Math.floor(min / 60), m = min % 60; return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`; };
function toggleEvent(e, k, on) {
  e.done ||= {};
  if (on) {
    if (!evStarted(e, k)) { toast(`You can check this off once it starts at ${fmtHM(e.start)}`); return false; }
    const before = levelFor(totalXP());
    e.done[k] = Date.now();
    const xp = evXP(e); toast(xp ? `${e.kind === "meeting" ? "Meeting" : "Block"} complete · +${xp} XP` : "Done");
    const after = levelFor(totalXP());
    if (after > before) setTimeout(() => toast(`LEVEL UP! You are now Level ${after}`), 1200);
  } else delete e.done[k];
  return true;
}
function openEventForm(e, presetDate, presetStart) {
  const st = e ? e.start : presetStart || (() => { const d = new Date(); d.setMinutes(d.getMinutes() < 30 ? 30 : 60, 0, 0); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; })();
  const en = e ? e.end : (() => { const m = Math.min(toMin(st) + 30, 23 * 60 + 59); return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; })();
  openModal({
    title: e ? "Edit event" : "New event", text: e && e.repeat ? "Changes apply to every occurrence." : "Meetings earn 3 XP once they start and you check them off. Missed meetings earn nothing.",
    fields: [
      { id: "title", label: "Title", value: e?.title || "", required: true, placeholder: "e.g. MDH Daily Standup" },
      { id: "type", label: "Type", type: "select", value: e ? evType(e) : "meeting", options: EV_TYPES.map(([v, l]) => ({ value: v, label: l })) },
      { id: "date", label: e && e.repeat ? "Starts on" : "Date", type: "date", value: e?.date || presetDate || today() },
      { id: "start", label: "Start", type: "time", value: st },
      { id: "end", label: "End", type: "time", value: en },
      { id: "repeat", label: "Repeat", type: "select", value: e?.repeat || "", options: REPEATS.map(([v, l]) => ({ value: v, label: l })) },
      { id: "icon", label: "Icon", type: "select", value: e?.icon || "", options: iconOptions() },
      { id: "color", label: "Color", type: "select", value: e?.color || EV_COLORS[0][0], options: EV_COLORS.map(([v, l]) => ({ value: v, label: l })) },
    ],
    confirm: e ? "Save" : "Add event",
    onSubmit: (v) => {
      if (!v.title || !v.date || !v.start) return;
      if (!v.end || toMin(v.end) <= toMin(v.start)) { const m = Math.min(toMin(v.start) + 30, 23 * 60 + 59); v.end = `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; }
      const kind = v.type === "meeting" ? "meeting" : "block", xp = kind === "block" ? Number(v.type.replace("block", "")) || 0 : MEETING_XP;
      const data = { title: v.title, kind, xp, date: v.date, start: v.start, end: v.end, repeat: v.repeat || "", icon: v.icon, color: v.color };
      if (e) Object.assign(e, data);
      else state.events.push({ id: uid(), ...data, skips: [], done: {}, createdAt: Date.now() });
      ui.calDay = v.date; toast(e ? "Event updated" : `Added · ${fmtHM(v.start)}`);
    },
  });
}
function eventSheetHtml(e, k) {
  const done = !!(e.done || {})[k], started = evStarted(e, k), xp = evXP(e);
  const rep = REPEATS.find(([v]) => v === (e.repeat || ""))[1];
  const ic = ICONS[e.icon] ? e.icon : e.kind === "meeting" ? "monitor" : "clock";
  return `
    <div class="sheet-head"><span class="ev-dot" style="--ec:${esc(e.color || "#4fc3ff")}">${iconHtml(ic, 22)}</span>
      <div><div class="sys-label" style="color:${esc(e.color || "#4fc3ff")}">${e.kind === "meeting" ? "Meeting" : "Time block"}</div><h2>${esc(e.title)}</h2></div></div>
    <div class="chiprow"><span class="state ${done ? "done" : "open"}">${done ? `Done${xp ? ` · +${xp} XP` : ""}` : xp ? `${xp} XP` : "No XP"}</span>${e.repeat ? `<span class="state open">↻ ${esc(rep)}</span>` : ""}</div>
    <div class="sq-facts"><div><span>When</span><b>${fmtHM(e.start)} – ${fmtHM(e.end)}</b><small>${esc(new Date(`${k}T12:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }))}</small></div>
      <div><span>Length</span><b>${durLabel(toMin(e.end) - toMin(e.start))}</b><small>${e.kind === "meeting" ? "Alert 10 min before" : ""}</small></div></div>
    ${!done && !started && xp ? `<p class="sheet-note">You can check this off once it starts.</p>` : ""}
    <div class="btnrow">
      ${done ? `<button class="btn ghost" type="button" data-action="ev-undo" data-id="${e.id}" data-day="${k}">Mark not done</button>`
        : `<button class="btn" type="button" data-action="ev-done" data-id="${e.id}" data-day="${k}" ${started ? "" : "disabled"}>${started ? "Complete" : `Starts ${fmtHM(e.start)}`}</button>`}
      <button class="btn ghost" type="button" data-action="ev-edit" data-id="${e.id}">Edit${e.repeat ? " series" : ""}</button>
      ${e.repeat ? `<button class="btn ghost" type="button" data-action="ev-skip" data-id="${e.id}" data-day="${k}">Skip this day</button>` : ""}
      <button class="btn danger" type="button" data-action="ev-del" data-id="${e.id}">Delete${e.repeat ? " series" : ""}</button>
    </div>`;
}

/* timeline items for a day: events + side quests due that day */
function dayItems(k) {
  const items = eventsOn(k).map((e) => ({ kind: "event", e, s: toMin(e.start), en: Math.max(toMin(e.end), toMin(e.start) + 15) }));
  (state.sideQuests || []).filter((q) => q.dueAt && dayKey(new Date(q.dueAt)) === k).forEach((q) => {
    const d = new Date(q.dueAt), m = d.getHours() * 60 + d.getMinutes();
    items.push({ kind: "side", q, s: m, en: m });
  });
  return items.sort((a, b) => a.s - b.s || a.en - b.en);
}
function weekStripCal(sel) {
  const d0 = new Date(`${sel}T12:00`); d0.setDate(d0.getDate() - d0.getDay());
  return `<div class="wk-strip">
    <button type="button" class="iconbtn wk-nav" data-action="cal-week" data-dir="-1" aria-label="Previous week">‹</button>
    ${Array.from({ length: 7 }, (_, i) => {
      const d = new Date(d0); d.setDate(d0.getDate() + i); const k = dayKey(d);
      const dots = dayItems(k).slice(0, 4).map((it) => `<i style="background:${it.kind === "side" ? (isOverdue(it.q) ? "var(--danger)" : "var(--gold)") : esc(it.e.color || "#4fc3ff")}"></i>`).join("");
      return `<button type="button" class="wk-day ${k === sel ? "sel" : ""} ${k === today() ? "today" : ""}" data-action="cal-day" data-id="${k}">
        <small>${DAY_NAMES[d.getDay()].slice(0, 3)}</small><b>${d.getDate()}</b><span class="wk-dots">${dots}</span></button>`;
    }).join("")}
    <button type="button" class="iconbtn wk-nav" data-action="cal-week" data-dir="1" aria-label="Next week">›</button>
  </div>`;
}
function timelineHtml(k) {
  const items = dayItems(k), isT = k === today(), n = new Date(), nowM = n.getHours() * 60 + n.getMinutes();
  const hm = (m) => { const d = new Date(); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return timeStr(d.getTime()); };
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const rows = []; let cursor = items.length ? Math.min(items[0].s, isT ? nowM : 24 * 60) : (isT ? nowM : 8 * 60), nowDone = !isT;
  const gap = (from, to) => {
    if (!nowDone && nowM >= from && nowM < to) {
      if (nowM > from + 5) gap2(from, nowM);
      rows.push(`<div class="tl-now"><span>${hm(nowM)}</span><i></i></div>`); nowDone = true; from = nowM;
    }
    gap2(from, to);
  };
  const gap2 = (from, to) => {
    if (to - from < 15) return;
    rows.push(`<div class="tl-gap"><span class="tl-t"></span><div class="tl-gap-body"><span>${to >= 24 * 60 ? "" : `${durLabel(to - from)} free`}</span><button type="button" class="tool" data-action="ev-new-at" data-id="${k}" data-start="${hhmm(from)}">+ Add</button></div></div>`);
  };
  items.forEach((it) => {
    if (it.s > cursor) gap(cursor, it.s);
    if (!nowDone && nowM <= it.s && it.s - nowM < 15) { rows.push(`<div class="tl-now"><span>${hm(nowM)}</span><i></i></div>`); nowDone = true; }
    if (it.kind === "event") {
      const e = it.e, done = !!(e.done || {})[k], len = it.en - it.s, h = Math.max(62, Math.min(220, len * 1.5));
      const past = k < today();
      const ic = ICONS[e.icon] ? e.icon : e.kind === "meeting" ? "monitor" : "clock";
      rows.push(`<div class="tl-item ${done ? "done" : ""} ${past && !done && evXP(e) ? "missed" : ""}" style="--ec:${esc(e.color || "#4fc3ff")}">
        <span class="tl-t">${hm(it.s)}</span>
        <button type="button" class="tl-pill" style="height:${h}px" data-action="sheet-ev" data-id="${e.id}" data-day="${k}" aria-label="${esc(e.title)}">${iconHtml(ic, 22)}</button>
        <button type="button" class="tl-info" data-action="sheet-ev" data-id="${e.id}" data-day="${k}">
          <small>${fmtHM(e.start)} – ${fmtHM(e.end)} (${durLabel(len)})${e.repeat ? " ↻" : ""}</small>
          <b>${esc(e.title)}</b>
          <em>${evXP(e) ? (done ? `+${evXP(e)} XP` : past ? "Missed · 0 XP" : `${evXP(e)} XP`) : ""}</em>
        </button>
        <label class="tl-check" for="ev-${e.id}-${k}"><input type="checkbox" id="ev-${e.id}-${k}" data-ev="${e.id}" data-day="${k}" ${done ? "checked" : ""} aria-label="Complete ${esc(e.title)}"></label>
      </div>`);
    } else {
      const q = it.q, st = sideStatus(q);
      rows.push(`<div class="tl-item side ${st.cls}">
        <span class="tl-t">${hm(it.s)}</span>
        <button type="button" class="tl-pill side-pill" data-action="sheet-side" data-id="${q.id}"><b>${q.rank}</b></button>
        <button type="button" class="tl-info" data-action="sheet-side" data-id="${q.id}"><small>Side Quest due ${timeStr(q.dueAt)}</small><b>${esc(q.title)}</b><em>${esc(st.label)}</em></button>
        <label class="tl-check" for="tls-${q.id}"><input type="checkbox" id="tls-${q.id}" data-side="${q.id}" ${q.done ? "checked" : ""}></label>
      </div>`);
    }
    cursor = Math.max(cursor, it.en);
  });
  if (cursor < 24 * 60) gap(cursor, 24 * 60);
  const total = items.filter((i) => i.kind === "event" && evXP(i.e)).length;
  const done = items.filter((i) => i.kind === "event" && (i.e.done || {})[k] && evXP(i.e)).reduce((a, i) => a + evXP(i.e), 0);
  return `<section class="tl">
    <div class="tl-head"><div><h2>${esc(new Date(`${k}T12:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }))}</h2>
      <small>${items.length ? `${items.length} item${items.length === 1 ? "" : "s"}${total ? ` · +${done} XP earned` : ""}` : "Nothing scheduled"}</small></div>
      <button type="button" class="btn" data-action="ev-new-at" data-id="${k}">+ Event</button></div>
    ${items.length ? "" : `<p class="t-empty">Add your meetings and time blocks. Repeating ones only need to be set up once.</p>`}
    <div class="tl-rows">${rows.join("")}</div>
  </section>`;
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const areaForDay = (dow) => state.disciplines.areas.find((a) => a.day === dow);
const weekIdx = (d) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000 + 3) / 7);
function discFor(d = new Date()) {
  const a = areaForDay(d.getDay()); if (!a || !a.tasks.length) return null;
  const key = dayKey(d), idx = (state.disciplines.swaps[key] ?? weekIdx(d)) % a.tasks.length;
  return { area: a, idx, text: a.tasks[idx], key, entry: state.disciplines.log[key] };
}
function statPoints() {
  const pts = {};
  state.disciplines.areas.forEach((a) => (pts[a.id] = 0));
  Object.values(state.disciplines.log).forEach((e) => { if (e.areaId in pts) pts[e.areaId]++; });
  return pts;
}
function discStreak() {
  const log = state.disciplines.log; let s = 0; const d = new Date();
  if (!log[today()]) d.setDate(d.getDate() - 1);
  while (log[dayKey(d)]) { s++; d.setDate(d.getDate() - 1); }
  return s;
}
const orderedAreas = () => [...state.disciplines.areas].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7));
function statGrid() {
  const pts = statPoints();
  return `<div class="stats" aria-label="Stats">${orderedAreas().map((a) => `<span class="stat ${areaForDay(new Date().getDay()) === a ? "now" : ""}" title="${esc(a.name)}"><i>${esc(a.stat)}</i><b>${pts[a.id]}</b></span>`).join("")}</div>`;
}
function weekStrip() {
  const now = new Date(), monday = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  return `<div class="week">${Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    const a = areaForDay(d.getDay()), key = dayKey(d), done = !!state.disciplines.log[key], isT = key === today(), past = d < now && !isT;
    return `<span class="wk ${done ? "done" : ""} ${isT ? "today" : ""} ${past && !done ? "missed" : ""}" title="${DAY_NAMES[d.getDay()]}: ${esc(a?.name || "")}" ${a ? `data-action="open-area" data-id="${a.id}" role="button" tabindex="0"` : ""}>
      <svg viewBox="0 0 40 44" aria-hidden="true"><polygon points="${hexPts(20, 22, 18)}"/><text x="20" y="26" text-anchor="middle">${esc((a?.stat || "").slice(0, 3))}</text></svg>
      <small>${DAY_NAMES[d.getDay()].slice(0, 3)}</small></span>`;
  }).join("")}</div>`;
}
function disciplineCard() {
  const d = discFor();
  if (!d) return `<section class="disc"><p class="t-empty">No discipline set for ${DAY_NAMES[new Date().getDay()]}. Add one in Settings.</p></section>`;
  const { area, text, entry } = d, ai = state.disciplines.areas.indexOf(area);
  const done = !!entry, pts = statPoints()[area.id];
  return `
  <section class="disc ${done ? "done" : ""}" aria-label="Daily discipline">
    <div class="disc-head" data-action="open-area" data-id="${area.id}" role="button" tabindex="0" title="Open ${esc(area.name)} log">
      <span class="disc-hex">${iconHtml(ICONS[area.icon] ? area.icon : iconFor(area, ai), 24)}</span>
      <div style="flex:1"><div class="sys-label">Daily Discipline · ${DAY_NAMES[new Date().getDay()]}</div><h2>${esc(area.name)} <span class="disc-stat">${esc(area.stat)} ${pts}</span></h2></div><span class="go-arrow" aria-hidden="true">›</span>
    </div>
    <p class="disc-task">${esc(done ? entry.text : text)}</p>
    <div class="btnrow">
      ${done ? `<span class="state done">Complete · +1 ${esc(area.stat)} · +${DISC_XP} XP</span><button class="tool" type="button" data-action="disc-undo">Undo</button>`
        : `<button class="btn" type="button" data-action="disc-done">Complete  +${DISC_XP} XP</button>${area.tasks.length > 1 ? `<button class="btn ghost" type="button" data-action="disc-swap">Swap task</button>` : ""}`}
    </div>
    ${done ? `<form class="note-form disc-note" data-disc-note="1">
      <label class="sr" for="disc-note">Reflection</label>
      <textarea id="disc-note" name="note" rows="2" placeholder="How did it go? (optional)">${esc(entry.note || "")}</textarea>
      <button class="btn ghost" type="submit">${entry.note ? "Update reflection" : "Save reflection"}</button>
    </form>` : ""}
    ${weekStrip()}
    <p class="disc-foot">Streak: <b>${discStreak()}</b> day${discStreak() === 1 ? "" : "s"} · Tasks rotate weekly. Edit them in Settings.</p>
  </section>`;
}

/* ---------- overview: progress & stats at a glance ---------- */
const TITLES = [[50, "Legend"], [35, "Master"], [20, "Expert"], [10, "Adept"], [5, "Apprentice"], [1, "Novice"]];
const titleFor = (lvl) => TITLES.find(([min]) => lvl >= min)[1];
function overviewStats() {
  const weekAgo = Date.now() - 7 * 86400000, active = new Set(state.days);
  let quests = 0, skills = 0, weekXP = 0;
  state.trees.forEach((t) => {
    t.branches.forEach((b) => b.nodes.forEach((n) => {
      if (nodeDone(n)) skills++;
      n.quests.forEach((q) => {
        if (!q.done) return; quests++;
        if (q.completedAt) { active.add(dayKey(new Date(q.completedAt))); if (q.completedAt >= weekAgo) weekXP += RANK_XP[n.rank]; }
      });
    }));
    if (t.capstone.done) quests++;
  });
  Object.entries(state.disciplines.log).forEach(([k, e]) => { active.add(k); if (e.at >= weekAgo) weekXP += DISC_XP; });
  const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  let weekDisc = 0;
  for (let i = 0; i < 7; i++) { const d = new Date(monday); d.setDate(monday.getDate() + i); if (state.disciplines.log[dayKey(d)]) weekDisc++; }
  return { quests, skills, weekXP, active: active.size, weekDisc };
}
function radarSvg() {
  const areas = orderedAreas(), pts = statPoints(), n = areas.length;
  if (!n) return "";
  const W = 300, H = 250, cx = W / 2, cy = H / 2 + 4, R = 82;
  const max = Math.max(5, ...areas.map((a) => pts[a.id]));
  const at = (i, r) => { const a = (-90 + (i * 360) / n) * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; };
  const poly = (f) => areas.map((_, i) => at(i, f(i)).map((v) => v.toFixed(1)).join(",")).join(" ");
  const grid = [1 / 3, 2 / 3, 1].map((k) => `<polygon class="rd-grid" points="${poly(() => R * k)}"/>`).join("");
  const spokes = areas.map((_, i) => { const [x, y] = at(i, R); return `<line class="rd-spoke" x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`; }).join("");
  const val = poly((i) => Math.max(4, (pts[areas[i].id] / max) * R));
  const dots = areas.map((a, i) => { const [x, y] = at(i, Math.max(4, (pts[a.id] / max) * R)); return `<circle class="rd-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3"/>`; }).join("");
  const todayArea = areaForDay(new Date().getDay());
  const labels = areas.map((a, i) => {
    const [x, y] = at(i, R + 26);
    return `<g class="rd-lab ${a === todayArea ? "now" : ""}" data-action="open-area" data-id="${a.id}" tabindex="0" role="button" aria-label="${esc(a.name)}: ${pts[a.id]} points">
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="21" class="rd-hit"/>
      <text x="${x.toFixed(1)}" y="${(y - 2).toFixed(1)}" text-anchor="middle" class="rd-name">${esc(a.stat)}</text>
      <text x="${x.toFixed(1)}" y="${(y + 13).toFixed(1)}" text-anchor="middle" class="rd-val">${pts[a.id]}</text></g>`;
  }).join("");
  return `<svg class="radar" viewBox="0 0 ${W} ${H}" role="img" aria-label="Stat radar">${grid}${spokes}<polygon class="rd-val-poly" points="${val}"/>${dots}${labels}</svg>`;
}
/* ---------- discipline area page ---------- */
function areaEntries(a) {
  const out = [];
  Object.entries(state.disciplines.log).forEach(([k, e]) => { if (e.areaId === a.id) out.push({ kind: "done", at: e.at || new Date(k).getTime(), key: k, text: e.text, note: e.note }); });
  (a.notes || []).forEach((n) => out.push({ kind: "note", at: n.at, id: n.id, text: n.text }));
  return out.sort((x, y) => y.at - x.at);
}
function entryHtml(e, opts = {}) {
  const when = fmtDate(e.at) + (opts.time ? ` · ${new Date(e.at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}` : "");
  if (e.kind === "done") return `
    <li class="j-entry done"><div class="j-top"><span class="j-kind">${opts.label || "Completed"}</span><time>${when}</time></div>
      <p class="j-task">${esc(e.text)}</p>${e.note ? `<p class="j-note">${esc(e.note)}</p>` : ""}</li>`;
  if (e.kind === "qnote") return `
    <li class="j-entry qnote"><div class="j-top"><span class="j-kind">${esc(opts.label || "Quest note")}</span><time>${when}</time></div>
      <p class="j-ctx">${esc(e.ctx)}</p><p class="j-note">${esc(e.text)}</p></li>`;
  return `
    <li class="j-entry jnote"><div class="j-top"><span class="j-kind">${opts.label || "Note"}</span><time>${when}</time>
      ${opts.noDelete ? "" : `<button type="button" class="note-del ${ui.pendingDel === e.id ? "arm" : ""}" data-action="del-area-note" data-id="${opts.areaId}" data-note="${e.id}" aria-label="Delete note">${ui.pendingDel === e.id ? "Delete?" : "✕"}</button>`}</div>
      <p class="j-note">${esc(e.text)}</p></li>`;
}
function areaView(a) {
  const ai = state.disciplines.areas.indexOf(a), pts = statPoints()[a.id];
  const entries = areaEntries(a), done = entries.filter((e) => e.kind === "done");
  const isToday = a.day === new Date().getDay();
  const nextTask = (() => { const d = new Date(); d.setDate(d.getDate() + ((a.day - d.getDay() + 7) % 7)); const idx = (state.disciplines.swaps[dayKey(d)] ?? weekIdx(d)) % Math.max(a.tasks.length, 1); return a.tasks[idx]; })();
  return `
  <div class="topbar"><button class="iconbtn" type="button" data-action="${ui.areaBack || "home"}">← Back</button><div class="btnrow">${syncPill()}<button class="iconbtn" type="button" data-action="edit-area" data-id="${a.id}">Edit</button></div></div>
  <header class="area-head">
    <span class="disc-hex">${iconHtml(ICONS[a.icon] ? a.icon : iconFor(a, ai), 26)}</span>
    <div><div class="sys-label" style="color:var(--gold)">${DAY_NAMES[a.day]}s</div><h1>${esc(a.name)}</h1></div>
    <div class="area-pts"><b>${pts}</b><span>${esc(a.stat)}</span></div>
  </header>
  <div class="tiles three">
    <div class="tile"><b>${done.length}</b><span>Times completed</span></div>
    <div class="tile"><b>${done.filter((e) => e.note).length + entries.filter((e) => e.kind === "note").length}</b><span>Notes &amp; reflections</span></div>
    <div class="tile"><b>${done.length * DISC_XP}</b><span>XP earned</span></div>
  </div>
  ${isToday ? disciplineCard() : `<section class="card"><div class="sys-label" style="color:var(--gold)">Next ${DAY_NAMES[a.day]}</div><p style="color:var(--text);font-size:15px">${esc(nextTask || "No tasks yet")}</p></section>`}
  <section class="card">
    <h2>Journal</h2>
    <p>Thoughts, wins, things to chew on later. Only you can see these.</p>
    <form class="note-form" data-area-note="${a.id}">
      <label class="sr" for="an-${a.id}">New ${esc(a.name)} note</label>
      <textarea id="an-${a.id}" name="note" rows="3" placeholder="What's on your mind about ${esc(a.name.toLowerCase())}?"></textarea>
      <button class="btn" type="submit">Add to journal</button>
    </form>
    ${entries.length ? `<ul class="j-list">${entries.map((e) => entryHtml(e, { areaId: a.id })).join("")}</ul>` : `<p class="t-empty">Nothing yet. Complete a ${esc(a.name)} task or add a note to start your log.</p>`}
  </section>
  <section class="card">
    <h2>Task rotation</h2>
    <ol class="task-rot">${a.tasks.map((t) => `<li>${esc(t)}</li>`).join("")}</ol>
    <button class="btn ghost" type="button" data-action="edit-area" data-id="${a.id}">Edit tasks</button>
  </section>`;
}

/* ---------- journal: every note and reflection in one timeline ---------- */
function journalEntries() {
  const out = [];
  state.disciplines.areas.forEach((a) => areaEntries(a).forEach((e) => out.push({ ...e, filter: a.id, label: `${a.stat} · ${e.kind === "done" ? "Completed" : "Note"}`, areaId: a.id })));
  state.trees.forEach((t) => t.branches.forEach((b) => b.nodes.forEach((n) => n.quests.forEach((q) => (q.notes || []).forEach((nt) =>
    out.push({ kind: "qnote", at: nt.at, text: nt.text, ctx: `${n.name}: ${q.text}`, filter: "quests", label: `${t.name}` }))))));
  (state.sideQuests || []).forEach((q) => (q.notes || []).forEach((nt) => out.push({ kind: "qnote", at: nt.at, text: nt.text, ctx: q.title, filter: "quests", label: "Side Quest" })));
  return out.sort((x, y) => y.at - x.at);
}
function journalView() {
  const f = ui.jFilter || "all";
  const all = journalEntries();
  const list = all.filter((e) => f === "all" || e.filter === f || (f === "notes" && e.kind !== "done") || (f === "reflections" && e.kind === "done" && e.note));
  const chips = [["all", "All"], ["reflections", "Reflections"], ["notes", "Notes"], ...orderedAreas().map((a) => [a.id, a.stat]), ["quests", "Quests"]];
  let lastDay = "";
  const items = list.map((e) => {
    const dk = dayKey(new Date(e.at));
    const head = dk !== lastDay ? `<li class="j-day">${new Date(e.at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: new Date(e.at).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined })}</li>` : "";
    lastDay = dk;
    return head + entryHtml(e, { label: e.label, areaId: e.areaId, time: true, noDelete: true });
  }).join("");
  return `
  <div class="topbar"><button class="iconbtn" type="button" data-action="home">← Home</button><div class="btnrow">${syncPill()}</div></div>
  <header class="tree-head"><div class="sys-label">Journal</div><h1 style="font-size:24px;color:#fff;margin-top:4px">Your log</h1><p>${all.length} entr${all.length === 1 ? "y" : "ies"} across disciplines and quests</p></header>
  <div class="chips">${chips.map(([k, l]) => `<button type="button" class="chip-f ${f === k ? "on" : ""}" data-action="jfilter" data-id="${k}">${esc(l)}</button>`).join("")}</div>
  ${list.length ? `<ul class="j-list">${items}</ul>` : `<p class="t-empty">No entries here yet. Add notes from a discipline's page, a quest, or your daily reflection.</p>`}`;
}

function disciplinesSection() {
  const pts = statPoints(), todayDow = new Date().getDay();
  return `
  <section class="disc-section" aria-label="Disciplines">
    <div class="ds-head">
      <div><div class="sys-label" style="color:var(--gold)">Disciplines</div><h2>Your seven stats</h2></div>
      <button type="button" class="iconbtn" data-action="journal">Journal</button>
    </div>
    <div class="ds-body">
      <div class="ds-radar">${radarSvg()}</div>
      <div class="ds-grid">${orderedAreas().map((a, i) => {
        const done = !!state.disciplines.log[(() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() - a.day + 7) % 7)); return dayKey(d); })()];
        const isT = a.day === todayDow;
        return `<button type="button" class="ds-card ${isT ? "now" : ""} ${done ? "done" : ""}" data-action="open-area" data-id="${a.id}">
          <span class="ds-hex">${iconHtml(ICONS[a.icon] ? a.icon : iconFor(a, state.disciplines.areas.indexOf(a)), 18)}</span>
          <span class="ds-txt"><b>${esc(a.name)}</b><small>${DAY_NAMES[a.day].slice(0, 3)}${isT ? " · Today" : ""}${done ? " · ✓" : ""}</small></span>
          <span class="ds-pts"><b>${pts[a.id]}</b><i>${esc(a.stat)}</i></span>
        </button>`;
      }).join("")}</div>
    </div>
  </section>`;
}

function statusWindow() {
  const xp = totalXP(), lvl = levelFor(xp), into = xp % XP_PER_LEVEL;
  const logged = state.days.includes(today());
  const o = overviewStats();
  return `
  <section class="window overview" aria-label="Player overview">
    <div class="ov-top">
      <div class="lvl"><div class="t">LEVEL</div><div class="n">${lvl}</div></div>
      <div class="ov-id">
        <div class="sys-label">Status</div>
        <div class="title">${titleFor(lvl)}<small>${xp} XP total · ${XP_PER_LEVEL - into} XP to Lv ${lvl + 1}</small></div>
        <div class="bar" aria-hidden="true"><i style="width:${(into / XP_PER_LEVEL) * 100}%"></i></div>
      </div>
    </div>
    <div class="tiles">
      <div class="tile"><b>${streak()}</b><span>Focus streak</span></div>
      <div class="tile"><b>${discStreak()}</b><span>Discipline streak</span></div>
      <div class="tile"><b>${o.weekDisc}<small>/7</small></b><span>Disciplines this week</span></div>
      <div class="tile"><b>+${o.weekXP}</b><span>XP last 7 days</span></div>
      <div class="tile"><b>${o.quests}</b><span>Quests cleared</span></div>
      <div class="tile"><b>${o.skills}</b><span>Skills cleared</span></div>
    </div>
    <div class="daily">
      <p>Daily quest: one 45-minute focus block, phone in another room.</p>
      <button class="btn" type="button" data-action="daily" ${logged ? "disabled" : ""}>${logged ? "Today's block logged" : "Log today's block"}</button>
    </div>
  </section>`;
}

function homeView() {
  return `
  <div class="topbar"><h1>Skill Tree</h1><div class="btnrow">${syncPill()}<button class="iconbtn" data-action="settings" type="button">Settings</button></div></div>
  ${statusWindow()}
  ${todayCard()}
  ${disciplinesSection()}
  ${journalSection()}
  <p class="foot">${session ? "Progress syncs across your signed-in devices." : "Progress saves on this device. Sign in from Settings to sync."}</p>`;
}
function journalSection() {
  const recent = journalEntries().slice(0, 3);
  return `
  <section class="card j-home">
    <div class="ds-head"><div><div class="sys-label">Journal</div><h2 style="font-size:19px;color:#fff;margin-top:2px">Recent entries</h2></div><button type="button" class="iconbtn" data-action="journal">Open →</button></div>
    ${recent.length ? `<ul class="j-list">${recent.map((e) => entryHtml(e, { label: e.label, areaId: e.areaId, noDelete: true })).join("")}</ul>`
      : `<p>Reflections, discipline notes, and quest notes collect here. Tap any stat above to write one.</p>`}
  </section>`;
}
function calendarView() {
  const sel = ui.calDay || today(), mode = ui.calMode || "day";
  return `
  <div class="topbar"><h1>Calendar</h1><div class="btnrow">${syncPill()}
    <div class="seg cal-seg" role="group" aria-label="View"><button type="button" class="${mode === "day" ? "on" : ""}" data-action="cal-mode" data-id="day">Day</button><button type="button" class="${mode === "month" ? "on" : ""}" data-action="cal-mode" data-id="month">Month</button></div></div></div>
  <div class="cal-layout mode-${mode}">
    <aside class="cal-side">${monthPanel()}${backlogSection()}</aside>
    <div class="cal-main">${weekStripCal(sel)}${timelineHtml(sel)}</div>
  </div>`;
}
function monthPanel() {
  const now = new Date();
  const ym = ui.calMonth || `${now.getFullYear()}-${now.getMonth()}`;
  const [Y, M] = ym.split("-").map(Number);
  const first = new Date(Y, M, 1), startPad = first.getDay(), days = new Date(Y, M + 1, 0).getDate();
  const sel = ui.calDay || today();
  const qs = state.sideQuests || [];
  const byDay = {};
  qs.filter((q) => q.dueAt).forEach((q) => { const k = dayKey(new Date(q.dueAt)); (byDay[k] ||= []).push(q); });
  const questDone = {};
  state.trees.forEach((t) => t.branches.forEach((b) => b.nodes.forEach((n) => n.quests.forEach((q) => { if (q.done && q.completedAt) { const k = dayKey(new Date(q.completedAt)); (questDone[k] ||= []).push({ q, n, t }); } }))));
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(`<span class="cal-cell pad"></span>`);
  for (let d = 1; d <= days; d++) {
    const k = dayKey(new Date(Y, M, d)), list = byDay[k] || [];
    const disc = !!state.disciplines.log[k], focus = state.days.includes(k), qd = (questDone[k] || []).length;
    const over = list.some((q) => isOverdue(q)), open = list.some((q) => !q.done && !isOverdue(q)), dn = list.some((q) => q.done);
    cells.push(`<button type="button" class="cal-cell ${k === today() ? "today" : ""} ${k === sel ? "sel" : ""}" data-action="cal-day" data-id="${k}">
      <span class="cal-n">${d}</span>
      <span class="cal-dots">${eventsOn(k).length ? `<i class="d-ev"></i>` : ""}${over ? `<i class="d-over"></i>` : ""}${open ? `<i class="d-open"></i>` : ""}${dn ? `<i class="d-done"></i>` : ""}${disc ? `<i class="d-disc"></i>` : ""}${focus || qd ? `<i class="d-act"></i>` : ""}</span>
    </button>`);
  }
  const selDate = new Date(`${sel}T12:00:00`);
  const selList = (byDay[sel] || []).sort((a, b) => a.dueAt - b.dueAt);
  const discE = state.disciplines.log[sel], discA = discE && state.disciplines.areas.find((a) => a.id === discE.areaId);
  const qdList = questDone[sel] || [];
  const monthName = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return `
  <section class="cal">
    <div class="cal-head">
      <button type="button" class="iconbtn" data-action="cal-prev" aria-label="Previous month">‹</button>
      <button type="button" class="cal-title" data-action="cal-today">${esc(monthName)}</button>
      <button type="button" class="iconbtn" data-action="cal-next" aria-label="Next month">›</button>
    </div>
    <div class="cal-grid cal-dow">${["S", "M", "T", "W", "T", "F", "S"].map((x) => `<span>${x}</span>`).join("")}</div>
    <div class="cal-grid">${cells.join("")}</div>
    <div class="cal-legend"><span><i class="d-ev"></i>Events</span><span><i class="d-open"></i>Due</span><span><i class="d-over"></i>Overdue</span><span><i class="d-done"></i>Done</span><span><i class="d-disc"></i>Discipline</span><span><i class="d-act"></i>Other activity</span></div>
  </section>
  <section class="t-section">
    <h2 class="t-h"><span>${esc(selDate.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }))}</span><span class="btnrow"><button type="button" class="tool" data-action="new-side-on" data-id="${sel}">+ Quest</button><button type="button" class="tool only-phone" data-action="cal-mode" data-id="day">Timeline →</button></span></h2>
    ${selList.length ? `<ul class="sq-list">${selList.map(sideItem).join("")}</ul>` : `<p class="t-empty">No side quests due this day.</p>`}
    ${discE ? `<div class="cal-act"><b style="color:var(--done)">${esc(discA ? discA.stat : discE.stat)}</b> ${esc(discE.text)}${discE.note ? `<p>${esc(discE.note)}</p>` : ""}</div>` : ""}
    ${state.days.includes(sel) ? `<div class="cal-act"><b style="color:var(--accent)">FOCUS</b> 45-minute focus block logged</div>` : ""}
    ${qdList.map(({ q, n, t }) => `<div class="cal-act"><b style="color:var(--gold)">${esc(n.rank)}</b> ${esc(q.text)} <small>· ${esc(t.name)}</small></div>`).join("")}
  </section>`;
}
function treesView() {
  return `
  <div class="topbar"><h1>Skill Trees</h1><div class="btnrow">${syncPill()}</div></div>
  <div class="trees">
    ${state.trees.map((t, ti) => {
      const s = treeStats(t), [r] = rankFor(t);
      return `
      <button class="tree-card" type="button" data-action="open-tree" data-id="${t.id}">
        <span class="card-hex">${iconHtml(iconFor(t, ti), 24)}</span>
        <span class="card-body">
          <span class="row"><h2>${esc(t.name)}</h2><span class="rankpill">${r}-RANK</span></span>
          ${t.desc ? `<p>${esc(t.desc)}</p>` : `<p></p>`}
          <span class="bar"><i style="width:${s.pct * 100}%"></i></span>
          <span class="meta" style="margin-top:6px"><span>${s.done} / ${s.total} quests</span><span>${s.xp} / ${s.max} XP</span></span>
        </span>
      </button>`;
    }).join("")}
    <button class="tree-card add-card" type="button" data-action="add-tree">+ New skill tree</button>
  </div>`;
}

/* ---------- icons (original line set, 24x24) ---------- */
const ICONS = {
  checklist: ['Checklist', '<path d="M3 6l2 2 3-3M3 13l2 2 3-3M11 6h10M11 14h10M11 20h10"/>'],
  search: ['Magnifier', '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>'],
  compass: ['Compass', '<circle cx="12" cy="12" r="10"/><path d="M16 8l-2.5 5.5L8 16l2.5-5.5z"/>'],
  users: ['People', '<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 12 0v1M16 3.5a4 4 0 0 1 0 7.5M22 21v-1a6 6 0 0 0-4-5.6"/>'],
  chart: ['Chart', '<path d="M3 3v18h18M8 16v-5M13 16V8M18 16V7"/>'],
  target: ['Target', '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'],
  zap: ['Lightning', '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'],
  book: ['Book', '<path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2zM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z"/>'],
  star: ['Star', '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>'],
  flag: ['Flag', '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>'],
  chat: ['Chat', '<path d="M21 12a8 8 0 0 1-11.6 7.1L3 21l1.9-6.4A8 8 0 1 1 21 12z"/>'],
  bulb: ['Idea', '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z"/>'],
  shield: ['Shield', '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'],
  coins: ['Coins', '<circle cx="8" cy="8" r="6"/><path d="M18.1 10.4a6 6 0 1 1-7.7 7.7M7 6h1v4"/>'],
  heart: ['Heart', '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>'],
  trending: ['Growth', '<path d="M22 7l-8.5 8.5-5-5L2 17M16 7h6v6"/>'],
  rocket: ['Rocket', '<path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.2 2.2 0 0 0-2.9-.1zM12 15l-3-3a22 22 0 0 1 2-4A13 13 0 0 1 22 2c0 2.7-.8 7.5-6 11a22 22 0 0 1-4 2zM9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/>'],
  dumbbell: ['Dumbbell', '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>'],
  pen: ['Pen', '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'],
  crown: ['Crown', '<path d="M2 20h20M3 7l5 5 4-7 4 7 5-5-2 10H5z"/>'],
  trophy: ['Trophy', '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'],
  code: ['Code', '<path d="M16 18l6-6-6-6M8 6l-6 6 6 6"/>'],
  sprout: ['Sprout', '<path d="M7 20h10M12 20V10M12 10C12 6 9 4 5 4c0 4 3 6 7 6zM12 13c0-3 2.5-5 6-5 0 3.5-2.5 5-6 5z"/>'],
  clock: ['Clock', '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'],
  briefcase: ['Briefcase', '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>'],
  home: ['Home', '<path d="M3 11l9-8 9 8M5 10v10h14V10M10 20v-6h4v6"/>'],
  sun: ['Sun', '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'],
  calendar: ['Calendar', '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'],
  tree: ['Tree', '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v5M12 12.5L6.5 17M12 12.5l5.5 4.5"/>'],
  monitor: ['Meeting', '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>'],
  car: ['Car', '<path d="M5 17h14M5 17v2M19 17v2M3 13l2-6h14l2 6v4H3z"/><circle cx="7.5" cy="14" r="1"/><circle cx="16.5" cy="14" r="1"/>'],
  food: ['Meal', '<path d="M7 2v20M4 2v6a3 3 0 0 0 6 0V2M17 2c-2 0-3 3-3 7s1 5 3 5v8"/>'],
  moon: ['Sleep', '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'],
  alarm: ['Alarm', '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M5 3L2 6M19 3l3 3"/>'],
  paw: ['Pet', '<circle cx="5.5" cy="10" r="2"/><circle cx="9.5" cy="5.5" r="2"/><circle cx="14.5" cy="5.5" r="2"/><circle cx="18.5" cy="10" r="2"/><path d="M12 12c-3 0-5 3.5-5 6 0 1.5 1 2.5 2.5 2.5S11 20 12 20s1 .5 2.5.5S17 19.5 17 18c0-2.5-2-6-5-6z"/>'],
  plus: ['Plus', '<path d="M12 5v14M5 12h14"/>'],
  cap: ['Graduation', '<path d="M22 10L12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5"/>'],
};
const ICON_KEYWORDS = [
  [/backlog|story|stories|task/i, "checklist"], [/discover|customer|user|research/i, "search"], [/vision|strateg|direction|roadmap/i, "compass"],
  [/stakeholder|influence|team|people|lead|relationship/i, "users"], [/metric|outcome|data|analy|measure/i, "chart"], [/invest|money|financ|budget|wealth/i, "coins"],
  [/read|learn|book|study/i, "book"], [/health|fit|gym|strength|workout/i, "dumbbell"], [/code|tech|engineer|program/i, "code"],
  [/product/i, "rocket"], [/writ/i, "pen"], [/career|job|work/i, "briefcase"], [/communicat|speak|present/i, "chat"], [/habit|routine|time/i, "clock"],
];
const ICON_FALLBACK = ["zap", "target", "star", "flag", "bulb", "shield", "trending", "crown", "sprout", "heart"];
const iconFor = (o, i = 0) => (o.icon && ICONS[o.icon] ? o.icon : (ICON_KEYWORDS.find(([re]) => re.test(o.name || ""))?.[1]) || ICON_FALLBACK[i % ICON_FALLBACK.length]);
const iconOptions = (cur) => [{ value: "", label: "Automatic (based on name)" }, ...Object.entries(ICONS).map(([k, [label]]) => ({ value: k, label }))];
const iconSvg = (key, size, x, y) => `<g class="m-icon" transform="translate(${x - size / 2} ${y - size / 2}) scale(${size / 24})" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[key][1]}</g>`;
const iconHtml = (key, size = 22) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key][1]}</svg>`;

/* ---------- map view ---------- */
const hexPts = (x, y, r, flat = false) => Array.from({ length: 6 }, (_, k) => {
  const a = ((flat ? 0 : -90) + 60 * k) * Math.PI / 180;
  return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
}).join(" ");
function wrapWords(s, max = 14) {
  const words = String(s).split(/\s+/), lines = [""];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (cur && (cur + " " + w).length > max) lines.push(w); else lines[lines.length - 1] = cur ? cur + " " + w : w;
  }
  if (lines.length > 2) { lines[1] = lines.slice(1).join(" "); lines.length = 2; if (lines[1].length > max + 3) lines[1] = lines[1].slice(0, max + 1) + "…"; }
  return lines;
}
function mapLabel(lines, x, y, ux, uy, cls) {
  // place the label to the side of the ray so it never sits on the connecting line
  const anchor = ux > 0.35 ? "start" : ux < -0.35 ? "end" : "middle";
  const y0 = uy > 0.35 ? y + 4 : uy < -0.35 ? y - (lines.length - 1) * 15 - 2 : y - ((lines.length - 1) * 15) / 2 + 4;
  return `<text class="m-label ${cls}" x="${x.toFixed(1)}" y="${y0.toFixed(1)}" text-anchor="${anchor}">${lines.map((l, i) => `<tspan x="${x.toFixed(1)}" dy="${i ? 15 : 0}">${esc(l)}</tspan>`).join("")}</text>`;
}
const MAP = { HUB: 52, BR: 32, SK: 27, R1: 130, STEP: 120 };
function mapGeometry(t) {
  const maxK = Math.max(1, ...t.branches.map((b) => b.nodes.length));
  const half = MAP.R1 + maxK * MAP.STEP + 120;
  return { maxK, half, size: half * 2 };
}
function resolveZoom(size) {
  if (typeof ui.zoom === "number") return ui.zoom;
  const avail = Math.min(window.innerWidth - 34, 1066);
  const fit = avail / size;
  return window.innerWidth < 700 ? Math.max(fit, 0.68) : Math.min(fit, 1);
}

function mapSvg(t) {
  const { maxK, half, size } = mapGeometry(t);
  const c = half, N = t.branches.length;
  const lines = [], nodes = [], rings = [];
  for (let k = 0; k <= maxK; k++) rings.push(`<circle class="m-ring" cx="${c}" cy="${c}" r="${MAP.R1 + k * MAP.STEP}"/>`);

  t.branches.forEach((b, bi) => {
    const ang = (-90 + (bi * 360) / Math.max(N, 1)) * Math.PI / 180;
    const ux = Math.cos(ang), uy = Math.sin(ang), vx = -uy, vy = ux;
    const at = (r) => [c + r * ux, c + r * uy];
    const allDone = b.nodes.length > 0 && b.nodes.every(nodeDone);
    const bState = allDone ? "done" : "open";
    const [bx, by] = at(MAP.R1);
    lines.push(`<line class="m-line ${bState}" x1="${c}" y1="${c}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}"/>`);
    let prev = [bx, by];
    b.nodes.forEach((n, ni) => {
      const st = nodeDone(n) ? "done" : nodeOpen(b, ni) ? "open" : "locked";
      const [x, y] = at(MAP.R1 + (ni + 1) * MAP.STEP);
      lines.push(`<line class="m-line ${st}" x1="${prev[0].toFixed(1)}" y1="${prev[1].toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`);
      prev = [x, y];
      const q = n.quests.length, orbit = MAP.SK + 11, dr = q > 10 ? 2.6 : 3.6;
      const dots = n.quests.map((qq, qi) => {
        const a = (-90 + (qi * 360) / q) * Math.PI / 180;
        return `<circle class="m-dot ${qq.done ? "done" : ""}" cx="${(x + orbit * Math.cos(a)).toFixed(1)}" cy="${(y + orbit * Math.sin(a)).toFixed(1)}" r="${dr}"/>`;
      }).join("");
      const lx = x + vx * (MAP.SK + 22), ly = y + vy * (MAP.SK + 22);
      nodes.push(`
        <g class="m-node ${st}" data-action="sheet-node" data-id="${n.id}" tabindex="0" role="button" aria-label="${esc(n.name)}, ${st}">
          <circle class="m-hit" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${MAP.SK + 16}"/>
          ${dots}
          <polygon class="m-hex" points="${hexPts(x, y, MAP.SK)}"/>
          <text class="m-rank" x="${x.toFixed(1)}" y="${(y + 5.5).toFixed(1)}" text-anchor="middle">${n.rank}</text>
          ${mapLabel(wrapWords(n.name), lx, ly, vx, vy, st)}
        </g>`);
    });
    const blx = bx + vx * (MAP.BR + 16), bly = by + vy * (MAP.BR + 16);
    nodes.push(`
      <g class="m-node m-branch ${bState}" data-action="sheet-branch" data-id="${b.id}" tabindex="0" role="button" aria-label="${esc(b.name)} branch">
        <circle class="m-hit" cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${MAP.BR + 12}"/>
        <polygon class="m-hex" points="${hexPts(bx, by, MAP.BR)}"/>
        ${iconSvg(iconFor(b, bi), 26, bx, by)}
        ${mapLabel(wrapWords(b.name, 16), blx, bly, vx, vy, "branch")}
      </g>`);
  });

  const [r] = rankFor(t), all = treeAllDone(t);
  const hubState = t.capstone.done ? "mastered" : all ? "ready" : "";
  const hub = `
    <g class="m-node m-hub ${hubState}" data-action="sheet-hub" tabindex="0" role="button" aria-label="${esc(t.name)} overview">
      <polygon class="m-hex-outer" points="${hexPts(c, c, MAP.HUB + 9, true)}"/>
      <polygon class="m-hex" points="${hexPts(c, c, MAP.HUB, true)}"/>
      <text class="m-hub-rank" x="${c}" y="${c + 8}" text-anchor="middle">${r}</text>
      <text class="m-hub-sub" x="${c}" y="${c + 28}" text-anchor="middle">RANK</text>
    </g>`;
  const empty = N === 0 ? `<text class="m-label" x="${c}" y="${c + MAP.HUB + 40}" text-anchor="middle">Tap Edit to add your first branch</text>` : "";

  return `
  <svg class="map" viewBox="0 0 ${size} ${size}" width="${Math.round(size * resolveZoom(size))}" height="${Math.round(size * resolveZoom(size))}" data-size="${size}" role="img" aria-label="${esc(t.name)} skill map">
    <defs>
      <filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <filter id="glowSoft" filterUnits="userSpaceOnUse" x="0" y="0" width="${size}" height="${size}"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      <radialGradient id="hubFill" cx="50%" cy="40%" r="70%"><stop offset="0%" stop-color="#2a6f8f"/><stop offset="100%" stop-color="#0d1f3a"/></radialGradient>
      <linearGradient id="prism" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6b9a"/><stop offset=".25" stop-color="#f2c14e"/><stop offset=".5" stop-color="#5ee6a8"/><stop offset=".75" stop-color="#4fc3ff"/><stop offset="1" stop-color="#a98bff"/></linearGradient>
    </defs>
    ${rings.join("")}
    ${lines.join("")}
    ${hub}
    ${nodes.join("")}
    ${empty}
  </svg>`;
}

function mapView(t) {
  const s = treeStats(t), [r, rs] = rankFor(t);
  return `
  <div class="topbar">
    <button class="iconbtn" type="button" data-action="trees">← Trees</button>
    <div class="btnrow">${syncPill()}<button class="iconbtn" type="button" data-action="toggle-edit">Edit</button></div>
  </div>
  <header class="tree-head">
    <h1 style="font-size:24px;color:#fff">${esc(t.name)}</h1>
    <p>${r}-Rank · ${esc(rs)} · ${s.done}/${s.total} quests · ${s.xp} XP</p>
  </header>
  <div class="map-bar">
    <div class="seg" role="group" aria-label="View">
      <button type="button" class="on" aria-pressed="true">Map</button>
      <button type="button" data-action="mode-list" aria-pressed="false">List</button>
    </div>
    <div class="seg" role="group" aria-label="Zoom">
      <button type="button" data-action="zoom" data-dir="-1" aria-label="Zoom out">−</button>
      <button type="button" data-action="zoom-fit">Fit</button>
      <button type="button" data-action="zoom" data-dir="1" aria-label="Zoom in">+</button>
    </div>
  </div>
  <div class="map-wrap" id="map-wrap"><div class="map-inner">${mapSvg(t)}</div></div>
  <div class="legend"><span style="--c:var(--locked)">Locked</span><span style="--c:var(--accent)">Unlocked</span><span style="--c:var(--done)">Cleared</span><span style="--c:var(--gold)">Tap a skill to see its quests</span></div>`;
}

/* ---------- quest notes (a dated progress log per quest) ---------- */
function fmtDate(ms) {
  const d = new Date(ms), now = new Date();
  const opts = { month: "short", day: "numeric" };
  if (d.getFullYear() !== now.getFullYear()) opts.year = "numeric";
  return d.toLocaleDateString(undefined, opts);
}
function notesBlock(q) {
  const notes = q.notes || [], open = !!ui.notesOpen[q.id];
  return `
    <button type="button" class="note-toggle ${notes.length ? "has" : ""}" data-action="toggle-notes" data-id="${q.id}" aria-expanded="${open}">
      ${open ? "Hide notes" : notes.length ? `Notes · ${notes.length}` : "+ Add note"}
    </button>
    ${open ? `<div class="notes">
      ${notes.map((n) => `
        <div class="note">
          <time>${fmtDate(n.at)}</time>
          <p>${esc(n.text)}</p>
          <button type="button" class="note-del ${ui.pendingDel === n.id ? "arm" : ""}" data-action="del-note" data-id="${q.id}" data-note="${n.id}" aria-label="Delete note">${ui.pendingDel === n.id ? "Delete?" : "✕"}</button>
        </div>`).join("")}
      <form class="note-form" data-quest-note="${q.id}">
        <label class="sr" for="nt-${q.id}">New note</label>
        <textarea id="nt-${q.id}" name="note" rows="2" placeholder="What progress did you make?"></textarea>
        <button class="btn" type="submit">Add note</button>
      </form>
    </div>` : ""}`;
}

/* ---------- today board ---------- */
const isToday = (ms) => ms && dayKey(new Date(ms)) === today();
function todayData() {
  const avail = [], cleared = [];
  state.trees.forEach((tree, ti) => tree.branches.forEach((branch, bi) => branch.nodes.forEach((node, ni) => {
    const open = nodeOpen(branch, ni);
    node.quests.forEach((quest) => {
      const item = { tree, ti, branch, bi, node, quest };
      if (quest.done) { if (isToday(quest.completedAt)) cleared.push(item); }
      else if (open) avail.push(item);
    });
  })));
  cleared.sort((a, b) => b.quest.completedAt - a.quest.completedAt);
  return { avail, cleared, pinned: avail.filter((i) => i.quest.pinned) };
}
function todayItem(i, opts = {}) {
  const { tree, ti, branch, bi, node, quest } = i;
  return `
  <li class="t-item ${quest.done ? "is-done" : ""}">
    <div class="t-row">
      <label for="tq-${quest.id}" class="t-check"><input type="checkbox" id="tq-${quest.id}" data-quest="${quest.id}" ${quest.done ? "checked" : ""}><span>${esc(quest.text)}</span></label>
      ${quest.done ? "" : `<button type="button" class="pin ${quest.pinned ? "on" : ""}" data-action="pin" data-id="${quest.id}" aria-pressed="${!!quest.pinned}" aria-label="${quest.pinned ? "Unpin from focus" : "Pin to focus"}">${quest.pinned ? "★" : "☆"}</button>`}
    </div>
    <div class="t-meta">
      <span class="t-ico">${iconHtml(iconFor(branch, bi), 13)}</span>
      ${opts.showTree ? `<span>${esc(tree.name)}</span><span class="dot">·</span>` : ""}
      <span>${esc(node.name)}</span><span class="dot">·</span><span class="t-rank">${node.rank}</span>
      <em class="xp">+${RANK_XP[node.rank]} XP</em>
    </div>
    ${notesBlock(quest)}
  </li>`;
}
function todayView() {
  const { avail, cleared, pinned } = todayData();
  const xpToday = cleared.reduce((a, i) => a + RANK_XP[i.node.rank], 0);
  const logged = state.days.includes(today());
  const multi = state.trees.length > 1;
  const groups = state.trees.map((tree) => ({ tree, items: avail.filter((i) => i.tree === tree && !i.quest.pinned) })).filter((g) => g.items.length);
  const dateStr = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  return `
  <div class="topbar"><h1>Today</h1><div class="btnrow">${syncPill()}<button class="iconbtn" type="button" data-action="new-side">+ Side Quest</button></div></div>
  <header class="tree-head">
    <div class="sys-label">Quest Board</div>
    <h1 style="font-size:24px;color:#fff;margin-top:4px">${esc(dateStr)}</h1>
    <p>${avail.length} quest${avail.length === 1 ? "" : "s"} available · ${cleared.length} cleared today · +${xpToday} XP today</p>
  </header>

  ${prioritySection()}

  ${backlogSection()}

  ${disciplineCard()}

  <section class="window t-daily">
    <div class="daily" style="margin:0;padding:0;border:none">
      <p><b style="color:var(--accent)">Daily quest:</b> one 45-minute focus block.<br>Streak: <b>${streak()}</b> day${streak() === 1 ? "" : "s"}</p>
      <button class="btn" type="button" data-action="daily" ${logged ? "disabled" : ""}>${logged ? "Logged" : "Log it"}</button>
    </div>
  </section>

  <section class="t-section">
    ${(() => { const sf = sideBuckets().focus, n = pinned.length + sf.length; return `
    <h2 class="t-h"><span>★ Focus</span><small>${n ? `${n} pinned` : ""}</small></h2>
    ${sf.length ? `<ul class="sq-list">${sf.map(sideItem).join("")}</ul>` : ""}
    ${pinned.length ? `<ul class="t-list">${pinned.map((i) => todayItem(i, { showTree: multi })).join("")}</ul>` : ""}
    ${!n ? `<p class="t-empty">Tap ☆ on any quest, side quest, or Backlog item to pin it here. Keep it to 1 to 3 things you'll actually do today.</p>` : ""}`; })()}
  </section>

  ${groups.map((g) => `
  <section class="t-section">
    <h2 class="t-h"><button type="button" class="t-tree" data-action="open-tree" data-id="${g.tree.id}"><span class="t-ico big">${iconHtml(iconFor(g.tree, state.trees.indexOf(g.tree)), 16)}</span>${esc(g.tree.name)}</button><small>${g.items.length} available</small></h2>
    <ul class="t-list">${g.items.map((i) => todayItem(i)).join("")}</ul>
  </section>`).join("")}

  ${!avail.length ? `<p class="t-empty">No open quests right now. Add skills or quests in a tree's Edit mode, or start a new skill tree.</p>` : ""}

  ${cleared.length ? `
  <section class="t-section">
    <h2 class="t-h"><span style="color:var(--done)">Cleared today</span><small>+${xpToday} XP</small></h2>
    <ul class="t-list">${cleared.map((i) => todayItem(i, { showTree: multi })).join("")}</ul>
  </section>` : ""}`;
}
function sideBuckets() {
  const tk = today(), now = Date.now();
  const qs = state.sideQuests || [];
  const open = qs.filter((q) => !q.done && isStarted(q));
  const focus = open.filter((q) => q.pinned).sort((a, b) => (a.dueAt || Infinity) - (b.dueAt || Infinity));
  const priority = open.filter((q) => !q.pinned && q.dueAt && (dayKey(new Date(q.dueAt)) === tk || q.dueAt < now)).sort((a, b) => a.dueAt - b.dueAt);
  const doneToday = qs.filter((q) => q.done && dayKey(new Date(q.completedAt)) === tk).sort((a, b) => b.completedAt - a.completedAt);
  const upcoming = open.filter((q) => !q.pinned && q.dueAt && q.dueAt > now && dayKey(new Date(q.dueAt)) !== tk).sort((a, b) => a.dueAt - b.dueAt);
  const backlog = open.filter((q) => !q.pinned && !q.dueAt).sort((a, b) => SIDE_RANKS.indexOf(b.rank) - SIDE_RANKS.indexOf(a.rank) || a.createdAt - b.createdAt);
  const later = qs.filter((q) => !q.done && !isStarted(q)).sort((a, b) => a.startDate.localeCompare(b.startDate));
  const dueCount = open.filter((q) => q.dueAt && (dayKey(new Date(q.dueAt)) === tk || q.dueAt < now)).length;
  return { focus, priority, doneToday, upcoming, backlog, later, dueCount };
}
function prioritySection() {
  const { priority, doneToday, upcoming } = sideBuckets();
  const overdue = priority.filter((q) => isOverdue(q)).length;
  return `
  <section class="t-section priority">
    <h2 class="t-h"><span style="color:var(--danger)">⚠ Priority</span><small>${priority.length ? `${priority.length} due${overdue ? ` · ${overdue} overdue` : ""}` : ""}</small></h2>
    ${priority.length || doneToday.length ? `<ul class="sq-list">${priority.map(sideItem).join("")}${doneToday.map(sideItem).join("")}</ul>`
      : `<p class="t-empty">No side quests due today. Tap <b>+</b> below to add one.</p>`}
    ${upcoming.length ? `<details class="upcoming"><summary>Coming up · ${upcoming.length}</summary><ul class="sq-list">${upcoming.slice(0, 8).map(sideItem).join("")}</ul></details>` : ""}
  </section>`;
}
function backlogSection(open) {
  const { backlog, later } = sideBuckets();
  return `
  <section class="t-section">
    <details class="backlog" ${open || ui.backlogOpen ? "open" : ""} data-backlog>
      <summary class="t-h"><span style="color:var(--accent)">Backlog</span><small>${backlog.length} quest${backlog.length === 1 ? "" : "s"} · ☆ to pull into Focus</small></summary>
      ${backlog.length ? `<ul class="sq-list">${backlog.map(sideItem).join("")}</ul>` : `<p class="t-empty">Nothing in your Backlog. Quests without a due date land here.</p>`}
      <button type="button" class="add-row" data-action="new-backlog" style="margin-top:8px">+ Backlog quest</button>
      ${later.length ? `<details class="upcoming" style="margin-top:10px"><summary>Starts later · ${later.length}</summary><ul class="sq-list">${later.map(sideItem).join("")}</ul></details>` : ""}
    </details>
  </section>`;
}
function todayCard() {
  const { avail, cleared, pinned } = todayData();
  const preview = (pinned.length ? pinned : avail).slice(0, 3);
  const dsc = discFor();
  return `
  <button class="today-card" type="button" data-action="today">
    <span class="row"><span class="sys-label">Today's Quest Board</span><span class="go">Open →</span></span>
    ${dsc ? `<span class="today-disc ${dsc.entry ? "done" : ""}"><b>${esc(dsc.area.stat)}</b> ${esc(dsc.area.name)}: ${esc(dsc.entry ? dsc.entry.text : dsc.text)}${dsc.entry ? " ✓" : ""}</span>` : ""}
    ${(() => { const { priority } = sideBuckets(); const pf = sideBuckets().focus; return pf.length ? `<span class="today-pri" style="color:var(--gold)"><b style="color:var(--gold)">★</b> ${esc(pf[0].title)}${pf.length > 1 ? ` +${pf.length - 1} more` : ""}</span>` + (priority.length ? `<span class="today-pri"><b>${priority.length}</b> more due: ${esc(priority[0].title)}</span>` : "") : priority.length ? `<span class="today-pri"><b>${priority.length}</b> side quest${priority.length === 1 ? "" : "s"} due${priority.some((q) => isOverdue(q)) ? ` · <em>${priority.filter((q) => isOverdue(q)).length} overdue</em>` : ""}: ${esc(priority[0].title)}</span>` : ""; })()}
    <span class="today-stats"><b>${avail.length}</b> available<span class="dot">·</span><b>${pinned.length}</b> pinned<span class="dot">·</span><b>${cleared.length}</b> cleared today</span>
    ${preview.length ? `<span class="today-prev">${preview.map((i) => `<span>${i.quest.pinned ? "★" : "▸"} ${esc(i.quest.text)}</span>`).join("")}</span>` : ""}
  </button>`;
}

/* ---------- bottom sheet ---------- */
function sheetHtml(t) {
  const sh = ui.sheet;
  let body = "";
  if (sh.type === "node") {
    const { branch, node } = find(t, "node", sh.id);
    if (!node) { ui.sheet = null; return ""; }
    const i = branch.nodes.indexOf(node), open = nodeOpen(branch, i), dn = nodeDone(node);
    const cnt = node.quests.filter((q) => q.done).length;
    body = `
      <div class="sheet-head">
        <svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true"><polygon class="s-hex ${dn ? "done" : open ? "open" : "locked"}" points="${hexPts(23, 23, 20)}"/><text x="23" y="28" text-anchor="middle" class="s-rank ${dn ? "done" : open ? "open" : "locked"}">${node.rank}</text></svg>
        <div><h2>${esc(node.name)}</h2><p>${esc(branch.name)} · ${node.rank}-Rank · +${RANK_XP[node.rank]} XP per quest</p></div>
      </div>
      <div class="chiprow"><span class="state ${dn ? "done" : open ? "open" : "locked"}">${dn ? "Cleared" : open ? `${cnt} of ${node.quests.length} done` : "Locked"}</span></div>
      ${!open ? `<p class="sheet-note">Clear <b>${esc(branch.nodes[i - 1].name)}</b> to unlock. Here's what's ahead:</p>` : ""}
      <ul class="quests sheet-quests">${node.quests.length ? node.quests.map((q) => `
        <li><label for="sq-${q.id}"><input type="checkbox" id="sq-${q.id}" data-quest="${q.id}" ${q.done ? "checked" : ""} ${open ? "" : "disabled"}><span>${esc(q.text)}</span><em class="xp">+${RANK_XP[node.rank]} XP</em></label>${open ? notesBlock(q) : ""}</li>`).join("")
        : `<li class="empty">No quests yet. Use Edit to add some.</li>`}</ul>`;
  } else if (sh.type === "branch") {
    const { branch } = find(t, "branch", sh.id);
    if (!branch) { ui.sheet = null; return ""; }
    const bi = t.branches.indexOf(branch);
    body = `
      <div class="sheet-head"><span class="s-icon">${iconHtml(iconFor(branch, bi), 26)}</span><div><h2>${esc(branch.name)}</h2>${branch.desc ? `<p>${esc(branch.desc)}</p>` : ""}</div></div>
      <div class="sheet-list">${branch.nodes.map((n, ni) => {
        const st = nodeDone(n) ? "done" : nodeOpen(branch, ni) ? "open" : "locked";
        return `<button type="button" class="sheet-row" data-action="sheet-node" data-id="${n.id}"><b class="r ${st}">${n.rank}</b><span>${esc(n.name)}</span><span class="state ${st}">${st === "done" ? "Cleared" : st === "open" ? `${n.quests.filter((q) => q.done).length}/${n.quests.length}` : "Locked"}</span></button>`;
      }).join("") || `<p class="empty">No skills yet. Use Edit to add some.</p>`}</div>`;
  } else {
    const s = treeStats(t), [r, rs] = rankFor(t), all = treeAllDone(t);
    body = `
      <div class="sheet-head"><svg width="46" height="46" viewBox="0 0 46 46" aria-hidden="true"><polygon class="s-hex open" points="${hexPts(23, 23, 20, true)}"/><text x="23" y="28" text-anchor="middle" class="s-rank open">${r}</text></svg>
        <div><h2>${esc(t.name)}</h2><p>${r}-Rank · ${esc(rs)}</p></div></div>
      ${t.desc ? `<p class="sheet-note">${esc(t.desc)}</p>` : ""}
      <div class="bar"><i style="width:${s.pct * 100}%"></i></div>
      <div class="meta"><span>${s.done} / ${s.total} quests</span><span>${s.xp} / ${s.max} XP</span></div>
      <div class="cap-box">
        <div class="sys-label" style="color:var(--gold)">S-Rank Capstone · +${CAPSTONE_XP} XP</div>
        ${!t.capstone.text ? `<p class="sheet-note">No capstone yet. Add one in Edit.</p>`
          : all ? `<label class="cap-label" for="capbox"><input type="checkbox" id="capbox" data-action="capstone" ${t.capstone.done ? "checked" : ""}><span>${esc(t.capstone.text)}</span></label>`
          : `<p class="sheet-note">Locked. Clear every skill in this tree to reveal the final quest.</p>`}
      </div>`;
  }
  return `<div class="sheet-bg" data-action="sheet-close"><section class="sheet" role="dialog" aria-modal="true"><div class="grab" aria-hidden="true"></div><button type="button" class="sheet-x" data-action="sheet-close" aria-label="Close">✕</button>${body}</section></div>`;
}
function renderSheet() {
  const m = document.getElementById("modal");
  const hadSheet = !!m.querySelector(".sheet");
  const settle = () => { if (hadSheet) m.querySelector(".sheet")?.classList.add("no-anim"); };
  const t = getTree(ui.treeId);
  if (ui.sheet && ui.sheet.type === "ev") {
    const e = (state.events || []).find((x) => x.id === ui.sheet.id);
    if (!e) { ui.sheet = null; m.innerHTML = ""; return; }
    m.innerHTML = `<div class="sheet-bg" data-action="sheet-close"><section class="sheet" role="dialog" aria-modal="true"><div class="grab" aria-hidden="true"></div><button type="button" class="sheet-x" data-action="sheet-close" aria-label="Close">✕</button>${eventSheetHtml(e, ui.sheet.day)}</section></div>`;
    settle(); return;
  }
  if (ui.sheet && ui.sheet.type === "side") {
    const q = state.sideQuests.find((x) => x.id === ui.sheet.id);
    if (!q) { ui.sheet = null; m.innerHTML = ""; return; }
    const sc = m.querySelector(".sheet"), sct = sc ? sc.scrollTop : 0;
    m.innerHTML = `<div class="sheet-bg" data-action="sheet-close"><section class="sheet" role="dialog" aria-modal="true"><div class="grab" aria-hidden="true"></div><button type="button" class="sheet-x" data-action="sheet-close" aria-label="Close">✕</button>${sideSheetHtml(q)}</section></div>`;
    const ns2 = m.querySelector(".sheet"); if (ns2) ns2.scrollTop = sct;
    settle(); return;
  }
  if (!ui.sheet || !t || ui.view !== "tree") { if (m.querySelector(".sheet-bg")) m.innerHTML = ""; ui.sheet = null; return; }
  const scroller = m.querySelector(".sheet"), st = scroller ? scroller.scrollTop : 0;
  m.innerHTML = sheetHtml(t); settle();
  const ns = m.querySelector(".sheet"); if (ns) ns.scrollTop = st;
}

function treeView(t) {
  if (!ui.edit && ui.mode !== "list") return mapView(t);
  const s = treeStats(t), [r, rs] = rankFor(t), edit = ui.edit;
  const branches = t.branches.map((b, bi) => {
    const bDone = b.nodes.reduce((a, n) => a + n.quests.filter((q) => q.done).length, 0);
    const bAll = b.nodes.reduce((a, n) => a + n.quests.length, 0);
    const nodes = b.nodes.map((n, ni) => {
      const open = nodeOpen(b, ni), dn = nodeDone(n);
      const expanded = ui.expanded[n.id] ?? (open && !dn);
      const cnt = n.quests.filter((q) => q.done).length;
      const chip = dn ? "CLEARED" : open ? `${cnt}/${n.quests.length}` : "LOCKED";
      const quests = edit
        ? n.quests.map((q, qi) => `
          <li class="qrow"><span>${esc(q.text)}</span>
            <button class="tool" type="button" data-action="move-quest" data-id="${q.id}" data-dir="-1" ${qi === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
            <button class="tool" type="button" data-action="edit-quest" data-id="${q.id}">Edit</button>
            <button class="tool del" type="button" data-action="del-quest" data-id="${q.id}">Delete</button>
          </li>`).join("") + `<li><button class="add-row" type="button" data-action="add-quest" data-id="${n.id}">+ Add quest</button></li>`
        : n.quests.length
        ? n.quests.map((q) => `
          <li><label for="q-${q.id}"><input type="checkbox" id="q-${q.id}" data-quest="${q.id}" ${q.done ? "checked" : ""}><span>${esc(q.text)}</span><em class="xp">+${RANK_XP[n.rank]} XP</em></label>${open ? notesBlock(q) : ""}</li>`).join("")
        : `<li class="empty">No quests yet. Tap Edit to add some.</li>`;
      return `
      <div class="node ${dn ? "done" : open ? "open" : "locked"} ${expanded ? "expanded" : ""}">
        <div class="gem"><b>${n.rank}</b></div>
        <button class="node-btn" type="button" data-action="toggle-node" data-id="${n.id}" aria-expanded="${expanded}">
          <h3>${esc(n.name)}</h3><span class="chip">${chip}</span>
        </button>
        ${edit ? `<div class="tools">
          <button class="tool" type="button" data-action="move-node" data-id="${n.id}" data-dir="-1" ${ni === 0 ? "disabled" : ""}>↑ Up</button>
          <button class="tool" type="button" data-action="move-node" data-id="${n.id}" data-dir="1" ${ni === b.nodes.length - 1 ? "disabled" : ""}>↓ Down</button>
          <button class="tool" type="button" data-action="edit-node" data-id="${n.id}">Edit skill</button>
          <button class="tool del" type="button" data-action="del-node" data-id="${n.id}">Delete</button></div>` : ""}
        <div class="lock-note">Clear ${esc(b.nodes[ni - 1]?.name || "")} to unlock.</div>
        <ul class="quests">${quests}</ul>
      </div>`;
    }).join("");
    return `
    <section class="branch">
      <div class="branch-head"><h2><span class="b-icon">${iconHtml(iconFor(b, bi), 18)}</span>${esc(b.name)}</h2><span class="pct">${bDone}/${bAll}</span></div>
      ${b.desc ? `<p class="branch-desc">${esc(b.desc)}</p>` : ""}
      ${edit ? `<div class="tools" style="margin-left:0">
        <button class="tool" type="button" data-action="move-branch" data-id="${b.id}" data-dir="-1" ${bi === 0 ? "disabled" : ""}>↑ Up</button>
        <button class="tool" type="button" data-action="move-branch" data-id="${b.id}" data-dir="1" ${bi === t.branches.length - 1 ? "disabled" : ""}>↓ Down</button>
        <button class="tool" type="button" data-action="edit-branch" data-id="${b.id}">Edit branch</button>
        <button class="tool del" type="button" data-action="del-branch" data-id="${b.id}">Delete branch</button></div>` : ""}
      ${nodes || (edit ? "" : `<p class="empty">No skills yet. Tap Edit to add some.</p>`)}
      ${edit ? `<div style="padding:0 0 10px"><button class="add-row" type="button" data-action="add-node" data-id="${b.id}">+ Add skill to ${esc(b.name)}</button></div>` : ""}
    </section>`;
  }).join("");

  const unlocked = treeAllDone(t);
  const cap = t.capstone.text || edit ? `
  <section class="window capstone" aria-label="Capstone quest">
    <div class="sys-label">S-Rank Capstone · +${CAPSTONE_XP} XP</div>
    ${edit
      ? `<p style="margin:8px 0">${t.capstone.text ? esc(t.capstone.text) : "<span style='color:var(--muted)'>No capstone yet.</span>"}</p>
         <button class="tool" type="button" data-action="edit-capstone">${t.capstone.text ? "Edit capstone" : "Add capstone"}</button>`
      : unlocked
      ? `<label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer;margin-top:8px" for="capbox"><input type="checkbox" id="capbox" data-action="capstone" ${t.capstone.done ? "checked" : ""} style="margin-top:3px;accent-color:var(--gold);width:16px;height:16px"><span>${esc(t.capstone.text)}</span></label>`
      : `<p style="margin:8px 0 0;color:var(--muted);font-size:14px">Locked. Clear every skill in this tree to reveal the final quest.</p>`}
  </section>` : "";

  return `
  <div class="topbar">
    <button class="iconbtn" type="button" data-action="trees">← Trees</button>
    <div class="btnrow">${syncPill()}<button class="iconbtn ${edit ? "on" : ""}" type="button" data-action="toggle-edit">${edit ? "Done editing" : "Edit"}</button></div>
  </div>
  <header class="tree-head">
    <h1 style="font-size:24px;color:#fff">${esc(t.name)}</h1>
    <p>${r}-Rank · ${esc(rs)} · ${s.done}/${s.total} quests · ${s.xp} XP</p>
    ${t.desc ? `<p>${esc(t.desc)}</p>` : ""}
  </header>
  ${edit ? `<div class="edit-banner">Edit mode: add, rename, reorder, or delete anything. Skills unlock top to bottom within each branch.</div>
    <div class="btnrow"><button class="tool" type="button" data-action="edit-tree">Edit tree</button><button class="tool del" type="button" data-action="del-tree">Delete tree</button></div>`
    : `<div class="map-bar"><div class="seg" role="group" aria-label="View"><button type="button" data-action="mode-map" aria-pressed="false">Map</button><button type="button" class="on" aria-pressed="true">List</button></div></div>
       <div class="legend"><span style="--c:var(--locked)">Locked</span><span style="--c:var(--accent)">Unlocked</span><span style="--c:var(--done)">Cleared</span></div>`}
  <div class="${edit ? "edit" : ""}" style="display:flex;flex-direction:column;gap:18px">
    ${branches}
    ${edit ? `<button class="add-row" type="button" data-action="add-branch" style="padding:12px">+ Add branch</button>` : ""}
  </div>
  ${cap}`;
}

function settingsView() {
  return `
  <div class="topbar"><button class="iconbtn" type="button" data-action="home">← Home</button><h1>Settings</h1></div>
  <section class="card">
    <h2>Sync across devices</h2>
    ${!syncConfigured()
      ? `<p>Syncing isn't set up yet. Add your Supabase project details to config.js.</p>`
      : session
      ? `<p>Signed in as <b style="color:var(--text)">${esc(session.user.email)}</b>. Status: <span id="acct-status">${STATUS_TEXT[syncStatus]}</span></p>
         <div class="btnrow"><button class="btn" type="button" data-action="sync-now">Sync now</button><button class="btn ghost" type="button" data-action="sign-out">Sign out</button></div>`
      : `<p>Sign in with the same account on your phone and iPad to share progress.</p>
         <div class="field"><label for="acct-email">Email</label><input id="acct-email" type="email" autocomplete="email" inputmode="email"></div>
         <div class="field"><label for="acct-pass">Password</label><input id="acct-pass" type="password" autocomplete="current-password" minlength="6"></div>
         <div class="btnrow"><button class="btn" type="button" data-action="sign-in">Sign in</button><button class="btn ghost" type="button" data-action="sign-up">Create account</button></div>`}
    ${acctMsg ? `<p style="color:var(--gold)">${esc(acctMsg)}</p>` : ""}
  </section>
  ${notificationsCard()}
  <section class="card">
    <h2>Back up your progress</h2>
    <p>${session ? "Syncing keeps your data in your account, but an extra backup never hurts." : "Without syncing, your data lives only on this device. Copy a backup now and then and keep it somewhere safe."}</p>
    <div class="btnrow">
      <button class="btn" type="button" data-action="export-copy">Copy backup</button>
      <button class="btn ghost" type="button" data-action="export-file">Download backup file</button>
    </div>
  </section>
  <section class="card">
    <h2>Restore or move devices</h2>
    <p>Paste a backup to load it here. This replaces everything on this device.</p>
    <div class="btnrow">
      <button class="btn ghost" type="button" data-action="import-paste">Paste backup</button>
      <label class="btn ghost" for="import-file" style="display:inline-block">Choose backup file</label>
      <input type="file" id="import-file" accept="application/json,.json" hidden>
    </div>
  </section>
  <section class="card">
    <h2>Daily Discipline</h2>
    <p>One area per weekday. The task rotates each week through that day's list.</p>
    <div class="sheet-list">${orderedAreas().map((a) => `<button type="button" class="sheet-row" data-action="edit-area" data-id="${a.id}"><b class="r open">${DAY_NAMES[a.day].slice(0, 3)}</b><span>${esc(a.name)} <small style="color:var(--muted)">(${esc(a.stat)})</small></span><span class="state open">${a.tasks.length} tasks</span></button>`).join("")}</div>
  </section>
  <section class="card">
    <h2>Add the Product Owner tree again</h2>
    <p>Adds a fresh copy of the starter tree, if you deleted it or want a clean run.</p>
    <div class="btnrow"><button class="btn ghost" type="button" data-action="reseed">Add starter tree</button></div>
  </section>
  <section class="card">
    <h2>Reset everything</h2>
    <p>Erases all trees, progress, and your streak${session ? " on every synced device" : " on this device"}.</p>
    <div class="btnrow"><button class="btn danger" type="button" data-action="reset">Reset all data</button></div>
  </section>
  <p class="foot">Skill Tree v2.0</p>`;
}

function render() {
  const app = document.getElementById("app");
  if (ui.view === "tree" && !getTree(ui.treeId)) ui.view = "home";
  const oldWrap = document.getElementById("map-wrap");
  const keep = oldWrap && !ui.recenter ? { l: oldWrap.scrollLeft, t: oldWrap.scrollTop } : null;
  app.innerHTML = ui.view === "tree" ? treeView(getTree(ui.treeId)) : ui.view === "settings" ? settingsView() : ui.view === "today" ? todayView() : ui.view === "area" && state.disciplines.areas.find((a) => a.id === ui.areaId) ? areaView(state.disciplines.areas.find((a) => a.id === ui.areaId)) : ui.view === "journal" ? journalView() : ui.view === "calendar" ? calendarView() : ui.view === "trees" ? treesView() : homeView();
  app.classList.toggle("wide", !!document.getElementById("map-wrap") || ui.view === "calendar");
  const wrap = document.getElementById("map-wrap");
  if (wrap) {
    if (keep) { wrap.scrollLeft = keep.l; wrap.scrollTop = keep.t; }
    else requestAnimationFrame(() => { wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2; wrap.scrollTop = (wrap.scrollHeight - wrap.clientHeight) / 2; });
    bindPinch(wrap);
  }
  ui.recenter = false;
  renderTabbar();
  renderSheet();
}
const TAB_OF = { home: "home", area: "home", journal: "home", settings: "home", today: "today", calendar: "calendar", trees: "trees", tree: "trees" };
function renderTabbar() {
  const bar = document.getElementById("tabbar"); if (!bar) return;
  const cur = TAB_OF[ui.view] || "home";
  const pri = sideBuckets().dueCount;
  const tab = (key, label, icon, badge) => `<button type="button" class="tab ${cur === key ? "on" : ""}" data-action="tab" data-id="${key}" aria-current="${cur === key ? "page" : "false"}">${iconHtml(icon, 22)}${badge ? `<span class="badge">${badge}</span>` : ""}<span>${label}</span></button>`;
  bar.innerHTML = `${tab("home", "Home", "home")}${tab("today", "Today", "sun", pri)}
    <button type="button" class="tab-add" data-action="new-side" aria-label="New side quest"><span>${iconHtml("plus", 26)}</span></button>
    ${tab("calendar", "Calendar", "calendar")}${tab("trees", "Trees", "tree")}`;
}

/* pinch to zoom on the map (two fingers), keeping the point between them in place */
function setZoom(z, wrap, fx, fy) {
  const svg = wrap.querySelector("svg.map"); if (!svg) return;
  const size = +svg.dataset.size, old = svg.getBoundingClientRect().width / size;
  z = Math.max(0.3, Math.min(2.2, z));
  const cx = (wrap.scrollLeft + fx) / old, cy = (wrap.scrollTop + fy) / old;
  svg.setAttribute("width", Math.round(size * z)); svg.setAttribute("height", Math.round(size * z));
  wrap.scrollLeft = cx * z - fx; wrap.scrollTop = cy * z - fy;
  ui.zoom = z;
}
function bindPinch(wrap) {
  let d0 = 0, z0 = 1;
  const dist = (e) => Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
  const mid = (e) => { const r = wrap.getBoundingClientRect(); return [(e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top]; };
  wrap.addEventListener("touchstart", (e) => {
    if (e.touches.length === 2) { d0 = dist(e); const svg = wrap.querySelector("svg.map"); z0 = svg.getBoundingClientRect().width / +svg.dataset.size; }
  }, { passive: true });
  wrap.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2 && d0) { e.preventDefault(); const [fx, fy] = mid(e); setZoom(z0 * dist(e) / d0, wrap, fx, fy); }
  }, { passive: false });
  wrap.addEventListener("touchend", (e) => { if (e.touches.length < 2) d0 = 0; }, { passive: true });
}

/* ---------- edit helpers ---------- */
const rankOptions = RANKS.map((r) => ({ value: r, label: `${r}-Rank (+${RANK_XP[r]} XP per quest)` }));
function move(arr, item, dir) {
  const i = arr.indexOf(item), j = i + dir;
  if (j < 0 || j >= arr.length) return;
  [arr[i], arr[j]] = [arr[j], arr[i]];
}
function confirmDel(what, onYes) {
  openModal({ title: `Delete ${what}?`, text: "This can't be undone.", confirm: "Delete", danger: true, onSubmit: onYes });
}
function importData(text) {
  try {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.trees)) throw new Error();
    state = normalize(data);
    save(); ui.view = "home"; render(); toast("Backup restored");
  } catch (e) { toast("That doesn't look like a Skill Tree backup"); }
}

/* ---------- events ---------- */
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-action]");
  if (!el) return;
  const a = el.dataset.action, id = el.dataset.id, dir = +el.dataset.dir;
  const t = getTree(ui.treeId);

  switch (a) {
    case "modal-bg": if (e.target === el) closeModal(); return;
    case "modal-close": closeModal(); return;
    case "home": ui.view = "home"; ui.edit = false; break;
    case "settings": ui.view = "settings"; pushRefresh(); break;
    case "today": ui.view = "today"; ui.sheet = null; window.scrollTo(0, 0); break;
    case "disc-done": {
      const d = discFor(); if (!d || d.entry) return;
      const before = levelFor(totalXP());
      state.disciplines.log[d.key] = { areaId: d.area.id, stat: d.area.stat, text: d.text, at: Date.now() };
      toast(`+1 ${d.area.stat} · +${DISC_XP} XP`);
      const after = levelFor(totalXP());
      if (after > before) setTimeout(() => toast(`LEVEL UP! You are now Level ${after}`), 1000);
      break;
    }
    case "tab": ui.view = id; ui.sheet = null; ui.edit = false; if (id === "calendar") { ui.calDay = ui.calDay || today(); } window.scrollTo(0, 0); break;
    case "trees": ui.view = "trees"; ui.edit = false; break;
    case "new-side": openSideForm(null); return;
    case "new-side-on": openSideForm(null, id); return;
    case "sheet-side": ui.sheet = { type: "side", id }; renderSheet(); return;
    case "side-done": { const q = state.sideQuests.find((x) => x.id === id); if (q) completeSide(q); break; }
    case "side-undo": { const q = state.sideQuests.find((x) => x.id === id); if (q) uncompleteSide(q); break; }
    case "side-edit": { const q = state.sideQuests.find((x) => x.id === id); if (q) openSideForm(q); return; }
    case "side-skip": {
      const q = state.sideQuests.find((x) => x.id === id); if (!q) return;
      const n = spawnNext(q); state.sideQuests = state.sideQuests.filter((x) => x !== q);
      ui.sheet = n ? { type: "side", id: n.id } : null; toast(n ? `Skipped · next ${fmtDue(n.dueAt)}` : "Skipped"); break;
    }
    case "side-del": {
      const q = state.sideQuests.find((x) => x.id === id); if (!q) return;
      confirmDel(`"${q.title}"${q.repeat ? " (and stop repeating)" : ""}`, () => { state.sideQuests = state.sideQuests.filter((x) => x !== q); });
      return;
    }
    case "cal-day": ui.calDay = id; if (ui.calMode === "month" && !e.target.closest(".cal-side")) ui.calMode = "day"; break;
    case "cal-mode": ui.calMode = id; break;
    case "cal-week": { const d = new Date(`${ui.calDay || today()}T12:00`); d.setDate(d.getDate() + 7 * dir); ui.calDay = dayKey(d); ui.calMonth = `${d.getFullYear()}-${d.getMonth()}`; break; }
    case "ev-new-at": openEventForm(null, id, el.dataset.start); return;
    case "sheet-ev": ui.sheet = { type: "ev", id, day: el.dataset.day }; renderSheet(); return;
    case "ev-done": case "ev-undo": { const ev = state.events.find((x) => x.id === id); if (!ev || !toggleEvent(ev, el.dataset.day, a === "ev-done")) return; break; }
    case "ev-edit": { const ev = state.events.find((x) => x.id === id); if (ev) { ui.sheet = null; openEventForm(ev); } return; }
    case "ev-skip": { const ev = state.events.find((x) => x.id === id); if (ev) { (ev.skips ||= []).push(el.dataset.day); ui.sheet = null; toast("Skipped for this day"); } break; }
    case "ev-del": { const ev = state.events.find((x) => x.id === id); if (!ev) return; confirmDel(`"${ev.title}"${ev.repeat ? " and all its repeats" : ""}`, () => { state.events = state.events.filter((x) => x !== ev); }); return; }
    case "cal-prev": case "cal-next": {
      const now = new Date(); const [Y, M] = (ui.calMonth || `${now.getFullYear()}-${now.getMonth()}`).split("-").map(Number);
      const d = new Date(Y, M + (a === "cal-next" ? 1 : -1), 1); ui.calMonth = `${d.getFullYear()}-${d.getMonth()}`; break;
    }
    case "cal-today": { const now = new Date(); ui.calMonth = `${now.getFullYear()}-${now.getMonth()}`; ui.calDay = today(); break; }
    case "open-area": ui.areaBack = ui.view === "today" ? "today" : ui.view === "journal" ? "journal" : "home"; ui.view = "area"; ui.areaId = id; ui.pendingDel = null; window.scrollTo(0, 0); break;
    case "journal": ui.view = "journal"; window.scrollTo(0, 0); break;
    case "jfilter": ui.jFilter = id; break;
    case "del-area-note": {
      const nid = el.dataset.note;
      if (ui.pendingDel !== nid) { ui.pendingDel = nid; render(); setTimeout(() => { if (ui.pendingDel === nid) { ui.pendingDel = null; render(); } }, 3000); return; }
      const a = state.disciplines.areas.find((x) => x.id === id);
      if (a) a.notes = (a.notes || []).filter((n) => n.id !== nid);
      ui.pendingDel = null; break;
    }
    case "disc-undo": delete state.disciplines.log[today()]; break;
    case "disc-swap": { const d = discFor(); if (!d || d.entry) return; state.disciplines.swaps = { [d.key]: (d.idx + 1) % d.area.tasks.length }; break; }
    case "edit-area": {
      const a = state.disciplines.areas.find((x) => x.id === id); if (!a) return;
      openModal({ title: `${DAY_NAMES[a.day]} discipline`, text: "One task per line. The app rotates through them week by week.",
        fields: [{ id: "name", label: "Area", value: a.name, required: true }, { id: "stat", label: "Stat abbreviation (up to 4 letters)", value: a.stat },
          { id: "icon", label: "Icon", type: "select", value: a.icon || "", options: iconOptions() }, { id: "tasks", label: "Tasks", type: "textarea", value: a.tasks.join("\n") }],
        onSubmit: (v) => {
          if (v.name) a.name = v.name;
          if (v.stat) a.stat = v.stat.toUpperCase().slice(0, 4);
          a.icon = v.icon;
          const tasks = (v.tasks || "").split("\n").map((x) => x.trim()).filter(Boolean);
          if (tasks.length) a.tasks = tasks;
        } });
      return;
    }
    case "pin": { const { quest } = findQuest(id); if (quest) { quest.pinned = !quest.pinned; if (quest.pinned) toast("Pinned to Focus"); } break; }
    case "del-step": {
      const nid = el.dataset.note;
      if (ui.pendingDel !== nid) { ui.pendingDel = nid; render(); setTimeout(() => { if (ui.pendingDel === nid) { ui.pendingDel = null; render(); } }, 3000); return; }
      const q = state.sideQuests.find((x) => x.id === id); if (q) q.checklist = stepsOf(q).filter((x) => x.id !== nid);
      ui.pendingDel = null; break;
    }
    case "new-backlog": openSideForm(null, null, true); return;
    case "open-tree": ui.view = "tree"; ui.treeId = id; ui.edit = false; ui.zoom = null; ui.recenter = true; window.scrollTo(0, 0); break;
    case "toggle-edit": ui.edit = !ui.edit; ui.sheet = null; ui.recenter = true; break;
    case "mode-list": ui.mode = "list"; ui.sheet = null; break;
    case "toggle-notes": ui.notesOpen[id] = !ui.notesOpen[id]; ui.pendingDel = null; render(); if (ui.notesOpen[id]) document.getElementById(`nt-${id}`)?.focus({ preventScroll: true }); return;
    case "del-note": {
      const nid = el.dataset.note;
      if (ui.pendingDel !== nid) { ui.pendingDel = nid; render(); setTimeout(() => { if (ui.pendingDel === nid) { ui.pendingDel = null; render(); } }, 3000); return; }
      const { quest } = findQuest(id);
      if (quest) quest.notes = (quest.notes || []).filter((n) => n.id !== nid);
      ui.pendingDel = null; break;
    }
    case "mode-map": ui.mode = "map"; ui.recenter = true; break;
    case "sheet-node": ui.sheet = { type: "node", id }; renderSheet(); return;
    case "sheet-branch": ui.sheet = { type: "branch", id }; renderSheet(); return;
    case "sheet-hub": ui.sheet = { type: "hub" }; renderSheet(); return;
    case "sheet-close": if (e.target === el || el.classList.contains("sheet-x")) { ui.sheet = null; renderSheet(); } return;
    case "zoom": {
      const wrap = document.getElementById("map-wrap"); if (!wrap) return;
      const svg = wrap.querySelector("svg.map"), cur = svg.getBoundingClientRect().width / +svg.dataset.size;
      setZoom(cur * (dir > 0 ? 1.25 : 0.8), wrap, wrap.clientWidth / 2, wrap.clientHeight / 2); return;
    }
    case "zoom-fit": {
      const wrap = document.getElementById("map-wrap"); if (!wrap) return;
      const svg = wrap.querySelector("svg.map");
      setZoom(Math.min(wrap.clientWidth, wrap.clientHeight) / +svg.dataset.size, wrap, wrap.clientWidth / 2, wrap.clientHeight / 2);
      requestAnimationFrame(() => { wrap.scrollLeft = (wrap.scrollWidth - wrap.clientWidth) / 2; wrap.scrollTop = (wrap.scrollHeight - wrap.clientHeight) / 2; });
      return;
    }
    case "toggle-node": {
      if (ui.edit) return;
      const { branch, node } = find(t, "node", id);
      const i = branch.nodes.indexOf(node);
      const cur = ui.expanded[id] ?? (nodeOpen(branch, i) && !nodeDone(node));
      ui.expanded[id] = !cur; break;
    }
    case "daily":
      if (!state.days.includes(today())) { state.days.push(today()); save(); toast(`Daily quest complete. Streak: ${streak()}`); }
      break;

    case "add-tree":
      openModal({ title: "New skill tree", text: "A subject you want to level up in, like Investing or Data Analysis.",
        fields: [{ id: "name", label: "Name", required: true, placeholder: "e.g. Investing" }, { id: "desc", label: "Goal (optional)", placeholder: "What does mastery look like?" }, { id: "icon", label: "Icon", type: "select", value: "", options: iconOptions() }],
        confirm: "Create", onSubmit: (v) => {
          if (!v.name) return;
          const nt = { id: uid(), name: v.name, desc: v.desc, icon: v.icon || "", capstone: { text: "", done: false }, branches: [] };
          state.trees.push(nt); ui.view = "tree"; ui.treeId = nt.id; ui.edit = true;
        } });
      return;
    case "edit-tree":
      openModal({ title: "Edit tree", fields: [{ id: "name", label: "Name", value: t.name, required: true }, { id: "desc", label: "Goal", value: t.desc }, { id: "icon", label: "Icon", type: "select", value: t.icon || "", options: iconOptions() }],
        onSubmit: (v) => { if (v.name) t.name = v.name; t.desc = v.desc; t.icon = v.icon; } });
      return;
    case "del-tree":
      confirmDel(`"${t.name}" and all its progress`, () => { state.trees = state.trees.filter((x) => x !== t); ui.view = "home"; ui.edit = false; });
      return;

    case "add-branch":
      openModal({ title: "New branch", text: "A major area within this subject.", fields: [{ id: "name", label: "Name", required: true }, { id: "desc", label: "Description (optional)" }, { id: "icon", label: "Icon", type: "select", value: "", options: iconOptions() }],
        confirm: "Add", onSubmit: (v) => { if (v.name) t.branches.push({ id: uid(), name: v.name, desc: v.desc, icon: v.icon || "", nodes: [] }); } });
      return;
    case "edit-branch": {
      const { branch } = find(t, "branch", id);
      openModal({ title: "Edit branch", fields: [{ id: "name", label: "Name", value: branch.name, required: true }, { id: "desc", label: "Description", value: branch.desc }, { id: "icon", label: "Icon", type: "select", value: branch.icon || "", options: iconOptions() }],
        onSubmit: (v) => { if (v.name) branch.name = v.name; branch.desc = v.desc; branch.icon = v.icon; } });
      return;
    }
    case "del-branch": {
      const { branch } = find(t, "branch", id);
      confirmDel(`branch "${branch.name}"`, () => { t.branches = t.branches.filter((x) => x !== branch); });
      return;
    }
    case "move-branch": { const { branch } = find(t, "branch", id); move(t.branches, branch, dir); break; }

    case "add-node": {
      const { branch } = find(t, "branch", id);
      const nextRank = RANKS[Math.min(RANKS.length - 2, branch.nodes.length * 2)] || "E";
      openModal({ title: `New skill in ${branch.name}`, text: "Skills unlock in order. Each needs at least one quest.",
        fields: [{ id: "name", label: "Skill name", required: true }, { id: "rank", label: "Rank", type: "select", value: nextRank, options: rankOptions },
          { id: "quests", label: "Quests (one per line, optional)", type: "textarea", placeholder: "Read chapter 1\nTry it at work once" }],
        confirm: "Add", onSubmit: (v) => {
          if (!v.name) return;
          const quests = (v.quests || "").split("\n").map((s) => s.trim()).filter(Boolean).map((text) => ({ id: uid(), text, done: false }));
          branch.nodes.push({ id: uid(), name: v.name, rank: v.rank, quests });
        } });
      return;
    }
    case "edit-node": {
      const { node } = find(t, "node", id);
      openModal({ title: "Edit skill", fields: [{ id: "name", label: "Skill name", value: node.name, required: true }, { id: "rank", label: "Rank", type: "select", value: node.rank, options: rankOptions }],
        onSubmit: (v) => { if (v.name) node.name = v.name; node.rank = v.rank; } });
      return;
    }
    case "del-node": {
      const { branch, node } = find(t, "node", id);
      confirmDel(`skill "${node.name}"`, () => { branch.nodes = branch.nodes.filter((x) => x !== node); });
      return;
    }
    case "move-node": { const { branch, node } = find(t, "node", id); move(branch.nodes, node, dir); break; }

    case "add-quest": {
      const { node } = find(t, "node", id);
      openModal({ title: `New quest for ${node.name}`, text: "Make it something you can finish and check off.",
        fields: [{ id: "text", label: "Quest", type: "textarea", placeholder: "One per line to add several" }],
        confirm: "Add", onSubmit: (v) => { (v.text || "").split("\n").map((s) => s.trim()).filter(Boolean).forEach((text) => node.quests.push({ id: uid(), text, done: false })); } });
      return;
    }
    case "edit-quest": {
      const { quest } = find(t, "quest", id);
      openModal({ title: "Edit quest", fields: [{ id: "text", label: "Quest", value: quest.text, required: true }], onSubmit: (v) => { if (v.text) quest.text = v.text; } });
      return;
    }
    case "del-quest": {
      const { node, quest } = find(t, "quest", id);
      node.quests = node.quests.filter((x) => x !== quest); break;
    }
    case "move-quest": { const { node, quest } = find(t, "quest", id); move(node.quests, quest, dir); break; }
    case "edit-capstone":
      openModal({ title: "Capstone quest", text: "The final challenge. It unlocks when every skill in the tree is cleared.",
        fields: [{ id: "text", label: "Capstone", type: "textarea", value: t.capstone.text }], onSubmit: (v) => { t.capstone.text = v.text; if (!v.text) t.capstone.done = false; } });
      return;

    case "export-copy": {
      const data = JSON.stringify(state);
      navigator.clipboard.writeText(data).then(() => toast("Backup copied. Paste it somewhere safe."), () => {
        openModal({ title: "Copy your backup", text: "Select all of this text and copy it.", fields: [{ id: "data", label: "Backup", type: "textarea", value: data }], confirm: "Done", onSubmit: () => {} });
      });
      return;
    }
    case "export-file": {
      try {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob); link.download = `skill-tree-backup-${today()}.json`;
        document.body.appendChild(link); link.click(); link.remove();
      } catch (err) { toast("Download isn't available here. Use Copy backup."); }
      return;
    }
    case "import-paste":
      openModal({ title: "Paste backup", text: "This replaces everything on this device.", fields: [{ id: "data", label: "Backup text", type: "textarea" }],
        confirm: "Restore", danger: true, onSubmit: (v) => importData(v.data) });
      return;
    case "sign-in": accountAction("in"); return;
    case "sign-up": accountAction("up"); return;
    case "sign-out": accountAction("out"); return;
    case "sync-now": pull(); return;
    case "push-on": pushEnable(); return;
    case "push-off": pushDisable(); return;
    case "push-test": pushTest(); return;
    case "push-hour": pushToggleHour(+id); return;
    case "reseed": state.trees.push(seedPO()); toast("Product Owner tree added"); ui.view = "home"; break;
    case "reset":
      openModal({ title: "Reset everything?", text: "All trees, progress, and your streak will be erased from this device.", confirm: "Reset", danger: true,
        onSubmit: () => { state = freshState(); ui.view = "home"; } });
      return;
    default: return;
  }
  save(); render();
});

document.addEventListener("change", (e) => {
  const el = e.target;
  if (el.id === "import-file" && el.files[0]) {
    el.files[0].text().then(importData); return;
  }
  if (el.dataset.quest) return onQuestToggle(el.dataset.quest, el.checked);
  if (el.dataset.ev) {
    const ev = state.events.find((x) => x.id === el.dataset.ev);
    if (ev && toggleEvent(ev, el.dataset.day, el.checked)) save(); else el.checked = !el.checked;
    render(); return;
  }
  if (el.dataset.step) {
    const q = state.sideQuests.find((x) => x.id === el.dataset.q), c = q && stepsOf(q).find((x) => x.id === el.dataset.step);
    if (c) { c.done = el.checked; save(); render(); if (el.checked && stepsOf(q).every((x) => x.done) && !q.done) toast("All steps done · complete the quest to claim XP"); }
    return;
  }
  if (el.dataset.side) {
    const q = state.sideQuests.find((x) => x.id === el.dataset.side);
    if (q) { el.checked ? completeSide(q) : uncompleteSide(q); save(); render(); }
    return;
  }
  const t = getTree(ui.treeId);
  if (!t) return;
  if (el.dataset.action === "capstone") {
    t.capstone.done = el.checked; save();
    if (el.checked) toast(`S-RANK ACHIEVED: ${t.name}`);
    render(); return;
  }
});

function onQuestToggle(qid, checked) {
  const { branch, node, quest } = findQuest(qid);
  if (!quest) return;
  const before = levelFor(totalXP());
  quest.done = checked;
  if (checked) quest.completedAt = Date.now(); else delete quest.completedAt;
  if (checked && nodeDone(node)) {
    ui.expanded[node.id] = false;
    const next = branch.nodes[branch.nodes.indexOf(node) + 1];
    if (next) { ui.expanded[next.id] = true; toast(`Skill cleared: ${node.name}. ${next.name} unlocked`); }
    else toast(`Branch mastered: ${branch.name}`);
  }
  save();
  const after = levelFor(totalXP());
  if (after > before) setTimeout(() => toast(`LEVEL UP! You are now Level ${after}`), 900);
  render();
}

/* ---------- push notifications ---------- */
const PUSH_HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const hourLabel = (h) => `${((h + 11) % 12) + 1}${h < 12 ? "am" : "pm"}`;
const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const pushSt = { sub: null, row: null, checked: false, busy: false, msg: "" };
function b64ToBytes(b64) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4), raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
async function pushRefresh() {
  pushSt.checked = true;
  try {
    if (pushSupported()) { const reg = await navigator.serviceWorker.ready; pushSt.sub = await reg.pushManager.getSubscription(); }
    if (pushSt.sub && sb && session) {
      const { data } = await sb.from("push_subs").select("id,times,enabled").eq("endpoint", pushSt.sub.endpoint).maybeSingle();
      pushSt.row = data || null;
    } else pushSt.row = null;
  } catch (e) { pushSt.row = null; }
  if (ui.view === "settings") render();
}
async function pushEnable() {
  if (!sb || !session) { pushSt.msg = "Sign in first so the System knows your progress."; return render(); }
  if (!CFG.vapidPublicKey) { pushSt.msg = "Notifications aren't configured yet."; return render(); }
  pushSt.busy = true; pushSt.msg = ""; render();
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") throw new Error("Notifications are blocked. Turn them on for Skill Tree in your device's Settings → Notifications, then try again.");
    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(CFG.vapidPublicKey) }));
    const j = sub.toJSON();
    const { error } = await sb.from("push_subs").upsert({
      user_id: session.user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Chicago", enabled: true,
      times: pushSt.row?.times || [8, 12, 15, 18],
    }, { onConflict: "endpoint" });
    if (error) throw error;
    pushSt.sub = sub; pushSt.msg = "Notifications are on for this device.";
    await pushRefresh();
  } catch (e) { pushSt.msg = String(e.message || e); }
  pushSt.busy = false; render();
}
async function pushDisable() {
  pushSt.busy = true; render();
  try {
    if (pushSt.sub) { if (sb && session) await sb.from("push_subs").delete().eq("endpoint", pushSt.sub.endpoint); await pushSt.sub.unsubscribe(); }
    pushSt.sub = null; pushSt.row = null; pushSt.msg = "Notifications are off for this device.";
  } catch (e) { pushSt.msg = String(e.message || e); }
  pushSt.busy = false; render();
}
async function pushToggleHour(h) {
  if (!pushSt.row) return;
  const set = new Set(pushSt.row.times || []);
  set.has(h) ? set.delete(h) : set.add(h);
  const times = [...set].sort((a, b) => a - b);
  if (!times.length) { toast("Keep at least one alert time"); return; }
  pushSt.row.times = times; render();
  const { error } = await sb.from("push_subs").update({ times, tz: Intl.DateTimeFormat().resolvedOptions().timeZone }).eq("endpoint", pushSt.sub.endpoint);
  if (error) toast("Couldn't save times. Check your connection.");
}
async function pushTest() {
  pushSt.busy = true; pushSt.msg = ""; render();
  try {
    const { data, error } = await sb.functions.invoke("Notify", { body: { test: true } });
    if (error) throw error;
    pushSt.msg = data && data.sent ? "Test sent. It should arrive in a few seconds." : "The System couldn't reach this device. Try turning notifications off and on.";
  } catch (e) {
    let detail = e && e.message ? e.message : String(e);
    try {
      const ctx = e && e.context;
      if (ctx && typeof ctx.status === "number") {
        let txt = ""; try { txt = await ctx.text(); } catch (_) {}
        detail = `HTTP ${ctx.status}${txt ? ": " + txt.slice(0, 200) : ""}`;
      }
    } catch (_) {}
    pushSt.msg = `Test failed (${detail}). ${/404/.test(detail) ? "The function isn't deployed or isn't named notify." : /401/.test(detail) ? "JWT verification is still on." : /Failed to send|fetch|CORS|NetworkError|Load failed/i.test(detail) ? "Couldn't reach the function. Check that it's deployed and JWT verification is off." : "Check the function's Logs in Supabase."}`;
  }
  pushSt.busy = false; render();
}
function notificationsCard() {
  let body;
  if (!pushSupported() && !isStandalone()) body = `<p>On iPhone and iPad, notifications only work from the home-screen app. In Safari, tap Share → <b style="color:var(--text)">Add to Home Screen</b>, then open Skill Tree from that icon.</p>`;
  else if (!pushSupported()) body = `<p>This device doesn't support web notifications. iPhone and iPad need iOS 16.4 or newer.</p>`;
  else if (!session) body = `<p>Sign in above first. The System checks your synced progress before it alerts you.</p>`;
  else if (!pushSt.checked) body = `<p>Checking…</p>`;
  else if (!pushSt.sub || !pushSt.row) body = `
    <p>Get System alerts at the hours you choose. They only fire when your Daily Discipline or focus block is still incomplete, and tell you exactly what's left.</p>
    <div class="btnrow"><button class="btn" type="button" data-action="push-on" ${pushSt.busy ? "disabled" : ""}>Enable notifications</button></div>`;
  else body = `
    <p>On for this device. Tap hours to choose when the System checks in.</p>
    <div class="hours">${PUSH_HOURS.map((h) => `<button type="button" class="hour ${pushSt.row.times.includes(h) ? "on" : ""}" data-action="push-hour" data-id="${h}" aria-pressed="${pushSt.row.times.includes(h)}">${hourLabel(h)}</button>`).join("")}</div>
    <p style="font-size:12.5px">First alert: Daily Quest arrives · Middle: status checks and warnings · Last: final notice before the day resets.</p>
    <div class="btnrow"><button class="btn" type="button" data-action="push-test" ${pushSt.busy ? "disabled" : ""}>Send test</button><button class="btn ghost" type="button" data-action="push-off" ${pushSt.busy ? "disabled" : ""}>Turn off</button></div>`;
  return `<section class="card"><h2>Notifications</h2>${body}${pushSt.msg ? `<p style="color:var(--gold)">${esc(pushSt.msg)}</p>` : ""}</section>`;
}

/* ---------- offline support ---------- */
if ("serviceWorker" in navigator && location.protocol === "https:") {
  try { navigator.serviceWorker.register("sw.js").catch(() => {}); } catch (e) {}
}

render();
initSync();
setInterval(() => {
  const ae = document.activeElement;
  if (ae && (ae.tagName === "TEXTAREA" || ae.tagName === "INPUT" || ae.tagName === "SELECT")) return;
  if (document.querySelector("#modal .modal")) return;
  if (["today", "calendar", "home"].includes(ui.view)) render();
}, 60000);
