import { Firestore, FieldValue } from "@google-cloud/firestore";
import {
  generateGemmaDraft,
  generateJson as geminiJson,
  normalizeStudioModel,
} from "./gemini.mjs";
import { getInvestorPage, getMvpPage, saveInvestorPage, saveMvpPage } from "./investor-page.mjs";
import { enforceEvidenceGuard, MVP_SCHEMA, SITE_SCHEMA } from "./tools.mjs";
import {
  applyGoogleCapabilityPreference,
  normalizeGoogleCapabilities,
  normalizeGoogleCapabilityPreference,
  prepareGoogleCapabilities,
} from "./google-capabilities.mjs";
import * as memory from "./memory.mjs";

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
    apiPreference: normalizeGoogleCapabilityPreference(mvpRecord.apiPreference),
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

function normalizeCofounder(value) {
  const key = String(value || "").trim().toLowerCase();
  if (key === "maya" || key === "creative") return "maya";
  if (key === "theo" || key === "technical") return "theo";
  return "";
}

async function resolveCofounderContext(missionId, idea = "") {
  const id = String(missionId || "").trim();
  const ideaText = text(idea).trim();
  const mvp = id && /^ep_[a-z0-9]+$/i.test(id) ? await getMvpPage(id) : null;
  const page = id && /^ep_[a-z0-9]+$/i.test(id) ? await getInvestorPage(id) : null;
  let mission = id ? memory.getMission(id) : null;
  if (!mission && id && (mvp || page)) {
    mission = memory.restoreMission(id, mvp || page);
  }
  const stage = mvp?.mvp
    ? "mvp"
    : page?.site || mission?.site
      ? "landing"
      : mission?.brand
        ? "brand"
        : ideaText || mission?.goal
          ? "idea"
          : "";
  if (!stage) return null;
  return {
    missionId: id || mission?.id || "",
    stage,
    idea: mvp?.idea || page?.idea || mission?.goal || ideaText,
    brand: mvp?.brand || page?.brand || mission?.brand || null,
    site: mvp?.site || page?.site || mission?.site || null,
    review: mvp?.review || page?.review || mission?.review || null,
    mvp: mvp?.mvp || mission?.mvp || null,
    mvpUrl: mvp?.mvpUrl || mission?.mvpUrl || "",
    pageUrl: mvp?.pageUrl || page?.pageUrl || mission?.pageUrl || "",
    apiPreference: mvp?.apiPreference || page?.apiPreference || "auto",
    revision: mvp?.revision || page?.revision || mission?.revision || null,
    record: mvp || page || null,
  };
}

