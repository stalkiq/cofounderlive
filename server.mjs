import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import textToSpeech from "@google-cloud/text-to-speech";
import { ZipArchive } from "archiver";
import { runMvpSprint, runNightShift, runWatcherTick } from "./lib/agent.mjs";
import * as memory from "./lib/memory.mjs";
import { geminiStatus } from "./lib/gemini.mjs";
import { getWorkspaceState, runWorkspaceTurn } from "./lib/workspace.mjs";
import {
  analyzeVisionCapability,
  getBigQueryCapabilityData,
  getGeospatialCapabilityData,
  googleCapabilitiesStatus,
  runGeminiCapability,
  translateCapabilityText,
} from "./lib/google-capabilities.mjs";
import { buildProductFiles } from "./lib/product-export.mjs";
import { deliverProductToGitHub, githubDeliveryStatus } from "./lib/github-delivery.mjs";
import {
  findInvestorPageByIdea,
  getInvestorPage,
  getMvpPage,
  investorPageUrl,
  mvpPageUrl,
  renderInvestorPage,
  renderMvpPage,
  renderMissingPage,
} from "./lib/investor-page.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 8080);
const TTS_ENABLED = String(process.env.GOOGLE_TTS_ENABLED || "true").toLowerCase() === "true";
const TTS_LANGUAGE_CODE = process.env.TTS_LANGUAGE_CODE || "en-US";
const TTS_VOICE_NAME = process.env.TTS_VOICE_NAME || "en-US-Neural2-F";
const CREATIVE_TTS_VOICE = process.env.CREATIVE_TTS_VOICE || "en-US-Neural2-F";
const TECHNICAL_TTS_VOICE = process.env.TECHNICAL_TTS_VOICE || "en-US-Neural2-D";
const TICK_SECRET = process.env.TICK_SECRET || "nightshift";

const ttsClient = TTS_ENABLED ? new textToSpeech.TextToSpeechClient() : null;

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  if (
    req.path === "/"
    || req.path.startsWith("/site/")
    || req.path.startsWith("/mvp/")
    || /\.(?:html|js|css)$/.test(req.path)
  ) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});
app.use(express.static(path.join(__dirname, "web"), {
  etag: false,
  lastModified: false,
}));

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "cofounder-live",
    ttsEnabled: Boolean(ttsClient),
    gemini: geminiStatus(),
    googleCapabilities: googleCapabilitiesStatus(),
    githubDelivery: githubDeliveryStatus(),
    publishing: "firestore",
    missions: memory.listMissions().length,
  });
});

app.get("/api/missions", (_req, res) => {
  res.json({ missions: memory.listMissions(), events: memory.listEvents() });
});

