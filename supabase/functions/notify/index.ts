// Skill Tree notifications: runs every 15 minutes (via pg_cron) and sends
// game-style "System" alerts at each user's chosen hours, based on their progress.
// Deploy as an Edge Function named "notify" with JWT verification turned OFF.
// Secrets needed: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const APP_URL = "https://rehendrix13.github.io/Skill-tree/";
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };

webpush.setVapidDetails(APP_URL, Deno.env.get("VAPID_PUBLIC_KEY") ?? "", Deno.env.get("VAPID_PRIVATE_KEY") ?? "");

/* ---------- time helpers ---------- */
export function localParts(date, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short", hourCycle: "h23",
  }).formatToParts(date).map((p) => [p.type, p.value]));
  const y = +parts.year, m = +parts.month, d = +parts.day;
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { tz, y, m, d, h: +parts.hour % 24, min: +parts.minute, dow, key: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}` };
}
const keyFromUTC = (ms) => new Date(ms).toISOString().slice(0, 10);
// offset (ms) of a time zone at a given instant, so we can find a quest's local date
function tzOffsetMs(ms, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000;
}

/* ---------- message builder (mirrors the app's discipline logic) ---------- */
export function buildMessage(st, L, slot, times) {
  if (slot === "test") return { title: "[SYSTEM] Notifications online", body: "The System will now alert you, Player.", tag: "skilltree-test" };
  if (!st) return { title: "[SYSTEM] Daily Quest has arrived", body: "Open Skill Tree to see today's tasks.", tag: "skilltree-daily" };
  const disc = st.disciplines || { areas: [], log: {}, swaps: {} };
  const area = (disc.areas || []).find((a) => a.day === L.dow);
  const dayUTC = Date.UTC(L.y, L.m - 1, L.d);
  let task = null;
  if (area && area.tasks && area.tasks.length) {
    const wk = Math.floor((dayUTC / 86400000 + 3) / 7);
    task = area.tasks[((disc.swaps || {})[L.key] ?? wk) % area.tasks.length];
  }
  const discDone = !area || !!(disc.log || {})[L.key];
  const focusDone = (st.days || []).includes(L.key);
  // discipline streak through yesterday (what's at risk today)
  let streak = 0, cur = dayUTC - 86400000;
  while ((disc.log || {})[keyFromUTC(cur)]) { streak++; cur -= 86400000; }
  if (discDone && area) streak++;
  const remaining = [];
  if (!discDone) remaining.push(`${area.name}: ${task}`);
  if (!focusDone) remaining.push("45-min focus block");
  const total = (area ? 1 : 0) + 1, doneCount = total - remaining.length;
  let pinned = 0;
  (st.trees || []).forEach((t) => (t.branches || []).forEach((b) => (b.nodes || []).forEach((n) => (n.quests || []).forEach((q) => { if (q.pinned && !q.done) pinned++; }))));
  const pinNote = pinned ? ` ${pinned} pinned quest${pinned === 1 ? "" : "s"} waiting.` : "";

  const sideToday = ((st.sideQuests) || []).filter((q) => !q.done && q.dueAt && keyFromUTC(q.dueAt + tzOffsetMs(q.dueAt, L.tz)) === L.key).length;
  const sideNote = sideToday ? ` ${sideToday} side quest${sideToday === 1 ? "" : "s"} due today.` : "";
  if (!remaining.length) return slot === [...times].sort((a, b) => a - b)[0] && sideToday ? { title: "[SYSTEM] Side Quests due today", body: `You have ${sideToday} side quest${sideToday === 1 ? "" : "s"} due today. Check your Priority list.`, tag: "skilltree-daily" } : null;
  const sorted = [...times].sort((a, b) => a - b);
  const role = slot === sorted[0] ? "arrival" : slot === sorted[sorted.length - 1] ? "final" : slot < 15 ? "check" : "warning";
  const left = remaining.join(" · ");
  const risk = streak > 0 ? ` Your ${streak}-day streak is at risk.` : "";
  if (role === "arrival") {
    const lead = area && !discDone ? `${DAY_NAMES[L.dow]} · ${area.name}: ${task}` : left;
    return { title: "[SYSTEM] Daily Quest has arrived", body: `${lead}${!focusDone && area && !discDone ? " · Focus block pending." : ""}${sideNote}${pinNote}`, tag: "skilltree-daily" };
  }
  if (role === "check") return { title: `[SYSTEM] Status check: ${doneCount}/${total} Daily Quests complete`, body: `Remaining: ${left}.${pinNote}`, tag: "skilltree-daily" };
  if (role === "warning") return { title: "[SYSTEM] Warning: Daily Quest incomplete", body: `Remaining: ${left}.${risk}`, tag: "skilltree-daily" };
  return { title: "[SYSTEM] Final notice: The day resets at midnight", body: `Remaining: ${left}.${risk || " Complete it to begin a new streak."}`, tag: "skilltree-daily" };
}

/* ---------- side quest alerts: 4h, 1h, and at the due time ---------- */
const ALERTS = [["4h", 4 * 3600000], ["1h", 3600000], ["due", 0]];
const WINDOW = 20 * 60000; // fire if we're within 20 min after the alert time
export function sideAlertsDue(st, nowMs, tz) {
  const out = [];
  for (const q of (st && st.sideQuests) || []) {
    if (q.done || !q.dueAt) continue;
    for (const [kind, off] of ALERTS) {
      const fireAt = q.dueAt - off;
      if (off && q.createdAt && q.createdAt > fireAt) continue; // created inside this window: skip
      if (nowMs < fireAt || nowMs >= fireAt + WINDOW) continue;
      const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(new Date(q.dueAt));
      const xp = Math.round(({ E: 10, C: 20, A: 30, S: 50 }[q.rank] || 20) * 1.1);
      const msg = kind === "4h" ? { title: "[SYSTEM] Side Quest due in 4 hours", body: `${q.title} · due ${time}. Finish early for ${xp} XP.` }
        : kind === "1h" ? { title: "[SYSTEM] Warning: Side Quest due in 1 hour", body: `${q.title} · due ${time}. ${xp} XP is still on the table.` }
        : { title: "[SYSTEM] Side Quest deadline reached", body: `${q.title} is due now. Overdue quests earn no XP.` };
      out.push({ questId: q.id, kind, msg: { ...msg, tag: `side-${q.id}-${kind}` } });
    }
  }
  return out;
}

/* ---------- handler ---------- */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const db = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const body = await req.json().catch(() => ({}));
  const isCron = !!Deno.env.get("CRON_SECRET") && req.headers.get("x-cron-secret") === Deno.env.get("CRON_SECRET");
  let testUser = null;
  if (!isCron) {
    const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    const { data } = await db.auth.getUser(jwt);
    if (!body.test || !data?.user) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...CORS, "Content-Type": "application/json" } });
    testUser = data.user.id;
  }
  let q = db.from("push_subs").select("*").eq("enabled", true);
  if (testUser) q = q.eq("user_id", testUser);
  const { data: subs, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });

  const now = new Date(), states = new Map();
  let sent = 0, skipped = 0;
  for (const s of subs ?? []) {
    const L = localParts(now, s.tz || "America/Chicago");
    const times = (s.times && s.times.length ? s.times : [8, 12, 15, 18]).map(Number);
    let slot = testUser ? "test" : times.find((h) => h === L.h && L.min < 15);
    if (slot === undefined) continue;
    const slotKey = `${L.key}-${slot}`;
    if (!testUser && s.last_slot === slotKey) continue;
    if (!states.has(s.user_id)) {
      const { data } = await db.from("skill_state").select("data").eq("user_id", s.user_id).maybeSingle();
      states.set(s.user_id, data?.data ?? null);
    }
    const msg = buildMessage(states.get(s.user_id), L, slot, times);
    if (!testUser) await db.from("push_subs").update({ last_slot: slotKey }).eq("id", s.id);
    if (!msg) { skipped++; continue; }
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...msg, url: APP_URL }), { TTL: 3600 });
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) await db.from("push_subs").delete().eq("id", s.id);
    }
  }
  // side quest alerts (cron only), sent once per quest + alert type to all of a user's devices
  let sideSent = 0;
  if (!testUser) {
    const byUser = new Map();
    for (const s of subs ?? []) { if (!byUser.has(s.user_id)) byUser.set(s.user_id, []); byUser.get(s.user_id).push(s); }
    for (const [uid, list] of byUser) {
      if (!states.has(uid)) {
        const { data } = await db.from("skill_state").select("data").eq("user_id", uid).maybeSingle();
        states.set(uid, data?.data ?? null);
      }
      const alerts = sideAlertsDue(states.get(uid), now.getTime(), list[0].tz || "America/Chicago");
      for (const a of alerts) {
        const { error: dup } = await db.from("side_alerts").insert({ user_id: uid, quest_id: a.questId, kind: a.kind });
        if (dup) continue; // already sent
        for (const s of list) {
          try { await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify({ ...a.msg, url: APP_URL }), { TTL: 3600 }); sideSent++; }
          catch (e) { if (e && (e.statusCode === 404 || e.statusCode === 410)) await db.from("push_subs").delete().eq("id", s.id); }
        }
      }
    }
  }
  return new Response(JSON.stringify({ sent, skipped, sideSent }), { headers: { ...CORS, "Content-Type": "application/json" } });
});
