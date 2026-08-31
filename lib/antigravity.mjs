import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Firestore, FieldValue } from "@google-cloud/firestore";
import { generateJson as geminiJson } from "./gemini.mjs";
import { getMvpPage } from "./investor-page.mjs";
import { productSlug } from "./product-export.mjs";
import { deliveryProof, normalizeAppFiles, verifyMemoryPersistence } from "./preview-runtime.mjs";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || "swift-approach-506317-p4";
const LOCATION = process.env.VERTEX_LOCATION || "global";
const ANTIGRAVITY_MODEL = process.env.ANTIGRAVITY_MODEL || "gemini-3.5-flash";
const ANTIGRAVITY_PYTHON = process.env.ANTIGRAVITY_PYTHON || "python3";
const TOKEN = process.env.GITHUB_DELIVERY_TOKEN || "";
const OWNER = process.env.GITHUB_DELIVERY_OWNER || "stalkiq";
const REPO = process.env.GITHUB_DELIVERY_REPO || "cofounderlive-deliveries";
const BASE_BRANCH = process.env.GITHUB_DELIVERY_BASE || "main";
const API = "https://api.github.com";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKER = path.join(__dirname, "..", "workers", "antigravity_implement.py");
const db = new Firestore({ projectId: PROJECT });

function text(value, fallback = "", limit = 4000) {
  return typeof value === "string" ? value.trim().slice(0, limit) : fallback;
}

function founderFacingSummary(raw, { revise = false, request = "" } = {}) {
  const fallback = revise
    ? (request
      ? `Applied your change: ${request.slice(0, 140)}`
      : "Applied your change to the existing Antigravity app.")
    : "Real multi-screen app implementation ready.";
  const cleaned = String(raw || "")
    .replace(/\s+/g, " ")
    .replace(/^[#>*\-\d.\s]+/, "")
    .trim();
  if (!cleaned) return fallback;
  // Never surface Antigravity tool dumps, policy denials, or long agent essays.
  if (
    cleaned.length > 160
    || /denied by policy|pre-tool hook|confirm_run_command|architecture blueprint|successfully built and deployed|i have (?:successfully )?(?:built|updated|created)|listing the directory|writing package\.json|\{["']?denied/i.test(cleaned)
    || /^(i (?:have |will |am |can )|let me |first[, ]|action[: ]|listing |reading |writing |created |building )/i.test(cleaned)
  ) {
    return fallback;
  }
  const sentence = cleaned.split(/(?<=[.!?])\s+/)[0] || cleaned;
  return sentence.slice(0, 160);
}

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export function antigravityStatus() {
  return {
    available: true,
    role: "Theo coding worker for real-app implementation",
    sdk: "google-antigravity",
    model: ANTIGRAVITY_MODEL,
    python: ANTIGRAVITY_PYTHON,
    githubConfigured: Boolean(TOKEN),
    repository: `${OWNER}/${REPO}`,
  };
}

async function resolvePython() {
  if (process.env.ANTIGRAVITY_PYTHON) return process.env.ANTIGRAVITY_PYTHON;
  if (await pathExists("/opt/antigravity/bin/python")) return "/opt/antigravity/bin/python";
  return ANTIGRAVITY_PYTHON;
}

async function runPythonWorker(payload) {
  const python = await resolvePython();
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "ag-payload-"));
  const payloadPath = path.join(tempRoot, "payload.json");
  await fs.writeFile(payloadPath, JSON.stringify(payload), "utf8");

  return new Promise((resolve) => {
    const child = spawn(python, [WORKER, payloadPath], {
      env: {
        ...process.env,
        GOOGLE_CLOUD_PROJECT: PROJECT,
        GCP_PROJECT: PROJECT,
        VERTEX_LOCATION: LOCATION,
        ANTIGRAVITY_MODEL,
      },
      cwd: payload.workspace,
    });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      resolve({ ok: false, engine: "antigravity-sdk", error: "Antigravity worker timed out after 480s." });
    }, 480000);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString("utf8"); });
    child.on("close", async (code) => {
      clearTimeout(timer);
      await fs.rm(tempRoot, { recursive: true, force: true }).catch(() => {});
      const lines = stdout.trim().split("\n").filter(Boolean);
      const last = lines.at(-1) || "";
      try {
        const parsed = JSON.parse(last);
        if (!parsed.ok && stderr) parsed.stderr = stderr.slice(0, 1000);
        resolve(parsed);
      } catch {
        resolve({
          ok: false,
          engine: "antigravity-sdk",
          error: `Antigravity worker failed (code ${code}). ${stderr || stdout}`.slice(0, 2000),
        });
      }
    });
  });
}

