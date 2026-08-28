import * as memory from "./memory.mjs";
import { generateJson as geminiJson } from "./gemini.mjs";
import {
  getInvestorPage,
  saveInvestorPage,
  saveMvpPage,
} from "./investor-page.mjs";
import {
  applyGoogleCapabilityPreference,
  normalizeGoogleCapabilityPreference,
  prepareGoogleCapabilities,
} from "./google-capabilities.mjs";

export const TOOL_DEFS = [
  {
    name: "create_visual_direction",
    description: "Creative cofounder tool. Define the name, story, palette, typography, layout, and visual direction for the idea before Technical builds it.",
    parameters: {
      type: "OBJECT",
      properties: {
        missionId: { type: "STRING" },
        idea: { type: "STRING", description: "The founder's app or startup idea" },
      },
      required: ["idea"],
    },
  },
  {
    name: "publish_landing_page",
    description: "Technical cofounder tool. Build and publish the first durable investor landing-page draft using Creative's visual direction.",
    parameters: {
      type: "OBJECT",
      properties: {
        missionId: { type: "STRING" },
        idea: { type: "STRING", description: "The founder's app or startup idea" },
      },
      required: ["idea"],
    },
  },
  {
    name: "review_landing_page",
    description: "Creative cofounder tool. Review Technical's first landing-page draft and return concrete visual and copy revisions.",
    parameters: {
      type: "OBJECT",
      properties: {
        missionId: { type: "STRING" },
      },
      required: ["missionId"],
    },
  },
  {
    name: "revise_landing_page",
    description: "Technical cofounder tool. Apply Creative's review, republish the page at the same URL, and return the final build.",
    parameters: {
      type: "OBJECT",
      properties: {
        missionId: { type: "STRING" },
      },
      required: ["missionId"],
    },
  },
  {
    name: "build_mvp",
    description: "Technical cofounder tool. Turn the approved investor page into a persistent, interactive product prototype.",
    parameters: {
      type: "OBJECT",
      properties: {
        missionId: { type: "STRING" },
      },
      required: ["missionId"],
    },
  },
  {
    name: "review_mvp",
    description: "Creative cofounder tool. Test Technical's product prototype and prescribe focused usability and visual improvements.",
    parameters: {
      type: "OBJECT",
      properties: {
        missionId: { type: "STRING" },
      },
      required: ["missionId"],
    },
  },
  {
    name: "revise_mvp",
    description: "Technical cofounder tool. Apply Creative's product review and launch the final working MVP.",
    parameters: {
      type: "OBJECT",
      properties: {
        missionId: { type: "STRING" },
      },
      required: ["missionId"],
    },
  },
];

export function agentForTool(name) {
  if (["create_visual_direction", "review_landing_page", "review_mvp"].includes(name)) return "creative";
  if (["publish_landing_page", "revise_landing_page", "build_mvp", "revise_mvp"].includes(name)) return "technical";
  return "director";
}

const SITE_SCHEMA = `{
  "name":"",
  "eyebrow":"",
  "headline":"",
  "subheadline":"",
  "cta":"See the thesis",
  "problem":{"headline":"","body":""},
  "solution":{"headline":"","body":""},
  "features":[
    {"title":"","detail":""},
    {"title":"","detail":""},
    {"title":"","detail":""}
  ],
  "moat":{"headline":"","points":["","",""]},
  "market":{"headline":"Working estimate","body":""},
  "businessModel":{"headline":"","body":""},
  "whyNow":{"headline":"","body":""},
  "milestones":{
    "headline":"",
    "items":[
      {"when":"Now","goal":""},
      {"when":"Next","goal":""},
      {"when":"Then","goal":""}
    ]
  },
  "ask":{"headline":"","body":""}
}`;

