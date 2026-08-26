import { Firestore, FieldValue } from "@google-cloud/firestore";
import { generateJson as geminiJson } from "./gemini.mjs";
import { getMvpPage, saveMvpPage } from "./investor-page.mjs";
import { MVP_SCHEMA } from "./tools.mjs";
import { normalizeGoogleCapabilities, prepareGoogleCapabilities } from "./google-capabilities.mjs";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || "swift-approach-506317-p4";
const db = new Firestore({ projectId: PROJECT });
const SCREEN_TYPES = ["dashboard", "catalog", "timeline", "kanban", "chat", "calendar", "table", "map", "assistant", "workflow"];
const ARCHETYPES = ["terminal", "marketplace", "mobile", "workspace", "assistant", "operations", "analytics", "community"];

function text(value, fallback = "") {
  return typeof value === "string" ? value.slice(0, 1200) : fallback;
}

function choice(value, options, fallback) {
  return options.includes(value) ? value : fallback;
}

function palette(next = {}, previous = {}) {
  const fallback = {
    background: "#0b0f14",
    surface: "#141b24",
    primary: "#8fc7ff",
    accent: "#b8f27c",
    text: "#f7f9fc",
  };
  return Object.fromEntries(Object.keys(fallback).map((key) => {
    const candidate = next[key];
    const prior = previous[key];
    const value = /^#[0-9a-f]{6}$/i.test(String(candidate || ""))
      ? candidate
      : /^#[0-9a-f]{6}$/i.test(String(prior || ""))
        ? prior
        : fallback[key];
    return [key, value];
  }));
}

function items(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 10).map((item) => ({
    title: text(item?.title, "Sample item"),
    detail: text(item?.detail),
    status: text(item?.status, "Sample").slice(0, 80),
    meta: text(item?.meta).slice(0, 120),
    value: text(item?.value).slice(0, 120),
  }));
}

function metrics(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 4).map((metric) => ({
    label: text(metric?.label, "Sample metric").slice(0, 100),
    value: text(metric?.value, "—").slice(0, 100),
  }));
}

function sanitizeSpec(candidate, current) {
  const next = candidate && typeof candidate === "object" ? candidate : {};
  const previous = current && typeof current === "object" ? current : {};
  let screens = Array.isArray(next.screens)
    ? next.screens.filter((screen) => SCREEN_TYPES.includes(screen?.type)).slice(0, 3).map((screen) => ({
      label: text(screen.label, screen.type).slice(0, 40),
      type: screen.type,
      title: text(screen.title, screen.label).slice(0, 160),
      description: text(screen.description).slice(0, 500),
      metrics: metrics(screen.metrics),
      items: items(screen.items),
    }))
    : [];
  if (!screens.length) screens = previous.screens || [];
  while (screens.length < 3) {
    screens.push({
      label: screens.length === 2 ? "Create" : "Explore",
      type: screens.length === 2 ? "workflow" : "catalog",
      title: screens.length === 2 ? "Create an entry" : "Explore",
      description: "",
      metrics: [],
      items: [],
    });
  }
  if (!screens.some((screen) => screen.type === "workflow")) {
    screens[2] = { label: "Create", type: "workflow", title: text(next.workflow?.title, "Create an entry"), description: "", metrics: [], items: [] };
  }
  const fields = Array.isArray(next.workflow?.fields)
    ? next.workflow.fields.slice(0, 5).map((field) => {
      const type = choice(field?.type, ["text", "select", "date"], "text");
      const normalized = {
        label: text(field?.label, "Input").slice(0, 100),
        type,
        placeholder: text(field?.placeholder).slice(0, 180),
      };
      if (type === "select") {
        normalized.options = Array.isArray(field?.options)
          ? field.options.slice(0, 6).map((option) => text(option).slice(0, 80))
          : [];
      }
      return normalized;
    })
    : previous.workflow?.fields || [];
  const priorExperience = previous.experience || {};
  const experience = next.experience || {};
  const googleCapabilities = normalizeGoogleCapabilities(
    next.googleCapabilities || next.googleCapability,
    previous.googleCapabilities || previous.googleCapability,
  );

  return {
    ...previous,
    name: text(next.name, previous.name || "Product concept").slice(0, 80),
    workspaceLabel: text(next.workspaceLabel, previous.workspaceLabel || "Founder workspace").slice(0, 120),
    experience: {
      archetype: choice(experience.archetype, ARCHETYPES, priorExperience.archetype || "workspace"),
      device: choice(experience.device, ["desktop", "mobile"], priorExperience.device || "desktop"),
      navigationStyle: choice(experience.navigationStyle, ["sidebar", "topbar", "bottom"], priorExperience.navigationStyle || "sidebar"),
      density: choice(experience.density, ["compact", "comfortable", "spacious"], priorExperience.density || "comfortable"),
      typeStyle: choice(experience.typeStyle, ["sans", "serif", "mono"], priorExperience.typeStyle || "sans"),
      radius: choice(experience.radius, ["sharp", "soft", "rounded"], priorExperience.radius || "soft"),
      motif: text(experience.motif, priorExperience.motif || "product workspace").slice(0, 180),
    },
    eyebrow: text(next.eyebrow, previous.eyebrow).slice(0, 120),
    headline: text(next.headline, previous.headline).slice(0, 220),
    subheadline: text(next.subheadline, previous.subheadline).slice(0, 500),
    palette: palette(next.palette, previous.palette),
    googleCapabilities,
    googleCapability: googleCapabilities[0],
    screens,
    workflow: {
      title: text(next.workflow?.title, previous.workflow?.title || "Create an entry").slice(0, 160),
      description: text(next.workflow?.description, previous.workflow?.description).slice(0, 500),
      fields,
      buttonLabel: text(next.workflow?.buttonLabel, previous.workflow?.buttonLabel || "Save").slice(0, 80),
      successTitle: text(next.workflow?.successTitle, previous.workflow?.successTitle || "Saved").slice(0, 120),
      successMessage: text(next.workflow?.successMessage, previous.workflow?.successMessage || "Your update was saved locally.").slice(0, 400),
    },
  };
}

