const $ = (id) => document.getElementById(id);

const trackCanvas = $("trackCanvas");
const forceCanvas = $("forceCanvas");
const statusLine = $("statusLine");
const liveReadout = $("liveReadout");
const probeReadout = $("probeReadout");
const metricsPanel = $("metricsPanel");
const historyBody = document.querySelector("#historyTable tbody");

const scenarioSelect = $("scenarioSelect");
const massAInput = $("massA");
const massBInput = $("massB");
const vAInput = $("vA");
const vBInput = $("vB");
const pushForceInput = $("pushForce");
const sensorModeSelect = $("sensorMode");
const sensorBiasInput = $("sensorBias");

const massAValue = $("massAValue");
const massBValue = $("massBValue");
const vAValue = $("vAValue");
const vBValue = $("vBValue");
const pushForceValue = $("pushForceValue");
const sensorBiasValue = $("sensorBiasValue");

const runBtn = $("runBtn");
const pauseBtn = $("pauseBtn");
const resetBtn = $("resetBtn");
const themeToggleBtn = $("themeToggleBtn");
const stationPrompt = $("stationPrompt");

const diagramSetSelect = $("diagramSet");
const diagramObjectSelect = $("diagramObject");
const diagramSourceSelect = $("diagramSource");
const diagramForceTypeSelect = $("diagramForceType");
const diagramDirectionSelect = $("diagramDirection");
const diagramMagnitudeInput = $("diagramMagnitude");
const diagramMagnitudeValue = $("diagramMagnitudeValue");
const addVectorBtn = $("addVectorBtn");
const undoVectorBtn = $("undoVectorBtn");
const clearSetBtn = $("clearSetBtn");
const diagramCanvas = $("diagramCanvas");
const diagramList = $("diagramList");
const diagramStatus = $("diagramStatus");

const TRACK = {
  min: 0,
  max: 9,
  cartWidth: 0.56,
  padding: { left: 56, right: 36, top: 26, bottom: 34 },
};

const FORCE_GRAPH = {
  padding: { left: 62, right: 28, top: 26, bottom: 34 },
};

const PHYS = {
  dtMax: 1 / 120,
  dtStep: 1 / 240,
  defaultDuration: 3.8,
  kContact: 920,
  cContact: 34,
  kWall: 5200,
  cWall: 120,
};

const SCENARIOS = {
  collision1: {
    label: "Station 1 · Collision 1",
    type: "collision",
    stationPrompt:
      "Push Cart A into Cart B. Compare the two force curves at impact, then draw force diagrams for each cart.",
    defaults: { mA: 0.5, mB: 0.5, vA: 1.4, vB: 0.0, pushForce: 12, sensorMode: "correct", sensorBias: 2 },
    duration: 3.3,
  },
  collision2: {
    label: "Station 1 · Collision 2 (heavier Cart B)",
    type: "collision",
    stationPrompt:
      "Repeat Collision 1 with more mass on Cart B. Compare speed change and force graphs between run 1 and run 2.",
    defaults: { mA: 0.5, mB: 1.2, vA: 1.4, vB: 0.0, pushForce: 12, sensorMode: "correct", sensorBias: 2 },
    duration: 3.3,
  },
  staticPush: {
    label: "Station 4 · Equal push, neither moves",
    type: "push-static",
    stationPrompt:
      "Equal-mass carts push on each other but remain at rest. Build predicted and measured force diagrams and compare arrows.",
    defaults: { mA: 0.65, mB: 0.65, vA: 0, vB: 0, pushForce: 11, sensorMode: "correct", sensorBias: 2 },
    duration: 3.6,
    lockVelocity: true,
    lockEqualMass: true,
  },
  togetherPush: {
    label: "Station 4 · A pushes B, both move together",
    type: "push-together",
    stationPrompt:
      "Cart A pushes Cart B and both move together. Compare force pair values and explain motion using net force on each cart.",
    defaults: { mA: 0.65, mB: 0.65, vA: 0, vB: 0, pushForce: 14, sensorMode: "correct", sensorBias: 2 },
    duration: 3.6,
    lockVelocity: true,
  },
  wallPush: {
    label: "Station 4 · Push Cart A into Cart B at wall",
    type: "wall-push",
    stationPrompt:
      "Hold Cart B at the wall and push Cart A into it. Focus on force spikes and compare to your predicted diagram.",
    defaults: { mA: 0.65, mB: 0.75, vA: 0, vB: 0, pushForce: 16, sensorMode: "correct", sensorBias: 2 },
    duration: 3.8,
    lockVelocity: true,
  },
  challenge: {
    label: "Station 4 · Challenge (make graphs look different)",
    type: "collision",
    stationPrompt:
      "Try to make Cart A and Cart B graph lines look different using sensor setup errors. Explain why true action-reaction forces are still equal.",
    defaults: { mA: 0.55, mB: 0.9, vA: 1.55, vB: 0.0, pushForce: 12, sensorMode: "bias", sensorBias: 2.5 },
    duration: 3.3,
  },
};

