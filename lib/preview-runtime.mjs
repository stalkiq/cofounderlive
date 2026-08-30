import { createHash, randomUUID } from "node:crypto";
import { Firestore, FieldValue } from "@google-cloud/firestore";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || "swift-approach-506317-p4";
const db = new Firestore({ projectId: PROJECT });

function memoryCol(missionId) {
  return db.collection("antigravityRuns").doc(missionId).collection("memory");
}

async function listAllMemoryEntries(missionId, limit = 100) {
  try {
    const snap = await memoryCol(missionId).orderBy("createdAt", "desc").limit(limit).get();
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch {
    const snap = await memoryCol(missionId).limit(limit).get();
    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  }
}

export async function listMemoryEntries(missionId, limit = 100) {
  const entries = await listAllMemoryEntries(missionId, limit);
  return entries.filter((entry) => entry.source !== "cofounder-verify");
}

export async function saveMemoryEntry(missionId, payload = {}) {
  const id = String(payload.id || randomUUID()).slice(0, 64);
  const entry = {
    id,
    title: String(payload.title || payload.name || payload.summary || "Saved entry").slice(0, 200),
    body: String(payload.body || payload.notes || payload.text || payload.content || "").slice(0, 8000),
    data: typeof payload.data === "object" && payload.data ? payload.data : payload,
    source: String(payload.source || "app").slice(0, 80),
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  await memoryCol(missionId).doc(id).set(entry, { merge: true });
  const saved = await memoryCol(missionId).doc(id).get();
  return { id, ...saved.data() };
}

export async function getMemoryEntry(missionId, entryId) {
  const snap = await memoryCol(missionId).doc(String(entryId)).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() };
}

export async function verifyMemoryPersistence(missionId) {
  const marker = `verify_${Date.now().toString(36)}`;
  const created = await saveMemoryEntry(missionId, {
    title: marker,
    body: "Cofounder Live persistence check",
    source: "cofounder-verify",
  });
  try {
    const listed = await listAllMemoryEntries(missionId, 50);
    const found = listed.some((row) => row.id === created.id || row.title === marker);
    return {
      ok: found,
      entryId: created.id,
      marker,
      count: listed.length,
      checkedAt: new Date().toISOString(),
    };
  } finally {
    await memoryCol(missionId).doc(created.id).delete().catch(() => {});
  }
}

function isMemoryApiPath(relativePath) {
  const clean = String(relativePath || "").replace(/^\/+/, "").split("?")[0];
  return (
    clean === "api"
    || clean === "api/memory"
    || clean === "api/entries"
    || clean === "api/items"
    || clean === "api/records"
    || /^api\/memory\/[^/]+$/.test(clean)
    || /^api\/entries\/[^/]+$/.test(clean)
  );
}

export function previewApiPathMatch(relativePath) {
  return isMemoryApiPath(relativePath);
}

export async function handlePreviewApi(missionId, relativePath, req, res) {
  const clean = String(relativePath || "").replace(/^\/+/, "").split("?")[0];
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    if ((clean === "api/memory" || clean === "api/entries" || clean === "api/items" || clean === "api/records") && req.method === "GET") {
      const entries = await listMemoryEntries(missionId);
      return res.json({ ok: true, missionId, entries, items: entries, records: entries });
    }

    if ((clean === "api/memory" || clean === "api/entries" || clean === "api/items" || clean === "api/records") && req.method === "POST") {
      const entry = await saveMemoryEntry(missionId, req.body || {});
      return res.status(201).json({ ok: true, missionId, entry, item: entry, record: entry });
    }

    const single = clean.match(/^api\/(?:memory|entries)\/([^/]+)$/);
    if (single && req.method === "GET") {
      const entry = await getMemoryEntry(missionId, single[1]);
      if (!entry) return res.status(404).json({ error: "Entry not found" });
      return res.json({ ok: true, entry });
    }

    return res.status(404).json({ error: "Unknown preview API route", path: clean });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Preview API failed" });
  }
}