export const MVP_SCHEMA = `{
  "name":"",
  "workspaceLabel":"",
  "experience":{
    "archetype":"terminal|marketplace|mobile|workspace|assistant|operations|analytics|community",
    "device":"desktop|mobile",
    "navigationStyle":"sidebar|topbar|bottom",
    "density":"compact|comfortable|spacious",
    "typeStyle":"sans|serif|mono",
    "radius":"sharp|soft|rounded",
    "motif":"short visual motif specific to the product"
  },
  "eyebrow":"",
  "headline":"",
  "subheadline":"",
  "palette":{"background":"#000000","surface":"#000000","primary":"#000000","accent":"#000000","text":"#000000"},
  "googleCapabilities":[
    {
      "service":"maps|places|routes|weather|air_quality|geocoding|translation|vision|gemini|bigquery|tts",
      "label":"",
      "rationale":"why this capability materially improves the core product workflow",
      "primaryScreen":0,
      "config":{
        "assistantRole":"product-specific role for Gemini",
        "mapQuery":"product-specific place or map query",
        "locationQuery":"city, region, address, or global location focus",
        "origin":"route origin when routes is selected",
        "destination":"route destination when routes is selected",
        "analyticsLabel":"label for live BigQuery sample analytics",
        "targetLanguage":"two-letter translation language code",
        "analysisMode":"labels|text|both",
        "speechPrompt":"product-specific Text-to-Speech action"
      }
    }
  ],
  "screens":[
    {
      "label":"",
      "type":"dashboard|catalog|timeline|kanban|chat|calendar|table|map|assistant|workflow",
      "title":"",
      "description":"",
      "metrics":[{"label":"","value":""}],
      "items":[{"title":"","detail":"","status":"Sample","meta":"","value":""}]
    },
    {
      "label":"",
      "type":"",
      "title":"",
      "description":"",
      "metrics":[],
      "items":[]
    },
    {
      "label":"",
      "type":"",
      "title":"",
      "description":"",
      "metrics":[],
      "items":[]
    }
  ],
  "workflow":{
    "title":"",
    "description":"",
    "fields":[
      {"label":"","type":"text","placeholder":""},
      {"label":"","type":"select","options":["","",""]},
      {"label":"","type":"date","placeholder":""}
    ],
    "buttonLabel":"",
    "successTitle":"",
    "successMessage":""
  }
}`;

function enforceEvidenceGuard(site) {
  const guarded = JSON.parse(JSON.stringify(site || {}));
  guarded.evidenceNote = "Concept generated from the founder brief. Traction, partnerships, and market assumptions require founder validation.";
  guarded.market = {
    ...(guarded.market || {}),
    headline: `Working market hypothesis · ${guarded.market?.headline || "Estimate pending validation"}`,
  };
  guarded.milestones = {
    headline: "Validation plan",
    items: [
      { when: "Now", goal: "Build and test the working prototype with prospective design partners." },
      { when: "Next", goal: "Measure activation, repeat use, and willingness to pay with a focused pilot." },
      { when: "Then", goal: "Use verified pilot evidence to choose the next product and fundraising milestone." },
    ],
  };
  return guarded;
}

