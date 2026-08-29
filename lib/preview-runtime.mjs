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

function durableUi(productName) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${productName}</title>
  <style>
    body{font-family:system-ui,sans-serif;margin:0;background:#0f1115;color:#eef1f6}
    main{max-width:720px;margin:0 auto;padding:32px 20px}
    h1{font-size:28px;margin:0 0 8px}
    p{color:#9aa3b2}
    form,section{margin-top:20px;padding:16px;border:1px solid #2a2f3a;border-radius:12px;background:#161a22}
    label{display:block;font-size:12px;margin:0 0 6px;color:#9aa3b2}
    input,textarea{width:100%;box-sizing:border-box;margin:0 0 12px;padding:10px;border-radius:8px;border:1px solid #343b49;background:#0f131a;color:#eef1f6}
    button{padding:10px 14px;border:0;border-radius:8px;background:#d8e5f2;color:#101114;font-weight:600;cursor:pointer}
    li{margin:0 0 10px;padding:10px;border-radius:8px;background:#12161e}
  </style>
</head>
<body>
  <main>
    <h1>${productName}</h1>
    <p>This live preview saves to durable memory. Refresh after saving to confirm it stuck.</p>
    <form id="saveForm">
      <label for="title">Title</label>
      <input id="title" name="title" required placeholder="What should we remember?" />
      <label for="body">Notes</label>
      <textarea id="body" name="body" rows="4" placeholder="Details"></textarea>
      <button type="submit">Save</button>
    </form>
    <section>
      <h2>Saved entries</h2>
      <ul id="list"></ul>
    </section>
  </main>
  <script>
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
          body: document.getElementById("body").value
        })
      });
      event.target.reset();
      await loadEntries();
    });
    loadEntries();
  </script>
</body>
</html>`;
}

/** Ensure generated apps expose a stable memory contract the preview runtime can host. */
export function normalizeAppFiles(fileMap = {}, productName = "Product App") {
  const files = { ...fileMap };
  const paths = Object.keys(files);
  const hasUi = paths.some((pathName) => pathName.endsWith(".html"));

  if (!hasUi) {
    files["web/index.html"] = durableUi(productName);
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

  return files;
}

export function appUsesMemoryApi(fileMap = {}) {
  const clientSource = Object.entries(fileMap)
    .filter(([filePath, content]) => {
      if (typeof content !== "string" || !/\.(html|js|mjs|jsx|ts|tsx)$/i.test(filePath)) return false;
      if (/\.html$/i.test(filePath)) return true;
      return !/(^|\/)(server|backend|api|lib)(\/|\.|$)/i.test(filePath);
    })
    .map(([, content]) => content)
    .join("\n");
  return /(?:fetch|axios|XMLHttpRequest)[\s\S]{0,160}\/api\/(?:memory|entries|items|records)/i.test(clientSource);
}

export function runtimeFingerprint(missionId) {
  return createHash("sha1").update(`preview-runtime:${missionId}`).digest("hex").slice(0, 12);
}