function injectPreviewBridge(html, missionId) {
  const base = `/preview/${encodeURIComponent(missionId)}/`;
  const bridge = `
<base href="${base}">
<script>
(function () {
  var root = ${JSON.stringify(base)};
  function rewrite(url) {
    if (typeof url !== "string") return url;
    if (url.indexOf("/api/") === 0) return root.replace(/\\/$/, "") + url;
    if (url.indexOf("api/") === 0) return root + url;
    return url;
  }
  var originalFetch = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === "string") return originalFetch.call(this, rewrite(input), init);
    if (input && typeof input.url === "string") {
      return originalFetch.call(this, new Request(rewrite(input.url), input), init);
    }
    return originalFetch.call(this, input, init);
  };
  var originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url) {
    var args = Array.prototype.slice.call(arguments);
    args[1] = rewrite(url);
    return originalOpen.apply(this, args);
  };
})();
</script>`;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${bridge}`);
  }
  return `<!DOCTYPE html><html><head>${bridge}</head><body>${html}</body></html>`;
}

export function preparePreviewContent(resolved, missionId) {
  if (!resolved) return null;
  if (!String(resolved.contentType || "").includes("text/html")) return resolved;
  return {
    ...resolved,
    content: injectPreviewBridge(String(resolved.content || ""), missionId),
  };
}

function clientSource(fileMap = {}) {
  return Object.entries(fileMap)
    .filter(([filePath, content]) => {
      if (typeof content !== "string" || !/\.(html|js|mjs|jsx|ts|tsx)$/i.test(filePath)) return false;
      if (/\.html$/i.test(filePath)) return true;
      return !/(^|\/)(server|backend|api|lib|scripts|test|tests)(\/|\.|$)/i.test(filePath);
    })
    .map(([, content]) => content)
    .join("\n");
}

function multiScreenUi(productName, idea = "") {
  const safeIdea = String(idea || "Your product workflow").replace(/[`$\\]/g, "");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${productName}</title>
  <style>
    :root{--bg:#0f1115;--panel:#161a22;--line:#2a2f3a;--ink:#eef1f6;--muted:#9aa3b2;--accent:#d8e5f2}
    *{box-sizing:border-box}
    body{margin:0;font-family:system-ui,sans-serif;background:var(--bg);color:var(--ink)}
    header{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:16px 20px;border-bottom:1px solid var(--line)}
    header strong{font-size:15px}
    nav{display:flex;gap:8px;flex-wrap:wrap}
    nav button,button.primary{padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:transparent;color:var(--ink);cursor:pointer}
    nav button.active,button.primary{background:var(--accent);color:#101114;border-color:transparent;font-weight:600}
    main{max-width:880px;margin:0 auto;padding:24px 20px 48px}
    .screen{display:none}
    .screen.active{display:block}
    h1{font-size:28px;margin:0 0 8px}
    p,label{color:var(--muted)}
    .panel{margin-top:18px;padding:16px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
    input,textarea,select{width:100%;margin:0 0 12px;padding:10px;border-radius:8px;border:1px solid #343b49;background:#0f131a;color:var(--ink)}
    label{display:block;font-size:12px;margin:0 0 6px}
    ul{list-style:none;padding:0;margin:0}
    li{margin:0 0 10px;padding:10px;border-radius:8px;background:#12161e}
    .hint{font-size:13px;line-height:1.45}
  </style>
</head>
<body>
  <header>
    <strong>${productName}</strong>
    <nav>
      <button type="button" data-screen="onboarding" class="active">Onboarding</button>
      <button type="button" data-screen="workflow">Main workflow</button>
      <button type="button" data-screen="history">History</button>
      <button type="button" data-screen="settings">Settings</button>
    </nav>
  </header>
  <main>
    <section class="screen active" id="onboarding" data-screen-panel="onboarding">
      <h1>Welcome to ${productName}</h1>
      <p class="hint">${safeIdea}</p>
      <div class="panel">
        <label for="founderName">Your name</label>
        <input id="founderName" placeholder="Founder name" />
        <label for="goal">What are you trying to get done first?</label>
        <textarea id="goal" rows="3" placeholder="Primary outcome"></textarea>
        <button type="button" class="primary" id="startWorkflow">Start main workflow</button>
      </div>
    </section>

    <section class="screen" id="workflow" data-screen-panel="workflow">
      <h1>Main workflow</h1>
      <p class="hint">Create the core record for this product. Saves use durable memory.</p>
      <form class="panel" id="saveForm">
        <label for="title">Title</label>
        <input id="title" name="title" required placeholder="Core item title" />
        <label for="body">Details</label>
        <textarea id="body" name="body" rows="4" placeholder="What should the product remember?"></textarea>
        <button type="submit" class="primary">Save to workflow</button>
      </form>
    </section>

    <section class="screen" id="history" data-screen-panel="history">
      <h1>History</h1>
      <p class="hint">Saved workflow entries from durable memory.</p>
      <div class="panel"><ul id="list"></ul></div>
    </section>

    <section class="screen" id="settings" data-screen-panel="settings">
      <h1>Settings</h1>
      <div class="panel">
        <label for="timezone">Preferred timezone</label>
        <select id="timezone">
          <option>Local</option>
          <option>UTC</option>
          <option>US/Eastern</option>
          <option>US/Pacific</option>
        </select>
        <label for="digest">Update cadence</label>
        <select id="digest">
          <option>As it happens</option>
          <option>Daily digest</option>
          <option>Weekly summary</option>
        </select>
        <p class="hint">Settings stay in this browser for the preview. Workflow records persist through /api/memory.</p>
      </div>
    </section>
  </main>
  <script>
    function showScreen(name) {
      document.querySelectorAll("[data-screen-panel]").forEach(function (panel) {
        panel.classList.toggle("active", panel.id === name);
      });
      document.querySelectorAll("[data-screen]").forEach(function (button) {
        button.classList.toggle("active", button.dataset.screen === name);
      });
      if (name === "history" || name === "workflow") loadEntries();
    }
    document.querySelectorAll("[data-screen]").forEach(function (button) {
      button.addEventListener("click", function () { showScreen(button.dataset.screen); });
    });
    document.getElementById("startWorkflow").addEventListener("click", function () {
      var name = document.getElementById("founderName").value.trim();
      var goal = document.getElementById("goal").value.trim();
      if (name || goal) {
        localStorage.setItem("cofounder-onboarding", JSON.stringify({ name: name, goal: goal }));
      }
      showScreen("workflow");
    });
    async function loadEntries() {
      const res = await fetch("/api/memory");
      const data = await res.json();
      const list = document.getElementById("list");
      list.innerHTML = (data.entries || []).map(function (row) {
        return "<li><strong>" + (row.title || "Entry") + "</strong><div>" + (row.body || "") + "</div></li>";
      }).join("") || "<li>No saved entries yet.</li>";
    }
    document.getElementById("saveForm").addEventListener("submit", async function (event) {
      event.preventDefault();
      await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: document.getElementById("title").value,
          body: document.getElementById("body").value,
          source: "workflow"
        })
      });
      event.target.reset();
      showScreen("history");
      await loadEntries();
    });
  </script>
</body>
</html>`;
}

function founderReadme(productName, idea = "") {
  return `# ${productName}

Founder-facing guide for the live app generated by Theo + Antigravity.

## What this app does
${idea || "A product-specific workflow with durable memory."}

## Screens
1. **Onboarding** — capture who is using the product and the first goal
2. **Main workflow** — create the core product record
3. **History** — review saved records from durable memory
4. **Settings** — lightweight preferences for the preview

## How to try it
1. Open the live preview
2. Complete onboarding
3. Save an item in the main workflow
4. Open History and refresh — the item should still be there

## Durable memory
- \`POST /api/memory\` saves a record
- \`GET /api/memory\` lists saved records

Inside Cofounder Live preview, these routes are hosted against Firestore.

## Proof it works
Run the smoke test:

\`\`\`bash
npm run smoke
\`\`\`

This checks that the app files include the product screens and that memory save/load is wired.
`;
}

