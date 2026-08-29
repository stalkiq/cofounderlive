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
import { appUsesMemoryApi, normalizeAppFiles, verifyMemoryPersistence } from "./preview-runtime.mjs";

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
      resolve({ ok: false, engine: "antigravity-sdk", error: "Antigravity worker timed out after 240s." });
    }, 240000);
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

async function buildGeminiFallbackFiles(record, instruction) {
  const name = record?.mvp?.name || record?.brand?.name || "Product App";
  const slug = productSlug(record);
  const generated = await geminiJson(`You are Theo preparing a real deployable app scaffold for Antigravity-style implementation.

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
    {"path":"Dockerfile","content":"..."},
    {"path":"memory.md","content":"how durable memory works"}
  ]
}

Rules:
- Build a Node.js Express app with POST/GET /api/memory endpoints for the core workflow form.
- The UI MUST call fetch("/api/memory") for both saving and listing so Cofounder Live can host durable Firestore memory in preview.
- Include a minimal UI with a form that posts JSON {title, body} and lists saved entries on load.
- No secrets, no fake traction, no markdown fences inside file contents.
- Keep files concise but runnable.`);

  const files = {};
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
      scripts: { start: "node server.mjs" },
      dependencies: { express: "^4.21.2" },
    }, null, 2);
  }
  return {
    ok: true,
    engine: "gemini-scaffold",
    summary: text(generated.summary, "Generated a real-app scaffold for Theo to continue with Antigravity."),
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
        "This PR contains a deployable application scaffold with durable-memory API endpoints, not only the concept preview.",
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

function repoFolderUrl(folder) {
  if (!folder) return "";
  return `https://github.com/${OWNER}/${REPO}/tree/${encodeURIComponent(BASE_BRANCH)}/${folder}`;
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
  return {
    missionId,
    runId: data.runId || null,
    status: data.status || "unknown",
    engine: data.engine || null,
    summary: data.summary || "",
    instruction: data.instruction || "",
    pullRequestUrl: data.pullRequestUrl || "",
    repositoryUrl: data.repositoryUrl || "",
    repoFolderUrl: data.repoFolderUrl || repoFolderUrl(folder),
    previewAppUrl: data.previewAppUrl || previewAppUrl(missionId),
    folder,
    fileCount: data.fileCount || 0,
    files: data.filePaths || [],
    verified: Boolean(data.verified),
    durableMemory: Boolean(data.durableMemory),
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
      },
    });
  }
}

