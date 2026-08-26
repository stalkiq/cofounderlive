const missions = new Map();
const events = [];

export function createMission(goal) {
  const id = `ep_${Date.now().toString(36)}`;
  const mission = {
    id,
    goal,
    status: "planning",
    brand: null,
    site: null,
    review: null,
    revision: 0,
    pageUrl: "",
    mvp: null,
    mvpReview: null,
    mvpUrl: "",
    lastCheckAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  missions.set(id, mission);
  return mission;
}

export function restoreMission(id, payload = {}) {
  const mission = {
    id,
    goal: payload.idea || payload.goal || "",
    status: payload.status || "published",
    brand: payload.brand || null,
    site: payload.site || null,
    review: payload.review || null,
    revision: payload.revision || 0,
    pageUrl: payload.pageUrl || "",
    mvp: payload.mvp || null,
    mvpReview: payload.mvpReview || null,
    mvpUrl: payload.mvpUrl || "",
    lastCheckAt: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  missions.set(id, mission);
  return mission;
}

export function getMission(id) {
  return missions.get(id) || null;
}

export function latestMission() {
  return [...missions.values()].sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
}

export function listMissions() {
  return [...missions.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function updateMission(id, patch) {
  const mission = missions.get(id);
  if (!mission) return null;
  Object.assign(mission, patch, { updatedAt: Date.now() });
  missions.set(id, mission);
  return mission;
}

export function addEvent(event) {
  const row = { id: `evt_${Date.now().toString(36)}_${events.length}`, at: Date.now(), ...event };
  events.push(row);
  if (events.length > 200) events.shift();
  return row;
}

export function listEvents(limit = 80) {
  return events.slice(-limit);
}

export function waitingMissions() {
  return [];
}