export async function runTool(name, args = {}) {
  let mission = args.missionId
    ? memory.getMission(args.missionId)
    : memory.latestMission();
  if (!mission && args.missionId) {
    const persisted = await getInvestorPage(args.missionId);
    if (persisted) mission = memory.restoreMission(args.missionId, persisted);
  }

  switch (name) {
    case "create_visual_direction": {
      const idea = String(args.idea || mission?.goal || "").trim();
      const brand = await geminiJson(`You are the Creative Cofounder. Turn this app idea into a concise, distinctive visual direction for an investor landing page.

IDEA:
${idea}

Avoid generic blue-gradient SaaS styling. Make the design fit the product and audience. Every palette value must be a six-digit hex color with strong contrast.
Return ONLY JSON:
{
  "name":"short memorable company name",
  "tagline":"one sharp line",
  "audience":"specific first customer",
  "tone":["three adjectives"],
  "visualConcept":"one concrete visual idea",
  "layout":"short layout direction",
  "palette":{
    "background":"#000000",
    "surface":"#000000",
    "primary":"#000000",
    "accent":"#000000",
    "text":"#000000"
  },
  "creativeNotes":["three specific suggestions for Technical"]
}`);
      if (!mission) throw new Error("No active founder session.");
      memory.updateMission(mission.id, { brand, status: "creative_ready" });
      return {
        ok: true,
        proof: {
          name: brand.name,
          tagline: brand.tagline,
          visualConcept: brand.visualConcept,
          palette: brand.palette,
          creativeNotes: brand.creativeNotes,
        },
        missionId: mission.id,
      };
    }

    case "publish_landing_page": {
      if (!mission) throw new Error("No active founder session.");
      if (!mission.brand) {
        throw new Error("Creative must finish the visual direction before Technical can publish.");
      }
      const idea = String(args.idea || mission.goal || "").trim();
      const context = JSON.stringify({ idea, brand: mission.brand });
      const generatedSite = await geminiJson(`You are the Technical Cofounder. Write the complete content model for a simple investor landing page using Creative's direction.

CONTEXT:
${context}

Rules:
- Do not invent traction, revenue, customer counts, partnerships, or market facts.
- Clearly label estimates.
- Make the moat specific and defensible.
- Write concise web copy, not a pitch-deck transcript.
- Present pre-launch honestly when no evidence was provided.

Return ONLY JSON:
${SITE_SCHEMA}`);
      const site = enforceEvidenceGuard(generatedSite);
      const pageUrl = await saveInvestorPage(mission.id, {
        idea,
        brand: mission.brand,
        site,
        missionId: mission.id,
        revision: 1,
      });
      memory.updateMission(mission.id, {
        site,
        pageUrl,
        revision: 1,
        status: "draft_published",
      });
      return {
        ok: true,
        proof: {
          pageUrl,
          name: site.name || mission.brand.name,
          headline: site.headline,
          revision: 1,
          stage: "first draft",
          builtWith: ["Gemini 3.5 Flash", "Cloud Run", "Firestore"],
        },
        missionId: mission.id,
      };
    }

    case "review_landing_page": {
      if (!mission?.site || !mission?.brand) {
        throw new Error("Technical must publish a first draft before Creative can review it.");
      }
      const review = await geminiJson(`You are the Creative Cofounder reviewing Technical's first investor landing-page build.

FOUNDER IDEA:
${mission.goal}

CREATIVE DIRECTION:
${JSON.stringify(mission.brand)}

TECHNICAL DRAFT:
${JSON.stringify(mission.site)}

Be exact and useful. Protect clarity for investors and visual distinction. Do not praise generically.
Return ONLY JSON:
{
  "score":7,
  "verdict":"one direct sentence",
  "strengths":["two specific strengths"],
  "changes":[
    {"area":"hero|copy|layout|palette|moat|ask","instruction":"specific revision"},
    {"area":"","instruction":""},
    {"area":"","instruction":""}
  ]
}`);
      memory.updateMission(mission.id, { review, status: "creative_reviewed" });
      return {
        ok: true,
        proof: review,
        missionId: mission.id,
      };
    }

    case "revise_landing_page": {
      if (!mission?.site || !mission?.review || !mission?.brand) {
        throw new Error("Creative must review the first draft before Technical revises it.");
      }
      const generatedRevision = await geminiJson(`You are the Technical Cofounder. Revise the investor landing-page content model using Creative's critique.

FOUNDER IDEA:
${mission.goal}

CREATIVE DIRECTION:
${JSON.stringify(mission.brand)}

FIRST BUILD:
${JSON.stringify(mission.site)}

CREATIVE REVIEW:
${JSON.stringify(mission.review)}

Apply every useful change while preserving factual honesty. Do not invent traction, customers, revenue, partnerships, or market facts.
Return ONLY JSON:
${SITE_SCHEMA}`);
      const revisedSite = enforceEvidenceGuard(generatedRevision);
      const pageUrl = await saveInvestorPage(mission.id, {
        idea: mission.goal,
        brand: mission.brand,
        site: revisedSite,
        review: mission.review,
        missionId: mission.id,
        revision: 2,
      });
      memory.updateMission(mission.id, {
        site: revisedSite,
        pageUrl,
        revision: 2,
        status: "published",
      });
      return {
        ok: true,
        proof: {
          pageUrl,
          name: revisedSite.name || mission.brand.name,
          headline: revisedSite.headline,
          revision: 2,
          stage: "creative-approved final",
          changesApplied: (mission.review.changes || []).map((change) => change.instruction),
          builtWith: ["Gemini 3.5 Flash", "Cloud Run", "Firestore"],
        },
        missionId: mission.id,
      };
    }

    case "build_mvp": {
      if (!mission?.site || !mission?.brand || mission.revision < 2) {
        throw new Error("The investor page must be approved before Technical can build the MVP.");
      }
      const apiPreference = normalizeGoogleCapabilityPreference(args.apiPreference);
      const capabilityPolicy = apiPreference === "auto"
        ? "AUTO MODE: Select one or two complementary capabilities that best fit the product."
        : `SELECTED-ONLY MODE: Use exactly one Google capability: ${apiPreference}. Do not add, substitute, or recommend a second capability. Design a compatible primary screen and core interaction for ${apiPreference}.`;
      const mvp = await geminiJson(`You are the Technical Cofounder. Turn the approved startup concept below into a focused interactive MVP specification.

FOUNDER IDEA:
${mission.goal}

APPROVED BRAND:
${JSON.stringify(mission.brand)}

APPROVED INVESTOR PAGE:
${JSON.stringify(mission.site)}

FOUNDER GOOGLE API POLICY:
${capabilityPolicy}

Build one useful core workflow, not a marketing page. First infer the product's natural experience, then choose an archetype and screen composition that fits it.

The controlled runtime supports these screen types:
- dashboard: metrics plus recent activity
- catalog: searchable listing cards
- timeline: chronological events
- kanban: work grouped by status
- chat: message history plus a working local composer
- calendar: scheduled events
- table: dense operational records
- map: schematic locations, routes, or network nodes
- assistant: prompt-and-generated-result interaction
- workflow: a working form using the workflow specification

Theo must select one or two complementary, working Google capabilities:
- maps for a real interactive world, regional, or local map
- places for real place discovery and markers
- routes for real origin-to-destination travel information
- weather for live conditions at a mapped location
- air_quality for live AQI and health guidance
- geocoding for converting product locations into real coordinates
- translation for multilingual product text
- vision for image labels or text extraction
- bigquery for analytics and operational data
- gemini for recommendations, summarization, planning, Q&A, or a copilot
- tts for spoken product output

Use one capability when it fully solves the workflow. Use two only when their combination is visibly useful, such as maps+weather, maps+places, routes+air_quality, vision+translation, gemini+tts, or bigquery+gemini. Never select redundant or decorative capabilities.

Set primaryScreen to a compatible screen index: map for maps/places/routes/weather/air_quality/geocoding; table for BigQuery; assistant or chat for Gemini/Translation; assistant for Vision; assistant, chat, or workflow for TTS.
For Weather and Air Quality, locationQuery must be a specific city, region, or coordinates—not "world" or "global". For Routes, provide specific origin and destination values. For Places, provide a concrete mapQuery such as "wheelchair accessible cafes in Chicago".

Examples:
- financial infrastructure can be a compact terminal with table, map/network, and workflow screens
- caregiving can be a warm mobile app with timeline, calendar, and workflow screens
- commerce can be a visual marketplace with catalog, dashboard, and chat screens
- team software can be a workspace with kanban, chat, and workflow screens

Rules:
- Make the workflow specific to this product and its first user.
- Choose exactly three screens. Include one workflow screen and two screen types most useful for this idea.
- Vary device format, navigation, typography, density, radius, motif, and composition based on the founder's prompt.
- Do not default to a dark SaaS dashboard. Consumer and human-centered ideas should usually use lighter, warmer, or more expressive visual systems.
- Screen labels, items, statuses, and metadata must be specific to the product.
- Metrics and activity are clearly sample/demo content; do not imply real users or traction.
- Every palette value is a six-digit hex color with accessible contrast.
- Do not output HTML, JavaScript, markdown, credentials, or executable code. The controlled runtime implements the selected Google capability.

Return ONLY JSON:
${MVP_SCHEMA}`);
      applyGoogleCapabilityPreference(mvp, apiPreference);
      await prepareGoogleCapabilities(mission.id, mvp);
      const mvpUrl = await saveMvpPage(mission.id, {
        idea: mission.goal,
        brand: mission.brand,
        site: mission.site,
        mvp,
        apiPreference,
        missionId: mission.id,
        revision: 1,
      });
      memory.updateMission(mission.id, {
        mvp,
        mvpUrl,
        apiPreference,
        status: "mvp_draft",
      });
      return {
        ok: true,
        proof: {
          mvpUrl,
          name: mvp.name || mission.brand.name,
          headline: mvp.headline,
          workflow: mvp.workflow?.title,
          googleCapability: mvp.googleCapability,
          googleCapabilities: mvp.googleCapabilities,
          apiPreference,
          revision: 1,
          stage: "working prototype",
        },
        missionId: mission.id,
      };
    }

    case "review_mvp": {
      if (!mission?.mvp) {
        throw new Error("Technical must build the MVP before Creative can review it.");
      }
      const apiPreference = normalizeGoogleCapabilityPreference(args.apiPreference || mission.apiPreference);
      const mvpReview = await geminiJson(`You are the Creative Cofounder testing Technical's working MVP.

FOUNDER IDEA:
${mission.goal}

CREATIVE DIRECTION:
${JSON.stringify(mission.brand)}

MVP SPECIFICATION:
${JSON.stringify(mission.mvp)}

GOOGLE API POLICY:
${apiPreference === "auto"
    ? "Auto mode: review whether the one or two selected capabilities are useful, complementary, and correctly implemented."
    : `Selected-only mode: ${apiPreference} is the founder's required and only capability. Review its implementation, but do not request a different or additional capability.`}

Review the archetype, device format, navigation, screen types, core workflow, visual hierarchy, product-specific motif, and Google capability implementation. Every capability must be functional, useful rather than decorative, and aligned to a compatible primary screen. Be direct.
Return ONLY JSON:
{
  "score":7,
  "verdict":"one direct sentence",
  "changes":[
    {"area":"archetype|device|navigation|screen|workflow|copy|hierarchy|palette|motif|google capability","instruction":"specific revision"},
    {"area":"","instruction":""},
    {"area":"","instruction":""}
  ]
}`);
      memory.updateMission(mission.id, {
        mvpReview,
        status: "mvp_reviewed",
      });
      return {
        ok: true,
        proof: mvpReview,
        missionId: mission.id,
      };
    }

    case "revise_mvp": {
      if (!mission?.mvp || !mission?.mvpReview || !mission?.brand) {
        throw new Error("Creative must review the MVP before Technical can launch it.");
      }
      const apiPreference = normalizeGoogleCapabilityPreference(args.apiPreference || mission.apiPreference);
      const revisedMvp = await geminiJson(`You are the Technical Cofounder. Apply Creative's review to the working MVP specification.

FOUNDER IDEA:
${mission.goal}

FIRST MVP:
${JSON.stringify(mission.mvp)}

CREATIVE REVIEW:
${JSON.stringify(mission.mvpReview)}

GOOGLE API POLICY:
${apiPreference === "auto"
    ? "Preserve one or two useful, complementary Google capabilities."
    : `Preserve exactly one capability: ${apiPreference}. Do not add or substitute another capability.`}

Apply every useful change. Keep exactly three screens, including one workflow screen and two product-appropriate supported screen types. Align map/places/routes/weather/air_quality/geocoding with a map screen; BigQuery with a table; Gemini/Translation with assistant or chat; Vision with assistant; and TTS with assistant, chat, or workflow. Preserve strong differentiation through the archetype, device format, navigation, typography, density, radius, motif, and composition. Keep one focused form workflow. All metrics and activity must remain obvious sample/demo content. Every palette value must be a six-digit hex color with accessible contrast. Do not output executable code.
Return ONLY JSON:
${MVP_SCHEMA}`);
      applyGoogleCapabilityPreference(revisedMvp, apiPreference, mission.mvp);
      await prepareGoogleCapabilities(mission.id, revisedMvp);
      const mvpUrl = await saveMvpPage(mission.id, {
        idea: mission.goal,
        brand: mission.brand,
        site: mission.site,
        mvp: revisedMvp,
        review: mission.mvpReview,
        apiPreference,
        missionId: mission.id,
        revision: 2,
      });
      memory.updateMission(mission.id, {
        mvp: revisedMvp,
        mvpUrl,
        apiPreference,
        status: "mvp_launched",
      });
      return {
        ok: true,
        proof: {
          mvpUrl,
          name: revisedMvp.name || mission.brand.name,
          headline: revisedMvp.headline,
          workflow: revisedMvp.workflow?.title,
          googleCapability: revisedMvp.googleCapability,
          googleCapabilities: revisedMvp.googleCapabilities,
          apiPreference,
          revision: 2,
          stage: "creative-approved working MVP",
          changesApplied: (mission.mvpReview.changes || []).map((change) => change.instruction),
          builtWith: [
            "Gemini 3.5 Flash",
            "Cloud Run",
            "Firestore",
            ...(revisedMvp.googleCapabilities || [revisedMvp.googleCapability])
              .filter(Boolean)
              .map((capability) => capability.label || capability.service),
          ],
        },
        missionId: mission.id,
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
