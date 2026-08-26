import { BigQuery } from "@google-cloud/bigquery";
import { generateContent } from "./gemini.mjs";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || "swift-approach-506317-p4";
const DATASET = process.env.BIGQUERY_DATASET || "cofounder_live";
const LOCATION = process.env.BIGQUERY_LOCATION || "US";
const bigquery = new BigQuery({ projectId: PROJECT });

export const GOOGLE_CAPABILITIES = ["maps", "calendar", "bigquery", "gemini"];

function cleanText(value, fallback = "", limit = 600) {
  return typeof value === "string" ? value.trim().slice(0, limit) : fallback;
}

export function normalizeGoogleCapability(value, previous = {}) {
  const next = value && typeof value === "object" ? value : {};
  const prior = previous && typeof previous === "object" ? previous : {};
  const service = GOOGLE_CAPABILITIES.includes(next.service)
    ? next.service
    : GOOGLE_CAPABILITIES.includes(prior.service)
      ? prior.service
      : "gemini";
  const config = next.config && typeof next.config === "object"
    ? next.config
    : prior.config && typeof prior.config === "object"
      ? prior.config
      : {};
  return {
    service,
    label: cleanText(next.label, prior.label || {
      maps: "Google Maps discovery",
      calendar: "Google Calendar planning",
      bigquery: "BigQuery live analytics",
      gemini: "Gemini product copilot",
    }[service], 80),
    rationale: cleanText(next.rationale, prior.rationale || "Selected by Theo to support the product's core workflow.", 320),
    primaryScreen: Math.max(0, Math.min(2, Number(next.primaryScreen ?? prior.primaryScreen ?? 0) || 0)),
    config: {
      assistantRole: cleanText(config.assistantRole, "Help the user complete the product's core workflow using only the supplied product context.", 500),
      mapQuery: cleanText(config.mapQuery, "", 180),
      calendarTitle: cleanText(config.calendarTitle, "", 120),
      analyticsLabel: cleanText(config.analyticsLabel, "Live sample operations data", 120),
    },
  };
}

function tableName(missionId) {
  return `mvp_${String(missionId).toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 80)}`;
}

function analyticsItems(mvp) {
  const capability = normalizeGoogleCapability(mvp?.googleCapability);
  const primary = mvp?.screens?.[capability.primaryScreen];
  const source = primary?.items?.length
    ? primary.items
    : mvp?.screens?.find((screen) => screen?.items?.length)?.items || [];
  return source.slice(0, 20).map((item, index) => ({
    rank: index + 1,
    name: cleanText(item?.title, `Sample row ${index + 1}`, 200),
    details: cleanText(item?.detail, "", 500),
    status: cleanText(item?.status, "Sample", 100),
    value: cleanText(item?.value || item?.meta, "—", 200),
    refreshed_at: new Date().toISOString(),
  }));
}

export async function prepareGoogleCapability(missionId, mvp) {
  const capability = normalizeGoogleCapability(mvp?.googleCapability);
  const supportedScreens = {
    maps: ["map"],
    calendar: ["calendar", "workflow"],
    bigquery: ["table"],
    gemini: ["assistant", "chat"],
  }[capability.service];
  const screens = Array.isArray(mvp?.screens) ? mvp.screens : [];
  let primaryScreen = screens.findIndex((screen) => supportedScreens.includes(screen?.type));
  if (primaryScreen < 0 && screens.length) {
    primaryScreen = screens.findIndex((screen) => screen?.type !== "workflow");
    if (primaryScreen < 0) primaryScreen = 0;
    screens[primaryScreen] = {
      ...screens[primaryScreen],
      type: supportedScreens[0],
      label: capability.label,
      title: capability.label,
    };
  }
  if (primaryScreen >= 0) capability.primaryScreen = primaryScreen;
  mvp.googleCapability = capability;
  if (capability.service !== "bigquery") return capability;

  const dataset = bigquery.dataset(DATASET);
  await dataset.get({ autoCreate: true, location: LOCATION });
  const table = dataset.table(tableName(missionId));
  await table.get({
    autoCreate: true,
    schema: [
      { name: "rank", type: "INTEGER", mode: "REQUIRED" },
      { name: "name", type: "STRING", mode: "REQUIRED" },
      { name: "details", type: "STRING" },
      { name: "status", type: "STRING" },
      { name: "value", type: "STRING" },
      { name: "refreshed_at", type: "TIMESTAMP" },
    ],
  });
  await bigquery.query({
    query: `DELETE FROM \`${PROJECT}.${DATASET}.${tableName(missionId)}\` WHERE TRUE`,
    location: LOCATION,
  });
  const rows = analyticsItems(mvp);
  if (rows.length) await table.insert(rows);
  return capability;
}

export async function getBigQueryCapabilityData(missionId, mvp) {
  const capability = normalizeGoogleCapability(mvp?.googleCapability);
  if (capability.service !== "bigquery") throw new Error("This product does not use BigQuery.");
  const [rows] = await bigquery.query({
    query: `SELECT rank, name, details, status, value, refreshed_at
      FROM \`${PROJECT}.${DATASET}.${tableName(missionId)}\`
      ORDER BY rank
      LIMIT 20`,
    location: LOCATION,
  });
  return {
    label: capability.config.analyticsLabel,
    source: `BigQuery · ${DATASET}.${tableName(missionId)}`,
    rows: rows.map((row) => ({
      rank: Number(row.rank),
      name: cleanText(row.name),
      details: cleanText(row.details),
      status: cleanText(row.status),
      value: cleanText(row.value),
      refreshedAt: row.refreshed_at?.value || row.refreshed_at || null,
    })),
  };
}

export async function runGeminiCapability(message, record) {
  const capability = normalizeGoogleCapability(record?.mvp?.googleCapability);
  if (capability.service !== "gemini") throw new Error("This product does not use Gemini assistance.");
  const prompt = cleanText(message, "", 1000);
  if (!prompt) throw new Error("A message is required.");
  const response = await generateContent({
    system: `You are the embedded Gemini capability inside ${cleanText(record.mvp?.name, "this product", 100)}.
${capability.config.assistantRole}
Use the founder idea and product specification below as your only product context. Be useful, concise, and honest. Never claim that sample data is real.

FOUNDER IDEA:
${cleanText(record.idea, "", 1200)}

PRODUCT SPECIFICATION:
${JSON.stringify(record.mvp).slice(0, 12000)}`,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    temperature: 0.25,
    maxOutputTokens: 900,
  });
  const text = response?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("").trim();
  if (!text) throw new Error("Gemini did not return a response.");
  return text;
}