const state = {
  scenarioId: "collision1",
  running: false,
  paused: false,
  done: false,
  animationId: null,
  lastTs: 0,
  time: 0,
  duration: PHYS.defaultDuration,
  runNumber: 0,
  probeLocked: false,
  probeSample: null,
  cfg: null,
  samples: [],
  history: [],
  carts: {
    mA: 0.5,
    mB: 0.5,
    xA: 2.1,
    xB: 5.0,
    vA: 0,
    vB: 0,
  },
  diagrams: {
    prediction: [],
    measured: [],
  },
};

const tCtx = trackCanvas.getContext("2d");
const fCtx = forceCanvas.getContext("2d");
const dCtx = diagramCanvas.getContext("2d");

bootstrap();

function bootstrap() {
  populateScenarios();
  wireInputs();
  restoreTheme();

  resizeCanvas(trackCanvas, 300);
  resizeCanvas(forceCanvas, 300);
  resizeCanvas(diagramCanvas, 360);

  window.addEventListener("resize", () => {
    resizeCanvas(trackCanvas, 300);
    resizeCanvas(forceCanvas, 300);
    resizeCanvas(diagramCanvas, 360);
    renderAll();
  });

  scenarioSelect.value = state.scenarioId;
  applyScenarioDefaults(state.scenarioId);
  resetTrial({ keepHistory: true });
}

function populateScenarios() {
  scenarioSelect.innerHTML = "";
  Object.entries(SCENARIOS).forEach(([id, cfg]) => {
    const opt = document.createElement("option");
    opt.value = id;
    opt.textContent = cfg.label;
    scenarioSelect.append(opt);
  });
}

function wireInputs() {
  const ranged = [
    [massAInput, massAValue, (v) => Number(v).toFixed(2)],
    [massBInput, massBValue, (v) => Number(v).toFixed(2)],
    [vAInput, vAValue, (v) => Number(v).toFixed(2)],
    [vBInput, vBValue, (v) => Number(v).toFixed(2)],
    [pushForceInput, pushForceValue, (v) => Number(v).toFixed(1)],
    [sensorBiasInput, sensorBiasValue, (v) => Number(v).toFixed(2)],
    [diagramMagnitudeInput, diagramMagnitudeValue, (v) => String(v)],
  ];

  ranged.forEach(([input, output, fmt]) => {
    input.addEventListener("input", () => {
      output.value = fmt(input.value);
      if (input === massAInput && SCENARIOS[state.scenarioId].lockEqualMass) {
        massBInput.value = massAInput.value;
        massBValue.value = Number(massBInput.value).toFixed(2);
      }
      if (!state.running) {
        resetTrial({ keepHistory: true });
      }
    });
  });

  scenarioSelect.addEventListener("change", () => {
    state.scenarioId = scenarioSelect.value;
    applyScenarioDefaults(state.scenarioId);
    resetTrial({ keepHistory: true });
  });

  sensorModeSelect.addEventListener("change", () => {
    if (!state.running) renderAll();
  });

  runBtn.addEventListener("click", startTrial);
  pauseBtn.addEventListener("click", togglePause);
  resetBtn.addEventListener("click", () => resetTrial({ keepHistory: true }));

  themeToggleBtn.addEventListener("click", toggleTheme);

  forceCanvas.addEventListener("mousemove", onGraphPointerMove);
  forceCanvas.addEventListener("click", onGraphClick);
  forceCanvas.addEventListener("mouseleave", onGraphLeave);

  addVectorBtn.addEventListener("click", addVector);
  undoVectorBtn.addEventListener("click", undoVector);
  clearSetBtn.addEventListener("click", clearSet);
  diagramSetSelect.addEventListener("change", () => {
    diagramStatus.textContent = `Editing ${diagramSetSelect.value} diagram set.`;
    renderDiagramList();
    renderDiagramBoard();
  });
}

function applyScenarioDefaults(id) {
  const s = SCENARIOS[id];
  if (!s) return;

  massAInput.value = String(s.defaults.mA);
  massBInput.value = String(s.defaults.mB);
  vAInput.value = String(s.defaults.vA);
  vBInput.value = String(s.defaults.vB);
  pushForceInput.value = String(s.defaults.pushForce);
  sensorModeSelect.value = s.defaults.sensorMode;
  sensorBiasInput.value = String(s.defaults.sensorBias);

  massAValue.value = Number(massAInput.value).toFixed(2);
  massBValue.value = Number(massBInput.value).toFixed(2);
  vAValue.value = Number(vAInput.value).toFixed(2);
  vBValue.value = Number(vBInput.value).toFixed(2);
  pushForceValue.value = Number(pushForceInput.value).toFixed(1);
  sensorBiasValue.value = Number(sensorBiasInput.value).toFixed(2);

  vAInput.disabled = Boolean(s.lockVelocity);
  vBInput.disabled = Boolean(s.lockVelocity);
  massBInput.disabled = Boolean(s.lockEqualMass);

  if (s.lockEqualMass) {
    massBInput.value = massAInput.value;
    massBValue.value = Number(massBInput.value).toFixed(2);
  }

  stationPrompt.textContent = s.stationPrompt;
}

function getConfig() {
  const scenario = SCENARIOS[state.scenarioId];
  return {
    scenarioId: state.scenarioId,
    label: scenario.label,
    type: scenario.type,
    duration: scenario.duration || PHYS.defaultDuration,
    mA: Number(massAInput.value),
    mB: Number(massBInput.value),
    vA: Number(vAInput.value),
    vB: Number(vBInput.value),
    pushForce: Number(pushForceInput.value),
    sensorMode: sensorModeSelect.value,
    sensorBias: Number(sensorBiasInput.value),
  };
}

