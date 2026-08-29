import { GoogleGenAI } from "@google/genai";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || "swift-approach-506317-p4";
const LOCATION = process.env.VERTEX_LOCATION || "global";
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const FALLBACK_MODELS = [PRIMARY_MODEL, "gemini-2.5-flash"];
const GEMMA_MODEL = process.env.GEMMA_MODEL || "publishers/google/models/gemma-4-26b-a4b-it-maas";

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT,
  location: LOCATION,
});

export const STUDIO_MODELS = {
  gemini: {
    id: "gemini",
    label: "Gemini 3.5 Flash",
    role: "agent",
    model: PRIMARY_MODEL,
  },
  gemma: {
    id: "gemma",
    label: "Gemma 4",
    role: "draft",
    model: GEMMA_MODEL,
  },
};

export function normalizeStudioModel(value) {
  const key = String(value || "gemini").trim().toLowerCase();
  return STUDIO_MODELS[key] ? key : "gemini";
}

function responseText(data) {
  if (typeof data?.text === "string" && data.text.trim()) return data.text.trim();
  return data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim() || "";
}

export async function generateContent({
  contents,
  system,
  tools,
  temperature = 0.3,
  maxOutputTokens = 2048,
  responseMimeType,
  model,
} = {}) {
  const config = {
    temperature,
    maxOutputTokens,
  };
  if (responseMimeType) config.responseMimeType = responseMimeType;
  if (system) config.systemInstruction = system;
  if (tools?.length) config.tools = tools;

  const models = model
    ? [model]
    : [...new Set(FALLBACK_MODELS)];

  let lastError;
  for (const candidate of models) {
    try {
      return await ai.models.generateContent({
        model: candidate,
        contents,
        config,
      });
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || error?.code || 0);
      const message = String(error?.message || error);
      const missing = status === 404 || /not found|does not exist|not supported/i.test(message);
      if (!missing || model) break;
    }
  }
  throw new Error(lastError?.message || "Google Gen AI SDK request failed");
}

export async function generateJson(prompt, { model } = {}) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const retryInstruction = attempt
      ? `\n\nYour previous response was invalid JSON. Retry from scratch. Return one complete JSON object with double-quoted keys and strings, valid commas, no comments, and no markdown.`
      : "";
    const data = await generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: `${prompt}${retryInstruction}` }] }],
      temperature: attempt ? 0.15 : 0.35,
      maxOutputTokens: 6144,
      responseMimeType: "application/json",
    });
    const text = responseText(data);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      lastError = new Error("Model did not return JSON.");
      continue;
    }
    try {
      return JSON.parse(match[0]);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Model returned invalid JSON after three attempts: ${lastError?.message || "unknown parse error"}`);
}

export async function generateGemmaDraft(prompt) {
  try {
    return await generateJson(prompt, { model: GEMMA_MODEL });
  } catch (error) {
    // Gemma MaaS may reject responseMimeType on some revisions; fall back to plain text JSON extraction.
    const data = await generateContent({
      model: GEMMA_MODEL,
      contents: [{ role: "user", parts: [{ text: `${prompt}\n\nReturn ONLY one JSON object.` }] }],
      temperature: 0.35,
      maxOutputTokens: 2048,
    });
    const text = responseText(data);
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error(error.message || "Gemma did not return a draft.");
    return JSON.parse(match[0]);
  }
}

export function geminiStatus() {
  return {
    provider: "vertex",
    sdk: "@google/genai",
    sdkVersion: "2.19.0",
    project: PROJECT,
    location: LOCATION,
    model: PRIMARY_MODEL,
    gemma: {
      available: true,
      model: GEMMA_MODEL,
      role: "studio drafting",
    },
    studioModels: Object.values(STUDIO_MODELS).map((item) => ({
      id: item.id,
      label: item.label,
      role: item.role,
      model: item.model,
    })),
  };
}