export async function runCofounderAsk(missionId, instruction, options = {}) {
  const request = text(instruction).trim();
  if (!request) throw new Error("Ask a question or describe what you need.");
  const context = await resolveCofounderContext(missionId, options.idea);
  if (!context) {
    throw new Error("Enter a project brief or start a build so Maya and Theo have context.");
  }
  const cofounder = normalizeCofounder(options.cofounder) || "theo";
  const agent = cofounder === "maya" ? "creative" : "technical";
  const role = cofounder === "maya"
    ? "Maya, the Creative Cofounder. Focus on brand, story, UX, copy, and product clarity."
    : "Theo, the Technical Cofounder. Focus on product structure, APIs, workflow, delivery, and implementation.";
  const voice = String(options.voice || "ask").trim().toLowerCase();
  const voiceHint = voice === "build_ack"
    ? `The founder just asked you to change the live Antigravity app. Reply in first person as ${cofounder === "maya" ? "Maya" : "Theo"} in 2-3 short sentences: acknowledge the request, say what you will change, and sound like a collaborating cofounder. Do not mention policies, hooks, logs, or tool dumps.`
    : voice === "build_done"
      ? `You just finished applying the founder's change to the live Antigravity app. Reply in first person as ${cofounder === "maya" ? "Maya" : "Theo"} in 2-4 short sentences: confirm what changed, where to look in App preview, and keep a natural cofounder tone. Do not mention policies, hooks, logs, scaffolds, or tool dumps. Outcome: ${options.outcome || "completed"}.`
      : `Answer the founder clearly and specifically using the current product context.
The build may still be in progress — answer with what you know now and what you would change next.
If they ask for a change, explain what you would change and whether they should click Build change.`;

  const answer = await geminiJson(`You are ${role} Inside Cofounder Live.
${voiceHint}
Do not invent fake traction, credentials, or unsupported APIs.
Speak like a real cofounder in chat — concise, concrete, human.

FOUNDER MESSAGE:
${request}

BUILD STAGE:
${context.stage}

PRODUCT CONTEXT:
${JSON.stringify({
  idea: context.idea || "",
  brand: context.brand || null,
  mvp: context.mvp || null,
  site: context.site || null,
  apiPreference: context.apiPreference || "auto",
  revision: context.revision || null,
  productName: context.mvp?.name || context.brand?.name || "",
})}

Return ONLY JSON:
{
  "answer":"your reply as ${cofounder === "maya" ? "Maya" : "Theo"} in under 90 words"
}`);

  return {
    missionId: context.missionId || missionId || "",
    cofounder,
    agent,
    mode: voice === "ask" ? "ask" : voice,
    stage: context.stage,
    answer: text(answer?.answer, voice === "build_done"
      ? "Done — check App preview for the update."
      : "On it — I’ll apply that to the live app now."),
  };
}

async function runLandingChange(context, instruction, onEvent = async () => {}, options = {}) {
  const cofounder = normalizeCofounder(options.cofounder);
  const leadNote = cofounder === "maya"
    ? "The founder asked Maya to lead this landing-page change."
    : cofounder === "theo"
      ? "The founder asked Theo to lead this landing-page change."
      : "";
  await onEvent({
    type: "studio_step",
    agent: cofounder === "maya" ? "creative" : "technical",
    text: leadNote || "Applying your landing-page change while the product concept evolves.",
  });
  const generated = await geminiJson(`You are revising the investor landing page during an active Cofounder Live build.

FOUNDER REQUEST:
${leadNote ? `${leadNote}\n\n${instruction}` : instruction}

FOUNDER IDEA:
${context.idea || ""}

CURRENT BRAND:
${JSON.stringify(context.brand || {})}

CURRENT LANDING PAGE:
${JSON.stringify(context.site || {})}

Apply the useful founder request. Keep factual honesty. Do not invent traction, customers, revenue, or partnerships.
Return ONLY JSON:
${SITE_SCHEMA}`);
  const revisedSite = enforceEvidenceGuard(generated);
  const pageUrl = await saveInvestorPage(context.missionId, {
    idea: context.idea || "",
    brand: context.brand || null,
    site: revisedSite,
    review: context.review || null,
    missionId: context.missionId,
    revision: Math.max(Number(context.revision || 1), 1) + 1,
  });
  if (memory.getMission(context.missionId)) {
    memory.updateMission(context.missionId, {
      site: revisedSite,
      pageUrl,
      revision: Math.max(Number(context.revision || 1), 1) + 1,
      lastFounderGuidance: instruction,
      status: "published",
    });
  }
  const proof = {
    missionId: context.missionId,
    pageUrl,
    name: revisedSite.name,
    headline: revisedSite.headline,
    revision: Math.max(Number(context.revision || 1), 1) + 1,
    stage: "landing",
    summary: "Landing page updated from cofounder change request.",
  };
  await onEvent({
    type: "studio_publish",
    agent: "technical",
    tool: "revise_landing_page",
    text: "Landing page updated with your change.",
    proof,
  });
  return proof;
}