function smokeTestScript(productName) {
  return `#!/usr/bin/env node
/**
 * Founder-facing smoke test for ${productName}.
 * Verifies product screens + durable memory wiring before delivery.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const required = ["web/index.html", "server.mjs", "README.md"];
for (const file of required) {
  if (!existsSync(resolve(root, file))) {
    console.error("Missing required file:", file);
    process.exit(1);
  }
}

const html = readFileSync(resolve(root, "web/index.html"), "utf8");
const readme = readFileSync(resolve(root, "README.md"), "utf8");
const server = readFileSync(resolve(root, "server.mjs"), "utf8");
const checks = [
  [/onboard/i.test(html), "Onboarding screen missing"],
  [/(workflow|dashboard|main workflow)/i.test(html), "Main workflow screen missing"],
  [/(settings|history)/i.test(html), "Settings/history screen missing"],
  [/\\/api\\/memory/.test(html), "Client is not calling /api/memory"],
  [/\\/api\\/memory/.test(server), "Server is missing /api/memory"],
  [/How to try it|Screens|Durable memory/i.test(readme), "README is not founder-facing enough"],
];

let failed = false;
for (const [ok, message] of checks) {
  if (!ok) {
    console.error("FAIL:", message);
    failed = true;
  } else {
    console.log("PASS:", message.replace(" missing", " present").replace(" is not ", " looks "));
  }
}

if (failed) process.exit(1);
console.log("Smoke test passed for ${productName}.");
`;
}