function startTrial() {
  if (state.running && !state.done) {
    statusLine.textContent = "Trial already running. Pause or Reset first.";
    return;
  }

  state.cfg = getConfig();
  state.runNumber += 1;
  initializeRunState(state.cfg);

  state.running = true;
  state.paused = false;
  state.done = false;
  state.probeLocked = false;
  pauseBtn.textContent = "Pause";
  statusLine.textContent = `${state.cfg.label} running. Watch the force pair during contact.`;

  if (state.animationId) cancelAnimationFrame(state.animationId);
  state.lastTs = performance.now();
  state.animationId = requestAnimationFrame(tick);
}

function initializeRunState(cfg) {
  state.time = 0;
  state.duration = cfg.duration;

  state.carts.mA = cfg.mA;
  state.carts.mB = cfg.mB;
  state.carts.vA = cfg.vA;
  state.carts.vB = cfg.vB;
  state.carts.forceAB = 0;

  if (cfg.type === "collision") {
    state.carts.xA = 2.55;
    state.carts.xB = 3.9;
  } else if (cfg.type === "push-static" || cfg.type === "push-together") {
    state.carts.xA = 3.0;
    state.carts.xB = state.carts.xA + TRACK.cartWidth;
    state.carts.vA = 0;
    state.carts.vB = 0;
  } else if (cfg.type === "wall-push") {
    state.carts.xB = TRACK.max - TRACK.cartWidth * 0.5 - 0.05;
    state.carts.xA = state.carts.xB - TRACK.cartWidth - 0.8;
    state.carts.vA = 0;
    state.carts.vB = 0;
  }

  state.samples = [];
  const start = computeSample(0);
  state.samples.push(start);
  state.probeSample = start;

  renderAll();
}

function togglePause() {
  if (!state.running || state.done) {
    statusLine.textContent = "Nothing to pause. Start a trial first.";
    return;
  }

  state.paused = !state.paused;
  pauseBtn.textContent = state.paused ? "Resume" : "Pause";
  statusLine.textContent = state.paused ? "Trial paused." : "Trial resumed.";

  if (!state.paused) {
    state.lastTs = performance.now();
    state.animationId = requestAnimationFrame(tick);
  }
}

function resetTrial({ keepHistory }) {
  if (state.animationId) cancelAnimationFrame(state.animationId);

  state.running = false;
  state.paused = false;
  state.done = true;
  state.probeLocked = false;
  pauseBtn.textContent = "Pause";

  state.cfg = getConfig();
  initializeRunState(state.cfg);

  if (!keepHistory) state.history = [];
  statusLine.textContent = "Choose a scenario and click Run Trial.";
  liveReadout.textContent = "";
  probeReadout.textContent = "Run a trial, then hover or tap the graph to read force values.";

  renderHistory();
  updateMetrics();
  renderAll();
}

function tick(ts) {
  if (state.paused || state.done) return;

  let frameDt = Math.min((ts - state.lastTs) / 1000, PHYS.dtMax);
  state.lastTs = ts;

  while (frameDt > 1e-8) {
    const dt = Math.min(PHYS.dtStep, frameDt);
    stepSimulation(dt);
    frameDt -= dt;
  }

  const sample = computeSample(state.time);
  state.samples.push(sample);

  if (!state.probeLocked) state.probeSample = sample;

  renderAll();

  if (state.time >= state.duration) {
    finishTrial();
    return;
  }

  state.animationId = requestAnimationFrame(tick);
}

function stepSimulation(dt) {
  const cfg = state.cfg;
  const carts = state.carts;
  state.time += dt;

  let forceAB = 0;
  let externalOnA = 0;

  if (cfg.type === "collision") {
    const overlap = overlapAB(carts.xA, carts.xB);
    if (overlap > 0) {
      const relV = carts.vA - carts.vB;
      forceAB = Math.max(0, PHYS.kContact * overlap + PHYS.cContact * relV);
    }

    const aA = (externalOnA - forceAB) / carts.mA;
    const aB = forceAB / carts.mB;

    carts.vA += aA * dt;
    carts.vB += aB * dt;
    carts.xA += carts.vA * dt;
    carts.xB += carts.vB * dt;

    confineToTrack();
  }

  if (cfg.type === "push-static") {
    forceAB = cfg.pushForce * pushEnvelope(state.time, cfg.duration, 0.22);
    carts.vA = 0;
    carts.vB = 0;
  }

  if (cfg.type === "push-together") {
    const push = cfg.pushForce * pushEnvelope(state.time, cfg.duration, 0.25);
    const aPair = push / (carts.mA + carts.mB);
    forceAB = carts.mB * aPair;

    carts.vA += aPair * dt;
    carts.vB = carts.vA;

    carts.xA += carts.vA * dt;
    carts.xB = carts.xA + TRACK.cartWidth;

    const maxCenter = TRACK.max - TRACK.cartWidth * 0.5;
    if (carts.xB > maxCenter) {
      carts.xB = maxCenter;
      carts.xA = carts.xB - TRACK.cartWidth;
      carts.vA = 0;
      carts.vB = 0;
    }
  }

  if (cfg.type === "wall-push") {
    const push = cfg.pushForce * pushEnvelope(state.time, cfg.duration, 0.18);
    externalOnA = push;

    const overlap = overlapAB(carts.xA, carts.xB);
    if (overlap > 0) {
      const relV = carts.vA - carts.vB;
      forceAB = Math.max(0, PHYS.kContact * overlap + PHYS.cContact * relV);
    }

    const wallX = TRACK.max - 0.02;
    const rightFaceB = carts.xB + TRACK.cartWidth * 0.5;
    const wallOverlap = rightFaceB - wallX;
    const wallForceOnB = wallOverlap > 0 ? Math.max(0, PHYS.kWall * wallOverlap + PHYS.cWall * Math.max(0, carts.vB)) : 0;

    const aA = (externalOnA - forceAB) / carts.mA;
    const aB = (forceAB - wallForceOnB) / carts.mB;

    carts.vA += aA * dt;
    carts.vB += aB * dt;
    carts.xA += carts.vA * dt;
    carts.xB += carts.vB * dt;

    confineToTrack();
  }

  carts.forceAB = forceAB;
}