async function runEarlyGuidanceChange(context, instruction, onEvent = async () => {}, options = {}) {
  const cofounder = normalizeCofounder(options.cofounder) || "theo";
  const agent = cofounder === "maya" ? "creative" : "technical";
  await onEvent({
    type: "studio_step",
    agent,
    text: `${cofounder === "maya" ? "Maya" : "Theo"} is absorbing your change into the active build direction.`,
  });
  if (context.missionId && memory.getMission(context.missionId)) {
    memory.updateMission(context.missionId, {
      lastFounderGuidance: instruction,
      goal: context.idea || memory.getMission(context.missionId).goal,
    });
  }
  const reply = await geminiJson(`You are ${cofounder === "maya" ? "Maya, Creative Cofounder" : "Theo, Technical Cofounder"}.
The founder requested a build change while the artifact is still early (${context.stage}).
Confirm what you will prioritize next in under 120 words. Do not invent fake traction.

FOUNDER REQUEST:
${instruction}

CONTEXT:
${JSON.stringify({ idea: context.idea, brand: context.brand, stage: context.stage })}

Return ONLY JSON:
{ "summary":"what you will change next" }`);
  const proof = {
    missionId: context.missionId || "",
    stage: context.stage,
    guidance: true,
    summary: text(reply?.summary, "Noted. We will apply this as the build continues."),
  };
  await onEvent({
    type: "studio_publish",
    agent,
    text: proof.summary,
    proof,
  });
  return proof;
}

export async function runCofounderChange(missionId, instruction, onEvent = async () => {}, options = {}) {
  const request = text(instruction).trim();
  if (!request) throw new Error("Describe the change you want.");
  const context = await resolveCofounderContext(missionId, options.idea);
  if (!context) {
    throw new Error("Enter a project brief or start a build before requesting a change.");
  }
  if (context.mvp) {
    return runWorkspaceTurn(context.missionId, request, onEvent, options);
  }
  if (context.site && context.missionId) {
    return runLandingChange(context, request, onEvent, options);
  }
  return runEarlyGuidanceChange(context, request, onEvent, options);
}

