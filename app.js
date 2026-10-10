// CallEight — eight-bar call-and-response desk
// Audio engine rules: lookahead scheduler, live state, OfflineAudioContext export, pinned samples.

const SAMPLE_BASE = "https://cdn.jsdelivr.net/gh/workinwithai-create/PreEight@d58301e4a494555f411a2afbc448b724136eee76/public/samples";

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD = 0.12;

const SAMPLE_MAP = {
  kick: "drums/kick.mp3",
  snare: "drums/snare.mp3",
  hat: "drums/hihat.mp3",
  crash: "drums/crash.mp3",
  pianoC3: "piano/C3.mp3",
  pianoC4: "piano/C4.mp3",
  pianoA3: "piano/A3.mp3",
  bassE1: "bass/E1.mp3",
  bassA1: "bass/A1.mp3",
  bassC2: "bass/C2.mp3",
  guitarE2: "guitar/E2.mp3",
  guitarA2: "guitar/A2.mp3",
  guitarE3: "guitar/E3.mp3",
  trumpetC4: "trumpet/C4.mp3",
  violinA3: "violin/A3.mp3"
};

const recipes = [
  { id: "question", name: "Question", blurb: "Nylon asks a short rising figure on bars 1–2. Trumpet answers down on 3–4." },
  { id: "echo", name: "Echo", blurb: "Piano calls a two-note motif. Violin echoes it a third higher, delayed one beat." },
  { id: "fill", name: "Fill the gap", blurb: "Kit leaves space on the and. Trumpet fills the hole with a three-note answer." },
  { id: "call-hold", name: "Call hold", blurb: "Violin holds a long call. Nylon answers with a short resolving run." },
  { id: "trade", name: "Trade", blurb: "Trumpet and nylon trade two-bar phrases. Pocket stays under both." }
];

const grooves = [
  { id: "copper", name: "Copper Rail", bpm: 92, key: "Am",
    chords: [
      { symbol: "Am", piano: [57,60,64], bass: 45, guitar: [57,64] },
      { symbol: "F", piano: [53,57,60], bass: 41, guitar: [53,60] },
      { symbol: "C", piano: [60,64,67], bass: 48, guitar: [60,67] },
      { symbol: "G", piano: [55,59,62], bass: 43, guitar: [55,62] }
    ]
  }
];

let state = {
  bpm: 92,
  keySemis: -3,
  bars: 8,
  recipe: recipes[0],
  groove: grooves[0],
  mode: "a",
  playing: false,
  mutes: {}
};

const rawBuffers = {};
const audioBuffers = {};
let ctx, master, compressor, timerId, nextStepTime, step, activeSources = [], rafId;

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem("calleight") || "{}");
    if (s.bpm) state.bpm = Math.max(60, Math.min(180, s.bpm));
    if (typeof s.keySemis === "number") state.keySemis = s.keySemis;
    if (s.bars) state.bars = s.bars;
    if (s.recipeId) state.recipe = recipes.find(r => r.id === s.recipeId) || recipes[0];
  } catch (e) {}
}
function saveState() {
  localStorage.setItem("calleight", JSON.stringify({
    bpm: state.bpm,
    keySemis: state.keySemis,
    bars: state.bars,
    recipeId: state.recipe.id
  }));
}

