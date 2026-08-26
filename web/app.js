const AGENTS = ["creative", "technical"];
const COLORS = {
  creative: "#d7b16a",
  technical: "#7f9bb8",
  director: "#c4b5a0",
};
const DISPLAY_NAMES = {
  creative: "Maya",
  technical: "Theo",
  director: "Studio",
};

const LOOKS = {
  creative: {
    skin: ["#f6dfcf", "#efcbb6", "#e3b39c", "#c9927c"],
    neck: "#d9a894",
    neckShadow: "#c48a76",
    jaw: "#d8a088",
    plane: "#d7a48f",
    socket: "#d9b09a",
    cheek: "#e8907c",
    bone: "#fff4ea",
    highlight: "#fff7f0",
    highlightOp: "0.42",
    brow: "#3d2a1c",
    browHair: "#2a1a12",
    lash: "#1a100c",
    crease: "#c99480",
    hair: ["#3a2418", "#5a3824", "#20140e"],
    hairLine: "#3a2418",
    bangs: "#4a2e1c",
    hairBack: "#1c120c",
    lip: ["#d4787a", "#b85058", "#8c3844"],
    lipLight: "#e8a0a0",
    iris: ["#7a9a6e", "#4a6a48", "#243428"],
    sclera: "#fff6ee",
    mouth: "#6a2430",
    nose: "#e8b8a4",
    noseWing: "#d09a86",
    nostril: "#b07868",
    ear: "#e8b8a4",
    eyeOpen: 11,
    lipRx: 22,
    noseW: 0,
    face: { w: 0, j: 0, c: 0 },
  },
  technical: {
    skin: ["#e9c5a8", "#d8a681", "#bf8660", "#986344"],
    neck: "#b77f5d",
    neckShadow: "#8f5b42",
    jaw: "#a66e50",
    plane: "#b77c5c",
    socket: "#c39778",
    cheek: "#bd765f",
    bone: "#efd2b9",
    highlight: "#f7dfcb",
    highlightOp: "0.28",
    brow: "#241a14",
    browHair: "#15100c",
    lash: "#15100c",
    crease: "#a9785d",
    hair: ["#241b15", "#3c2b20", "#120e0b"],
    hairLine: "#241b15",
    bangs: "#302219",
    hairBack: "#120e0b",
    lip: ["#a8615b", "#864b49", "#633738"],
    lipLight: "#bc7770",
    iris: ["#3a2418", "#241810", "#0e0a08"],
    sclera: "#fff4ea",
    mouth: "#563431",
    nose: "#c69372",
    noseWing: "#ad7759",
    nostril: "#86543e",
    ear: "#c79270",
    eyeOpen: 9,
    lipRx: 15,
    noseW: 3,
    face: { w: 12, j: 14, c: -1 },
  },
  researcher: {
    skin: ["#c4885c", "#a86a42", "#8a4e2c", "#6a3618"],
    neck: "#7a4428",
    neckShadow: "#5c2e18",
    jaw: "#7a4628",
    plane: "#8a5430",
    socket: "#8a5434",
    cheek: "#b85a4a",
    bone: "#d4a07a",
    highlight: "#e8c4a0",
    highlightOp: "0.22",
    brow: "#120c0a",
    browHair: "#0a0604",
    lash: "#0a0604",
    crease: "#6a3820",
    hair: ["#120c0a", "#221610", "#080604"],
    hairLine: "#120c0a",
    bangs: "#1a100c",
    hairBack: "#080604",
    lip: ["#a8484c", "#843038", "#5c2028"],
    lipLight: "#c8686c",
    iris: ["#4a2c18", "#2a180e", "#100a08"],
    sclera: "#f0dcc8",
    mouth: "#4a1820",
    nose: "#9a5c38",
    noseWing: "#7a4024",
    nostril: "#5c2c18",
    ear: "#9a5c38",
    eyeOpen: 11,
    lipRx: 26,
    noseW: 5,
    face: { w: 10, j: 6, c: 2 },
  },
  board: {
    skin: ["#e6c09a", "#d0a078", "#b88458", "#9a663e"],
    neck: "#b8845c",
    neckShadow: "#9a6644",
    jaw: "#b07a52",
    plane: "#b88860",
    socket: "#c09068",
    cheek: "#cc6e5c",
    bone: "#f0d4b4",
    highlight: "#f8e8d4",
    highlightOp: "0.3",
    brow: "#241810",
    browHair: "#140c08",
    lash: "#140c08",
    crease: "#a87858",
    hair: ["#241810", "#3a2418", "#120c08"],
    hairLine: "#241810",
    bangs: "#322018",
    hairBack: "#120c08",
    lip: ["#c45c5c", "#a04048", "#782830"],
    lipLight: "#d87878",
    iris: ["#5a3c20", "#3a2814", "#181008"],
    sclera: "#f6eadc",
    mouth: "#541820",
    nose: "#c4946c",
    noseWing: "#a87854",
    nostril: "#8a5c3c",
    ear: "#c4946c",
    eyeOpen: 10,
    lipRx: 23,
    noseW: 1,
    face: { w: -2, j: -8, c: 8 },
  },
};