function confineToTrack() {
  const carts = state.carts;
  const minCenter = TRACK.min + TRACK.cartWidth * 0.5;
  const maxCenter = TRACK.max - TRACK.cartWidth * 0.5;

  if (carts.xA < minCenter) {
    carts.xA = minCenter;
    carts.vA = 0;
  }

  if (carts.xB < minCenter) {
    carts.xB = minCenter;
    carts.vB = 0;
  }

  if (carts.xA > maxCenter) {
    carts.xA = maxCenter;
    carts.vA = 0;
  }

  if (carts.xB > maxCenter) {
    carts.xB = maxCenter;
    carts.vB = 0;
  }
}

function overlapAB(xA, xB) {
  const rightA = xA + TRACK.cartWidth * 0.5;
  const leftB = xB - TRACK.cartWidth * 0.5;
  return Math.max(0, rightA - leftB);
}

function pushEnvelope(t, duration, rise) {
  const p = Math.max(0, Math.min(1, t / duration));
  const riseGate = smoothstep(Math.min(1, p / rise));
  const fallGate = smoothstep(Math.min(1, (1 - p) / 0.2));
  return riseGate * fallGate;
}

function smoothstep(x) {
  return x * x * (3 - 2 * x);
}

function computeSample(t) {
  const forceAB = Number.isFinite(state.carts.forceAB) ? state.carts.forceAB : 0;
  const trueOnAByB = -forceAB;
  const trueOnBByA = forceAB;
  const measured = applySensorEffects(trueOnAByB, trueOnBByA, t);

  return {
    t,
    xA: state.carts.xA,
    xB: state.carts.xB,
    vA: state.carts.vA,
    vB: state.carts.vB,
    trueOnAByB,
    trueOnBByA,
    measOnAByB: measured.onAByB,
    measOnBByA: measured.onBByA,
  };
}

function applySensorEffects(trueA, trueB, t) {
  const mode = state.cfg.sensorMode;
  const bias = state.cfg.sensorBias;
  const driftA = 0.08 * Math.sin(t * 6.1);
  const driftB = 0.08 * Math.cos(t * 5.6);

  if (mode === "correct") {
    return {
      onAByB: trueA + driftA,
      onBByA: trueB + driftB,
    };
  }

  if (mode === "bias") {
    return {
      onAByB: trueA + bias + driftA,
      onBByA: trueB - 0.65 * bias + driftB,
    };
  }

  return {
    onAByB: trueA + driftA,
    onBByA: -trueB + driftB,
  };
}

function finishTrial() {
  state.running = false;
  state.done = true;

  if (state.animationId) cancelAnimationFrame(state.animationId);

  const metrics = summarizeRun();
  state.history.unshift(metrics);
  state.history = state.history.slice(0, 10);

  renderHistory();
  updateMetrics(metrics);

  let setupNote = "";
  if (state.cfg.sensorMode === "bias") {
    setupNote = " Sensor offsets make measured curves look unequal.";
  } else if (state.cfg.sensorMode === "orientation") {
    setupNote = " Second sensor orientation is wrong, so signs look inconsistent.";
  }

  statusLine.textContent = `Run ${metrics.run} complete.${setupNote}`;
  renderAll();
}

function summarizeRun() {
  const samples = state.samples;
  const first = samples[0];
  const last = samples[samples.length - 1];

  let peakAbs = 0;
  let impulseA = 0;
  let impulseB = 0;

  for (let i = 1; i < samples.length; i += 1) {
    const p = samples[i - 1];
    const c = samples[i];
    const dt = c.t - p.t;
    impulseA += 0.5 * (p.measOnAByB + c.measOnAByB) * dt;
    impulseB += 0.5 * (p.measOnBByA + c.measOnBByA) * dt;
    peakAbs = Math.max(peakAbs, Math.abs(c.measOnAByB), Math.abs(c.measOnBByA));
  }

  return {
    run: state.runNumber,
    scenario: state.cfg.label,
    peakAbs,
    impulseA,
    impulseB,
    dvA: last.vA - first.vA,
    dvB: last.vB - first.vB,
    sensorMode: state.cfg.sensorMode,
  };
}

