import { BigQuery } from "@google-cloud/bigquery";
import { TranslationServiceClient } from "@google-cloud/translate";
import vision from "@google-cloud/vision";
import { generateContent } from "./gemini.mjs";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || "swift-approach-506317-p4";
const DATASET = process.env.BIGQUERY_DATASET || "cofounder_live";
const LOCATION = process.env.BIGQUERY_LOCATION || "US";
const SERVER_KEY = process.env.GOOGLE_CAPABILITIES_SERVER_KEY || "";
const CACHE_TTL_MS = 5 * 60 * 1000;
const bigquery = new BigQuery({ projectId: PROJECT });
const translation = new TranslationServiceClient();
const visionClient = new vision.ImageAnnotatorClient();
const cache = new Map();

export const GOOGLE_CAPABILITIES = [
  "maps",
  "places",
  "routes",
  "weather",
  "air_quality",
  "geocoding",
  "translation",
  "vision",
  "gemini",
  "bigquery",
  "tts",
];

const LABELS = {
  maps: "Interactive Google Maps",
  places: "Google Places discovery",
  routes: "Google Routes planning",
  weather: "Google Weather conditions",
  air_quality: "Google Air Quality",
  geocoding: "Google Geocoding",
  translation: "Cloud Translation",
  vision: "Cloud Vision",
  gemini: "Gemini product copilot",
  bigquery: "BigQuery live analytics",
  tts: "Cloud Text-to-Speech",
  calendar: "Google Calendar planning",
};

const SCREEN_SUPPORT = {
  maps: ["map"],
  places: ["map"],
  routes: ["map"],
  weather: ["map"],
  air_quality: ["map"],
  geocoding: ["map"],
  translation: ["assistant", "chat"],
  vision: ["assistant"],
  gemini: ["assistant", "chat"],
  bigquery: ["table"],
  tts: ["assistant", "chat", "workflow"],
  calendar: ["calendar", "workflow"],
};

function cleanText(value, fallback = "", limit = 600) {
  return typeof value === "string" ? value.trim().slice(0, limit) : fallback;
}

export function normalizeGoogleCapability(value, previous = {}) {
  const next = value && typeof value === "object" ? value : {};
  const prior = previous && typeof previous === "object" ? previous : {};
  const allowed = [...GOOGLE_CAPABILITIES, "calendar"];
  const service = allowed.includes(next.service)
    ? next.service
    : allowed.includes(prior.service)
      ? prior.service
      : "gemini";
  const config = next.config && typeof next.config === "object"
    ? next.config
    : prior.config && typeof prior.config === "object"
      ? prior.config
      : {};
  return {
    service,
    label: cleanText(next.label, prior.label || LABELS[service], 80),
    rationale: cleanText(next.rationale, prior.rationale || "Selected by Theo to support the product's core workflow.", 320),
    primaryScreen: Math.max(0, Math.min(2, Number(next.primaryScreen ?? prior.primaryScreen ?? 0) || 0)),
    config: {
      assistantRole: cleanText(config.assistantRole, "Help the user complete the product's core workflow using only the supplied product context.", 500),
      mapQuery: cleanText(config.mapQuery, "", 180),
      locationQuery: cleanText(config.locationQuery, config.mapQuery || "", 180),
      origin: cleanText(config.origin, "", 180),
      destination: cleanText(config.destination, "", 180),
      calendarTitle: cleanText(config.calendarTitle, "", 120),
      analyticsLabel: cleanText(config.analyticsLabel, "Live sample operations data", 120),
      targetLanguage: cleanText(config.targetLanguage, "es", 12).toLowerCase(),
      analysisMode: ["labels", "text", "both"].includes(config.analysisMode) ? config.analysisMode : "both",
      speechPrompt: cleanText(config.speechPrompt, "Read this result aloud", 160),
    },
  };
}

export function normalizeGoogleCapabilities(value, previous = []) {
  const nextValues = Array.isArray(value) ? value : value ? [value] : [];
  const priorValues = Array.isArray(previous) ? previous : previous ? [previous] : [];
  const source = nextValues.length ? nextValues : priorValues.length ? priorValues : [{ service: "gemini" }];
  const seen = new Set();
  const capabilities = [];
  for (const candidate of source) {
    const prior = priorValues.find((item) => item?.service === candidate?.service) || {};
    const capability = normalizeGoogleCapability(candidate, prior);
    if (!GOOGLE_CAPABILITIES.includes(capability.service) || seen.has(capability.service)) continue;
    seen.add(capability.service);
    capabilities.push(capability);
    if (capabilities.length === 2) break;
  }
  return capabilities.length ? capabilities : [normalizeGoogleCapability({ service: "gemini" })];
}

