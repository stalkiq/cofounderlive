import { TOOL_DEFS, runTool, agentForTool } from "./tools.mjs";
import * as memory from "./memory.mjs";
import { generateContent } from "./gemini.mjs";

const SYSTEM = `You are On Air, a two-person AI cofounder team powered by Gemini.
You are not a chatbot. The founder gives you one app idea and you publish a live investor landing page.

Cofounders:
- creative: calls create_visual_direction, then reviews Technical's first draft with review_landing_page.
- technical: calls publish_landing_page after Creative's direction, then applies the critique with revise_landing_page.

Required workflow:
1) create_visual_direction with the founder's complete idea
2) publish_landing_page with the same complete idea
3) review_landing_page after the first draft exists
4) revise_landing_page after Creative's review
5) Give one short recap containing the exact final pageUrl returned by Technical

Do not ask follow-up questions. Do not invent URLs. Do not stop at advice or the first draft. You must complete all four tools and publish the reviewed revision.`;

const MVP_SYSTEM = `You are Cofounder Live, a two-person AI product team powered by Gemini.
The investor page is already approved. Your job is to turn it into a working MVP.

Cofounders:
- technical: calls build_mvp to create the first interactive prototype.
- creative: calls review_mvp after the prototype exists.
- technical: calls revise_mvp to apply the review and launch the final MVP.

Required workflow:
1) build_mvp
2) review_mvp
3) revise_mvp
4) Give one short recap containing the exact final mvpUrl returned by Technical

Use only these three tools. Do not ask questions, invent URLs, stop after a draft, or claim unimplemented capabilities.`;

const MVP_TOOL_DEFS = TOOL_DEFS.filter((tool) =>
  ["build_mvp", "review_mvp", "revise_mvp"].includes(tool.name),
);

function extractCalls(parts = []) {
  return parts
    .filter((part) => part.functionCall?.name)
    .map((part) => ({
      name: part.functionCall.name,
      args: part.functionCall.args || {},
    }));
}

async function geminiTurn(contents, system = SYSTEM, tools = TOOL_DEFS) {
  return generateContent({
    contents,
    system,
    tools: [{ functionDeclarations: tools }],
    temperature: 0.25,
    maxOutputTokens: 1600,
  });
}

export async function runNightShift(goal, onEvent = async () => {}) {
  const mission = memory.createMission(goal);
  await onEvent({
    type: "mission",
    agent: "director",
    text: `Founder session ${mission.id} is live.`,
    proof: { missionId: mission.id, idea: goal },
  });

  const contents = [{
    role: "user",
    parts: [{
      text: `Mission ID: ${mission.id}
Founder idea:
${goal}

Creative must define the visual direction. Technical builds a first draft. Creative reviews it. Technical applies the review and republishes the final investor landing page.`,
    }],
  }];
  const toolTrace = [];

  for (let turn = 0; turn < 8; turn += 1) {
    const data = await geminiTurn(contents);
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const calls = extractCalls(parts);
    const speech = parts.map((part) => part.text || "").join("").trim();

    if (!calls.length) {
      if (speech) await onEvent({ type: "speech", agent: "director", text: speech });
      break;
    }

    contents.push({ role: "model", parts });
    const responseParts = [];

    for (const call of calls) {
      const agent = agentForTool(call.name);
      await onEvent({
        type: "tool_start",
        agent,
        tool: call.name,
        text: `${agent} started ${call.name}`,
      });
      let result;
      try {
        result = await runTool(call.name, {
          ...call.args,
          idea: call.args.idea || goal,
          missionId: call.args.missionId || mission.id,
        });
        toolTrace.push({ tool: call.name, agent, ok: true, proof: result.proof });
        await onEvent({
          type: "tool_done",
          agent,
          tool: call.name,
          text: `${agent} finished ${call.name}`,
          proof: result.proof,
        });
      } catch (error) {
        result = { ok: false, error: error.message };
        toolTrace.push({ tool: call.name, agent, ok: false, error: error.message });
        await onEvent({
          type: "tool_error",
          agent,
          tool: call.name,
          text: `${agent} hit an error: ${error.message}`,
          proof: result,
        });
      }
      responseParts.push({
        functionResponse: { name: call.name, response: result },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return { mission: memory.getMission(mission.id), toolTrace };
}

export async function runMvpSprint(missionId, onEvent = async () => {}) {
  const contents = [{
    role: "user",
    parts: [{
      text: `Mission ID: ${missionId}

The approved landing page is ready. Technical must build the working product prototype, Creative must test and review it, and Technical must apply that review and launch the final MVP.`,
    }],
  }];
  const toolTrace = [];

  for (let turn = 0; turn < 7; turn += 1) {
    const data = await geminiTurn(contents, MVP_SYSTEM, MVP_TOOL_DEFS);
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const calls = extractCalls(parts);
    const speech = parts.map((part) => part.text || "").join("").trim();

    if (!calls.length) {
      if (speech) await onEvent({ type: "speech", agent: "director", text: speech });
      break;
    }

    contents.push({ role: "model", parts });
    const responseParts = [];
    for (const call of calls) {
      const agent = agentForTool(call.name);
      await onEvent({
        type: "tool_start",
        agent,
        tool: call.name,
        text: `${agent} started ${call.name}`,
      });
      let result;
      try {
        result = await runTool(call.name, {
          ...call.args,
          missionId,
        });
        toolTrace.push({ tool: call.name, agent, ok: true, proof: result.proof });
        await onEvent({
          type: "tool_done",
          agent,
          tool: call.name,
          text: `${agent} finished ${call.name}`,
          proof: result.proof,
        });
        if (call.name === "revise_mvp" && result.proof?.mvpUrl) {
          return { mission: memory.getMission(missionId), toolTrace };
        }
      } catch (error) {
        result = { ok: false, error: error.message };
        toolTrace.push({ tool: call.name, agent, ok: false, error: error.message });
        await onEvent({
          type: "tool_error",
          agent,
          tool: call.name,
          text: `${agent} hit an error: ${error.message}`,
          proof: result,
        });
      }
      responseParts.push({
        functionResponse: { name: call.name, response: result },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return { mission: memory.getMission(missionId), toolTrace };
}

export async function runWatcherTick() {
  return { checked: 0, results: [], note: "Published pages persist in Firestore." };
}