function updateMetrics(metrics = null) {
  const data = metrics || summarizePreview();

  const cards = [
    {
      title: "Current setup",
      body: `mA = ${fmt(state.cfg.mA)} kg, mB = ${fmt(state.cfg.mB)} kg\nStart vA = ${fmt(state.cfg.vA)} m/s, vB = ${fmt(state.cfg.vB)} m/s\nPush = ${fmt(state.cfg.pushForce)} N`,
    },
    {
      title: "Force pair check",
      body: `Peak |F| = ${fmt(data.peakAbs)} N\nImpulse on A by B = ${fmt(data.impulseA)} N·s\nImpulse on B by A = ${fmt(data.impulseB)} N·s`,
    },
    {
      title: "Speed change",
      body: `ΔvA = ${fmt(data.dvA)} m/s\nΔvB = ${fmt(data.dvB)} m/s`,
    },
  ];

  if (state.history.length >= 2) {
    const current = state.history[0];
    const prev = state.history[1];
    cards.push({
      title: "Difference from previous run",
      body: `ΔPeak |F| = ${fmt(current.peakAbs - prev.peakAbs)} N\nΔ(ΔvA) = ${fmt(current.dvA - prev.dvA)} m/s\nΔ(ΔvB) = ${fmt(current.dvB - prev.dvB)} m/s`,
    });
  }

  metricsPanel.innerHTML = cards
    .map(
      (card) =>
        `<article class="metric-card"><h4>${escapeHtml(card.title)}</h4><p>${escapeHtml(card.body).replace(/\n/g, "<br />")}</p></article>`
    )
    .join("");
}

function summarizePreview() {
  const s = state.samples;
  if (!s.length) {
    return {
      peakAbs: 0,
      impulseA: 0,
      impulseB: 0,
      dvA: 0,
      dvB: 0,
    };
  }

  const first = s[0];
  const last = s[s.length - 1];
  let peakAbs = 0;
  let impulseA = 0;
  let impulseB = 0;

  for (let i = 1; i < s.length; i += 1) {
    const p = s[i - 1];
    const c = s[i];
    const dt = c.t - p.t;
    impulseA += 0.5 * (p.measOnAByB + c.measOnAByB) * dt;
    impulseB += 0.5 * (p.measOnBByA + c.measOnBByA) * dt;
    peakAbs = Math.max(peakAbs, Math.abs(c.measOnAByB), Math.abs(c.measOnBByA));
  }

  return {
    peakAbs,
    impulseA,
    impulseB,
    dvA: last.vA - first.vA,
    dvB: last.vB - first.vB,
  };
}