function faceOutline(agent) {
  const { w, j, c } = (LOOKS[agent] || LOOKS.creative).face;
  return `M320 ${228 + c * 0.15}
    C${392 + w} ${226} ${452 + w} ${266} ${466 + w} ${338}
    C${478 + w} ${408} ${472 + w} ${468} ${452 + w + j} ${520}
    C${424 + j} ${578} ${374} ${616 + c} 320 ${626 + c}
    C${266} ${616 + c} ${216 - j} ${578} ${188 - w - j} ${520}
    C${168 - w} ${468} ${162 - w} ${408} ${174 - w} ${338}
    C${188 - w} ${266} ${248 - w} ${226} 320 ${228 + c * 0.15}Z`;
}

function hairExtras(agent, L) {
  if (agent === "researcher") {
    return `
      <ellipse cx="198" cy="248" rx="72" ry="56" fill="${L.hair[1]}"/>
      <ellipse cx="442" cy="248" rx="72" ry="56" fill="${L.hair[1]}"/>
      <ellipse cx="320" cy="172" rx="96" ry="52" fill="${L.hair[0]}"/>
      <ellipse cx="248" cy="200" rx="36" ry="28" fill="${L.hair[2]}" opacity="0.7"/>
      <ellipse cx="392" cy="200" rx="36" ry="28" fill="${L.hair[2]}" opacity="0.7"/>
    `;
  }
  if (agent === "board") {
    return `
      <path d="M148 370 Q128 470 176 620" stroke="${L.hair[1]}" stroke-width="20" fill="none"/>
      <path d="M492 370 Q512 470 464 620" stroke="${L.hair[1]}" stroke-width="20" fill="none"/>
      <path d="M170 300 Q150 360 168 430" stroke="${L.hair[0]}" stroke-width="14" fill="none" opacity="0.7"/>
      <path d="M470 300 Q490 360 472 430" stroke="${L.hair[0]}" stroke-width="14" fill="none" opacity="0.7"/>
    `;
  }
  if (agent === "technical") {
    return `
      <path d="M190 306 Q202 188 320 164 Q438 188 450 306 Q410 234 320 218 Q230 234 190 306Z" fill="${L.hair[0]}"/>
      <path d="M214 238 Q252 178 320 170" stroke="${L.hair[1]}" stroke-width="13" stroke-linecap="round" fill="none"/>
      <path d="M270 206 Q318 162 374 190" stroke="${L.hair[1]}" stroke-width="12" stroke-linecap="round" fill="none"/>
      <path d="M336 180 Q400 188 430 246" stroke="${L.hair[2]}" stroke-width="11" stroke-linecap="round" fill="none"/>
    `;
  }
  return "";
}

function eyePair(p, L, cx, cy, side) {
  const open = L.eyeOpen;
  const dir = side === "left" ? 1 : -1;
  const inner = cx + 34 * dir;
  const outer = cx - 36 * dir;
  const top = cy - open;
  const bot = cy + open * 0.85;
  const clip = `${p}eye${side}`;
  return `
    <ellipse cx="${cx}" cy="${cy + 6}" rx="40" ry="20" fill="${L.socket}" opacity="0.45"/>
    <path d="M${outer} ${cy} C${cx - 16 * dir} ${top - 2}, ${cx + 14 * dir} ${top}, ${inner} ${cy + 1}
             C${cx + 12 * dir} ${bot}, ${cx - 14 * dir} ${bot + 2}, ${outer} ${cy}Z" fill="${L.sclera}"/>
    <clipPath id="${clip}">
      <path d="M${outer} ${cy} C${cx - 16 * dir} ${top - 2}, ${cx + 14 * dir} ${top}, ${inner} ${cy + 1}
               C${cx + 12 * dir} ${bot}, ${cx - 14 * dir} ${bot + 2}, ${outer} ${cy}Z"/>
    </clipPath>
    <g clip-path="url(#${clip})">
      <circle cx="${cx}" cy="${cy}" r="13.5" fill="url(#${p}iris)"/>
      <circle cx="${cx}" cy="${cy}" r="13.5" fill="none" stroke="${L.iris[2]}" stroke-width="1.2" opacity="0.35"/>
      <circle cx="${cx}" cy="${cy}" r="6.2" fill="#111"/>
      <circle cx="${cx + 3}" cy="${cy - 4}" r="2.6" fill="#fff"/>
      <circle cx="${cx - 4}" cy="${cy + 3}" r="1.2" fill="#fff" opacity="0.45"/>
    </g>
    <path d="M${outer} ${cy} C${cx - 16 * dir} ${top - 2}, ${cx + 14 * dir} ${top}, ${inner} ${cy + 1}"
          fill="none" stroke="${L.lash}" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M${outer + 4 * dir} ${cy - 1} C${cx - 10 * dir} ${top + 10}, ${cx + 8 * dir} ${bot - 2}, ${inner - 2 * dir} ${cy + 2}"
          fill="none" stroke="${L.crease}" stroke-width="1.6" opacity="0.55"/>
    <path d="M${outer + 2 * dir} ${top + 2} C${cx - 8 * dir} ${top - 10}, ${cx + 10 * dir} ${top - 8}, ${inner - 2 * dir} ${cy - 4}"
          fill="none" stroke="${L.crease}" stroke-width="2.2" opacity="${open < 10 ? "0.15" : "0.45"}"/>
    <path d="M${outer - 2 * dir} ${cy - 4} L${outer - 6 * dir} ${cy - 11}" stroke="${L.lash}" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M${cx - 10 * dir} ${top - 1} L${cx - 12 * dir} ${top - 8}" stroke="${L.lash}" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M${cx + 8 * dir} ${top} L${cx + 9 * dir} ${top - 7}" stroke="${L.lash}" stroke-width="1.2" stroke-linecap="round"/>
  `;
}