export function capabilitiesFor(mvp) {
  return normalizeGoogleCapabilities(
    mvp?.googleCapabilities || mvp?.googleCapability,
    mvp?.googleCapabilities || mvp?.googleCapability,
  );
}

function hasCapability(mvp, service) {
  return capabilitiesFor(mvp).some((capability) => capability.service === service);
}

function requireCapability(record, service) {
  const capability = capabilitiesFor(record?.mvp).find((item) => item.service === service);
  if (!capability) throw new Error(`This product does not use ${LABELS[service] || service}.`);
  return capability;
}

function cacheKey(prefix, value) {
  return `${prefix}:${JSON.stringify(value)}`;
}

async function cached(prefix, input, loader) {
  const key = cacheKey(prefix, input);
  const existing = cache.get(key);
  if (existing && existing.expiresAt > Date.now()) return existing.value;
  const value = await loader();
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

async function mapFetch(url, options = {}) {
  if (!SERVER_KEY) throw new Error("Google Maps Platform server key is not configured.");
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.status && payload.status !== "OK") {
    throw new Error(payload.error?.message || payload.error_message || `Google Maps Platform request failed (${response.status})`);
  }
  return payload;
}

function tableName(missionId) {
  return `mvp_${String(missionId).toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 80)}`;
}

function analyticsItems(mvp) {
  const capability = capabilitiesFor(mvp).find((item) => item.service === "bigquery")
    || normalizeGoogleCapability({ service: "bigquery" });
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

export async function prepareGoogleCapabilities(missionId, mvp) {
  const capabilities = normalizeGoogleCapabilities(mvp?.googleCapabilities || mvp?.googleCapability);
  const screens = Array.isArray(mvp?.screens) ? mvp.screens : [];
  for (const capability of capabilities) {
    const supportedScreens = SCREEN_SUPPORT[capability.service] || ["assistant"];
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
  }
  mvp.googleCapabilities = capabilities;
  mvp.googleCapability = capabilities[0];
  if (!capabilities.some((capability) => capability.service === "bigquery")) return capabilities;

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
  return capabilities;
}

export async function prepareGoogleCapability(missionId, mvp) {
  const capabilities = await prepareGoogleCapabilities(missionId, mvp);
  return capabilities[0];
}

export async function getBigQueryCapabilityData(missionId, mvp) {
  const capability = capabilitiesFor(mvp).find((item) => item.service === "bigquery");
  if (!capability) throw new Error("This product does not use BigQuery.");
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
  const capability = requireCapability(record, "gemini");
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

export async function getGeospatialCapabilityData(record) {
  const capabilities = capabilitiesFor(record?.mvp);
  const geoServices = capabilities.filter((capability) =>
    ["maps", "places", "routes", "weather", "air_quality", "geocoding"].includes(capability.service));
  if (!geoServices.length) throw new Error("This product does not use a geospatial Google capability.");
  const primary = geoServices[0];
  const locationQuery = primary.config.locationQuery
    || primary.config.origin
    || primary.config.mapQuery
    || record?.mvp?.screens?.[primary.primaryScreen]?.items?.[0]?.meta
    || record?.idea
    || "San Francisco, CA";
  const resolveLocation = (query) => cached("geocode", query, async () => {
    if (/^(world|global|worldwide|earth|international)$/i.test(String(query).trim())) {
      return { lat: 20, lng: 0, address: "Global view" };
    }
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", query);
    url.searchParams.set("key", SERVER_KEY);
    const payload = await mapFetch(url);
    const result = payload.results?.[0];
    if (!result) throw new Error(`No location found for “${query}”.`);
    return {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng,
      address: result.formatted_address,
    };
  });
  const geocode = await resolveLocation(locationQuery);
  const output = {
    center: geocode,
    services: geoServices.map((capability) => capability.service),
    places: [],
    weather: null,
    airQuality: null,
    route: null,
    errors: [],
  };
  await Promise.all(geoServices.map(async (capability) => {
    try {
      if (capability.service === "places") {
        const query = capability.config.mapQuery || locationQuery;
        output.places = await cached("places", query, async () => {
          const payload = await mapFetch("https://places.googleapis.com/v1/places:searchText", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": SERVER_KEY,
              "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.rating",
            },
            body: JSON.stringify({ textQuery: query, maxResultCount: 8 }),
          });
          return (payload.places || []).map((place) => ({
            id: place.id,
            name: place.displayName?.text || "Place",
            address: place.formattedAddress || "",
            lat: place.location?.latitude,
            lng: place.location?.longitude,
            mapsUrl: place.googleMapsUri || "",
            rating: place.rating || null,
          }));
        });
      }
      if (capability.service === "weather") {
        const weatherLocation = await resolveLocation(capability.config.locationQuery || locationQuery);
        output.weather = await cached("weather", weatherLocation, async () => {
          const url = new URL("https://weather.googleapis.com/v1/currentConditions:lookup");
          url.searchParams.set("key", SERVER_KEY);
          url.searchParams.set("location.latitude", weatherLocation.lat);
          url.searchParams.set("location.longitude", weatherLocation.lng);
          url.searchParams.set("unitsSystem", "IMPERIAL");
          const payload = await mapFetch(url);
          return {
            location: weatherLocation.address,
            description: payload.weatherCondition?.description?.text || "Current conditions",
            temperature: payload.temperature?.degrees,
            feelsLike: payload.feelsLikeTemperature?.degrees,
            unit: payload.temperature?.unit || "FAHRENHEIT",
            humidity: payload.relativeHumidity,
            uvIndex: payload.uvIndex,
            wind: payload.wind?.speed?.value,
          };
        });
      }
      if (capability.service === "air_quality") {
        const airLocation = await resolveLocation(capability.config.locationQuery || locationQuery);
        output.airQuality = await cached("air-quality", airLocation, async () => {
          const payload = await mapFetch(`https://airquality.googleapis.com/v1/currentConditions:lookup?key=${encodeURIComponent(SERVER_KEY)}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              universalAqi: true,
              location: { latitude: airLocation.lat, longitude: airLocation.lng },
              extraComputations: ["HEALTH_RECOMMENDATIONS", "DOMINANT_POLLUTANT_CONCENTRATION", "LOCAL_AQI"],
              languageCode: "en",
            }),
          });
          const index = payload.indexes?.[0] || {};
          return {
            location: airLocation.address,
            aqi: index.aqi,
            category: index.category || "Current air quality",
            dominantPollutant: index.dominantPollutant || "",
            recommendation: payload.healthRecommendations?.generalPopulation || "",
          };
        });
      }
      if (capability.service === "routes") {
        const origin = capability.config.origin || locationQuery;
        const destination = capability.config.destination || capability.config.mapQuery || "";
        if (!destination) throw new Error("Theo did not provide a route destination.");
        output.route = await cached("route", { origin, destination }, async () => {
          const payload = await mapFetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": SERVER_KEY,
              "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.localizedValues",
            },
            body: JSON.stringify({
              origin: { address: origin },
              destination: { address: destination },
              travelMode: "DRIVE",
              routingPreference: "TRAFFIC_AWARE",
              computeAlternativeRoutes: false,
              languageCode: "en-US",
              units: "IMPERIAL",
            }),
          });
          const route = payload.routes?.[0];
          if (!route) throw new Error("No route was returned.");
          return {
            origin,
            destination,
            distance: route.localizedValues?.distance?.text || `${route.distanceMeters || 0} m`,
            duration: route.localizedValues?.duration?.text || route.duration || "",
            polyline: route.polyline?.encodedPolyline || "",
          };
        });
      }
    } catch (error) {
      output.errors.push({ service: capability.service, message: error.message });
    }
  }));
  return output;
}

export async function translateCapabilityText(message, record, targetLanguage) {
  const capability = requireCapability(record, "translation");
  const text = cleanText(message, "", 3000);
  if (!text) throw new Error("Text is required for translation.");
  const target = cleanText(targetLanguage, capability.config.targetLanguage || "es", 12);
  const [response] = await translation.translateText({
    parent: `projects/${PROJECT}/locations/global`,
    contents: [text],
    mimeType: "text/plain",
    targetLanguageCode: target,
  });
  return {
    text: response.translations?.[0]?.translatedText || "",
    targetLanguage: target,
  };
}

export async function analyzeVisionCapability(imageBase64, record) {
  const capability = requireCapability(record, "vision");
  const content = cleanText(imageBase64, "", 2_000_000).replace(/^data:image\/[a-z0-9.+-]+;base64,/i, "");
  if (!content) throw new Error("An image is required.");
  const features = [];
  if (["labels", "both"].includes(capability.config.analysisMode)) {
    features.push({ type: "LABEL_DETECTION", maxResults: 8 });
  }
  if (["text", "both"].includes(capability.config.analysisMode)) {
    features.push({ type: "TEXT_DETECTION", maxResults: 1 });
  }
  const [result] = await visionClient.annotateImage({
    image: { content },
    features,
  });
  return {
    labels: (result.labelAnnotations || []).map((label) => ({
      description: label.description,
      score: Math.round(Number(label.score || 0) * 100),
    })),
    text: cleanText(result.fullTextAnnotation?.text || result.textAnnotations?.[0]?.description, "", 5000),
  };
}

export function googleCapabilitiesStatus() {
  return {
    available: GOOGLE_CAPABILITIES,
    mapsBrowserConfigured: Boolean(process.env.MAPS_BROWSER_KEY),
    mapsServerConfigured: Boolean(SERVER_KEY),
    maxPerProduct: 2,
  };
}