function renderHistory() {
  historyBody.textContent = "";

  state.history.forEach((row) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${row.run}</td>
      <td>${escapeHtml(row.scenario)}</td>
      <td>${fmt(row.peakAbs)}</td>
      <td>${fmt(row.impulseA)}</td>
      <td>${fmt(row.impulseB)}</td>
      <td>${fmt(row.dvA)}</td>
      <td>${fmt(row.dvB)}</td>
    `;
    historyBody.append(tr);
  });
}

function renderAll() {
  renderTrack();
  renderForceGraph();
  renderDiagramBoard();
  renderDiagramList();
  updateLiveReadout();
}

function updateLiveReadout() {
  const sample = state.probeLocked && state.probeSample ? state.probeSample : state.samples[state.samples.length - 1];
  if (!sample) {
    liveReadout.textContent = "";
    return;
  }

  liveReadout.textContent =
    `Force on A by B = ${fmt(sample.measOnAByB)} N | ` +
    `Force on B by A = ${fmt(sample.measOnBByA)} N | ` +
    `vA = ${fmt(sample.vA)} m/s | vB = ${fmt(sample.vB)} m/s`;
}

function getPalette() {
  const light = document.body.dataset.theme === "light";

  if (light) {
    return {
      trackTop: "#a6bad3",
      trackMid: "#7f95b6",
      trackBottom: "#5f7394",
      rail: "#f1cf8f",
      tick: "rgba(16, 51, 66, 0.14)",
      wall: "#0f7e9b",
      cartA: "#d89c28",
      cartB: "#2f9eb8",
      cartStroke: "#123140",
      graphBg: "#f8fcff",
      graphAxis: "#bdd1da",
      graphGrid: "rgba(18, 49, 64, 0.08)",
      graphText: "#355463",
      lineA: "#b27300",
      lineB: "#0d718b",
      probe: "#133747",
      panelBg: "#eaf4f8",
      diagramA: "#f6a700",
      diagramB: "#0f7e9b",
    };
  }

  return {
    trackTop: "#3a4558",
    trackMid: "#273245",
    trackBottom: "#1a2433",
    rail: "rgba(229, 204, 143, 0.8)",
    tick: "rgba(229, 204, 143, 0.16)",
    wall: "#e1c375",
    cartA: "#c8a24a",
    cartB: "#7ba0c9",
    cartStroke: "#090b0f",
    graphBg: "#0f1420",
    graphAxis: "rgba(216, 183, 103, 0.33)",
    graphGrid: "rgba(201, 214, 236, 0.11)",
    graphText: "#b5c2dc",
    lineA: "#d8b767",
    lineB: "#9cc0eb",
    probe: "#e5cc8f",
    panelBg: "#1b2230",
    diagramA: "#d8b767",
    diagramB: "#9cc0eb",
  };
}

function renderTrack() {
  const ctx = tCtx;
  const width = trackCanvas.clientWidth;
  const height = trackCanvas.clientHeight;
  const p = getPalette();

  if (!state.cfg) {
    ctx.clearRect(0, 0, width, height);
    return;
  }

  const left = TRACK.padding.left;
  const right = width - TRACK.padding.right;
  const top = TRACK.padding.top;
  const bottom = height - TRACK.padding.bottom;
  const centerY = (top + bottom) * 0.5;

  ctx.clearRect(0, 0, width, height);

  const trackGrad = ctx.createLinearGradient(0, top, 0, bottom);
  trackGrad.addColorStop(0, p.trackTop);
  trackGrad.addColorStop(0.5, p.trackMid);
  trackGrad.addColorStop(1, p.trackBottom);

  ctx.fillStyle = trackGrad;
  roundRect(ctx, left, top + 18, right - left, bottom - top - 20, 10);
  ctx.fill();

  for (let i = 0; i <= 18; i += 1) {
    const x = left + ((right - left) * i) / 18;
    ctx.strokeStyle = p.tick;
    ctx.beginPath();
    ctx.moveTo(x, top + 20);
    ctx.lineTo(x, bottom - 4);
    ctx.stroke();
  }

  ctx.strokeStyle = p.rail;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, centerY);
  ctx.lineTo(right, centerY);
  ctx.stroke();

  if (state.cfg.type === "wall-push") {
    const wallX = toTrackX(TRACK.max - 0.02, left, right);
    ctx.fillStyle = p.wall;
    roundRect(ctx, wallX - 6, top + 4, 12, bottom - top + 4, 4);
    ctx.fill();
  }

  const cartW = ((TRACK.cartWidth / (TRACK.max - TRACK.min)) * (right - left));
  const cartH = 56;

  const xA = toTrackX(state.carts.xA, left, right) - cartW * 0.5;
  const xB = toTrackX(state.carts.xB, left, right) - cartW * 0.5;
  const y = centerY - cartH * 0.5;

  drawCart(ctx, xA, y, cartW, cartH, "A", state.carts.mA, p.cartA, p.cartStroke);
  drawCart(ctx, xB, y, cartW, cartH, "B", state.carts.mB, p.cartB, p.cartStroke);

  const sample = state.probeLocked && state.probeSample ? state.probeSample : state.samples[state.samples.length - 1];
  if (sample) {
    const forceMag = Math.abs(sample.measOnBByA);
    const arrowLen = Math.min(90, 20 + forceMag * 3.2);

    if (forceMag > 0.12) {
      drawArrow(ctx, xA + cartW, y + cartH * 0.3, arrowLen, 0, p.lineA, 3);
      drawArrow(ctx, xB, y + cartH * 0.7, -arrowLen, 0, p.lineB, 3);
    }
  }

  ctx.fillStyle = p.graphText;
  ctx.font = "13px IBM Plex Sans, sans-serif";
  ctx.fillText("Track", left, top - 2);
}

function drawCart(ctx, x, y, w, h, name, mass, fill, stroke) {
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fill();

  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.4;
  roundRect(ctx, x, y, w, h, 8);
  ctx.stroke();

  ctx.fillStyle = stroke;
  ctx.font = "700 16px IBM Plex Sans, sans-serif";
  ctx.fillText(`Cart ${name}`, x + 10, y + 22);
  ctx.font = "12px IBM Plex Sans, sans-serif";
  ctx.fillText(`${fmt(mass)} kg`, x + 10, y + 40);
}

function renderForceGraph() {
  const ctx = fCtx;
  const width = forceCanvas.clientWidth;
  const height = forceCanvas.clientHeight;
  const p = getPalette();

  const left = FORCE_GRAPH.padding.left;
  const right = width - FORCE_GRAPH.padding.right;
  const top = FORCE_GRAPH.padding.top;
  const bottom = height - FORCE_GRAPH.padding.bottom;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = p.graphBg;
  roundRect(ctx, 0, 0, width, height, 0);
  ctx.fill();

  let maxForce = 8;
  const tMax = Math.max(state.duration, state.samples[state.samples.length - 1]?.t || 0.01);

  state.samples.forEach((s) => {
    maxForce = Math.max(maxForce, Math.abs(s.measOnAByB), Math.abs(s.measOnBByA));
  });

  maxForce = niceCeiling(maxForce * 1.15);

  for (let gy = -maxForce; gy <= maxForce + 1e-9; gy += maxForce / 4) {
    const y = mapY(gy, top, bottom, maxForce);
    ctx.strokeStyle = p.graphGrid;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();

    ctx.fillStyle = p.graphText;
    ctx.font = "12px IBM Plex Sans, sans-serif";
    ctx.fillText(`${fmt(gy)} N`, 6, y + 4);
  }

  for (let gx = 0; gx <= tMax + 1e-9; gx += Math.max(0.5, tMax / 8)) {
    const x = mapX(gx, left, right, tMax);
    ctx.strokeStyle = p.graphGrid;
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();

    ctx.fillStyle = p.graphText;
    ctx.font = "12px IBM Plex Sans, sans-serif";
    ctx.fillText(`${gx.toFixed(1)} s`, x - 14, height - 10);
  }

  ctx.strokeStyle = p.graphAxis;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(left, bottom);
  ctx.lineTo(right, bottom);
  ctx.moveTo(left, top);
  ctx.lineTo(left, bottom);
  ctx.stroke();

  const zeroY = mapY(0, top, bottom, maxForce);
  ctx.strokeStyle = p.graphAxis;
  ctx.beginPath();
  ctx.moveTo(left, zeroY);
  ctx.lineTo(right, zeroY);
  ctx.stroke();

  drawSeries("measOnAByB", p.lineA, left, right, top, bottom, tMax, maxForce);
  drawSeries("measOnBByA", p.lineB, left, right, top, bottom, tMax, maxForce);

  ctx.fillStyle = p.lineA;
  ctx.fillRect(right - 246, top + 8, 16, 3);
  ctx.fillStyle = p.graphText;
  ctx.font = "12px IBM Plex Sans, sans-serif";
  ctx.fillText("Force on A by B", right - 224, top + 14);

  ctx.fillStyle = p.lineB;
  ctx.fillRect(right - 128, top + 8, 16, 3);
  ctx.fillStyle = p.graphText;
  ctx.fillText("Force on B by A", right - 106, top + 14);

  if (state.probeSample) {
    const x = mapX(state.probeSample.t, left, right, tMax);
    ctx.strokeStyle = p.probe;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
    ctx.setLineDash([]);

    const probeText =
      `t=${state.probeSample.t.toFixed(2)} s | ` +
      `F(A by B)=${fmt(state.probeSample.measOnAByB)} N | ` +
      `F(B by A)=${fmt(state.probeSample.measOnBByA)} N`;
    probeReadout.textContent = probeText;
  }
}

function drawSeries(key, color, left, right, top, bottom, tMax, maxForce) {
  if (state.samples.length < 2) return;

  const ctx = fCtx;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.1;
  ctx.beginPath();

  state.samples.forEach((sample, i) => {
    const x = mapX(sample.t, left, right, tMax);
    const y = mapY(sample[key], top, bottom, maxForce);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });

  ctx.stroke();
}

function onGraphPointerMove(event) {
  if (!state.samples.length || state.probeLocked) return;
  state.probeSample = sampleAtPointer(event);
  renderAll();
}

function onGraphClick(event) {
  if (!state.samples.length) return;

  if (state.probeLocked) {
    state.probeLocked = false;
    state.probeSample = state.samples[state.samples.length - 1];
  } else {
    state.probeLocked = true;
    state.probeSample = sampleAtPointer(event);
  }

  renderAll();
}

function onGraphLeave() {
  if (state.probeLocked) return;
  state.probeSample = state.samples[state.samples.length - 1] || null;
  renderAll();
}

function sampleAtPointer(event) {
  const rect = forceCanvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const left = FORCE_GRAPH.padding.left;
  const right = rect.width - FORCE_GRAPH.padding.right;
  const tMax = Math.max(state.duration, state.samples[state.samples.length - 1]?.t || 0.01);

  const t = ((x - left) / Math.max(1, right - left)) * tMax;
  const clampedT = Math.max(0, Math.min(tMax, t));

  let best = state.samples[0];
  let bestDist = Math.abs(best.t - clampedT);

  for (let i = 1; i < state.samples.length; i += 1) {
    const d = Math.abs(state.samples[i].t - clampedT);
    if (d < bestDist) {
      bestDist = d;
      best = state.samples[i];
    }
  }

  return best;
}

function addVector() {
  const set = diagramSetSelect.value;
  const on = diagramObjectSelect.value;
  const by = diagramSourceSelect.value;
  const forceType = diagramForceTypeSelect.value;

  const vector = {
    forceType,
    on,
    by,
    dir: diagramDirectionSelect.value,
    mag: Number(diagramMagnitudeInput.value),
  };

  state.diagrams[set].push(vector);
  diagramStatus.textContent = `${forceType} added to ${set} diagram.`;
  renderDiagramList();
  renderDiagramBoard();
}

function undoVector() {
  const set = diagramSetSelect.value;
  state.diagrams[set].pop();
  diagramStatus.textContent = `Removed last vector from ${set}.`;
  renderDiagramList();
  renderDiagramBoard();
}

function clearSet() {
  const set = diagramSetSelect.value;
  state.diagrams[set] = [];
  diagramStatus.textContent = `Cleared all vectors in ${set}.`;
  renderDiagramList();
  renderDiagramBoard();
}

function renderDiagramList() {
  const set = diagramSetSelect.value;
  const vectors = state.diagrams[set];

  diagramList.textContent = "";
  if (!vectors.length) {
    const item = document.createElement("li");
    item.textContent = `No vectors in ${set}.`;
    diagramList.append(item);
    return;
  }

  vectors.forEach((v, idx) => {
    const item = document.createElement("li");
    item.textContent = `${idx + 1}. ${v.forceType} on ${v.on} by ${v.by}, ${v.dir}, magnitude ${v.mag}`;
    diagramList.append(item);
  });
}

function renderDiagramBoard() {
  const ctx = dCtx;
  const width = diagramCanvas.clientWidth;
  const height = diagramCanvas.clientHeight;
  const p = getPalette();

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = p.panelBg;
  roundRect(ctx, 0, 0, width, height, 0);
  ctx.fill();

  const leftX = 0;
  const midX = width * 0.5;
  const rightX = width;

  drawDiagramSet(ctx, {
    title: "Prediction",
    vectors: state.diagrams.prediction,
    x0: leftX + 12,
    x1: midX - 6,
    y0: 14,
    y1: height - 14,
    palette: p,
  });

  drawDiagramSet(ctx, {
    title: "From Graph",
    vectors: state.diagrams.measured,
    x0: midX + 6,
    x1: rightX - 12,
    y0: 14,
    y1: height - 14,
    palette: p,
  });

  ctx.strokeStyle = p.graphAxis;
  ctx.beginPath();
  ctx.moveTo(midX, 10);
  ctx.lineTo(midX, height - 10);
  ctx.stroke();
}

function drawDiagramSet(ctx, { title, vectors, x0, x1, y0, y1, palette }) {
  ctx.strokeStyle = palette.graphAxis;
  ctx.lineWidth = 1.2;
  roundRect(ctx, x0, y0, x1 - x0, y1 - y0, 10);
  ctx.stroke();

  ctx.fillStyle = palette.graphText;
  ctx.font = "700 14px IBM Plex Sans, sans-serif";
  ctx.fillText(title, x0 + 12, y0 + 20);

  const centerY = (y0 + y1) * 0.58;
  const aX = x0 + (x1 - x0) * 0.32;
  const bX = x0 + (x1 - x0) * 0.68;

  drawNode(ctx, aX, centerY, "Cart A", palette.diagramA, palette.graphText);
  drawNode(ctx, bX, centerY, "Cart B", palette.diagramB, palette.graphText);

  const laneCount = new Map();

  vectors.forEach((v) => {
    const baseX = v.on === "Cart A" ? aX : bX;
    const baseY = centerY;
    const key = `${v.on}:${v.dir}`;
    const used = laneCount.get(key) || 0;
    laneCount.set(key, used + 1);

    const laneOffset = (used - 1) * 15;
    const len = 18 + v.mag * 8;

    let dx = 0;
    let dy = 0;

    if (v.dir === "right") dx = len;
    if (v.dir === "left") dx = -len;
    if (v.dir === "up") dy = -len;
    if (v.dir === "down") dy = len;

    let startX = baseX;
    let startY = baseY;

    if (v.dir === "right" || v.dir === "left") startY += laneOffset;
    if (v.dir === "up" || v.dir === "down") startX += laneOffset;

    const color = v.on === "Cart A" ? palette.diagramA : palette.diagramB;
    drawArrow(ctx, startX, startY, dx, dy, color, 2.6);

    ctx.fillStyle = palette.graphText;
    ctx.font = "11px IBM Plex Sans, sans-serif";
    ctx.fillText(`${v.forceType}: on ${v.on} by ${v.by}`, startX + dx * 0.56 + 4, startY + dy * 0.56 - 4);
  });
}

function drawNode(ctx, x, y, label, fill, ink) {
  ctx.fillStyle = fill;
  roundRect(ctx, x - 42, y - 18, 84, 36, 9);
  ctx.fill();

  ctx.fillStyle = ink;
  ctx.font = "700 13px IBM Plex Sans, sans-serif";
  ctx.fillText(label, x - 28, y + 4);
}

function drawArrow(ctx, x, y, dx, dy, color, width) {
  const tipX = x + dx;
  const tipY = y + dy;
  const angle = Math.atan2(dy, dx);
  const size = 7;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;

  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(tipX, tipY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tipX - size * Math.cos(angle - Math.PI / 6), tipY - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(tipX - size * Math.cos(angle + Math.PI / 6), tipY - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

function toTrackX(xMeters, left, right) {
  return left + ((xMeters - TRACK.min) / (TRACK.max - TRACK.min)) * (right - left);
}

function mapX(t, left, right, tMax) {
  return left + (t / Math.max(0.001, tMax)) * (right - left);
}

function mapY(force, top, bottom, fMax) {
  const p = (force + fMax) / (2 * fMax);
  return bottom - p * (bottom - top);
}

function fmt(value) {
  return Number(value).toFixed(2);
}

function niceCeiling(value) {
  if (value <= 2) return 2;
  if (value <= 5) return 5;
  if (value <= 10) return 10;
  return Math.ceil(value / 5) * 5;
}

function resizeCanvas(canvas, baseHeight) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  const width = rect.width || canvas.width || 1200;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(baseHeight * dpr);

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width * 0.5, height * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function restoreTheme() {
  const saved = localStorage.getItem("third-law-theme") || "dark";
  setTheme(saved);
}

function toggleTheme() {
  const next = document.body.dataset.theme === "light" ? "dark" : "light";
  setTheme(next);
}

function setTheme(value) {
  document.body.dataset.theme = value;
  localStorage.setItem("third-law-theme", value);
  themeToggleBtn.textContent = value === "light" ? "Dark mode" : "Light mode";
  if (state.cfg) renderAll();
}