function cofounderFaceSvg(agent, accent) {
  const p = `${agent}-`;
  const L = LOOKS[agent] || LOOKS.creative;
  const outline = faceOutline(agent);
  const nw = L.noseW;
  return `
    <defs>
      <linearGradient id="${p}bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#1a1420"/>
        <stop offset="100%" stop-color="#0b0a10"/>
      </linearGradient>
      <radialGradient id="${p}skin" cx="46%" cy="34%" r="68%">
        <stop offset="0%" stop-color="${L.skin[0]}"/>
        <stop offset="32%" stop-color="${L.skin[1]}"/>
        <stop offset="70%" stop-color="${L.skin[2]}"/>
        <stop offset="100%" stop-color="${L.skin[3]}"/>
      </radialGradient>
      <radialGradient id="${p}cheekL" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${L.cheek}" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="${L.cheek}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="${p}cheekR" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${L.cheek}" stop-opacity="0.42"/>
        <stop offset="100%" stop-color="${L.cheek}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="${p}bone" cx="50%" cy="40%" r="50%">
        <stop offset="0%" stop-color="${L.bone}" stop-opacity="0.38"/>
        <stop offset="100%" stop-color="${L.bone}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="${p}light" cx="50%" cy="40%" r="50%">
        <stop offset="0%" stop-color="${L.highlight}" stop-opacity="${L.highlightOp}"/>
        <stop offset="100%" stop-color="${L.highlight}" stop-opacity="0"/>
      </radialGradient>
      <linearGradient id="${p}hair" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${L.hair[0]}"/>
        <stop offset="40%" stop-color="${L.hair[1]}"/>
        <stop offset="100%" stop-color="${L.hair[2]}"/>
      </linearGradient>
      <linearGradient id="${p}lipU" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${L.lip[1]}"/>
        <stop offset="100%" stop-color="${L.lip[2]}"/>
      </linearGradient>
      <linearGradient id="${p}lipL" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${L.lipLight}"/>
        <stop offset="40%" stop-color="${L.lip[0]}"/>
        <stop offset="100%" stop-color="${L.lip[1]}"/>
      </linearGradient>
      <radialGradient id="${p}iris" cx="38%" cy="34%" r="70%">
        <stop offset="0%" stop-color="${L.iris[0]}"/>
        <stop offset="55%" stop-color="${L.iris[1]}"/>
        <stop offset="100%" stop-color="${L.iris[2]}"/>
      </radialGradient>
      <filter id="${p}soft" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="5"/>
      </filter>
      <clipPath id="${p}face">
        <path d="${outline}"/>
      </clipPath>
    </defs>
    <rect width="640" height="800" fill="url(#${p}bg)"/>
    ${agent === "technical"
      ? `<path d="M174 340 Q170 184 320 146 Q470 184 466 340 L442 392 Q424 246 320 218 Q216 246 198 392Z" fill="url(#${p}hair)"/>`
      : `<ellipse cx="320" cy="438" rx="228" ry="298" fill="url(#${p}hair)"/>
         <path d="M118 360 C78 520, 108 690, 208 762 L432 762 C532 690, 562 520, 522 360 Q500 198, 320 146 Q140 198, 118 360 Z" fill="${L.hairBack}"/>`}
    ${hairExtras(agent, L)}
    <path d="M272 575 C278 640, 292 705, 320 738 C348 705, 362 640, 368 575 Z" fill="${L.neck}"/>
    <path d="M286 600 C296 660, 308 710, 320 728 C332 710, 344 660, 354 600" fill="${L.neckShadow}" opacity="0.35"/>
    <path d="M168 392 C150 404, 146 444, 160 478 C174 500, 194 496, 204 474 C196 440, 188 412, 180 392 Z" fill="${L.ear}"/>
    <path d="M472 392 C490 404, 494 444, 480 478 C466 500, 446 496, 436 474 C444 440, 452 412, 460 392 Z" fill="${L.ear}"/>
    <path d="${outline}" fill="url(#${p}skin)"/>
    <g clip-path="url(#${p}face)">
      <ellipse cx="320" cy="292" rx="102" ry="62" fill="url(#${p}light)" filter="url(#${p}soft)"/>
      <ellipse cx="236" cy="428" rx="46" ry="30" fill="url(#${p}cheekL)" filter="url(#${p}soft)"/>
      <ellipse cx="404" cy="428" rx="46" ry="30" fill="url(#${p}cheekR)" filter="url(#${p}soft)"/>
      <ellipse cx="232" cy="404" rx="34" ry="18" fill="url(#${p}bone)" filter="url(#${p}soft)"/>
      <ellipse cx="408" cy="404" rx="34" ry="18" fill="url(#${p}bone)" filter="url(#${p}soft)"/>
      <ellipse cx="320" cy="598" rx="92" ry="28" fill="${L.jaw}" opacity="0.28" filter="url(#${p}soft)"/>
      <path d="M186 360 C196 430, 208 490, 232 548" stroke="${L.plane}" stroke-width="16" fill="none" opacity="0.22"/>
      <path d="M454 360 C444 430, 432 490, 408 548" stroke="${L.plane}" stroke-width="16" fill="none" opacity="0.2"/>
    </g>
    ${agent === "technical"
      ? `<path d="M178 330 C194 224 248 176 320 168 C392 176 446 224 462 330 C424 256 382 220 320 216 C258 220 216 256 178 330Z" fill="${L.hairLine}"/>
         <path d="M206 254 Q266 188 340 204 Q296 240 222 288Z" fill="${L.bangs}" opacity="0.88"/>`
      : `<path d="M176 332 C198 228, 248 176, 320 168 C392 176, 442 228, 464 332
                  C436 248, 392 206, 320 200 C248 206, 204 248, 176 332 Z" fill="${L.hairLine}"/>
         <path d="M208 248 C252 206, 294 190, 336 204 C304 232, 270 258, 226 292 Z" fill="${L.bangs}" opacity="0.92"/>
         <path d="M432 248 C388 206, 346 190, 304 204 C336 232, 370 258, 414 292 Z" fill="${L.bangs}" opacity="0.86"/>`}
    <path d="M220 334 C250 314, 282 310, 308 326" stroke="${L.brow}" stroke-width="7.5" stroke-linecap="round" fill="none"/>
    <path d="M222 336 C250 318, 280 316, 306 328" stroke="${L.browHair}" stroke-width="2" fill="none" opacity="0.75"/>
    <path d="M332 326 C358 310, 390 314, 420 336" stroke="${L.brow}" stroke-width="7.5" stroke-linecap="round" fill="none"/>
    <path d="M334 328 C360 316, 390 318, 418 336" stroke="${L.browHair}" stroke-width="2" fill="none" opacity="0.75"/>
    ${eyePair(p, L, 256, 368, "left")}
    ${eyePair(p, L, 384, 368, "right")}
    <path d="M320 348 C316 398, 312 ${438 + nw}, ${308 - nw} 466 C314 474, 326 474, ${332 + nw} 466 C${328 + nw} ${438 + nw}, 324 398, 320 348"
          fill="${L.nose}" opacity="0.55"/>
    <ellipse cx="320" cy="410" rx="5" ry="34" fill="${L.highlight}" opacity="${Number(L.highlightOp) + 0.08}"/>
    <ellipse cx="${306 - nw}" cy="470" rx="${11 + nw * 0.4}" ry="7" fill="${L.noseWing}" opacity="0.85"/>
    <ellipse cx="${334 + nw}" cy="470" rx="${11 + nw * 0.4}" ry="7" fill="${L.noseWing}" opacity="0.85"/>
    <ellipse cx="${310 - nw}" cy="472" rx="4.2" ry="2.6" fill="${L.nostril}" opacity="0.7"/>
    <ellipse cx="${330 + nw}" cy="472" rx="4.2" ry="2.6" fill="${L.nostril}" opacity="0.7"/>
    <path d="M${308 - nw} 466 C314 478, 326 478, ${332 + nw} 466" fill="none" stroke="${L.nostril}" stroke-width="1.4" opacity="0.35"/>
    <path d="M312 478 C314 492, 316 504, 318 512" stroke="${L.plane}" stroke-width="1.4" opacity="0.25"/>
    <path d="M328 478 C326 492, 324 504, 322 512" stroke="${L.plane}" stroke-width="1.4" opacity="0.25"/>
    ${agent === "technical"
      ? `<path d="M288 518 Q306 510 320 514 Q334 510 352 518 Q334 526 320 525 Q306 526 288 518Z" fill="${L.lip[1]}"/>
         <path d="M294 521 Q320 536 346 521 Q320 529 294 521Z" fill="${L.lip[0]}" opacity="0.75"/>`
      : `<path d="M${278 - nw} 516 C296 500, 310 504, 320 510 C330 504, 344 500, ${362 + nw} 516
                  C346 520, 332 522, 320 520 C308 522, 294 520, ${278 - nw} 516 Z" fill="url(#${p}lipU)"/>
         <path d="M${280 - nw} 518 C300 542, 340 542, ${360 + nw} 518 C340 532, 300 532, ${280 - nw} 518 Z" fill="url(#${p}lipL)"/>
         <ellipse cx="320" cy="528" rx="18" ry="5" fill="${L.highlight}" opacity="0.28"/>`}
    <ellipse class="mouth" cx="320" cy="518" rx="${L.lipRx}" ry="2.5" fill="${L.mouth}"/>
    ${agent === "technical" ? "" : `<circle cx="164" cy="478" r="6.5" fill="${accent}"/><circle cx="476" cy="478" r="6.5" fill="${accent}"/>`}
    <rect x="236" y="736" width="168" height="28" rx="14" fill="${accent}"/>
  `;
}

document.querySelectorAll(".talent .face").forEach((svg) => {
  const agent = svg.closest(".talent").dataset.agent;
  svg.innerHTML = cofounderFaceSvg(agent, COLORS[agent]);
});

const logEl = document.getElementById("log");
const form = document.getElementById("missionForm");
const goalEl = document.getElementById("goal");
const runBtn = document.getElementById("runBtn");
const onAirEl = document.getElementById("onAir");
const clockEl = document.getElementById("clock");
const packEl = document.getElementById("pack");
const packStatusEl = document.getElementById("packStatus");
const studioEl = document.getElementById("studio");
const studioPreviewEl = document.getElementById("studioPreview");
const studioRevisionEl = document.getElementById("studioRevision");
const studioStateEl = document.getElementById("studioState");
const studioLogEl = document.getElementById("studioLog");
const studioForm = document.getElementById("studioForm");
const studioPromptEl = document.getElementById("studioPrompt");
const studioSendEl = document.getElementById("studioSend");
const studioCodeEl = document.getElementById("studioCode");
const studioGithubEl = document.getElementById("studioGithub");
const episode = {
  missionId: "",
  builtIdea: "",
  brand: null,
  review: null,
  page: null,
  mvpReview: null,
  mvp: null,
};
const SAVED_IDEA_KEY = "cofounder-live-idea";
const SAVED_PROJECT_KEY = "cofounder-live-project";

goalEl.value = localStorage.getItem(SAVED_IDEA_KEY) || "";
goalEl.addEventListener("input", () => {
  localStorage.setItem(SAVED_IDEA_KEY, goalEl.value);
  if (episode.builtIdea && goalEl.value.trim() !== episode.builtIdea) {
    runBtn.dataset.phase = "build";
    runBtn.textContent = "Build it live";
    studioEl.hidden = true;
  }
});

function tickClock() {
  clockEl.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
tickClock();
setInterval(tickClock, 1000);

function setLive(on) {
  onAirEl.textContent = on ? "On air" : "Standby";
  onAirEl.classList.toggle("live", on);
  onAirEl.classList.toggle("standby", !on);
}

function setSpeaking(agent, on) {
  document.querySelectorAll(".talent").forEach((el) => {
    el.classList.toggle("speaking", on && el.dataset.agent === agent);
    const mouth = el.querySelector(".mouth");
    if (mouth) mouth.setAttribute("ry", on && el.dataset.agent === agent ? "12" : "2.5");
  });
}

function setWorking(agent, on) {
  document.querySelectorAll(".talent").forEach((el) => {
    el.classList.toggle("working", on && el.dataset.agent === agent);
  });
}

function ingestPresence(event) {
  if (event.type === "tool_start" || event.type === "studio_step") {
    setWorking(event.agent, true);
  }
  if (["tool_done", "tool_error", "studio_plan", "studio_publish"].includes(event.type)) {
    setWorking(event.agent, false);
  }
  if (["done", "error", "studio_done"].includes(event.type)) {
    setWorking("creative", false);
    setWorking("technical", false);
  }
}

function displayName(agent) {
  return DISPLAY_NAMES[agent] || agent || "Studio";
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}

function renderPack() {
  const parts = [];
  if (episode.brand) {
    const notes = (episode.brand.creativeNotes || [])
      .map((note) => `<li>${esc(note)}</li>`)
      .join("");
    const swatches = Object.entries(episode.brand.palette || {})
      .slice(0, 5)
      .map(([name, value]) => `<span class="swatch" title="${esc(name)}" style="background:${esc(value)}"></span>`)
      .join("");
    parts.push(`
      <div class="pack-block">
        <h3>Creative direction</h3>
        <p><strong>${esc(episode.brand.name || "")}</strong> · ${esc(episode.brand.tagline || "")}</p>
        <div class="swatches">${swatches}</div>
        ${notes ? `<ul>${notes}</ul>` : ""}
      </div>
    `);
  }
  if (episode.review) {
    const changes = (episode.review.changes || [])
      .map((change) => `<li><strong>${esc(change.area || "Design")}</strong> · ${esc(change.instruction || change)}</li>`)
      .join("");
    parts.push(`
      <div class="pack-block creative-review">
        <h3>Creative review · ${esc(episode.review.score || "—")}/10</h3>
        <p>${esc(episode.review.verdict || "")}</p>
        ${changes ? `<ul>${changes}</ul>` : ""}
      </div>
    `);
  }
  if (episode.page?.pageUrl) {
    parts.push(`
      <div class="pack-block published">
        <h3>Technical build · Revision ${esc(episode.page.revision || 1)}</h3>
        <p>${esc(episode.page.headline || "Investor landing page published")}</p>
        <a class="page-link" href="${esc(episode.page.pageUrl)}" target="_blank" rel="noreferrer">Open live landing page ↗</a>
        <small>${esc(episode.page.pageUrl)}</small>
        <iframe class="site-preview" src="${esc(episode.page.pageUrl)}" title="Live landing-page preview"></iframe>
      </div>
    `);
  }
  if (episode.mvpReview) {
    const changes = (episode.mvpReview.changes || [])
      .map((change) => `<li><strong>${esc(change.area || "Product")}</strong> · ${esc(change.instruction || change)}</li>`)
      .join("");
    parts.push(`
      <div class="pack-block creative-review">
        <h3>MVP review · ${esc(episode.mvpReview.score || "—")}/10</h3>
        <p>${esc(episode.mvpReview.verdict || "")}</p>
        ${changes ? `<ul>${changes}</ul>` : ""}
      </div>
    `);
  }
  if (episode.mvp?.mvpUrl) {
    const capability = episode.mvp.googleCapability;
    parts.push(`
      <div class="pack-block published">
        <h3>Working MVP · Revision ${esc(episode.mvp.revision || 1)}</h3>
        <p>${esc(episode.mvp.workflow || episode.mvp.headline || "Interactive prototype launched")}</p>
        ${capability ? `<p><strong>${esc(capability.label || capability.service)}</strong> · ${esc(capability.rationale || "Selected by Theo for the core workflow.")}</p>` : ""}
        <a class="page-link" href="${esc(episode.mvp.mvpUrl)}" target="_blank" rel="noreferrer">View Product Concept ↗</a>
        <small>${esc(episode.mvp.mvpUrl)}</small>
        <iframe class="site-preview" src="${esc(episode.mvp.mvpUrl)}" title="Working MVP preview"></iframe>
      </div>
    `);
  }
  packEl.innerHTML = parts.length
    ? parts.join("")
    : `<p class="empty">Creative’s visual direction and Technical’s published URL will appear here.</p>`;
}

let studioLoadedMission = "";

function addStudioRow(agent, message) {
  const row = document.createElement("p");
  const who = document.createElement("strong");
  const text = document.createElement("span");
  who.textContent = agent;
  text.textContent = message;
  row.append(who, text);
  studioLogEl.append(row);
  studioLogEl.scrollTop = studioLogEl.scrollHeight;
}

async function syncStudio() {
  if (!episode.missionId || !episode.mvp?.mvpUrl || Number(episode.mvp.revision || 0) < 2) {
    studioEl.hidden = true;
    return;
  }
  studioEl.hidden = false;
  const revision = Number(episode.mvp.revision || 2);
  studioRevisionEl.textContent = `Revision ${revision}`;
  if (studioPreviewEl.dataset.revision !== String(revision)) {
    studioPreviewEl.src = `${episode.mvp.mvpUrl}?studio=${revision}`;
    studioPreviewEl.dataset.revision = String(revision);
  }
  if (studioLoadedMission === episode.missionId) return;
  studioLoadedMission = episode.missionId;
  studioLogEl.innerHTML = "";
  addStudioRow("Creative + Technical", "Ask us to change the product, workflow, copy, layout, or visual direction.");
  try {
    const res = await fetch(`/api/workspace/${encodeURIComponent(episode.missionId)}`);
    if (!res.ok) return;
    const workspace = await res.json();
    studioRevisionEl.textContent = `Revision ${workspace.revision || revision}`;
    if (workspace.history?.length) {
      studioLogEl.innerHTML = "";
      workspace.history.slice().reverse().forEach((item) => {
        addStudioRow(`Revision ${item.revision}`, item.summary || item.instruction);
      });
    }
  } catch {
    studioStateEl.textContent = "Preview ready";
  }
}

function syncEpisodeUi() {
  if (episode.page?.revision === 2 && !episode.mvp) {
    runBtn.dataset.phase = "launch";
    runBtn.textContent = "Launch MVP";
  }
  if (episode.mvp?.revision >= 2) {
    runBtn.dataset.phase = "open";
    runBtn.textContent = "View Product Concept ↗";
  }
  if (episode.brand || episode.review || episode.page || episode.mvp) {
    packStatusEl.textContent = episode.mvp?.revision >= 2
      ? "Working MVP live"
      : episode.mvpReview
        ? "Applying MVP review"
        : episode.mvp?.mvpUrl
          ? "MVP draft live"
          : episode.page?.revision === 2
            ? "Final page live"
            : episode.review
              ? "Applying review"
              : episode.page?.pageUrl
                ? "Draft live"
                : "Designing";
    renderPack();
  }
  syncStudio();
}

function persistEpisode() {
  if (!episode.missionId) return;
  localStorage.setItem(SAVED_PROJECT_KEY, JSON.stringify(episode));
}

function ingestProof(event) {
  const proof = event.proof;
  if (!proof || typeof proof !== "object") return;
  if (proof.missionId) episode.missionId = proof.missionId;
  if (proof.id && String(proof.id).startsWith("ep_")) episode.missionId = proof.id;
  if (event.tool === "create_visual_direction") episode.brand = proof;
  if (event.tool === "review_landing_page") episode.review = proof;
  if (["publish_landing_page", "revise_landing_page"].includes(event.tool) || proof.pageUrl) episode.page = proof;
  if (event.tool === "review_mvp") episode.mvpReview = proof;
  if (["build_mvp", "revise_mvp"].includes(event.tool) || proof.mvpUrl) episode.mvp = proof;
  syncEpisodeUi();
  persistEpisode();
}

function addRow(event) {
  ingestPresence(event);
  ingestProof(event);
  const row = document.createElement("div");
  row.className = "row";
  const proof = event.proof ? JSON.stringify(event.proof, null, 2) : "";
  row.innerHTML = `
    <div class="who" style="color:${COLORS[event.agent] || COLORS.director}">${esc(displayName(event.agent))} · ${esc(event.tool || event.type)}</div>
    <div class="msg">${esc(event.text || "")}</div>
    ${proof ? `<pre class="proof">${esc(proof)}</pre>` : ""}
  `;
  logEl.appendChild(row);
  logEl.scrollTop = logEl.scrollHeight;
}

async function speak(text, agent) {
  if (!text) return;
  setSpeaking(agent, true);
  try {
    const res = await fetch("/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 280), agent }),
    });
    if (!res.ok) throw new Error("tts");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    await audio.play();
    await new Promise((resolve) => {
      audio.onended = resolve;
    });
    URL.revokeObjectURL(url);
  } catch {
    if ("speechSynthesis" in window) {
      await new Promise((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        u.onend = resolve;
        speechSynthesis.speak(u);
      });
    }
  } finally {
    setSpeaking(agent, false);
  }
}

async function consumeEventStream(res, onEvent = addRow) {
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";
    for (const chunk of chunks) {
      if (!chunk.startsWith("data: ")) continue;
      const event = JSON.parse(chunk.slice(6));
      onEvent(event);
      if (event.text && (event.type === "speech" || event.type === "done")) {
        await speak(event.text, event.agent);
      }
    }
  }
}

