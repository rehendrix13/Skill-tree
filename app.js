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
function freshState() { return { version: 1, trees: [seedPO()], days: [], updatedAt: 0 }; }
function normalize(s) { return { version: 1, days: [], updatedAt: 0, ...s, trees: Array.isArray(s.trees) ? s.trees : [] }; }
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
    if (evt === "SIGNED_IN" && !had) { acctMsg = ""; pull(); render(); }
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

const ui = { view: "home", treeId: null, edit: false, expanded: {} };

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
const totalXP = () => state.trees.reduce((a, t) => a + treeStats(t).xp, 0);
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
      ${fields.map((f) => `
        <div class="field">
          <label for="f-${f.id}">${esc(f.label)}</label>
          ${f.type === "textarea"
            ? `<textarea id="f-${f.id}" name="${f.id}" placeholder="${esc(f.placeholder || "")}">${esc(f.value || "")}</textarea>`
            : f.type === "select"
            ? `<select id="f-${f.id}" name="${f.id}">${f.options.map((o) => `<option value="${esc(o.value)}" ${o.value === f.value ? "selected" : ""}>${esc(o.label)}</option>`).join("")}</select>`
            : `<input id="f-${f.id}" name="${f.id}" type="text" value="${esc(f.value || "")}" placeholder="${esc(f.placeholder || "")}" ${f.required ? "required" : ""}>`}
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
function closeModal() { document.getElementById("modal").innerHTML = ""; modalSubmit = null; }
document.addEventListener("submit", (e) => {
  if (e.target.id !== "modal-form") return;
  e.preventDefault();
  const vals = Object.fromEntries(new FormData(e.target).entries());
  for (const k in vals) vals[k] = vals[k].trim();
  const fn = modalSubmit; closeModal();
  if (fn) { fn(vals); save(); render(); }
});
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

/* ---------- views ---------- */
function statusWindow() {
  const xp = totalXP(), lvl = levelFor(xp), into = xp % XP_PER_LEVEL;
  const logged = state.days.includes(today());
  const quests = state.trees.reduce((a, t) => a + treeStats(t).done, 0);
  return `
  <section class="window" aria-label="Player status">
    <div class="sys-label">Status</div>
    <div class="status">
      <div class="lvl"><div class="t">LEVEL</div><div class="n">${lvl}</div></div>
      <div class="title">Player<small>${state.trees.length} skill tree${state.trees.length === 1 ? "" : "s"} · ${quests} quests cleared</small></div>
      <div class="bar" aria-hidden="true"><i style="width:${(into / XP_PER_LEVEL) * 100}%"></i></div>
      <div class="meta"><span>${xp} XP total</span><span>${XP_PER_LEVEL - into} XP to Lv ${lvl + 1}</span></div>
    </div>
    <div class="daily">
      <p>Daily quest: one 45-minute focus block, phone in another room.<br>Streak: <b>${streak()}</b> day${streak() === 1 ? "" : "s"}</p>
      <button class="btn" type="button" data-action="daily" ${logged ? "disabled" : ""}>${logged ? "Today's block logged" : "Log today's block"}</button>
    </div>
  </section>`;
}

function homeView() {
  return `
  <div class="topbar"><h1>Skill Tree</h1><div class="btnrow">${syncPill()}<button class="iconbtn" data-action="settings" type="button">Settings</button></div></div>
  ${statusWindow()}
  <div class="trees">
    ${state.trees.map((t) => {
      const s = treeStats(t), [r] = rankFor(t);
      return `
      <button class="tree-card" type="button" data-action="open-tree" data-id="${t.id}">
        <div class="row"><h2>${esc(t.name)}</h2><span class="rankpill">${r}-RANK</span></div>
        ${t.desc ? `<p>${esc(t.desc)}</p>` : `<p></p>`}
        <div class="bar"><i style="width:${s.pct * 100}%"></i></div>
        <div class="meta" style="margin-top:6px"><span>${s.done} / ${s.total} quests</span><span>${s.xp} / ${s.max} XP</span></div>
      </button>`;
    }).join("")}
    <button class="tree-card add-card" type="button" data-action="add-tree">+ New skill tree</button>
  </div>
  <p class="foot">${session ? "Progress syncs across your signed-in devices." : "Progress saves on this device. Sign in from Settings to sync."}</p>`;
}

function treeView(t) {
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
          <li><label for="q-${q.id}"><input type="checkbox" id="q-${q.id}" data-quest="${q.id}" ${q.done ? "checked" : ""}><span>${esc(q.text)}</span><em class="xp">+${RANK_XP[n.rank]} XP</em></label></li>`).join("")
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
      <div class="branch-head"><h2>${esc(b.name)}</h2><span class="pct">${bDone}/${bAll}</span></div>
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
    <button class="iconbtn" type="button" data-action="home">← Trees</button>
    <div class="btnrow">${syncPill()}<button class="iconbtn ${edit ? "on" : ""}" type="button" data-action="toggle-edit">${edit ? "Done editing" : "Edit"}</button></div>
  </div>
  <header class="tree-head">
    <h1 style="font-size:24px;color:#fff">${esc(t.name)}</h1>
    <p>${r}-Rank · ${esc(rs)} · ${s.done}/${s.total} quests · ${s.xp} XP</p>
    ${t.desc ? `<p>${esc(t.desc)}</p>` : ""}
  </header>
  ${edit ? `<div class="edit-banner">Edit mode: add, rename, reorder, or delete anything. Skills unlock top to bottom within each branch.</div>
    <div class="btnrow"><button class="tool" type="button" data-action="edit-tree">Rename tree</button><button class="tool del" type="button" data-action="del-tree">Delete tree</button></div>`
    : `<div class="legend"><span style="--c:var(--locked)">Locked</span><span style="--c:var(--accent)">Unlocked</span><span style="--c:var(--done)">Cleared</span></div>`}
  <div class="${edit ? "edit" : ""}" style="display:flex;flex-direction:column;gap:18px">
    ${branches}
    ${edit ? `<button class="add-row" type="button" data-action="add-branch" style="padding:12px">+ Add branch</button>` : ""}
  </div>
  ${cap}`;
}

function settingsView() {
  return `
  <div class="topbar"><button class="iconbtn" type="button" data-action="home">← Trees</button><h1>Settings</h1></div>
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
    <h2>Add the Product Owner tree again</h2>
    <p>Adds a fresh copy of the starter tree, if you deleted it or want a clean run.</p>
    <div class="btnrow"><button class="btn ghost" type="button" data-action="reseed">Add starter tree</button></div>
  </section>
  <section class="card">
    <h2>Reset everything</h2>
    <p>Erases all trees, progress, and your streak${session ? " on every synced device" : " on this device"}.</p>
    <div class="btnrow"><button class="btn danger" type="button" data-action="reset">Reset all data</button></div>
  </section>
  <p class="foot">Skill Tree v1.1</p>`;
}

function render() {
  const app = document.getElementById("app");
  if (ui.view === "tree" && !getTree(ui.treeId)) ui.view = "home";
  app.innerHTML = ui.view === "tree" ? treeView(getTree(ui.treeId)) : ui.view === "settings" ? settingsView() : homeView();
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
    case "settings": ui.view = "settings"; break;
    case "open-tree": ui.view = "tree"; ui.treeId = id; ui.edit = false; window.scrollTo(0, 0); break;
    case "toggle-edit": ui.edit = !ui.edit; break;
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
        fields: [{ id: "name", label: "Name", required: true, placeholder: "e.g. Investing" }, { id: "desc", label: "Goal (optional)", placeholder: "What does mastery look like?" }],
        confirm: "Create", onSubmit: (v) => {
          if (!v.name) return;
          const nt = { id: uid(), name: v.name, desc: v.desc, capstone: { text: "", done: false }, branches: [] };
          state.trees.push(nt); ui.view = "tree"; ui.treeId = nt.id; ui.edit = true;
        } });
      return;
    case "edit-tree":
      openModal({ title: "Rename tree", fields: [{ id: "name", label: "Name", value: t.name, required: true }, { id: "desc", label: "Goal", value: t.desc }],
        onSubmit: (v) => { if (v.name) t.name = v.name; t.desc = v.desc; } });
      return;
    case "del-tree":
      confirmDel(`"${t.name}" and all its progress`, () => { state.trees = state.trees.filter((x) => x !== t); ui.view = "home"; ui.edit = false; });
      return;

    case "add-branch":
      openModal({ title: "New branch", text: "A major area within this subject.", fields: [{ id: "name", label: "Name", required: true }, { id: "desc", label: "Description (optional)" }],
        confirm: "Add", onSubmit: (v) => { if (v.name) t.branches.push({ id: uid(), name: v.name, desc: v.desc, nodes: [] }); } });
      return;
    case "edit-branch": {
      const { branch } = find(t, "branch", id);
      openModal({ title: "Edit branch", fields: [{ id: "name", label: "Name", value: branch.name, required: true }, { id: "desc", label: "Description", value: branch.desc }],
        onSubmit: (v) => { if (v.name) branch.name = v.name; branch.desc = v.desc; } });
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
  const t = getTree(ui.treeId);
  if (!t) return;
  if (el.dataset.action === "capstone") {
    t.capstone.done = el.checked; save();
    if (el.checked) toast(`S-RANK ACHIEVED: ${t.name}`);
    render(); return;
  }
  if (!el.dataset.quest) return;
  const before = levelFor(totalXP());
  const { branch, node, quest } = find(t, "quest", el.dataset.quest);
  quest.done = el.checked;
  if (el.checked && nodeDone(node)) {
    ui.expanded[node.id] = false;
    const next = branch.nodes[branch.nodes.indexOf(node) + 1];
    if (next) { ui.expanded[next.id] = true; toast(`Skill cleared: ${node.name}. ${next.name} unlocked`); }
    else toast(`Branch mastered: ${branch.name}`);
  }
  save();
  const after = levelFor(totalXP());
  if (after > before) setTimeout(() => toast(`LEVEL UP! You are now Level ${after}`), 900);
  render();
});

/* ---------- offline support ---------- */
if ("serviceWorker" in navigator && location.protocol === "https:") {
  try { navigator.serviceWorker.register("sw.js").catch(() => {}); } catch (e) {}
}

render();
initSync();