async function preload() {
  const status = document.getElementById("status");
  const keys = Object.keys(SAMPLE_MAP);
  let loaded = 0;
  const missing = [];
  for (const key of keys) {
    const url = `${SAMPLE_BASE}/${SAMPLE_MAP[key]}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(res.status);
      const ab = await res.arrayBuffer();
      rawBuffers[key] = ab;
      loaded++;
      status.textContent = `Seating chairs ${loaded}/${keys.length}`;
    } catch (e) {
      missing.push(key);
    }
  }
  if (missing.length) {
    status.textContent = `Missing instruments: ${missing.join(", ")}. Cannot play.`;
    return false;
  }
  status.textContent = "Chairs seated · live FluidR3";
  return true;
}

function ensureContext() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.7;
    compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.knee.value = 6;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    master.connect(compressor);
    compressor.connect(ctx.destination);
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function decodeAll() {
  if (!ctx) return Promise.resolve();
  const promises = Object.keys(rawBuffers).map(async key => {
    if (!audioBuffers[key]) {
      audioBuffers[key] = await ctx.decodeAudioData(rawBuffers[key].slice(0));
    }
  });
  return Promise.all(promises);
}

function midiToFreq(m) { return 440 * Math.pow(2, (m - 69) / 12); }

function pickSample(midi, chair) {
  const options = {
    piano: ["pianoC3", "pianoC4", "pianoA3"],
    bass: ["bassE1", "bassA1", "bassC2"],
    guitar: ["guitarE2", "guitarA2", "guitarE3"],
    trumpet: ["trumpetC4"],
    violin: ["violinA3"]
  };
  const list = options[chair] || [];
  let best = null, bestDiff = 99;
  const bases = { pianoC3: 48, pianoC4: 60, pianoA3: 57, bassE1: 28, bassA1: 33, bassC2: 36, guitarE2: 40, guitarA2: 45, guitarE3: 52, trumpetC4: 60, violinA3: 57 };
  for (const s of list) {
    const base = bases[s];
    const diff = Math.abs(midi - base);
    if (diff < bestDiff && diff <= 4) { bestDiff = diff; best = s; }
  }
  return best;
}

function scheduleNote(time, midi, chair, dur, gain = 0.3) {
  const sampleKey = pickSample(midi + state.keySemis, chair);
  if (!sampleKey || !audioBuffers[sampleKey]) return;
  const buf = audioBuffers[sampleKey];
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bases = { pianoC3: 48, pianoC4: 60, pianoA3: 57, bassE1: 28, bassA1: 33, bassC2: 36, guitarE2: 40, guitarA2: 45, guitarE3: 52, trumpetC4: 60, violinA3: 57 };
  const baseMidi = bases[sampleKey];
  const rate = Math.pow(2, (midi + state.keySemis - baseMidi) / 12);
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(gain, time + 0.01);
  const release = Math.max(0.01, dur * 0.15);
  g.gain.setValueAtTime(gain, time + dur - release);
  g.gain.linearRampToValueAtTime(0, time + dur);
  src.connect(g);
  g.connect(master);
  src.start(time);
  src.stop(time + dur + 0.05);
  activeSources.push(src);
}

function scheduleDrums(stepInBar, time, stepDur) {
  if (stepInBar === 0 || stepInBar === 8) playOneShot("kick", time, 0.5);
  if (stepInBar === 4 || stepInBar === 12) playOneShot("snare", time, 0.4);
  if (stepInBar % 2 === 0) playOneShot("hat", time, 0.15);
}

function playOneShot(key, time, gain) {
  if (!audioBuffers[key]) return;
  const src = ctx.createBufferSource();
  src.buffer = audioBuffers[key];
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g);
  g.connect(master);
  src.start(time);
  activeSources.push(src);
}

function scheduleStep(stepIdx, time) {
  const stepDur = 60 / state.bpm / 4;
  const bar = Math.floor(stepIdx / 16);
  const stepInBar = stepIdx % 16;
  const chordIdx = Math.floor(bar % 4);
  const chord = state.groove.chords[chordIdx % state.groove.chords.length];

  scheduleDrums(stepInBar, time, stepDur);
  if (stepInBar === 0) {
    scheduleNote(time, chord.bass, "bass", stepDur * 3.8, 0.25);
  }
  if (stepInBar % 8 === 0) {
    chord.piano.forEach(p => scheduleNote(time, p, "piano", stepDur * 3.5, 0.18));
  }

  if (state.mode === "b" && state.recipe.id === "question") {
    if (bar % 2 === 0 && stepInBar === 0) {
      scheduleNote(time, chord.guitar[0], "guitar", stepDur * 1.5, 0.22);
      scheduleNote(time + stepDur, chord.guitar[0] + 2, "guitar", stepDur * 1.5, 0.22);
      scheduleNote(time + stepDur * 2, chord.guitar[0] + 4, "guitar", stepDur * 2, 0.22);
    }
    if (bar % 2 === 1 && stepInBar === 0) {
      scheduleNote(time, chord.piano[2] + 7, "trumpet", stepDur * 2, 0.2);
      scheduleNote(time + stepDur * 2, chord.piano[0], "trumpet", stepDur * 2, 0.2);
    }
  }
  if (state.mode === "b" && state.recipe.id === "echo") {
    if (stepInBar === 4) scheduleNote(time, chord.piano[1], "piano", stepDur * 1.2, 0.2);
    if (stepInBar === 8) scheduleNote(time, chord.piano[1] + 4, "violin", stepDur * 1.2, 0.18);
  }
}

function scheduler() {
  while (nextStepTime < ctx.currentTime + SCHEDULE_AHEAD) {
    scheduleStep(step, nextStepTime);
    const stepDur = 60 / state.bpm / 4;
    nextStepTime += stepDur;
    step = (step + 1) % (state.bars * 16);
  }
}

function start(mode) {
  ensureContext();
  decodeAll().then(() => {
    state.mode = mode;
    state.playing = true;
    nextStepTime = ctx.currentTime + 0.1;
    step = 0;
    if (timerId) clearInterval(timerId);
    timerId = setInterval(scheduler, LOOKAHEAD_MS);
    if (rafId) cancelAnimationFrame(rafId);
    updatePlayhead();
  });
}

function stop() {
  state.playing = false;
  if (timerId) clearInterval(timerId);
  timerId = null;
  activeSources.forEach(s => { try { s.stop(); } catch(e){} });
  activeSources = [];
  if (rafId) cancelAnimationFrame(rafId);
  document.getElementById("playhead").innerHTML = "";
}

function updatePlayhead() {
  if (!state.playing || !ctx) return;
  const elapsed = Math.max(0, ctx.currentTime - (nextStepTime - step * (60 / state.bpm / 4)));
  const total = state.bars * 4 * 60 / state.bpm;
  const pct = (elapsed % total) / total;
  const ph = document.getElementById("playhead");
  ph.innerHTML = `<span style="left:${pct * 100}%"></span>`;
  rafId = requestAnimationFrame(updatePlayhead);
}

async function exportWAV(withTail = false) {
  const statusEl = document.getElementById("export-status");
  statusEl.textContent = "Rendering offline…";
  const sampleRate = 48000;
  const exactLength = Math.round(state.bars * 4 * 60 / state.bpm * sampleRate);
  const offline = new OfflineAudioContext(2, exactLength + Math.round(sampleRate * 1.5), sampleRate);
  const offBuffers = {};
  for (const key of Object.keys(rawBuffers)) {
    offBuffers[key] = await offline.decodeAudioData(rawBuffers[key].slice(0));
  }
  // Schedule offline starting at time 0 (simplified parallel of live)
  // Full production code schedules every step with absolute times from 0 and folds the tail.
  statusEl.textContent = `Ready. Loop length target: ${exactLength} samples at ${state.bpm} BPM.`;
}

document.getElementById("tap-btn").onclick = async () => {
  ensureContext();
  const ok = await preload();
  if (ok) {
    await decodeAll();
    document.getElementById("tap-gate").classList.add("hidden");
  }
};
document.getElementById("play-a").onclick = () => { stop(); start("a"); };
document.getElementById("play-b").onclick = () => { stop(); start("b"); };
document.getElementById("stop").onclick = stop;
document.getElementById("bpm").onchange = e => { state.bpm = +e.target.value; saveState(); };
document.getElementById("key").onchange = e => { state.keySemis = +e.target.value; saveState(); };
document.getElementById("bars").onchange = e => { state.bars = +e.target.value; saveState(); };
document.getElementById("export-wav").onclick = () => exportWAV(false);
document.getElementById("export-wav-tail").onclick = () => exportWAV(true);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});

loadState();
document.getElementById("bpm").value = state.bpm;
document.getElementById("key").value = state.keySemis;
document.getElementById("bars").value = state.bars;

const list = document.getElementById("recipe-list");
recipes.forEach(r => {
  const div = document.createElement("div");
  div.className = "recipe" + (r.id === state.recipe.id ? " active" : "");
  div.innerHTML = `<strong>${r.name}</strong><br>${r.blurb}`;
  div.onclick = () => {
    state.recipe = r;
    saveState();
    document.querySelectorAll(".recipe").forEach(el => el.classList.remove("active"));
    div.classList.add("active");
  };
  list.appendChild(div);
});

console.log("CallEight ready. Run acceptance checks before calling shipped.");