async function launchMvp() {
  if (!episode.missionId) {
    throw new Error("The landing-page session is missing. Rebuild the page before launching its MVP.");
  }
  runBtn.disabled = true;
  setLive(true);
  packStatusEl.textContent = "Building working MVP";
  addRow({ agent: "director", type: "start", text: "Technical is turning the approved page into a working product. Creative will test it before launch." });
  try {
    const res = await fetch("/api/agent/mvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ missionId: episode.missionId }),
    });
    await consumeEventStream(res);
  } finally {
    runBtn.disabled = false;
    setLive(false);
  }
}

studioForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const instruction = studioPromptEl.value.trim();
  if (!instruction || !episode.missionId) return;
  studioSendEl.disabled = true;
  studioCodeEl.disabled = true;
  studioGithubEl.disabled = true;
  studioPromptEl.disabled = true;
  studioStateEl.textContent = "Cofounders building";
  addStudioRow("Founder", instruction);
  let failed = false;
  try {
    const res = await fetch(`/api/workspace/${encodeURIComponent(episode.missionId)}/turn`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
    });
    await consumeEventStream(res, (studioEvent) => {
      ingestPresence(studioEvent);
      if (studioEvent.text) addStudioRow(displayName(studioEvent.agent), studioEvent.text);
      if (studioEvent.proof) ingestProof(studioEvent);
      if (studioEvent.type === "error") failed = true;
    });
    if (!failed) studioPromptEl.value = "";
  } catch (error) {
    failed = true;
    addStudioRow("System", error.message);
  } finally {
    studioStateEl.textContent = failed ? "Needs attention" : "Preview updated";
    studioSendEl.disabled = false;
    studioCodeEl.disabled = false;
    studioGithubEl.disabled = false;
    studioPromptEl.disabled = false;
    studioPromptEl.focus();
  }
});

