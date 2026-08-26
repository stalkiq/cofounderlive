import { GoogleGenAI } from "@google/genai";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || "swift-approach-506317-p4";
const LOCATION = process.env.VERTEX_LOCATION || "global";
const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";
const FALLBACK_MODELS = [PRIMARY_MODEL, "gemini-2.5-flash"];

const ai = new GoogleGenAI({
  vertexai: true,
  project: PROJECT,
  location: LOCATION,
});

export async function generateContent({
  contents,
  system,
  tools,
  temperature = 0.3,
  maxOutputTokens = 2048,
  responseMimeType,
} = {}) {
  const config = {
    temperature,
    maxOutputTokens,
  };
  if (responseMimeType) config.responseMimeType = responseMimeType;
  if (system) config.systemInstruction = system;
  if (tools?.length) config.tools = tools;

  let lastError;
  for (const model of [...new Set(FALLBACK_MODELS)]) {
    try {
      return await ai.models.generateContent({
        model,
        contents,
        config,
      });
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || error?.code || 0);
      const message = String(error?.message || error);
      const missing = status === 404 || /not found|does not exist|not supported/i.test(message);
      if (!missing) break;
    }
  }
  throw new Error(lastError?.message || "Google Gen AI SDK request failed");
}

export async function generateJson(prompt) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const retryInstruction = attempt
      ? `\n\nYour previous response was invalid JSON. Retry from scratch. Return one complete JSON object with double-quoted keys and strings, valid commas, no comments, and no markdown.`
      : "";
    const data = await generateContent({
      contents: [{ role: "user", parts: [{ text: `${prompt}${retryInstruction}` }] }],
      temperature: attempt ? 0.15 : 0.35,
      maxOutputTokens: 6144,
      responseMimeType: "application/json",
    });
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      lastError = new Error("Gemini did not return JSON.");
      continue;
    }
    try {
      return JSON.parse(match[0]);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`Gemini returned invalid JSON after three attempts: ${lastError?.message || "unknown parse error"}`);
}

export function geminiStatus() {
  return {
    provider: "vertex",
    sdk: "@google/genai",
    sdkVersion: "2.19.0",
    project: PROJECT,
    location: LOCATION,
    model: PRIMARY_MODEL,
  };
}