export async function runAntigravityImplementation(missionId, instruction, onEvent = async () => {}) {
  const record = await getMvpPage(missionId);
  if (!record?.mvp) throw new Error("Launch a product concept before asking Antigravity to implement a real app.");
  const request = text(instruction, "Implement durable backend memory and a deployable real app for this product concept.", 1500);
  const runId = `ag_${Date.now().toString(36)}`;
  const runRef = db.collection("antigravityRuns").doc(missionId);
  await runRef.set({
    missionId,
    runId,
    status: "running",
    instruction: request,
    previewAppUrl: previewAppUrl(missionId),
    updatedAt: FieldValue.serverTimestamp(),
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  await onEvent({
    type: "implement_agent",
    agent: "technical",
    text: "Theo is briefing the Antigravity coding workers.",
    proof: { runId, worker: "theo", status: "leading", task: "Brief coding agents and define the real-app architecture." },
  });

  const workspace = await fs.mkdtemp(path.join(os.tmpdir(), `ag-${missionId}-`));
  try {
    const seedSpec = {
      missionId,
      idea: record.idea || "",
      brand: record.brand || null,
      mvp: record.mvp,
      revision: record.revision || 1,
    };
    await fs.writeFile(path.join(workspace, "product-spec.json"), JSON.stringify(seedSpec, null, 2));
    await fs.writeFile(
      path.join(workspace, "README.md"),
      `# ${record.mvp?.name || "Product"}\n\nSeed workspace for Antigravity implementation.\n\nRequest:\n${request}\n`,
    );

    await onEvent({
      type: "implement_agent",
      agent: "technical",
      text: "API agent is preparing backend memory routes.",
      proof: { worker: "api", status: "coding", task: "Design POST/GET memory endpoints and server entrypoint." },
    });
    await onEvent({
      type: "implement_agent",
      agent: "technical",
      text: "UI agent is preparing screens and forms.",
      proof: { worker: "ui", status: "coding", task: "Build the product UI that saves and lists durable entries." },
    });
    await onEvent({
      type: "implement_step",
      agent: "technical",
      text: "Antigravity worker is generating the real application files.",
    });

    let result = { ok: false };
    const workerReady = await pathExists(WORKER);
    if (workerReady) {
      result = await runPythonWorker({
        workspace,
        project: PROJECT,
        location: LOCATION,
        model: ANTIGRAVITY_MODEL,
        instruction: [
          `Mission: ${missionId}`,
          `Product: ${record.mvp?.name || "Product"}`,
          `Founder request: ${request}`,
          "Read product-spec.json and turn this concept into a real Node/Express app with:",
          "1) POST/GET /api/memory for the core workflow (JSON {title, body})",
          "2) simple web UI that fetch('/api/memory') to save and list entries",
          "3) Dockerfile and README",
          "4) no secrets",
          "Write all files into the current workspace.",
        ].join("\n"),
      });
    } else {
      result = { ok: false, error: "Antigravity worker script is missing." };
    }

    if (!result.ok || !result.files?.length) {
      await onEvent({
        type: "implement_agent",
        agent: "technical",
        text: "Theo switched to a Gemini scaffold while keeping the Antigravity delivery shape.",
        proof: { worker: "theo", status: "recovering", task: "Generate a deployable scaffold for follow-up Antigravity work." },
      });
      const fallback = await buildGeminiFallbackFiles(record, request);
      result = {
        ...fallback,
        antigravityError: result.error || null,
      };
    }

    let fileMap = normalizeAppFiles(
      filesToMap(result.files),
      record.mvp?.name || record.brand?.name || "Product App",
    );
    if (!Object.keys(fileMap).length) throw new Error("Implementation produced no files.");
    if (!appUsesMemoryApi(fileMap)) {
      throw new Error(
        "Antigravity built the product UI but did not connect its create/save workflow to durable memory. Rebuild to run the storage repair pass.",
      );
    }

    await onEvent({
      type: "implement_agent",
      agent: "technical",
      text: "Coding agents are streaming the generated source files.",
      proof: { worker: "api", status: "streaming", task: `Streaming ${Object.keys(fileMap).length} files into the live preview.` },
    });
    await emitFiles(onEvent, fileMap, "api");
    await persistImplementationFiles(missionId, fileMap);

    await onEvent({
      type: "implement_agent",
      agent: "technical",
      text: "Theo is verifying that save and reload works against durable memory.",
      proof: { worker: "api", status: "verifying", task: "POST then GET /api/memory against Firestore-backed preview runtime." },
    });
    const verification = await verifyMemoryPersistence(missionId);
    if (!verification.ok) {
      throw new Error("Live app save/reload verification failed. Durable memory did not persist.");
    }
    await onEvent({
      type: "implement_agent",
      agent: "technical",
      text: "Save/reload verified. Entries persist in Firestore-backed preview memory.",
      proof: { worker: "api", status: "verified", task: "Durable memory check passed.", verification },
    });

    let delivery = null;
    if (TOKEN) {
      await onEvent({
        type: "implement_agent",
        agent: "technical",
        text: "Deploy agent is publishing the real app to GitHub.",
        proof: { worker: "deploy", status: "publishing", task: "Create branch, commit app files, and open the implementation PR." },
      });
      delivery = await deliverImplementation(record, fileMap, runId);
    }

    const proof = {
      missionId,
      runId,
      status: "completed",
      engine: result.engine || "antigravity-sdk",
      summary: text(result.summary, "Real app implementation ready."),
      instruction: request,
      fileCount: Object.keys(fileMap).length,
      filePaths: Object.keys(fileMap).sort(),
      pullRequestUrl: delivery?.pullRequestUrl || "",
      repositoryUrl: delivery?.repositoryUrl || "",
      repoFolderUrl: repoFolderUrl(delivery?.folder || ""),
      previewAppUrl: previewAppUrl(missionId),
      folder: delivery?.folder || "",
      branch: delivery?.branch || "",
      reused: Boolean(delivery?.reused),
      antigravityError: result.antigravityError || null,
      storageContractRepaired: Boolean(result.storageContractRepaired),
      usesMemoryApi: true,
      verified: true,
      verification,
      durableMemory: true,
    };

    await runRef.set({
      ...proof,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

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