studioCodeEl.addEventListener("click", async () => {
  if (!episode.missionId) return;
  studioCodeEl.disabled = true;
  studioStateEl.textContent = "Preparing code";
  try {
    const res = await fetch(`/api/workspace/${encodeURIComponent(episode.missionId)}/code`);
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      throw new Error(payload.error || "Code download failed");
    }
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition") || "";
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1] || "product-concept.zip";
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    studioStateEl.textContent = "Code downloaded";
    addStudioRow("Technical", "Packaged the current product concept as a portable codebase.");
  } catch (error) {
    studioStateEl.textContent = "Download failed";
    addStudioRow("System", error.message);
  } finally {
    studioCodeEl.disabled = false;
  }
});

studioGithubEl.addEventListener("click", async () => {
  if (!episode.missionId) return;
  studioGithubEl.disabled = true;
  studioStateEl.textContent = "Creating GitHub PR";
  try {
    const res = await fetch(`/api/workspace/${encodeURIComponent(episode.missionId)}/github`, {
      method: "POST",
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || "GitHub delivery failed");
    studioStateEl.textContent = payload.reused ? "PR already ready" : "PR created";
    addStudioRow("Technical", payload.reused
      ? `Reopened the existing delivery for this revision: ${payload.pullRequestUrl}`
      : `Created a clean repository delivery and pull request: ${payload.pullRequestUrl}`);
    window.open(payload.pullRequestUrl, "_blank", "noopener,noreferrer");
  } catch (error) {
    studioStateEl.textContent = "GitHub delivery failed";
    addStudioRow("System", error.message);
  } finally {
    studioGithubEl.disabled = false;
  }
});

async function restorePreviousBuild() {
  const idea = goalEl.value.trim();
  if (!idea) return;
  runBtn.disabled = true;
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED_PROJECT_KEY) || "null");
    if (saved?.missionId && saved.builtIdea === idea && saved.page?.pageUrl) {
      Object.assign(episode, saved);
      syncEpisodeUi();
      return;
    }
    const res = await fetch("/api/project/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idea }),
    });
    if (!res.ok) return;
    const project = await res.json();
    if (!project.found) return;
    Object.assign(episode, project);
    syncEpisodeUi();
    persistEpisode();
  } catch {
    // A failed restore should never prevent a fresh build.
  } finally {
    runBtn.disabled = false;
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const phase = runBtn.dataset.phase || "build";
  if (phase === "open" && episode.mvp?.mvpUrl) {
    window.open(episode.mvp.mvpUrl, "_blank", "noopener,noreferrer");
    return;
  }
  if (phase === "launch") {
    try {
      await launchMvp();
    } catch (err) {
      addRow({ agent: "director", type: "error", text: err.message });
    }
    return;
  }

  const goal = goalEl.value.trim();
  if (!goal) return;
  localStorage.setItem(SAVED_IDEA_KEY, goal);
  localStorage.removeItem(SAVED_PROJECT_KEY);
  runBtn.disabled = true;
  runBtn.dataset.phase = "build";
  runBtn.textContent = "Build it live";
  setLive(true);
  logEl.innerHTML = "";
  Object.assign(episode, {
    missionId: "",
    builtIdea: goal,
    brand: null,
    review: null,
    page: null,
    mvpReview: null,
    mvp: null,
  });
  studioEl.hidden = true;
  studioLoadedMission = "";
  delete studioPreviewEl.dataset.revision;
  packStatusEl.textContent = "Cofounders working";
  renderPack();
  addRow({ agent: "director", type: "start", text: "Creative is shaping the idea. Technical is standing by." });

  try {
    const res = await fetch("/api/agent/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal }),
    });
    await consumeEventStream(res);
  } catch (err) {
    addRow({ agent: "director", type: "error", text: err.message });
  }
  runBtn.disabled = false;
  setLive(false);
});

restorePreviousBuild();