async function collectWorkspaceFiles(workspace) {
  const files = [];
  const walk = async (directory) => {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".git" || entry.name === "node_modules") continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(absolute);
        continue;
      }
      const relative = path.relative(workspace, absolute).replaceAll(path.sep, "/");
      if (relative === "product-spec.json" || relative === "CHANGE_REQUEST.md") continue;
      const stat = await fs.stat(absolute);
      if (stat.size > 400000) continue;
      try {
        files.push({ path: relative, content: await fs.readFile(absolute, "utf8") });
      } catch {
        // Ignore binary or unreadable workspace files.
      }
    }
  };
  await walk(workspace);
  return files;
}

async function seedWorkspaceFromFiles(workspace, fileMap = {}) {
  const entries = Object.entries(fileMap || {});
  for (const [filePath, content] of entries) {
    const clean = String(filePath || "").replace(/^\/+/, "").trim();
    if (!clean || clean.includes("..")) continue;
    const absolute = path.join(workspace, clean);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, String(content ?? ""), "utf8");
  }
  return entries.length;
}

async function buildGeminiFallbackFiles(record, instruction, options = {}) {
  const name = record?.mvp?.name || record?.brand?.name || "Product App";
  const slug = productSlug(record);
  const previousFiles = options.previousFiles && typeof options.previousFiles === "object"
    ? options.previousFiles
    : null;
  const revise = Boolean(options.revise && previousFiles && Object.keys(previousFiles).length);
  const previousSnippet = revise
    ? Object.entries(previousFiles)
      .slice(0, 12)
      .map(([filePath, content]) => `### ${filePath}\n${String(content).slice(0, 3500)}`)
      .join("\n\n")
    : "";

  const generated = await geminiJson(revise
    ? `You are Theo revising an EXISTING Antigravity app in place.

PRODUCT NAME: ${name}
FOUNDER IDEA: ${record?.idea || ""}
FOUNDER CHANGE REQUEST (must apply): ${instruction}

CURRENT APP FILES:
${previousSnippet}

Return ONLY JSON with the FULL updated file set (include unchanged files you still need):
{
  "summary":"one sentence describing what changed",
  "files":[
    {"path":"package.json","content":"..."},
    {"path":"server.mjs","content":"..."},
    {"path":"web/index.html","content":"..."},
    {"path":"README.md","content":"..."},
    {"path":"scripts/smoke-test.mjs","content":"..."},
    {"path":"Dockerfile","content":"..."}
  ]
}

Rules:
- Apply the founder change request. Do not ignore it.
- Preserve the existing product UI, copy, and durable /api/memory contract unless the change requires edits.
- Keep onboarding, main workflow, and settings/history.
- No secrets, no fake traction.`
    : `You are Theo preparing a real deployable app scaffold for Antigravity-style implementation.

PRODUCT NAME: ${name}
FOUNDER IDEA: ${record?.idea || ""}
PRODUCT SPEC: ${JSON.stringify(record?.mvp || {})}
FOUNDER IMPLEMENTATION REQUEST: ${instruction}

Return ONLY JSON:
{
  "summary":"one sentence describing the real app scaffold",
  "files":[
    {"path":"package.json","content":"..."},
    {"path":"server.mjs","content":"..."},
    {"path":"web/index.html","content":"..."},
    {"path":"README.md","content":"..."},
    {"path":"scripts/smoke-test.mjs","content":"..."},
    {"path":"Dockerfile","content":"..."},
    {"path":"memory.md","content":"how durable memory works"}
  ]
}

Rules:
- Build a Node.js Express app with POST/GET /api/memory endpoints for the core workflow form.
- The UI MUST be product-specific with three areas: onboarding, main workflow, and settings/history.
- The main workflow MUST call fetch("/api/memory") to save and list durable records.
- Include scripts/smoke-test.mjs that validates the screens and /api/memory wiring.
- Include a founder-facing README with What this app does, Screens, How to try it, Durable memory, and Proof it works.
- package.json must include scripts.smoke and scripts.test.
- No secrets, no fake traction, no markdown fences inside file contents.
- Keep files concise but runnable.`);

  const files = revise ? { ...previousFiles } : {};
  for (const file of generated.files || []) {
    if (!file?.path || typeof file.content !== "string") continue;
    files[String(file.path).replace(/^\/+/, "").slice(0, 180)] = file.content;
  }
  if (!files["README.md"]) {
    files["README.md"] = `# ${name}\n\nReal-app scaffold generated for Antigravity implementation.\n`;
  }
  if (!files["package.json"]) {
    files["package.json"] = JSON.stringify({
      name: slug,
      private: true,
      type: "module",
      scripts: {
        start: "node server.mjs",
        smoke: "node scripts/smoke-test.mjs",
        test: "npm run smoke",
      },
      dependencies: { express: "^4.21.2" },
    }, null, 2);
  }
  return {
    ok: true,
    engine: revise ? "gemini-revise" : "gemini-scaffold",
    summary: text(generated.summary, revise
      ? "Applied the founder change to the existing Antigravity app."
      : "Generated a real-app scaffold for Theo to continue with Antigravity."),
    files: Object.entries(files).map(([filePath, content]) => ({ path: filePath, content })),
  };
}

