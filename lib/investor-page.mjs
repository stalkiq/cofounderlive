import { Firestore, FieldValue } from "@google-cloud/firestore";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "swift-approach-506317-p4";
const PUBLIC_BASE = String(
  process.env.PUBLIC_BASE_URL || "https://nano-banana-guide-26967920041.us-central1.run.app",
).replace(/\/$/, "");
const db = new Firestore({ projectId: PROJECT });

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function color(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;
}

function clean(value) {
  return JSON.parse(JSON.stringify(value));
}

export function investorPageUrl(id) {
  return `${PUBLIC_BASE}/site/${encodeURIComponent(id)}`;
}

export async function saveInvestorPage(id, payload) {
  await db.collection("investorPages").doc(id).set({
    ...clean(payload),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return investorPageUrl(id);
}

export async function getInvestorPage(id) {
  const snapshot = await db.collection("investorPages").doc(id).get();
  return snapshot.exists ? snapshot.data() : null;
}

export async function findInvestorPageByIdea(idea) {
  const snapshot = await db.collection("investorPages")
    .where("idea", "==", String(idea || "").trim())
    .limit(10)
    .get();
  if (snapshot.empty) return null;
  const pages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  pages.sort((a, b) => {
    const aTime = a.updatedAt?.toMillis?.() || 0;
    const bTime = b.updatedAt?.toMillis?.() || 0;
    return bTime - aTime;
  });
  return pages[0];
}

export function mvpPageUrl(id) {
  return `${PUBLIC_BASE}/mvp/${encodeURIComponent(id)}`;
}

export async function saveMvpPage(id, payload) {
  await db.collection("mvpPages").doc(id).set({
    ...clean(payload),
    updatedAt: FieldValue.serverTimestamp(),
  });
  return mvpPageUrl(id);
}

export async function getMvpPage(id) {
  const snapshot = await db.collection("mvpPages").doc(id).get();
  return snapshot.exists ? snapshot.data() : null;
}

function cards(items = []) {
  return items
    .slice(0, 4)
    .map((item, index) => `
      <article class="card">
        <span>0${index + 1}</span>
        <h3>${esc(item.title || item.name || "Advantage")}</h3>
        <p>${esc(item.detail || item.body || item)}</p>
      </article>
    `)
    .join("");
}

function bullets(items = []) {
  return `<ul>${items.slice(0, 5).map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

export function renderInvestorPage(record) {
  const site = record.site || {};
  const brand = record.brand || {};
  const palette = brand.palette || {};
  const bg = color(palette.background, "#0a0c10");
  const surface = color(palette.surface, "#131722");
  const primary = color(palette.primary, "#9ed0ff");
  const accent = color(palette.accent, "#d9ff73");
  const text = color(palette.text, "#f7f8fb");
  const name = site.name || brand.name || "New Venture";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${esc(site.subheadline || site.headline || "")}" />
  <title>${esc(name)} · Investor Preview</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Manrope:wght@500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg:${bg}; --surface:${surface}; --primary:${primary}; --accent:${accent}; --text:${text};
      --muted:color-mix(in srgb, var(--text) 62%, transparent); --line:color-mix(in srgb, var(--text) 13%, transparent);
    }
    * { box-sizing:border-box; }
    html { scroll-behavior:smooth; }
    body { margin:0; background:var(--bg); color:var(--text); font-family:"DM Sans",sans-serif; }
    body::before { content:""; position:fixed; inset:0; pointer-events:none; background:
      radial-gradient(800px 500px at 75% -10%, color-mix(in srgb, var(--primary) 22%, transparent), transparent 60%),
      radial-gradient(650px 440px at -10% 55%, color-mix(in srgb, var(--accent) 13%, transparent), transparent 65%); }
    nav, section, footer { width:min(1120px, calc(100% - 40px)); margin:auto; position:relative; }
    nav { height:76px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--line); }
    .logo { font-family:"Manrope",sans-serif; font-weight:700; letter-spacing:-.03em; font-size:20px; }
    .badge { padding:7px 10px; border:1px solid var(--line); border-radius:999px; color:var(--muted); font-size:12px; }
    .hero { min-height:660px; display:grid; align-content:center; padding:80px 0; }
    .eyebrow { color:var(--accent); letter-spacing:.17em; text-transform:uppercase; font-size:12px; font-weight:600; }
    h1 { max-width:920px; margin:16px 0 22px; font-family:"Manrope",sans-serif; font-size:clamp(46px,8vw,92px); line-height:.98; letter-spacing:-.06em; }
    .hero-copy { max-width:700px; color:var(--muted); font-size:clamp(18px,2.2vw,24px); line-height:1.5; }
    .actions { display:flex; gap:12px; flex-wrap:wrap; margin-top:32px; }
    .button { display:inline-block; padding:13px 18px; background:var(--text); color:var(--bg); text-decoration:none; border-radius:8px; font-weight:600; }
    .button.alt { background:transparent; color:var(--text); border:1px solid var(--line); }
    .evidence { max-width:720px; margin-top:28px; padding:12px 14px; border-left:2px solid var(--accent); color:var(--muted); font-size:13px; line-height:1.5; }
    .section { padding:100px 0; border-top:1px solid var(--line); }
    .section-label { color:var(--primary); font-size:12px; text-transform:uppercase; letter-spacing:.15em; }
    h2 { max-width:800px; margin:12px 0 28px; font-family:"Manrope",sans-serif; font-size:clamp(34px,5vw,58px); line-height:1.08; letter-spacing:-.045em; }
    .lead { max-width:760px; color:var(--muted); font-size:20px; line-height:1.6; }
    .grid { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; margin-top:36px; }
    .card { min-height:220px; padding:24px; background:color-mix(in srgb, var(--surface) 90%, transparent); border:1px solid var(--line); border-radius:12px; }
    .card span { color:var(--accent); font:12px monospace; }
    .card h3 { margin:46px 0 10px; font-size:20px; }
    .card p, li { color:var(--muted); line-height:1.55; }
    .split { display:grid; grid-template-columns:1fr 1fr; gap:60px; align-items:start; }
    ul { padding-left:20px; }
    li { margin-bottom:12px; }
    .metric { padding:22px 0; border-bottom:1px solid var(--line); }
    .metric strong { display:block; font-size:25px; margin-bottom:5px; }
    .metric span { color:var(--muted); }
    .ask { padding:110px 0; text-align:center; }
    .ask h2, .ask .lead { margin-left:auto; margin-right:auto; }
    footer { padding:28px 0 42px; display:flex; justify-content:space-between; border-top:1px solid var(--line); color:var(--muted); font-size:12px; }
    @media (max-width:760px) {
      .hero { min-height:580px; }
      .grid, .split { grid-template-columns:1fr; }
      .section { padding:72px 0; }
      footer { gap:20px; flex-direction:column; }
    }
  </style>
</head>
<body>
  <nav>
    <div class="logo">${esc(name)}</div>
    <div class="badge">Investor preview · revision ${esc(record.revision || 1)}</div>
  </nav>

  <section class="hero">
    <p class="eyebrow">${esc(site.eyebrow || "A new company in formation")}</p>
    <h1>${esc(site.headline || brand.tagline || name)}</h1>
    <p class="hero-copy">${esc(site.subheadline || site.oneLiner || "")}</p>
    <div class="actions">
      <a class="button" href="#thesis">${esc(site.cta || "See the thesis")}</a>
      <a class="button alt" href="#ask">View the ask</a>
    </div>
    <p class="evidence">${esc(site.evidenceNote || "Concept generated from the founder brief. Claims require founder validation.")}</p>
  </section>

  <section class="section split" id="thesis">
    <div>
      <p class="section-label">The problem</p>
      <h2>${esc(site.problem?.headline || "A costly problem hiding in plain sight.")}</h2>
    </div>
    <div class="lead">${esc(site.problem?.body || "")}</div>
  </section>

  <section class="section">
    <p class="section-label">The product</p>
    <h2>${esc(site.solution?.headline || "A simpler way forward.")}</h2>
    <p class="lead">${esc(site.solution?.body || "")}</p>
    <div class="grid">${cards(site.features)}</div>
  </section>

  <section class="section split">
    <div>
      <p class="section-label">Why this wins</p>
      <h2>${esc(site.moat?.headline || "An advantage that compounds.")}</h2>
      ${bullets(site.moat?.points)}
    </div>
    <div>
      <p class="section-label">Market and model</p>
      <div class="metric"><strong>${esc(site.market?.headline || "Focused entry market")}</strong><span>${esc(site.market?.body || "")}</span></div>
      <div class="metric"><strong>${esc(site.businessModel?.headline || "Business model")}</strong><span>${esc(site.businessModel?.body || "")}</span></div>
      <div class="metric"><strong>${esc(site.whyNow?.headline || "Why now")}</strong><span>${esc(site.whyNow?.body || "")}</span></div>
    </div>
  </section>

  <section class="section">
    <p class="section-label">Execution</p>
    <h2>${esc(site.milestones?.headline || "The next proof points.")}</h2>
    <div class="grid">${cards((site.milestones?.items || []).map((item) => ({ title: item.when, detail: item.goal })))}</div>
  </section>

  <section class="ask" id="ask">
    <p class="section-label">The ask</p>
    <h2>${esc(site.ask?.headline || "Help us prove the next milestone.")}</h2>
    <p class="lead">${esc(site.ask?.body || "")}</p>
  </section>

  <footer>
    <span>${esc(name)} · ${new Date().getFullYear()}</span>
    <span>Designed by Creative · Built by Technical · Powered by Gemini on Google Cloud</span>
  </footer>
</body>
</html>`;
}

export function renderMissingPage() {
  return `<!doctype html><html><body style="font-family:sans-serif;padding:48px;background:#0a0c10;color:#fff">
    <h1>Landing page not found.</h1><p>This build may not have completed.</p><a href="/" style="color:#9ed0ff">Back to the cofounders</a>
  </body></html>`;
}

function formFields(fields = []) {
  return fields.slice(0, 5).map((field, index) => {
    const id = `field-${index}`;
    const label = esc(field.label || `Input ${index + 1}`);
    if (field.type === "select" && Array.isArray(field.options)) {
      return `<label for="${id}">${label}<select id="${id}" name="${id}" required>
        <option value="">Choose one</option>
        ${field.options.slice(0, 6).map((option) => `<option>${esc(option)}</option>`).join("")}
      </select></label>`;
    }
    return `<label for="${id}">${label}<input id="${id}" name="${id}" type="${field.type === "date" ? "date" : "text"}" placeholder="${esc(field.placeholder || "")}" required /></label>`;
  }).join("");
}

function allowed(value, choices, fallback) {
  return choices.includes(value) ? value : fallback;
}

function normalizeScreens(mvp) {
  const supported = ["dashboard", "catalog", "timeline", "kanban", "chat", "calendar", "table", "map", "assistant", "workflow"];
  let screens = Array.isArray(mvp.screens)
    ? mvp.screens.filter((screen) => supported.includes(screen?.type)).slice(0, 3)
    : [];
  if (!screens.length) {
    screens = [
      {
        label: mvp.navigation?.[0] || "Overview",
        type: "dashboard",
        title: mvp.dashboard?.activityTitle || "Overview",
        metrics: mvp.dashboard?.metrics || [],
        items: mvp.dashboard?.sampleItems || [],
      },
      { label: mvp.navigation?.[1] || "New entry", type: "workflow", title: mvp.workflow?.title },
      {
        label: mvp.navigation?.[2] || "Insights",
        type: "catalog",
        title: mvp.insights?.headline || "Insights",
        items: mvp.insights?.cards || [],
      },
    ];
  }
  while (screens.length < 3) {
    screens.push({ label: screens.length === 1 ? "Create" : "Explore", type: screens.length === 1 ? "workflow" : "catalog", items: [] });
  }
  if (!screens.some((screen) => screen.type === "workflow")) {
    screens[2] = { label: "Create", type: "workflow", title: mvp.workflow?.title || "Create an entry" };
  }
  return screens;
}

function itemRows(items = [], live = false) {
  return `<div ${live ? "data-live-activity" : ""}>${items.slice(0, 8).map((item) => `
    <article class="activity-row">
      <span class="activity-dot"></span>
      <div><strong>${esc(item.title || "Sample activity")}</strong><p>${esc(item.detail || item.meta || "")}</p></div>
      <small>${esc(item.status || item.value || "Sample")}</small>
    </article>
  `).join("")}</div>`;
}

function metricCards(metrics = []) {
  return `<div class="metrics">${metrics.slice(0, 4).map((metric) =>
    `<div class="metric"><span>${esc(metric.label || "Sample metric")}</span><strong>${esc(metric.value || "—")}</strong></div>`,
  ).join("")}</div>`;
}

function screenBody(screen, mvp, index) {
  const items = Array.isArray(screen.items) ? screen.items : [];
  const title = screen.title || screen.label || "Product screen";
  const intro = `<div class="screen-head"><span class="screen-number">0${index + 1}</span><div><h2>${esc(title)}</h2><p>${esc(screen.description || "")}</p></div></div>`;

  if (screen.type === "workflow") {
    return `${intro}<div class="panel form-panel">
      <form id="workflow">${formFields(mvp.workflow?.fields)}
        <button class="primary" type="submit">${esc(mvp.workflow?.buttonLabel || "Save")}</button>
      </form>
      <div class="result" id="result"><h3></h3><p></p></div>
    </div>`;
  }
  if (screen.type === "dashboard") {
    return `${intro}${metricCards(screen.metrics)}<div class="panel">${itemRows(items, true)}</div>`;
  }
  if (screen.type === "catalog") {
    return `${intro}<input class="filter" data-filter="${index}" placeholder="Search ${esc(screen.label || "items").toLowerCase()}…" />
      <div class="catalog-grid" data-filter-grid="${index}">${items.slice(0, 8).map((item, itemIndex) => `
        <article class="catalog-card" data-search="${esc(`${item.title} ${item.detail} ${item.meta}`.toLowerCase())}">
          <div class="catalog-visual"><span>${String(itemIndex + 1).padStart(2, "0")}</span></div>
          <small>${esc(item.status || item.meta || "Sample")}</small><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p>
          <button class="text-action">View details →</button>
        </article>`).join("")}</div>`;
  }
  if (screen.type === "timeline") {
    return `${intro}<div class="timeline">${items.slice(0, 8).map((item) => `
      <article><time>${esc(item.meta || item.status || "Upcoming")}</time><div><h3>${esc(item.title)}</h3><p>${esc(item.detail)}</p></div></article>`).join("")}</div>`;
  }
  if (screen.type === "kanban") {
    const statuses = [...new Set(items.map((item) => item.status || "Planned"))].slice(0, 3);
    return `${intro}<div class="kanban">${statuses.map((status, columnIndex) => `
      <section class="kanban-column" data-column="${columnIndex}"><h3>${esc(status)}</h3>
        ${items.filter((item) => (item.status || "Planned") === status).map((item) => `
          <article class="task-card"><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p><small>${esc(item.meta || "Sample")}</small>
          ${columnIndex < statuses.length - 1 ? `<button class="advance" type="button">Move forward →</button>` : ""}</article>`).join("")}
      </section>`).join("")}</div>`;
  }
  if (screen.type === "chat") {
    return `${intro}<div class="chat panel"><div class="messages">${items.slice(0, 8).map((item, itemIndex) => `
      <article class="bubble ${itemIndex % 2 ? "mine" : ""}"><small>${esc(item.meta || item.status || "Teammate")}</small><strong>${esc(item.title)}</strong><p>${esc(item.detail)}</p></article>`).join("")}</div>
      <form class="local-composer" data-composer="chat"><input name="message" placeholder="Write a message…" required /><button class="primary">Send</button></form></div>`;
  }
  if (screen.type === "calendar") {
    const calendarTitle = mvp.googleCapability?.config?.calendarTitle || mvp.workflow?.title || title;
    const calendarUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(calendarTitle)}&details=${encodeURIComponent(mvp.workflow?.description || screen.description || "")}`;
    return `${intro}<div class="calendar-strip">${["M", "T", "W", "T", "F", "S", "S"].map((day, dayIndex) =>
      `<span class="${dayIndex === 2 ? "selected" : ""}">${day}<strong>${dayIndex + 12}</strong></span>`,
    ).join("")}</div><div class="panel">${itemRows(items)}</div>
      ${mvp.googleCapability?.service === "calendar" ? `<a class="capability-action" href="${esc(calendarUrl)}" target="_blank" rel="noreferrer">Plan in Google Calendar ↗</a>` : ""}`;
  }
  if (screen.type === "table") {
    const liveBigQuery = mvp.googleCapability?.service === "bigquery"
      && Number(mvp.googleCapability.primaryScreen) === index;
    return `${intro}<div class="table-wrap"><table><thead><tr><th>Name</th><th>Details</th><th>Status</th><th>Value</th></tr></thead><tbody${liveBigQuery ? " data-live-bigquery" : ""}>
      ${items.slice(0, 10).map((item) => `<tr><td><strong>${esc(item.title)}</strong></td><td>${esc(item.detail)}</td><td><span class="tag">${esc(item.status || "Sample")}</span></td><td>${esc(item.value || item.meta || "—")}</td></tr>`).join("")}
      </tbody></table></div>${liveBigQuery ? `<p class="capability-source" data-bigquery-source>Loading live sample rows from BigQuery…</p>` : ""}`;
  }
  if (screen.type === "map") {
    const queryContext = mvp.googleCapability?.config?.mapQuery || mvp.name || "";
    return `${intro}<div class="map-layout"><div class="map-canvas">${items.slice(0, 6).map((item, itemIndex) =>
      `<a class="map-pin" style="left:${15 + (itemIndex * 31) % 72}%;top:${18 + (itemIndex * 23) % 62}%" title="Open ${esc(item.title)} in Google Maps" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(`${item.title || ""} ${queryContext}`)}" target="_blank" rel="noreferrer"><span>${itemIndex + 1}</span></a>`,
    ).join("")}<svg viewBox="0 0 800 420" preserveAspectRatio="none"><path d="M40 330 C170 80 270 360 410 150 S650 90 760 260" /></svg></div>
      <div class="map-list">${itemRows(items)}</div></div>`;
  }
  if (screen.type === "assistant") {
    return `${intro}<div class="assistant-panel panel"><div class="assistant-mark">✦</div>
      <form class="local-composer assistant-form" data-composer="assistant"><textarea name="message" placeholder="${esc(screen.description || "What would you like to explore?")}" required></textarea><button class="primary">Generate</button></form>
      <div class="assistant-output"></div></div>`;
  }
  return `${intro}<div class="panel">${itemRows(items)}</div>`;
}

export function renderMvpPage(record) {
  const mvp = record.mvp || {};
  const brand = record.brand || {};
  const experience = mvp.experience || {};
  const palette = mvp.palette || brand.palette || {};
  const bg = color(palette.background, "#0b0f14");
  const surface = color(palette.surface, "#141b24");
  const primary = color(palette.primary, "#8fc7ff");
  const accent = color(palette.accent, "#b8f27c");
  const text = color(palette.text, "#f7f9fc");
  const name = mvp.name || brand.name || "Working MVP";
  const storageKey = `cofounder-mvp-${record.missionId || "prototype"}`;
  const screens = normalizeScreens(mvp);
  const archetype = allowed(experience.archetype, ["terminal", "marketplace", "mobile", "workspace", "assistant", "operations", "analytics", "community"], "workspace");
  const device = allowed(experience.device, ["desktop", "mobile"], "desktop");
  const navStyle = allowed(experience.navigationStyle, ["sidebar", "topbar", "bottom"], device === "mobile" ? "bottom" : "sidebar");
  const density = allowed(experience.density, ["compact", "comfortable", "spacious"], "comfortable");
  const typeStyle = allowed(experience.typeStyle, ["sans", "serif", "mono"], "sans");
  const radius = allowed(experience.radius, ["sharp", "soft", "rounded"], "soft");
  const safeModel = JSON.stringify({
    missionId: record.missionId || "",
    apiBase: record.runtimeBaseUrl || "",
    capability: mvp.googleCapability || null,
    successTitle: mvp.workflow?.successTitle || "Saved",
    successMessage: mvp.workflow?.successMessage || "Your entry was added to the prototype.",
    assistantReply: screens.find((screen) => screen.type === "assistant")?.items?.[0]?.detail || mvp.workflow?.successMessage || "A prototype result is ready for review.",
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${esc(name)} · Working MVP</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&family=Manrope:wght@500;600;700&family=Newsreader:opsz,wght@6..72,500;6..72,600&display=swap" rel="stylesheet" />
  <style>
    :root { --bg:${bg};--surface:${surface};--primary:${primary};--accent:${accent};--text:${text};--muted:color-mix(in srgb,var(--text) 62%,transparent);--line:color-mix(in srgb,var(--text) 13%,transparent);--radius:${radius === "sharp" ? "2px" : radius === "rounded" ? "22px" : "10px"};--gap:${density === "compact" ? "10px" : density === "spacious" ? "22px" : "15px"}; }
    *{box-sizing:border-box} body{margin:0;min-height:100vh;background:var(--bg);color:var(--text);font-family:"DM Sans",sans-serif}button,input,select,textarea{font:inherit}
    .app-frame{min-height:100vh;background:var(--bg)}.shell{display:grid;grid-template-columns:230px 1fr;min-height:100vh}
    aside{padding:28px 20px;background:color-mix(in srgb,var(--surface) 88%,var(--bg));border-right:1px solid var(--line);z-index:5}
    .logo{font-family:"Manrope",sans-serif;font-size:21px;font-weight:700;letter-spacing:-.04em;margin-bottom:34px}.prototype{margin-left:7px;color:var(--accent);font:9px "IBM Plex Mono";letter-spacing:.1em}
    .nav-button{width:100%;display:block;margin:5px 0;padding:11px 12px;text-align:left;border:0;border-radius:var(--radius);background:transparent;color:var(--muted);cursor:pointer}.nav-button.active,.nav-button:hover{background:color-mix(in srgb,var(--primary) 14%,transparent);color:var(--text)}
    .built-by{position:fixed;bottom:24px;width:190px;color:var(--muted);font-size:10px;line-height:1.5}main{padding:32px clamp(22px,5vw,68px);overflow:hidden}
    .top{display:flex;justify-content:space-between;gap:20px;align-items:center;margin-bottom:${density === "compact" ? "28px" : "42px"}}.top p{margin:0;color:var(--muted)}.status,.motif{padding:7px 10px;border:1px solid var(--line);border-radius:999px;color:var(--accent);font-size:10px}
    .view{display:none}.view.active{display:block}
    .hero{margin-bottom:${density === "spacious" ? "48px" : "32px"}}.eyebrow{color:var(--primary);font:11px "IBM Plex Mono";letter-spacing:.13em;text-transform:uppercase}
    h1{max-width:900px;margin:12px 0 14px;font-family:"Manrope",sans-serif;font-size:clamp(38px,6vw,68px);line-height:1.02;letter-spacing:-.055em}.lede{max-width:760px;margin:0;color:var(--muted);font-size:18px;line-height:1.55}
    .screen-head{display:flex;gap:16px;align-items:flex-start;margin-bottom:24px}.screen-head h2{margin:0 0 5px;font-size:30px;letter-spacing:-.035em}.screen-head p{margin:0;color:var(--muted)}.screen-number{color:var(--accent);font:11px "IBM Plex Mono";padding-top:8px}
    .metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:var(--gap);margin-bottom:var(--gap)}.metric,.panel,.catalog-card,.task-card,.table-wrap{padding:${density === "compact" ? "15px" : "20px"};background:var(--surface);border:1px solid var(--line);border-radius:var(--radius)}.metric span{display:block;color:var(--muted);font-size:11px;margin-bottom:10px}.metric strong{font-size:25px}
    .activity-row{display:grid;grid-template-columns:12px 1fr auto;gap:12px;align-items:center;padding:14px 0;border-top:1px solid var(--line)}.activity-row:first-child{border-top:0}.activity-dot{width:7px;height:7px;border-radius:50%;background:var(--accent)}.activity-row strong{font-size:14px}.activity-row p{margin:3px 0 0;color:var(--muted);font-size:12px}.activity-row small{color:var(--muted);font-size:10px}
    .form-panel{max-width:720px}form{display:grid;gap:16px}label{color:var(--muted);font-size:11px}input,select,textarea{width:100%;display:block;margin-top:7px;padding:13px 14px;color:var(--text);background:var(--bg);border:1px solid var(--line);border-radius:calc(var(--radius) * .7)}input:focus,select:focus,textarea:focus{outline:1px solid var(--primary)}
    .primary{padding:13px 16px;border:0;border-radius:calc(var(--radius) * .7);background:var(--text);color:var(--bg);font-weight:600;cursor:pointer}.result{display:none;margin-top:18px;padding:18px;border-left:3px solid var(--accent);background:color-mix(in srgb,var(--accent) 8%,transparent)}.result.show{display:block}.result h3,.result p{margin:0}.result p{color:var(--muted);margin-top:5px}.capability-action{display:inline-block;margin-top:16px;padding:11px 14px;color:var(--bg);background:var(--accent);border-radius:var(--radius);font-size:12px;font-weight:600;text-decoration:none}.capability-source{color:var(--muted);font:10px "IBM Plex Mono";margin-top:10px}
    .filter{max-width:420px;margin:0 0 20px}.catalog-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--gap)}.catalog-card{overflow:hidden}.catalog-visual{height:125px;margin:-20px -20px 18px;display:grid;place-items:center;background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 28%,var(--surface)),color-mix(in srgb,var(--accent) 18%,var(--bg)))}.catalog-visual span{font:28px "IBM Plex Mono";color:var(--text)}.catalog-card small{color:var(--accent)}.catalog-card h3{margin:10px 0 7px}.catalog-card p{color:var(--muted);min-height:42px}.text-action,.advance{border:0;background:transparent;color:var(--primary);padding:0;cursor:pointer;font-size:12px}
    .timeline{max-width:800px;border-left:1px solid var(--line);margin-left:10px}.timeline article{position:relative;display:grid;grid-template-columns:130px 1fr;gap:20px;padding:0 0 30px 28px}.timeline article:before{content:"";position:absolute;left:-5px;top:4px;width:9px;height:9px;border-radius:50%;background:var(--accent)}.timeline time{color:var(--accent);font:10px "IBM Plex Mono"}.timeline h3,.timeline p{margin:0}.timeline p{color:var(--muted);margin-top:5px}
    .kanban{display:grid;grid-template-columns:repeat(3,1fr);gap:var(--gap);overflow:auto}.kanban-column{min-width:220px;padding:13px;background:color-mix(in srgb,var(--surface) 60%,transparent);border-radius:var(--radius)}.kanban-column>h3{color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.1em}.task-card{margin-top:10px}.task-card p{color:var(--muted);font-size:12px}.task-card small{display:block;color:var(--accent);margin-bottom:12px}
    .chat{max-width:760px}.messages{display:flex;flex-direction:column;gap:12px;min-height:280px}.bubble{max-width:70%;padding:13px 15px;background:color-mix(in srgb,var(--primary) 10%,var(--bg));border-radius:var(--radius)}.bubble.mine{align-self:flex-end;background:color-mix(in srgb,var(--accent) 12%,var(--surface))}.bubble small,.bubble strong{display:block}.bubble small{color:var(--muted);font-size:9px}.bubble p{margin:5px 0 0;color:var(--muted)}.local-composer{display:grid;grid-template-columns:1fr auto;gap:8px;margin-top:20px}.local-composer input{margin:0}
    .calendar-strip{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:20px}.calendar-strip span{display:grid;gap:8px;place-items:center;padding:12px;color:var(--muted);border:1px solid var(--line);border-radius:var(--radius)}.calendar-strip span.selected{background:var(--primary);color:var(--bg)}.calendar-strip strong{font-size:18px}
    .table-wrap{padding:0;overflow:auto}table{width:100%;border-collapse:collapse;text-align:left}th,td{padding:14px 16px;border-bottom:1px solid var(--line);font-size:12px}th{color:var(--muted);font:10px "IBM Plex Mono";text-transform:uppercase}.tag{color:var(--accent);padding:5px 8px;border:1px solid var(--line);border-radius:999px}
    .map-layout{display:grid;grid-template-columns:1.6fr 1fr;gap:var(--gap)}.map-canvas{position:relative;min-height:420px;overflow:hidden;background:color-mix(in srgb,var(--surface) 82%,var(--bg));border:1px solid var(--line);border-radius:var(--radius)}.map-canvas:before{content:"";position:absolute;inset:0;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:42px 42px;opacity:.35}.map-canvas svg{position:absolute;inset:0;width:100%;height:100%}.map-canvas path{fill:none;stroke:var(--primary);stroke-width:3;stroke-dasharray:8 8}.map-pin{position:absolute;z-index:2;width:34px;height:34px;display:grid;place-items:center;border:4px solid color-mix(in srgb,var(--accent) 25%,transparent);border-radius:50%;background:var(--accent);color:var(--bg);cursor:pointer;text-decoration:none}.map-list{padding:0 16px;background:var(--surface);border:1px solid var(--line);border-radius:var(--radius)}
    .assistant-panel{max-width:820px;text-align:center;padding:40px}.assistant-mark{font-size:46px;color:var(--accent)}.assistant-form{display:block}.assistant-form textarea{min-height:130px;resize:vertical;margin-bottom:10px}.assistant-output{display:none;text-align:left;margin-top:20px;padding:20px;background:color-mix(in srgb,var(--primary) 9%,var(--bg));border-radius:var(--radius);line-height:1.6}.assistant-output.show{display:block}
    .type-serif h1,.type-serif h2,.type-serif .logo{font-family:"Newsreader",Georgia,serif;letter-spacing:-.025em}.type-mono,.type-mono button,.type-mono input,.type-mono select,.type-mono textarea{font-family:"IBM Plex Mono",monospace}.type-mono h1,.type-mono h2,.type-mono .logo{font-family:"IBM Plex Mono",monospace;letter-spacing:-.04em}
    .archetype-terminal{background-image:linear-gradient(color-mix(in srgb,var(--primary) 3%,transparent) 1px,transparent 1px);background-size:100% 24px}.archetype-terminal .metric,.archetype-terminal .panel,.archetype-terminal .table-wrap{box-shadow:inset 2px 0 var(--accent)}.archetype-marketplace .catalog-card:nth-child(2n){transform:translateY(16px)}.archetype-community .bubble,.archetype-community .catalog-card{box-shadow:0 12px 30px color-mix(in srgb,var(--bg) 55%,transparent)}.archetype-mobile .hero h1{font-size:48px}
    .nav-topbar .shell{display:block}.nav-topbar aside{position:sticky;top:0;display:flex;align-items:center;gap:8px;padding:14px 28px;border-right:0;border-bottom:1px solid var(--line)}.nav-topbar .logo{margin:0 auto 0 0}.nav-topbar .nav-button{width:auto;margin:0}.nav-topbar .built-by{display:none}
    body.device-mobile{overflow:hidden}.device-mobile .app-frame{max-width:430px;height:calc(100vh - 56px);min-height:0;margin:28px auto;border:1px solid var(--line);border-radius:32px;overflow:hidden;box-shadow:0 30px 90px color-mix(in srgb,var(--text) 10%,transparent)}.device-mobile .shell{grid-template-columns:1fr;height:100%;min-height:0}.device-mobile main{height:100%;padding:26px 20px 100px;overflow-y:auto;overscroll-behavior:contain}.device-mobile aside,.nav-bottom aside{position:fixed;left:50%;bottom:18px;transform:translateX(-50%);width:min(390px,calc(100% - 28px));display:flex;align-items:center;gap:4px;padding:8px;background:color-mix(in srgb,var(--surface) 94%,transparent);border:1px solid var(--line);border-radius:22px;backdrop-filter:blur(18px)}.device-mobile .logo,.device-mobile .built-by,.nav-bottom .logo,.nav-bottom .built-by{display:none}.device-mobile .nav-button,.nav-bottom .nav-button{flex:1;width:auto;margin:0;padding:11px 5px;text-align:center;font-size:10px}.device-mobile .metrics{grid-template-columns:1fr 1fr}.device-mobile .catalog-grid{grid-template-columns:1fr}.device-mobile .map-layout{grid-template-columns:1fr}.device-mobile .map-canvas{min-height:280px}.device-mobile .kanban{grid-template-columns:repeat(3,78%)}.device-mobile .screen-head h2{font-size:25px}
    @media(max-width:800px){.shell{grid-template-columns:1fr}body:not(.nav-topbar):not(.device-mobile) aside{display:none}main{padding:24px 18px}.metrics{grid-template-columns:1fr 1fr}.catalog-grid{grid-template-columns:1fr}.map-layout{grid-template-columns:1fr}.kanban{grid-template-columns:repeat(3,80%)}.top{margin-bottom:30px}}
  </style>
</head>
<body class="archetype-${archetype} device-${device} nav-${navStyle} density-${density} type-${typeStyle} radius-${radius}">
  <div class="app-frame"><div class="shell">
    <aside><div class="logo">${esc(name)}<span class="prototype">MVP</span></div>
      ${screens.map((screen, index) => `<button class="nav-button${index === 0 ? " active" : ""}" data-view="${index}">${esc(screen.label || screen.type)}</button>`).join("")}
      <p class="built-by">Creative-reviewed · Technical-built<br/>Powered by ${esc(mvp.googleCapability?.label || "Gemini on Google Cloud")}</p>
    </aside>
    <main>
      <header class="top"><p>${esc(mvp.workspaceLabel || "Founder workspace")}</p><span class="status">${esc(mvp.googleCapability?.label || "Google Cloud")} · revision ${esc(record.revision || 1)}</span></header>
      ${screens.map((screen, index) => `<section class="view${index === 0 ? " active" : ""}" data-panel="${index}">
        ${index === 0 ? `<div class="hero"><div class="motif">${esc(experience.motif || archetype)}</div><p class="eyebrow">${esc(mvp.eyebrow || `${archetype} experience`)}</p><h1>${esc(mvp.headline || "A working first version.")}</h1><p class="lede">${esc(mvp.subheadline || "")}</p></div>` : ""}
        ${screenBody(screen, mvp, index)}
      </section>`).join("")}
    </main>
  </div></div>
  <script>
    const model=${safeModel};const key=${JSON.stringify(storageKey)};
    const buttons=[...document.querySelectorAll(".nav-button")],views=[...document.querySelectorAll(".view")];
    buttons.forEach(button=>button.addEventListener("click",()=>{const index=Number(button.dataset.view),main=document.querySelector("main");buttons.forEach((item,i)=>item.classList.toggle("active",i===index));views.forEach((item,i)=>item.classList.toggle("active",i===index));main.scrollTo(0,0);window.scrollTo(0,0)}));
    const saved=JSON.parse(localStorage.getItem(key)||"[]");
    function row(entry){const article=document.createElement("article");article.className="activity-row";const dot=document.createElement("span");dot.className="activity-dot";const wrap=document.createElement("div"),strong=document.createElement("strong"),p=document.createElement("p");strong.textContent=entry.title;p.textContent=entry.detail;wrap.append(strong,p);const small=document.createElement("small");small.textContent="Saved";article.append(dot,wrap,small);return article}
    document.querySelectorAll("[data-live-activity]").forEach(activity=>saved.slice().reverse().forEach(entry=>activity.prepend(row(entry))));
    const workflow=document.getElementById("workflow"),result=document.getElementById("result");
    if(workflow)workflow.addEventListener("submit",event=>{event.preventDefault();const values=[...new FormData(workflow).values()].filter(Boolean);const entry={title:values[0]||model.successTitle,detail:values.slice(1).join(" · ")||model.successMessage};saved.push(entry);localStorage.setItem(key,JSON.stringify(saved.slice(-20)));document.querySelectorAll("[data-live-activity]").forEach(activity=>activity.prepend(row(entry)));result.querySelector("h3").textContent=model.successTitle;result.querySelector("p").textContent=model.successMessage;result.classList.add("show");if(model.capability?.service==="calendar"){const date=values.find(value=>/^\\d{4}-\\d{2}-\\d{2}$/.test(value));const dates=date?"&dates="+date.replaceAll("-","")+"/"+date.replaceAll("-",""):"";const url="https://calendar.google.com/calendar/render?action=TEMPLATE&text="+encodeURIComponent(entry.title)+"&details="+encodeURIComponent(entry.detail)+dates;window.open(url,"_blank","noopener,noreferrer")}workflow.reset()});
    document.querySelectorAll("[data-filter]").forEach(input=>input.addEventListener("input",()=>{const grid=document.querySelector('[data-filter-grid="'+input.dataset.filter+'"]');grid.querySelectorAll("[data-search]").forEach(card=>card.hidden=!card.dataset.search.includes(input.value.toLowerCase()))}));
    document.querySelectorAll('[data-composer="chat"]').forEach(form=>form.addEventListener("submit",event=>{event.preventDefault();const input=form.elements.message;if(!input.value.trim())return;const bubble=document.createElement("article");bubble.className="bubble mine";const strong=document.createElement("strong");strong.textContent="You";const p=document.createElement("p");p.textContent=input.value;bubble.append(strong,p);form.closest(".chat").querySelector(".messages").append(bubble);input.value=""}));
    document.querySelectorAll('[data-composer="assistant"]').forEach(form=>form.addEventListener("submit",async event=>{event.preventDefault();const output=form.parentElement.querySelector(".assistant-output"),message=form.elements.message.value.trim(),button=form.querySelector("button");if(!message)return;output.textContent=model.capability?.service==="gemini"?"Gemini is working…":model.assistantReply;output.classList.add("show");if(model.capability?.service!=="gemini")return;button.disabled=true;try{const response=await fetch((model.apiBase||"")+"/api/mvp/"+encodeURIComponent(model.missionId)+"/assistant",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message})});const payload=await response.json();if(!response.ok)throw new Error(payload.error||"Gemini request failed");output.textContent=payload.text}catch(error){output.textContent=error.message}finally{button.disabled=false}}));
    document.querySelectorAll("[data-live-bigquery]").forEach(async body=>{const source=document.querySelector("[data-bigquery-source]");try{const response=await fetch((model.apiBase||"")+"/api/mvp/"+encodeURIComponent(model.missionId)+"/analytics");const payload=await response.json();if(!response.ok)throw new Error(payload.error||"BigQuery request failed");body.replaceChildren(...payload.rows.map(item=>{const tr=document.createElement("tr");[item.name,item.details,item.status,item.value].forEach((value,index)=>{const td=document.createElement("td");if(index===0){const strong=document.createElement("strong");strong.textContent=value;td.append(strong)}else if(index===2){const span=document.createElement("span");span.className="tag";span.textContent=value;td.append(span)}else td.textContent=value;tr.append(td)});return tr}));if(source)source.textContent=payload.source+" · live sample data"}catch(error){if(source)source.textContent=error.message}});
    document.querySelectorAll(".advance").forEach(button=>button.addEventListener("click",()=>{const card=button.closest(".task-card"),column=card.closest(".kanban-column"),next=column.nextElementSibling;if(next){button.remove();next.append(card)}}));
  </script>
</body>
</html>`;
}