export async function getWorkspaceState(missionId) {
  const [workspaceSnapshot, mvpRecord] = await Promise.all([
    db.collection("mvpWorkspaces").doc(missionId).get(),
    getMvpPage(missionId),
  ]);
  if (!mvpRecord) return null;
  const revisions = await db.collection("mvpWorkspaces")
    .doc(missionId)
    .collection("revisions")
    .orderBy("revision", "desc")
    .limit(8)
    .get();
  return {
    missionId,
    revision: workspaceSnapshot.exists
      ? workspaceSnapshot.data().revision || mvpRecord.revision || 2
      : mvpRecord.revision || 2,
    mvpUrl: `/mvp/${encodeURIComponent(missionId)}`,
    history: revisions.docs.map((doc) => {
      const row = doc.data();
      return {
        revision: row.revision,
        instruction: row.instruction,
        summary: row.summary,
      };
    }),
  };
}

export async function runWorkspaceTurn(missionId, instruction, onEvent = async () => {}) {
  const record = await getMvpPage(missionId);
  if (!record?.mvp) throw new Error("Launch a product concept before opening the AI Build Studio.");
  const request = text(instruction).trim();
  if (!request) throw new Error("Describe the product change you want.");

  await onEvent({
    type: "studio_step",
    agent: "creative",
    text: "Creative is translating your request into a focused product and design plan.",
  });
  const plan = await geminiJson(`You are the Creative Cofounder inside an iterative AI product studio.

FOUNDER REQUEST:
${request}

CURRENT PRODUCT SPECIFICATION:
${JSON.stringify(record.mvp)}

Create a focused plan that respects the request and improves usability. Use only the supported controlled runtime: dashboard, catalog, timeline, kanban, chat, calendar, table, map, assistant, and workflow screens. Preserve or improve the product's one or two supported Google capabilities: Maps, Places, Routes, Weather, Air Quality, Geocoding, Translation, Vision, BigQuery, Gemini, or Text-to-Speech. Every capability must create a visible action and complementary capabilities must share a coherent workflow. Do not request other external models, credentials, arbitrary JavaScript, shell commands, package installation, or unsupported APIs.

Return ONLY JSON:
{
  "summary":"one sentence describing the intended revision",
  "productChanges":["specific change","specific change"],
  "designChanges":["specific change","specific change"],
  "acceptanceChecks":["observable result","observable result"]
}`);
  await onEvent({
    type: "studio_plan",
    agent: "creative",
    text: plan.summary || "Creative finished the revision plan.",
    proof: plan,
  });

  await onEvent({
    type: "studio_step",
    agent: "technical",
    text: "Technical is editing and validating the product concept.",
  });
  const generated = await geminiJson(`You are the Technical Cofounder inside an iterative AI product studio.

FOUNDER REQUEST:
${request}

CREATIVE PLAN:
${JSON.stringify(plan)}

CURRENT PRODUCT SPECIFICATION:
${JSON.stringify(record.mvp)}

Revise the specification to implement the founder request and Creative's plan.
Rules:
- Return a complete specification, not a patch.
- Use exactly three supported screens and include one workflow screen.
- Keep every interaction within the controlled component runtime.
- Preserve one or two complementary Google capabilities and keep each aligned with a compatible screen.
- Sample data must be clearly fictional and must not imply real traction.
- Do not output source code, HTML, JavaScript, shell commands, dependencies, credentials, or unsupported APIs.
- Preserve unaffected product decisions.

Return ONLY JSON:
${MVP_SCHEMA}`);
  const revisedMvp = sanitizeSpec(generated, record.mvp);
  await prepareGoogleCapabilities(missionId, revisedMvp);

  const workspaceRef = db.collection("mvpWorkspaces").doc(missionId);
  const workspaceSnapshot = await workspaceRef.get();
  const revision = Math.max(
    Number(record.revision || 2),
    Number(workspaceSnapshot.exists ? workspaceSnapshot.data().revision || 2 : 2),
  ) + 1;
  const mvpUrl = await saveMvpPage(missionId, {
    idea: record.idea || "",
    brand: record.brand || null,
    site: record.site || null,
    mvp: revisedMvp,
    review: record.review || null,
    missionId,
    revision,
  });
  const revisionPayload = {
    revision,
    instruction: request,
    summary: text(plan.summary, "Product concept revised.").slice(0, 300),
    plan,
    mvp: revisedMvp,
    createdAt: FieldValue.serverTimestamp(),
  };
  await Promise.all([
    workspaceRef.set({
      missionId,
      revision,
      mvpUrl,
      lastInstruction: request,
      lastSummary: revisionPayload.summary,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true }),
    workspaceRef.collection("revisions").doc(String(revision).padStart(4, "0")).set(revisionPayload),
  ]);

  const proof = {
    missionId,
    mvpUrl,
    revision,
    headline: revisedMvp.headline,
    workflow: revisedMvp.workflow?.title,
    googleCapability: revisedMvp.googleCapability,
    googleCapabilities: revisedMvp.googleCapabilities,
    summary: revisionPayload.summary,
    acceptanceChecks: plan.acceptanceChecks || [],
  };
  await onEvent({
    type: "studio_publish",
    agent: "technical",
    tool: "workspace_publish",
    text: `Technical published revision ${revision}.`,
    proof,
  });
  return proof;
}