app.post("/api/project/restore", async (req, res) => {
  const idea = String(req.body?.idea || "").trim();
  if (!idea) return res.status(400).json({ error: "idea is required" });
  try {
    const page = await findInvestorPageByIdea(idea);
    if (!page) return res.json({ found: false });
    const mvp = await getMvpPage(page.id);
    res.json({
      found: true,
      missionId: page.id,
      builtIdea: page.idea,
      brand: page.brand || null,
      review: page.review || null,
      page: {
        pageUrl: investorPageUrl(page.id),
        headline: page.site?.headline || "",
        revision: page.revision || 1,
      },
      mvpReview: mvp?.review || null,
      mvp: mvp ? {
        mvpUrl: mvpPageUrl(page.id),
        headline: mvp.mvp?.headline || "",
        workflow: mvp.mvp?.workflow?.title || "",
        googleCapability: mvp.mvp?.googleCapability || null,
        googleCapabilities: mvp.mvp?.googleCapabilities || (mvp.mvp?.googleCapability ? [mvp.mvp.googleCapability] : []),
        revision: mvp.revision || 1,
      } : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/site/:id", async (req, res) => {
  try {
    const page = await getInvestorPage(req.params.id);
    if (!page) {
      res.status(404).type("html").send(renderMissingPage());
      return;
    }
    res.type("html").send(renderInvestorPage(page));
  } catch (error) {
    res.status(500).type("html").send(renderMissingPage());
  }
});

app.get("/mvp/:id", async (req, res) => {
  try {
    const page = await getMvpPage(req.params.id);
    if (!page) {
      res.status(404).type("html").send(renderMissingPage());
      return;
    }
    res.type("html").send(renderMvpPage(page));
  } catch (error) {
    res.status(500).type("html").send(renderMissingPage());
  }
});

app.post("/api/mvp/:missionId/assistant", async (req, res) => {
  const missionId = String(req.params.missionId || "").trim();
  const message = String(req.body?.message || "").trim();
  if (!/^ep_[a-z0-9]+$/i.test(missionId)) {
    return res.status(400).json({ error: "valid missionId is required" });
  }
  if (!message) return res.status(400).json({ error: "message is required" });
  try {
    const record = await getMvpPage(missionId);
    if (!record?.mvp) return res.status(404).json({ error: "Product concept not found" });
    const text = await runGeminiCapability(message, record);
    res.setHeader("Cache-Control", "no-store");
    return res.json({ text, capability: "gemini" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/mvp/:missionId/analytics", async (req, res) => {
  const missionId = String(req.params.missionId || "").trim();
  if (!/^ep_[a-z0-9]+$/i.test(missionId)) {
    return res.status(400).json({ error: "valid missionId is required" });
  }
  try {
    const record = await getMvpPage(missionId);
    if (!record?.mvp) return res.status(404).json({ error: "Product concept not found" });
    const data = await getBigQueryCapabilityData(missionId, record.mvp);
    res.setHeader("Cache-Control", "no-store");
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/mvp/:missionId/capabilities/geo", async (req, res) => {
  const missionId = String(req.params.missionId || "").trim();
  if (!/^ep_[a-z0-9]+$/i.test(missionId)) {
    return res.status(400).json({ error: "valid missionId is required" });
  }
  try {
    const record = await getMvpPage(missionId);
    if (!record?.mvp) return res.status(404).json({ error: "Product concept not found" });
    const data = await getGeospatialCapabilityData(record);
    res.setHeader("Cache-Control", "no-store");
    return res.json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/mvp/:missionId/capabilities/translate", async (req, res) => {
  const missionId = String(req.params.missionId || "").trim();
  if (!/^ep_[a-z0-9]+$/i.test(missionId)) {
    return res.status(400).json({ error: "valid missionId is required" });
  }
  try {
    const record = await getMvpPage(missionId);
    if (!record?.mvp) return res.status(404).json({ error: "Product concept not found" });
    const result = await translateCapabilityText(req.body?.text, record, req.body?.targetLanguage);
    res.setHeader("Cache-Control", "no-store");
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/mvp/:missionId/capabilities/vision", async (req, res) => {
  const missionId = String(req.params.missionId || "").trim();
  if (!/^ep_[a-z0-9]+$/i.test(missionId)) {
    return res.status(400).json({ error: "valid missionId is required" });
  }
  try {
    const record = await getMvpPage(missionId);
    if (!record?.mvp) return res.status(404).json({ error: "Product concept not found" });
    const result = await analyzeVisionCapability(req.body?.image, record);
    res.setHeader("Cache-Control", "no-store");
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/agent/run", async (req, res) => {
  const goal = String(req.body?.goal || "").trim();
  if (!goal) return res.status(400).json({ error: "goal is required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (event) => {
    const row = memory.addEvent(event);
    res.write(`data: ${JSON.stringify(row)}\n\n`);
  };

  try {
    send({ type: "start", agent: "director", text: "The AI cofounders are taking the founder brief." });
    const result = await runNightShift(goal, async (event) => send(event));
    send({ type: "done", agent: "director", text: "The landing page is built and published.", proof: result.mission });
  } catch (err) {
    send({ type: "error", agent: "director", text: err.message });
  }
  res.end();
});

app.post("/api/agent/mvp", async (req, res) => {
  const missionId = String(req.body?.missionId || "").trim();
  if (!/^ep_[a-z0-9]+$/i.test(missionId)) {
    return res.status(400).json({ error: "valid missionId is required" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (event) => {
    const row = memory.addEvent(event);
    res.write(`data: ${JSON.stringify(row)}\n\n`);
  };

  try {
    send({ type: "start", agent: "director", text: "The landing page is approved. The cofounders are launching the MVP sprint." });
    const result = await runMvpSprint(missionId, async (event) => send(event));
    if (!result.mission?.mvpUrl || result.mission?.status !== "mvp_launched") {
      throw new Error("The MVP sprint stopped before the final prototype was published.");
    }
    send({ type: "done", agent: "director", text: "The working MVP is creative-approved and live.", proof: result.mission });
  } catch (err) {
    send({ type: "error", agent: "director", text: err.message });
  }
  res.end();
});

app.get("/api/workspace/:missionId", async (req, res) => {
  const missionId = String(req.params.missionId || "").trim();
  if (!/^ep_[a-z0-9]+$/i.test(missionId)) {
    return res.status(400).json({ error: "valid missionId is required" });
  }
  try {
    const workspace = await getWorkspaceState(missionId);
    if (!workspace) return res.status(404).json({ error: "Product concept not found" });
    res.json(workspace);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/workspace/:missionId/code", async (req, res) => {
  const missionId = String(req.params.missionId || "").trim();
  if (!/^ep_[a-z0-9]+$/i.test(missionId)) {
    return res.status(400).json({ error: "valid missionId is required" });
  }
  try {
    const record = await getMvpPage(missionId);
    if (!record?.mvp) return res.status(404).json({ error: "Product concept not found" });
    const product = buildProductFiles(record);
    res.attachment(`${product.slug}-concept.zip`);
    res.type("application/zip");
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on("warning", (error) => {
      if (error.code !== "ENOENT") archive.emit("error", error);
    });
    archive.on("error", (error) => {
      if (!res.headersSent) res.status(500).json({ error: error.message });
      else res.destroy(error);
    });
    archive.pipe(res);
    Object.entries(product.files).forEach(([filePath, content]) => {
      archive.append(content, { name: `${product.slug}/${filePath}` });
    });
    await archive.finalize();
  } catch (err) {
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
});

app.post("/api/workspace/:missionId/github", async (req, res) => {
  const missionId = String(req.params.missionId || "").trim();
  if (!/^ep_[a-z0-9]+$/i.test(missionId)) {
    return res.status(400).json({ error: "valid missionId is required" });
  }
  try {
    const record = await getMvpPage(missionId);
    if (!record?.mvp) return res.status(404).json({ error: "Product concept not found" });
    const delivery = await deliverProductToGitHub(record);
    return res.json(delivery);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/workspace/:missionId/turn", async (req, res) => {
  const missionId = String(req.params.missionId || "").trim();
  const instruction = String(req.body?.instruction || "").trim();
  if (!/^ep_[a-z0-9]+$/i.test(missionId)) {
    return res.status(400).json({ error: "valid missionId is required" });
  }
  if (!instruction) return res.status(400).json({ error: "instruction is required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  const send = (event) => {
    const row = memory.addEvent(event);
    res.write(`data: ${JSON.stringify(row)}\n\n`);
  };
  try {
    send({ type: "studio_start", agent: "director", text: "The AI Build Studio is applying your request." });
    const proof = await runWorkspaceTurn(missionId, instruction, async (event) => send(event));
    send({ type: "studio_done", agent: "director", text: "Your product concept has been updated.", proof });
  } catch (err) {
    send({ type: "error", agent: "director", text: err.message });
  }
  res.end();
});

app.post("/api/agent/tick", async (req, res) => {
  const secret = req.get("x-tick-secret") || req.body?.secret;
  if (secret !== TICK_SECRET) return res.status(401).json({ error: "unauthorized" });
  try {
    const out = await runWatcherTick(async (event) => memory.addEvent(event));
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/tts", async (req, res) => {
  try {
    const text = String(req.body?.text || "").trim().slice(0, 1200);
    const agent = String(req.body?.agent || "director");
    if (!text) return res.status(400).json({ error: "text is required" });
    if (!ttsClient) return res.status(503).json({ error: "TTS is not enabled" });

    const [response] = await ttsClient.synthesizeSpeech({
      input: { text },
      voice: {
        languageCode: TTS_LANGUAGE_CODE,
        name: agent === "creative"
          ? CREATIVE_TTS_VOICE
          : agent === "technical"
            ? TECHNICAL_TTS_VOICE
            : TTS_VOICE_NAME,
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: agent === "technical" ? 0.94 : 0.97,
        pitch: agent === "technical" ? -1.2 : 0.8,
      },
    });

    const audio = response.audioContent;
    if (!audio) return res.status(500).json({ error: "No audio returned" });
    const buffer = Buffer.isBuffer(audio) ? audio : Buffer.from(audio, "base64");
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : "TTS failed" });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "web", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Cofounder Live listening on 0.0.0.0:${PORT}`);
});