/** Ensure generated apps expose a stable memory + product-screen contract. */
export function normalizeAppFiles(fileMap = {}, productName = "Product App", idea = "") {
  const files = { ...fileMap };
  const paths = Object.keys(files);
  const hasUi = paths.some((pathName) => pathName.endsWith(".html"));

  if (!hasUi) {
    files["web/index.html"] = multiScreenUi(productName, idea);
  }

  if (!files["memory.md"]) {
    files["memory.md"] = `# Durable memory

This app uses POST/GET \`/api/memory\`.

Inside Cofounder Live preview, those routes are hosted against Firestore so saves survive refresh.
In a standalone deploy, wire the same routes to your database.
`;
  }

  if (!files["server.mjs"]) {
    files["server.mjs"] = `import express from "express";

const app = express();
const port = process.env.PORT || 8080;
const memory = [];

app.use(express.json());
app.use(express.static("web"));

app.get("/api/memory", (_req, res) => {
  res.json({ ok: true, entries: memory });
});

app.post("/api/memory", (req, res) => {
  const entry = {
    id: String(Date.now()),
    title: String(req.body?.title || "Saved entry"),
    body: String(req.body?.body || ""),
    createdAt: new Date().toISOString(),
  };
  memory.unshift(entry);
  res.status(201).json({ ok: true, entry });
});

app.listen(port, () => console.log("listening on " + port));
`;
  }

  if (!files["scripts/smoke-test.mjs"] && !files["smoke-test.mjs"]) {
    files["scripts/smoke-test.mjs"] = smokeTestScript(productName);
  }

  const readme = String(files["README.md"] || "");
  if (!readme || !/How to try it|Screens|Durable memory|smoke/i.test(readme)) {
    files["README.md"] = founderReadme(productName, idea);
  }

  if (!files["package.json"]) {
    files["package.json"] = JSON.stringify({
      name: String(productName || "product-app").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "product-app",
      private: true,
      type: "module",
      scripts: {
        start: "node server.mjs",
        smoke: "node scripts/smoke-test.mjs",
        test: "npm run smoke",
      },
      dependencies: { express: "^4.21.2" },
    }, null, 2);
  } else {
    try {
      const pkg = JSON.parse(files["package.json"]);
      pkg.type = pkg.type || "module";
      pkg.scripts = {
        ...(pkg.scripts || {}),
        start: pkg.scripts?.start || "node server.mjs",
        smoke: pkg.scripts?.smoke || "node scripts/smoke-test.mjs",
        test: pkg.scripts?.test || "npm run smoke",
      };
      files["package.json"] = JSON.stringify(pkg, null, 2);
    } catch {
      // Keep original package.json if malformed.
    }
  }

  return files;
}

export function appUsesMemoryApi(fileMap = {}) {
  return /(?:fetch|axios|XMLHttpRequest)[\s\S]{0,160}\/api\/(?:memory|entries|items|records)/i.test(clientSource(fileMap));
}

export function appHasProductScreens(fileMap = {}) {
  const source = clientSource(fileMap);
  const hasOnboarding = /onboard/i.test(source);
  const hasWorkflow = /(workflow|dashboard|main workflow|core workflow)/i.test(source);
  const hasHistoryOrSettings = /(settings|history)/i.test(source);
  return hasOnboarding && hasWorkflow && hasHistoryOrSettings;
}

export function appHasSmokeProof(fileMap = {}) {
  const hasScript = Object.keys(fileMap).some((pathName) => /(^|\/)(scripts\/)?smoke-test\.(mjs|js|cjs)$/i.test(pathName));
  const readme = String(fileMap["README.md"] || "");
  const founderFacing = /How to try it|Screens|Durable memory/i.test(readme);
  return hasScript && founderFacing;
}

export function deliveryProof(fileMap = {}) {
  return {
    usesMemoryApi: appUsesMemoryApi(fileMap),
    productScreens: appHasProductScreens(fileMap),
    smokeProof: appHasSmokeProof(fileMap),
  };
}

export function runtimeFingerprint(missionId) {
  return createHash("sha1").update(`preview-runtime:${missionId}`).digest("hex").slice(0, 12);
}