async function github(pathname, options = {}) {
  if (!TOKEN) throw new Error("GitHub delivery is not configured yet.");
  const response = await fetch(`${API}${pathname}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${TOKEN}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `GitHub request failed (${response.status})`);
  return payload;
}

function encodePath(value) {
  return String(value).split("/").map(encodeURIComponent).join("/");
}

async function deliverImplementation(record, files, runId) {
  const slug = productSlug(record);
  const missionId = String(record.missionId || "").toLowerCase();
  const hash = createHash("sha256")
    .update(JSON.stringify(files))
    .digest("hex")
    .slice(0, 8);
  const branch = `antigravity/${missionId}-${runId}-${hash}`;
  const folder = `apps/${slug}`;
  const head = `${OWNER}:${branch}`;
  const existing = await github(
    `/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/pulls?state=all&head=${encodeURIComponent(head)}&per_page=1`,
  );
  if (existing?.length) {
    return {
      repository: `${OWNER}/${REPO}`,
      repositoryUrl: `https://github.com/${OWNER}/${REPO}`,
      branch,
      folder,
      pullRequestUrl: existing[0].html_url,
      pullRequestNumber: existing[0].number,
      reused: true,
    };
  }

  const baseRef = await github(`/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/git/ref/heads/${encodePath(BASE_BRANCH)}`);
  const baseSha = baseRef.object.sha;
  const baseCommit = await github(`/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/git/commits/${encodeURIComponent(baseSha)}`);
  const blobs = await Promise.all(Object.entries(files).map(async ([filePath, content]) => {
    const blob = await github(`/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({ content, encoding: "utf-8" }),
    });
    return {
      path: `${folder}/${filePath}`,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    };
  }));
  const tree = await github(`/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/git/trees`, {
    method: "POST",
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: blobs }),
  });
  const commit = await github(`/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/git/commits`, {
    method: "POST",
    body: JSON.stringify({
      message: `Antigravity implement ${slug} (${runId})`,
      tree: tree.sha,
      parents: [baseSha],
    }),
  });
  await github(`/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
  });
  const pull = await github(`/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/pulls`, {
    method: "POST",
    body: JSON.stringify({
      title: `Antigravity real app: ${slug}`,
      head: branch,
      base: BASE_BRANCH,
      body: [
        `Theo used Antigravity to implement a real app for mission \`${missionId}\`.`,
        "",
        `Folder: \`${folder}\``,
        "",
        "This PR contains a deployable multi-screen application with durable-memory API endpoints, a founder-facing README, and a smoke test — not only a concept preview.",
      ].join("\n"),
    }),
  });
  return {
    repository: `${OWNER}/${REPO}`,
    repositoryUrl: `https://github.com/${OWNER}/${REPO}`,
    branch,
    folder,
    pullRequestUrl: pull.html_url,
    pullRequestNumber: pull.number,
    reused: false,
  };
}

const PUBLIC_BASE = String(
  process.env.PUBLIC_BASE_URL || "https://nano-banana-guide-26967920041.us-central1.run.app",
).replace(/\/$/, "");
const implementationCache = new Map();

function previewAppUrl(missionId) {
  return `${PUBLIC_BASE}/preview/${encodeURIComponent(missionId)}/`;
}

function repoFolderUrl(folder, branch = "") {
  if (!folder || !branch) return "";
  return `https://github.com/${OWNER}/${REPO}/tree/${encodePath(branch)}/${encodePath(folder)}`;
}

async function persistImplementationFiles(missionId, fileMap) {
  implementationCache.set(missionId, fileMap);
  const batchSize = 20;
  const entries = Object.entries(fileMap);
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = db.batch();
    for (const [filePath, content] of entries.slice(i, i + batchSize)) {
      const id = createHash("sha1").update(filePath).digest("hex").slice(0, 24);
      batch.set(db.collection("antigravityRuns").doc(missionId).collection("files").doc(id), {
        path: filePath,
        content: String(content).slice(0, 200000),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

export async function getImplementationFiles(missionId) {
  if (implementationCache.has(missionId)) return implementationCache.get(missionId);
  const snap = await db.collection("antigravityRuns").doc(missionId).collection("files").get();
  if (snap.empty) return null;
  const files = {};
  snap.docs.forEach((doc) => {
    const row = doc.data();
    if (row?.path) files[row.path] = row.content || "";
  });
  implementationCache.set(missionId, files);
  return files;
}

export function resolvePreviewFile(files, requestPath = "") {
  if (!files || typeof files !== "object") return null;
  let clean = String(requestPath || "").replace(/^\/+/, "").replace(/\?.*$/, "");
  if (!clean || clean.endsWith("/")) {
    const candidates = ["web/index.html", "index.html", "public/index.html"];
    clean = candidates.find((pathName) => files[pathName]) || Object.keys(files).find((pathName) => pathName.endsWith("index.html")) || "";
  }
  if (clean && files[clean] == null) {
    const baseName = path.basename(clean);
    const prefixes = ["web/", "public/", ""];
    clean = prefixes
      .map((prefix) => `${prefix}${clean}`.replace(/^\/+/, ""))
      .concat(Object.keys(files).filter((pathName) => pathName === baseName || pathName.endsWith(`/${baseName}`)))
      .find((pathName) => files[pathName] != null) || clean;
  }
  if (!clean || files[clean] == null) return null;
  const ext = path.extname(clean).toLowerCase();
  const types = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
  };
  return {
    path: clean,
    content: files[clean],
    contentType: types[ext] || "text/plain; charset=utf-8",
  };
}

function filesToMap(fileList = []) {
  const files = {};
  for (const file of fileList) {
    if (!file?.path || typeof file.content !== "string") continue;
    files[String(file.path).replace(/^\/+/, "")] = file.content;
  }
  return files;
}

export async function getImplementationState(missionId) {
  const snap = await db.collection("antigravityRuns").doc(missionId).get();
  if (!snap.exists) return null;
  const data = snap.data();
  const folder = data.folder || "";
  const branch = data.branch || "";
  return {
    missionId,
    runId: data.runId || null,
    status: data.status || "unknown",
    engine: data.engine || null,
    summary: data.summary || "",
    instruction: data.instruction || "",
    pullRequestUrl: data.pullRequestUrl || "",
    repositoryUrl: data.repositoryUrl || "",
    repoFolderUrl: repoFolderUrl(folder, branch),
    previewAppUrl: data.previewAppUrl || previewAppUrl(missionId),
    folder,
    branch,
    fileCount: data.fileCount || 0,
    files: data.filePaths || [],
    verified: Boolean(data.verified),
    durableMemory: Boolean(data.durableMemory),
    productScreens: Boolean(data.productScreens),
    smokeProof: Boolean(data.smokeProof),
    verification: data.verification || null,
    error: data.error || "",
    updatedAt: data.updatedAt || null,
  };
}

async function emitFiles(onEvent, fileMap, worker = "api") {
  const paths = Object.keys(fileMap).sort();
  for (const [index, filePath] of paths.entries()) {
    await onEvent({
      type: "implement_file",
      agent: "technical",
      text: `${worker === "ui" ? "UI" : "API"} agent wrote ${filePath}`,
      proof: {
        worker,
        path: filePath,
        content: String(fileMap[filePath]).slice(0, 120000),
        index: index + 1,
        total: paths.length,
        stage: "wiring-memory",
      },
    });
  }
}

async function emitStage(onEvent, stage, label, extra = {}) {
  await onEvent({
    type: "implement_stage",
    agent: "technical",
    text: label,
    proof: {
      stage,
      label,
      ...extra,
    },
  });
}

export async function runAntigravityImplementation(missionId, instruction, onEvent = async () => {}, options = {}) {
  const record = await getMvpPage(missionId);
  if (!record?.mvp) throw new Error("Launch a product concept before asking Antigravity to implement a real app.");
  const request = text(instruction, "Implement durable backend memory and a deployable real app for this product concept.", 1500);
  const previousFiles = await getImplementationFiles(missionId);
  const previousCount = previousFiles ? Object.keys(previousFiles).length : 0;
  const requestedMode = String(options.mode || "").trim().toLowerCase();
  const revise = requestedMode === "revise"
    ? previousCount > 0
    : requestedMode === "create"
      ? false
      : previousCount > 0;
  const runId = `ag_${Date.now().toString(36)}`;
  const runRef = db.collection("antigravityRuns").doc(missionId);
  await runRef.set({
    missionId,
    runId,
    status: "running",
    mode: revise ? "revise" : "create",
    instruction: request,
    previewAppUrl: previewAppUrl(missionId),
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await onEvent({
    type: "implement_agent",
    agent: "technical",
    text: revise
      ? "Theo is applying your change to the existing Antigravity app."
      : "Theo is briefing the Antigravity coding workers.",
    proof: {
      runId,
      worker: "theo",
      status: "leading",
      task: revise
        ? `Apply founder change: ${request.slice(0, 120)}`
        : "Brief coding agents and define the real-app architecture.",
      stage: "briefing",
      mode: revise ? "revise" : "create",
    },
  });

  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), `ag-${missionId}-`));
  try {
    const seedSpec = {
      missionId,
      idea: record.idea || "",
      brand: record.brand || null,
      mvp: record.mvp,
      revision: record.revision || 1,
      mode: revise ? "revise" : "create",
      changeRequest: request,
    };
    await fs.writeFile(path.join(workspace, "product-spec.json"), JSON.stringify(seedSpec, null, 2));
    if (revise && previousFiles) {
      const seeded = await seedWorkspaceFromFiles(workspace, previousFiles);
      await fs.writeFile(
        path.join(workspace, "CHANGE_REQUEST.md"),
        `# Founder change request\n\n${request}\n\nApply this change to the existing app in this workspace.\nDo not rebuild from scratch.\nPreserve working screens and durable memory unless the change requires edits.\n`,
      );
      await onEvent({
        type: "implement_step",
        agent: "technical",
        text: `Loaded ${seeded} existing app files so Theo can revise them in place.`,
        proof: { stage: "briefing", mode: "revise", seededFiles: seeded },
      });
    } else {
      await fs.writeFile(
        path.join(workspace, "README.md"),
        `# ${record.mvp?.name || "Product"}\n\nSeed workspace for Antigravity implementation.\n\nRequest:\n${request}\n`,
      );
    }

    await emitStage(onEvent, "scaffold-api", revise ? "Updating API" : "Scaffolding API");
    await onEvent({
      type: "implement_agent",
      agent: "technical",
      text: revise
        ? "API agent is updating backend routes for your change."
        : "API agent is scaffolding backend routes and durable memory.",
      proof: {
        worker: "api",
        status: revise ? "Updating API" : "Scaffolding API",
        task: revise ? "Patch API for the founder change." : "Scaffolding API endpoints and server entrypoint.",
        stage: "scaffold-api",
      },
    });

    await emitStage(onEvent, "writing-screens", revise ? "Updating screens" : "Writing screens");
    await onEvent({
      type: "implement_agent",
      agent: "technical",
      text: revise
        ? "UI agent is applying your change to the product screens."
        : "UI agent is writing onboarding, main workflow, and settings/history screens.",
      proof: {
        worker: "ui",
        status: revise ? "Updating screens" : "Writing screens",
        task: revise ? `Change: ${request.slice(0, 100)}` : "Building onboarding → workflow → settings/history.",
        stage: "writing-screens",
      },
    });

    await onEvent({
      type: "implement_step",
      agent: "technical",
      text: revise
        ? "Antigravity worker is editing the existing multi-screen application files."
        : "Antigravity worker is generating the real multi-screen application files.",
      proof: { stage: "writing-screens", mode: revise ? "revise" : "create" },
    });

    let result = { ok: false };
    const workerReady = await pathExists(WORKER);
    const workerInstruction = revise
      ? [
          `Mission: ${missionId}`,
          `Mode: REVISE existing app (do not rebuild from scratch)`,
          `Product: ${record.mvp?.name || "Product"}`,
          `Founder idea: ${record.idea || ""}`,
          `FOUNDER CHANGE REQUEST (required): ${request}`,
          "The current workspace already contains the previous working app.",
          "Read the existing files and CHANGE_REQUEST.md, then apply the founder change.",
          "Preserve product-specific UI, onboarding → workflow → settings/history, and POST/GET /api/memory unless the change requires edits.",
          "Update smoke-test/README only if needed for the change.",
          "Write the updated files into the current workspace.",
        ].join("\n")
      : [
          `Mission: ${missionId}`,
          `Product: ${record.mvp?.name || "Product"}`,
          `Founder idea: ${record.idea || ""}`,
          `Product spec: ${JSON.stringify(record.mvp || {})}`,
          `Founder request: ${request}`,
          "Read product-spec.json and turn this concept into a real Node/Express app with:",
          "1) Product-specific multi-screen UI: onboarding → main workflow → settings/history",
          "2) POST/GET /api/memory for the core workflow (JSON records)",
          "3) Main workflow must fetch('/api/memory') to save and list entries",
          "4) Founder-facing README with What this app does, Screens, How to try it, Durable memory, Proof it works",
          "5) scripts/smoke-test.mjs plus package.json scripts.smoke/test",
          "6) Dockerfile",
          "7) no secrets and no fake traction",
          "Do not ship only a generic create/list storage page.",
          "Write all files into the current workspace.",
        ].join("\n");

    if (workerReady) {
      result = await runPythonWorker({
        workspace,
        project: PROJECT,
        location: LOCATION,
        model: ANTIGRAVITY_MODEL,
        mode: revise ? "revise" : "create",
        instruction: workerInstruction,
      });
    } else {
      result = { ok: false, error: "Antigravity worker script is missing." };
    }

    if (!result.ok || !result.files?.length) {
      const workerError = result.error || "Antigravity worker returned no files.";
      const partialFiles = await collectWorkspaceFiles(workspace);
      const partialProof = deliveryProof(filesToMap(partialFiles));
      if (partialFiles.length && partialProof.usesMemoryApi && partialProof.productScreens) {
        await onEvent({
          type: "implement_agent",
          agent: "technical",
          text: `API agent recovered ${partialFiles.length} completed files from the Antigravity workspace.`,
          proof: {
            worker: "api",
            status: "recovered",
            task: "Recovered files written before the worker response ended.",
            stage: "wiring-memory",
          },
        });
        result = {
          ok: true,
          engine: "antigravity-workspace-recovery",
          summary: "Recovered the completed application files from the Antigravity workspace.",
          files: partialFiles,
          antigravityError: workerError,
        };
      } else {
        await onEvent({
          type: "implement_agent",
          agent: "technical",
          text: revise
            ? "Theo is applying the requested change with the recovery builder."
            : "Theo started the recovery builder because Antigravity did not return a complete file manifest.",
          proof: {
            worker: "theo",
            status: "recovering",
            task: revise
              ? "Apply founder change with the recovery builder."
              : "Generate a deployable multi-screen recovery scaffold.",
            stage: "scaffold-api",
          },
        });
        let fallback;
        try {
          fallback = await buildGeminiFallbackFiles(record, request, {
            revise,
            previousFiles: previousFiles || null,
          });
        } catch (fallbackError) {
          const productName = record.mvp?.name || record.brand?.name || "Product App";
          const deterministicFiles = normalizeAppFiles(
            revise && previousFiles ? previousFiles : {},
            productName,
            record.idea || request,
          );
          fallback = {
            ok: true,
            engine: "deterministic-recovery",
            summary: "Created a verified recovery build after model output could not be parsed.",
            files: Object.entries(deterministicFiles).map(([filePath, content]) => ({
              path: filePath,
              content,
            })),
            fallbackError: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
          };
        }
        result = {
          ...fallback,
          antigravityError: workerError,
        };
      }
    }

    await emitStage(onEvent, "wiring-memory", "Wiring save/load");
    await onEvent({
      type: "implement_agent",
      agent: "technical",
      text: "Theo is wiring the app's create/save workflow to durable memory and checking delivery proof.",
      proof: { worker: "api", status: "Wiring save/load", task: "Connect forms to POST/GET /api/memory and confirm smoke/README proof.", stage: "wiring-memory" },
    });

    const productName = record.mvp?.name || record.brand?.name || "Product App";
    let fileMap = normalizeAppFiles(
      {
        ...(revise && previousFiles ? previousFiles : {}),
        ...filesToMap(result.files),
      },
      productName,
      record.idea || request,
    );
    if (!Object.keys(fileMap).length) throw new Error("Implementation produced no files.");
    const proofChecks = deliveryProof(fileMap);
    if (!proofChecks.usesMemoryApi) {
      throw new Error(
        "Antigravity built the product UI but did not connect its create/save workflow to durable memory. Rebuild to run the storage repair pass.",
      );
    }
    if (!proofChecks.productScreens) {
      throw new Error(
        "Antigravity must deliver product-specific screens: onboarding, main workflow, and settings/history.",
      );
    }
    if (!proofChecks.smokeProof) {
      throw new Error(
        "Antigravity must include a smoke-test script and founder-facing README as delivery proof.",
      );
    }

    await onEvent({
      type: "implement_agent",
      agent: "technical",
      text: "Coding agents are streaming the generated source files, smoke test, and README.",
      proof: {
        worker: "api",
        status: "streaming",
        task: `Streaming ${Object.keys(fileMap).length} files into the live preview.`,
        stage: "wiring-memory",
        ...proofChecks,
      },
    });
    await emitFiles(onEvent, fileMap, "api");
    await persistImplementationFiles(missionId, fileMap);

    await emitStage(onEvent, "verifying", "Verifying persistence");
    await onEvent({
      type: "implement_agent",
      agent: "technical",
      text: "Theo is verifying that save and reload works against durable memory.",
      proof: { worker: "api", status: "verifying", task: "Verifying persistence with POST then GET /api/memory.", stage: "verifying" },
    });
    const verification = await verifyMemoryPersistence(missionId);
    if (!verification.ok) {
      throw new Error("Live app save/reload verification failed. Durable memory did not persist.");
    }
    await onEvent({
      type: "implement_agent",
      agent: "technical",
      text: "Save/reload verified. Multi-screen app, smoke test, and README proof are ready.",
      proof: {
        worker: "api",
        status: "verified",
        task: "Durable memory check passed with product-screen and smoke proof.",
        verification,
        stage: "verifying",
        ...proofChecks,
      },
    });

    let delivery = null;
    if (TOKEN) {
      await emitStage(onEvent, "opening-pr", "Opening PR");
      await onEvent({
        type: "implement_agent",
        agent: "technical",
        text: "Deploy agent is opening the GitHub PR.",
        proof: { worker: "deploy", status: "Opening PR", task: "Create branch, commit app files, and open the implementation PR.", stage: "opening-pr" },
      });
      delivery = await deliverImplementation(record, fileMap, runId);
    } else {
      await emitStage(onEvent, "opening-pr", "Preview ready");
    }

    const proof = {
      missionId,
      runId,
      status: "completed",
      engine: result.engine || "antigravity-sdk",
      summary: founderFacingSummary(result.summary, { revise, request }),
      instruction: request,
      mode: revise ? "revise" : "create",
      fileCount: Object.keys(fileMap).length,
      filePaths: Object.keys(fileMap).sort(),
      pullRequestUrl: delivery?.pullRequestUrl || "",
      repositoryUrl: delivery?.repositoryUrl || "",
      repoFolderUrl: repoFolderUrl(delivery?.folder || "", delivery?.branch || ""),
      previewAppUrl: previewAppUrl(missionId),
      folder: delivery?.folder || "",
      branch: delivery?.branch || "",
      reused: Boolean(delivery?.reused),
      antigravityError: result.antigravityError || null,
      storageContractRepaired: Boolean(result.storageContractRepaired),
      usesMemoryApi: true,
      productScreens: true,
      smokeProof: true,
      verified: true,
      verification,
      durableMemory: true,
      stage: "complete",
    };

    await runRef.set({
      ...proof,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await emitStage(onEvent, "complete", proof.pullRequestUrl ? "Real app delivered · PR ready" : "Real app delivered · save/load verified");
    await onEvent({
      type: "implement_agent",
      agent: "technical",
      text: proof.pullRequestUrl
        ? `Deploy agent finished. PR ready at ${proof.pullRequestUrl}`
        : "Implementation complete. Live preview is ready with durable save/reload.",
      proof: {
        ...proof,
        worker: "deploy",
        status: "done",
        task: proof.pullRequestUrl ? "Pull request published." : "Preview published with verified durable memory.",
        stage: "complete",
      },
    });
    return proof;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await runRef.set({
      missionId,
      runId,
      status: "failed",
      error: message.slice(0, 2000),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    throw error;
  } finally {
    await fs.rm(workspace, { recursive: true, force: true }).catch(() => {});
  }
}