export async function runWorkspaceTurn(missionId, instruction, onEvent = async () => {}, options = {}) {
  const record = await getMvpPage(missionId);
  if (!record?.mvp) throw new Error("Launch a product concept before opening the AI Build Studio.");
  const request = text(instruction).trim();
  if (!request) throw new Error("Describe the product change you want.");
  const studioModel = normalizeStudioModel(options.studioModel);
  const cofounder = normalizeCofounder(options.cofounder);
  const leadNote = cofounder === "maya"
    ? "The founder asked Maya to lead this change. Prioritize brand, story, UX, and clarity while Theo still applies a valid product revision."
    : cofounder === "theo"
      ? "The founder asked Theo to lead this change. Prioritize product structure, workflow, APIs, and delivery while Maya still shapes the plan."
      : "";
  const apiPreference = normalizeGoogleCapabilityPreference(record.apiPreference);
  const capabilityPolicy = apiPreference === "auto"
    ? "Preserve or improve the product's one or two supported Google capabilities."
    : `The founder selected ${apiPreference}. Preserve exactly that one capability and do not add, remove, or substitute another capability.`;

  let gemmaDraft = null;
  let enrichedRequest = leadNote ? `${leadNote}\n\n${request}` : request;
  if (studioModel === "gemma") {
    await onEvent({
      type: "studio_step",
      agent: "creative",
      text: "Gemma is drafting fast copy and layout alternatives.",
    });
    gemmaDraft = await generateGemmaDraft(`You are Gemma, a fast drafting model inside Cofounder Live.
Help Maya and Theo improve this product concept. Propose concrete copy and layout alternatives only.
Do not invent unsupported APIs, credentials, executable code, or production claims.

FOUNDER REQUEST:
${request}

CURRENT PRODUCT SPECIFICATION:
${JSON.stringify(record.mvp)}

Return ONLY JSON:
{
  "summary":"one sentence describing the draft direction",
  "headlineOptions":["option 1","option 2","option 3"],
  "copyEdits":["specific copy improvement","specific copy improvement"],
  "layoutIdeas":["specific layout or hierarchy idea","specific layout or hierarchy idea"],
  "workflowTweaks":["specific workflow wording or field improvement"]
}`);
    await onEvent({
      type: "studio_draft",
      agent: "creative",
      text: gemmaDraft.summary || "Gemma finished a draft for Maya and Theo to apply.",
      proof: {
        model: "gemma",
        modelId: "publishers/google/models/gemma-4-26b-a4b-it-maas",
        ...gemmaDraft,
      },
    });
    enrichedRequest = `${request}

GEMMA DRAFT SUGGESTIONS:
${JSON.stringify(gemmaDraft)}

Use the useful Gemma suggestions while preserving product constraints and the supported runtime.`;
  }

  await onEvent({
    type: "studio_step",
    agent: "creative",
    text: studioModel === "gemma"
      ? "Maya is turning Gemma's draft into a focused product and design plan."
      : "Creative is translating your request into a focused product and design plan.",
  });
  const plan = await geminiJson(`You are the Creative Cofounder inside an iterative AI product studio.

FOUNDER REQUEST:
${enrichedRequest}

CURRENT PRODUCT SPECIFICATION:
${JSON.stringify(record.mvp)}

Create a focused plan that respects the request and improves usability. Use only the supported controlled runtime: dashboard, catalog, timeline, kanban, chat, calendar, table, map, assistant, and workflow screens. ${capabilityPolicy} Every capability must create a visible action. Do not request other external models, credentials, arbitrary JavaScript, shell commands, package installation, or unsupported APIs.

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
    proof: {
      ...plan,
      studioModel,
      gemmaDraft,
    },
  });

  await onEvent({
    type: "studio_step",
    agent: "technical",
    text: "Technical is editing and validating the product concept with Gemini.",
  });
  const generated = await geminiJson(`You are the Technical Cofounder inside an iterative AI product studio.

FOUNDER REQUEST:
${enrichedRequest}

CREATIVE PLAN:
${JSON.stringify(plan)}

CURRENT PRODUCT SPECIFICATION:
${JSON.stringify(record.mvp)}

Revise the specification to implement the founder request and Creative's plan.
Rules:
- Return a complete specification, not a patch.
- Use exactly three supported screens and include one workflow screen.
- Keep every interaction within the controlled component runtime.
- ${capabilityPolicy} Keep every capability aligned with a compatible screen.
- Sample data must be clearly fictional and must not imply real traction.
- Do not output source code, HTML, JavaScript, shell commands, dependencies, credentials, or unsupported APIs.
- Preserve unaffected product decisions.

Return ONLY JSON:
${MVP_SCHEMA}`);  const revisedMvp = sanitizeSpec(generated, record.mvp);
  applyGoogleCapabilityPreference(revisedMvp, apiPreference, record.mvp);
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
    apiPreference,
    missionId,
    revision,
  });
  const revisionPayload = {
    revision,
    instruction: request,
    summary: text(plan.summary, "Product concept revised.").slice(0, 300),
    plan,
    gemmaDraft,
    studioModel,
    mvp: revisedMvp,
    apiPreference,
    createdAt: FieldValue.serverTimestamp(),
  };
  await Promise.all([
    workspaceRef.set({
      missionId,
      revision,
      mvpUrl,
      lastInstruction: request,
      lastSummary: revisionPayload.summary,
      lastStudioModel: studioModel,
      apiPreference,
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
    apiPreference,
    studioModel,
    gemmaDraft,
    summary: revisionPayload.summary,
    acceptanceChecks: plan.acceptanceChecks || [],
  };  await onEvent({
    type: "studio_publish",
    agent: "technical",
    tool: "workspace_publish",
    text: `Technical published revision ${revision}.`,
    proof,
  });
  return proof;
}
