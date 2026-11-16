/**
 * main.js — complexity-priors pilot 1, vignette 1.
 *
 * Three-factor between-participants design (order x complexity x evidence; the 8
 * conditions of the script's design table). Two further things are randomized
 * independently: which version of the evidence figure is shown (table / line),
 * and, in the evidence-first conditions, whether the sentences that highlight
 * the surprise are shown.
 *
 * Timeline: welcome -> consent (enters fullscreen) -> assignment -> preload ->
 * instructions -> five stages, each one or two scenario screens (text, or text +
 * picture; read-locked) followed by its question screens (scenario hidden) ->
 * comments -> debrief -> the data are saved (DataPipe) -> back to Prolific.
 *
 * Timing: every screen's row has `rt` (ms from the screen appearing to leaving
 * it) and `screen`, a name for the screen; the same time is also written to the
 * participant-level column rt_<screen>. Question rows hold the time of the first
 * and last answer to each item. See "Data" in the README.
 *
 * The screens from welcome to comments are drawn by two looping trials that each
 * show "the screen at the cursor" (sections 4 and 5). Participants only ever move
 * forward. In testing mode a bar under the progress bar shows the settings in
 * use and has a Back button, which moves the cursor back.
 *
 * URL flags: ?debug=1  testing mode: test-setup screen first, safeguards and
 *                      read-locks off unless switched on there, loads the dev bot
 *            ?nofs=1   no fullscreen requirement and no viewport lock (dev only)
 *            ?condition=k   forces assignment cell k (0-31) when DataPipe is not used
 *            ?nopipe=1  nothing is sent to DataPipe (the data can be downloaded at the end)
 * With ?debug=1 the first screen is a test-setup screen where the tester picks the
 * condition, the figure version, the surprise text, pilot / main questions,
 * the randomly shown question, read-locks and safeguards; ?cond=1..8,
 * ?fig=table|line, ?surprise=shown|hidden, ?orgq=complexity|more, ?mode=pilot|main,
 * ?locks=1 and ?safeguards=1 prefill it.
 */
import { initJsPsych } from "jspsych";
import jsPsychPreload from "@jspsych/plugin-preload";
import jsPsychCallFunction from "@jspsych/plugin-call-function";
import PipeExtension from "@jspsych/extension-pipe";
import { saveData as pipeSaveData } from "datapipe-client";
// fonts are bundled, so the page makes no third-party requests
import "@fontsource/lora/latin-400.css";
import "@fontsource/lora/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "./styles.css";

import PagePlugin from "./page-plugin.js";
import { CONFIG, DATAPIPE, ASSIGNMENT, PROLIFIC, STUDY, WELCOME, INSTRUCTIONS, FEEDBACK_PROMPT, DEBRIEF, CONSENT, fillStudyValues, readLockSeconds } from "./config.js";
import { CONDITIONS, STAGE_SEQUENCE, assignmentCells, cellFromCounter, assignmentFromIndex, indexFromAssignment, scenario, countWords, pageWordCount, questionPages, randomizePages } from "./content.js";
import { imageUrl } from "./images.js";
import { state, integrityProps, fullscreenRequired, DEBUG, DEV_FLAGS, NOFS, NOPIPE, URL_PARAMS, prolificPID, studyID, sessionID, subjectId } from "./state.js";
import { buildFrame, setPhase, setProgress, setTestBar, card, lockButton, rich, questionsHtml, bindQuestions, N_STAGES } from "./ui.js";
import { saveConsentPdf } from "./consent-pdf.js";
import { requestFullscreenSafe, isFullscreen, hideFullscreenOverlay, isMobileDevice, enableSafeguards, disableSafeguards, installIntegrityListeners } from "./integrity.js";

document.title = STUDY.title;
// read-lock of a page with `nWords` words of text and `extra` seconds of its own
// (0 when a tester has the read-locks off)
const lock = (nWords, extra = 0) => (state.locks ? readLockSeconds(nWords, extra) : 0);
const T0 = performance.now();   // page load, for total_time_ms
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const eyebrow = (text) => `<div class="eyebrow">${text}</div>`;

// ============================================================================
// 1. JSPSYCH
// ============================================================================
// jsPsych replaces the content of its display element, so it gets its own
// container and the fixed stepper frame lives outside it.
const target = document.createElement("div");
target.id = "jspsych-target";
document.body.appendChild(target);
buildFrame();

// Whether this run talks to DataPipe (condition counter and data upload).
const PIPE_ON = DATAPIPE.enabled && !NOPIPE && /^[A-Za-z0-9]{12}$/.test(DATAPIPE.experiment_id);
const DATA_FILE = `${subjectId}.csv`;
const COMPLETION_URL = `https://app.prolific.com/submissions/complete?cc=${PROLIFIC.completion_code}`;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const endCard = (inner) => { target.innerHTML = `<div class="end-wrap">${card(`${eyebrow(STUDY.title)}${inner}`, "card-narrow card-center")}</div>`; };

const jsPsych = initJsPsych({
  display_element: "jspsych-target",
  // DataPipe's extension uploads the whole data file when the timeline ends, and
  // only then runs on_finish below. (It is not a trial, so nothing is added to the timeline.)
  extensions: [{
    type: PipeExtension,
    params: {
      experiment_id: DATAPIPE.experiment_id,
      filename: DATA_FILE,
      enabled: PIPE_ON,
      stream: DATAPIPE.stream,
      wait_message: card(`<h2>Saving your responses…</h2><div class="spinner"></div><p class="muted">Please do not close this window.</p>`, "card-narrow card-center"),
      on_save: (result) => { state.saveResult = result; },
    },
  }],
  on_finish: endOfStudy,
});

// After the last screen: makes sure the data are stored, then sends a Prolific
// participant back to Prolific. If the upload did not reach DataPipe it is tried
// again; if the data still cannot be stored, the participant can download the
// file and is not left without a way back.
async function endOfStudy() {
  let stored = !PIPE_ON || !!(state.saveResult && state.saveResult.ok);
  for (let n = 2; PIPE_ON && !stored && n <= DATAPIPE.save_attempts; n++) {
    // a refusal (data collection off, session limit, invalid data) would be refused again
    if (state.saveResult && state.saveResult.status >= 400 && state.saveResult.status < 500) break;
    await wait(DEBUG ? 100 : 1500);
    jsPsych.data.addProperties({ save_attempts: n });
    const r = await pipeSaveData({ experimentID: DATAPIPE.experiment_id, filename: DATA_FILE, data: jsPsych.data.get().csv() });
    state.saveResult = r;
    // "FILE_EXISTS": the earlier attempt did arrive, only its answer was lost
    stored = r.ok || !!(r.body && r.body.error === "FILE_EXISTS");
  }
  state.saved = true;                      // from here on, leaving the page gives no warning
  const back = prolificPID
    ? `<p><a class="btn btn-lg" id="prolific-link" href="${COMPLETION_URL}">Return to Prolific</a></p>
       <p class="small">Completion code: <strong>${PROLIFIC.completion_code}</strong></p>`
    : "";
  if (!stored) {
    endCard(`<h1>Your responses could not be saved</h1>
      <p>Please download your responses with the button below and keep the file.${prolificPID ? " Then return to Prolific and send us a message, so that we can arrange to receive it." : ""}</p>
      <p><button class="btn btn-lg btn-secondary" id="download-btn" type="button">Download my responses</button></p>${back}`);
    document.getElementById("download-btn").addEventListener("click", () => jsPsych.data.get().localSave("csv", DATA_FILE));
  } else if (prolificPID) {
    endCard(`<h1>Returning you to Prolific…</h1><p>Your responses are saved. If nothing happens within a few seconds, use the button below.</p>${back}`);
    window.location.href = COMPLETION_URL;
  } else {
    endCard(`<h1>All done</h1><p>${PIPE_ON ? "Your responses are saved. " : ""}You can now close this window.</p>`);
  }
}

jsPsych.data.addProperties({
  subject_id: subjectId,
  prolific_pid: prolificPID,
  study_id: studyID,
  session_id: sessionID,
  experiment_name: CONFIG.experiment_name,
  experiment_version: CONFIG.experiment_version,
  start_time: new Date().toISOString(),
  debug_mode: DEBUG,
  nofs_mode: NOFS,
  user_agent: navigator.userAgent,
  screen_width: window.screen.width,
  screen_height: window.screen.height,
});

// ============================================================================
// 2. ASSIGNMENT
//    A cell index 0-31 fixes the condition, the evidence-figure version and the
//    surprise text (assignmentFromIndex in content.js).
// ============================================================================
// The cells the counter runs through: all 32, or the list of a top-up batch.
const CELLS = assignmentCells(ASSIGNMENT.top_up_cells);
const TOP_UP = Array.isArray(ASSIGNMENT.top_up_cells) && ASSIGNMENT.top_up_cells.length > 0;

function applyAssignment(index, source, counter = null) {
  const a = assignmentFromIndex(index);
  // testing mode: whatever was fixed on the test-setup screen replaces the draw
  const t = state.test;
  if (DEBUG && (t.cond || t.figureVersion || t.surpriseText)) {
    if (t.cond) a.cond = t.cond;
    if (t.figureVersion) a.figureVersion = t.figureVersion;
    if (t.surpriseText) a.surpriseText = t.surpriseText === "shown";
    index = indexFromAssignment(a);
    source = "test_setup";
  }
  const c = CONDITIONS[a.cond];
  Object.assign(state, {
    conditionIndex: index,
    cond: a.cond,
    order: c.order,
    complexity: c.complexity,
    anomaly: c.anomaly,
    figureVersion: a.figureVersion,
    // the surprise sentences exist only where the evidence comes before the elaboration
    surpriseText: c.order === "evidence_first" ? a.surpriseText : null,
    stages: STAGE_SEQUENCE[c.order],
  });
  jsPsych.data.addProperties({
    condition_index: index,
    condition_source: source,       // "datapipe" | "url" | "random" | "random_fallback" (DataPipe did not answer) | "test_setup"
    assignment_counter: counter,    // the number DataPipe handed out (null when it was not asked or did not answer)
    top_up: TOP_UP,                 // true in a top-up batch (ASSIGNMENT.top_up_cells)
    mode: state.mode,
    safeguards: state.safeguards,   // false only in testing mode with the safeguards left off
    cond: state.cond,
    order: state.order,
    complexity: state.complexity,
    anomaly: state.anomaly,
    goal_relevance: state.anomaly === "heat" ? "high" : "low",
    evidence_figure: state.figureVersion,
    surprise_text: state.surpriseText === null ? "not_applicable" : state.surpriseText ? "shown" : "hidden",
    stage_order: JSON.stringify(state.stages),
  });
  buildScreens();
}

// The screens between consent and saving, in order: instructions, then for each
// stage its scenario pages and its question screens, then the comments. All
// random orders are drawn here, once, so they stay the same if a tester goes back.
function buildScreens() {
  const screens = [{ kind: "instructions" }];
  const orders = {};
  state.stages.forEach((stage, stageIdx) => {
    const pages = scenarioOf(stage).pages;
    // a tester may have fixed which of the two organism questions of part 3 is shown
    const picks = DEBUG && state.test.organismQuestion ? { organism_question: state.test.organismQuestion } : {};
    const drawn = randomizePages(questionPages(stage, state.cond, state.mode), Math.random, picks);
    Object.assign(orders, drawn.orders);
    const total = pages.length + drawn.pages.length;
    pages.forEach((page, n) => screens.push({ kind: "scenario", stage, stageIdx, page, pageNo: n + 1, nPages: pages.length, lastPage: n === pages.length - 1, hasQuestions: drawn.pages.length > 0, sub: { now: n + 1, total } }));
    drawn.pages.forEach((page, n) => screens.push({ kind: "questions", stage, stageIdx, page, pageNo: n + 1, sub: { now: pages.length + n + 1, total } }));
  });
  screens.push({ kind: "comments" });
  Object.assign(state, { screens, cursor: 0, answers: {} });
  if (Object.keys(orders).length) jsPsych.data.addProperties(orders);
}

const scenarioOf = (stage) => scenario(stage, state.cond, { surpriseText: state.surpriseText !== false, figureVersion: state.figureVersion });

const randomCell = () => CELLS[randomInt(0, CELLS.length - 1)];
const assignCondition = {
  type: jsPsychCallFunction,
  async: true,
  data: { task: "condition_assignment" },
  func: function (done) {
    // a tester who went back and did not change the setup keeps the assignment
    if (!state.needsAssignment) return done();
    state.needsAssignment = false;
    // No counter request when DataPipe is not used, and none when a tester fixed
    // the condition on the test-setup screen (it would use up a number for nothing).
    if (!PIPE_ON || (DEBUG && state.test.cond)) {
      const forced = DEV_FLAGS ? parseInt(URL_PARAMS.get("condition")) : NaN;
      const ok = Number.isFinite(forced) && forced >= 0;
      applyAssignment(ok ? forced : randomCell(), ok ? "url" : "random");
      return done();
    }
    // DataPipe's condition counter; a random cell if it does not answer in time
    let settled = false;
    const settle = (c) => {
      if (settled) return;
      settled = true;
      const ok = Number.isInteger(c) && c >= 0;
      applyAssignment(ok ? cellFromCounter(c, CELLS) : randomCell(), ok ? "datapipe" : "random_fallback", ok ? c : null);
      done();
    };
    setTimeout(() => settle(null), DATAPIPE.condition_timeout_ms);
    // getCondition rejects when DataPipe cannot be reached or condition assignment is switched off
    PipeExtension.getCondition(DATAPIPE.experiment_id).then((c) => settle(c), (e) => { console.warn("No condition from DataPipe; drawing a cell at random.", e); settle(null); });
  },
};

// ============================================================================
// 3. SCREEN NAVIGATION
//    Every screen is drawn by show(el, done, ...) and left through go(+1) or, in
//    testing mode, go(-1). `position` says which loop is running.
// ============================================================================
const PRE = [...(DEBUG ? ["setup"] : []), "welcome", "consent"];   // screens before the assignment
const N_INTRO = 2;                                                 // welcome and consent, for the progress bar
let leave = null;      // ends the screen being shown: leave(data)
let cleanup = null;    // removes that screen's listeners
let screenName = "";   // name of the screen being shown; the `screen` column of its row
// Each screen's time also becomes a participant-level column rt_<screen>, so that
// the last row of the file holds every screen time. (A tester who goes back and
// sees a screen twice gets the time of the last visit there; each visit has its own row.)
const recordScreenTime = (data) => {
  if (data.screen && data.task !== "test_back") jsPsych.data.addProperties({ [`rt_${data.screen}`]: data.rt });
};

function showProgress() {
  // before the assignment the number of screens is not known yet; ~30 is typical
  const total = N_INTRO + (state.screens.length || 28) + 1;
  const done = state.position === "pre" ? Math.max(0, state.preCursor - (DEBUG ? 1 : 0))
    : state.position === "main" ? N_INTRO + state.cursor : total;
  setProgress(done / total);
}

// Leaves the current screen: step = +1 forward, -1 back (testing mode only).
function go(step, data = {}) {
  if (!leave || (step < 0 && state.position === "pre" && state.preCursor === 0)) return;
  if (cleanup) { cleanup(); cleanup = null; }
  if (state.position === "pre") {
    state.preCursor += step;
  } else if (state.position === "main") {
    if (step < 0 && state.cursor === 0) { state.backToPre = true; state.preCursor = PRE.length - 1; }   // instructions -> consent
    else state.cursor += step;
  }
  const end = leave;
  leave = null;
  end(step < 0 ? { task: "test_back", from_task: data.task, screen: screenName } : { screen: screenName, ...data });
}

// testing mode: back to the test-setup screen from anywhere before the data are saved
function backToSetup() {
  if (!leave || state.position === "end") return;
  if (cleanup) { cleanup(); cleanup = null; }
  state.preCursor = 0;
  if (state.position === "main") state.backToPre = true;
  const end = leave;
  leave = null;
  end({ task: "test_back", to: "setup", screen: screenName });
}

// The bar under the progress bar in testing mode: settings in use, Back, Change settings.
function showTestBar(current) {
  if (!DEBUG) return;
  const assigned = state.cond !== null && !state.needsAssignment;
  const c = assigned ? CONDITIONS[state.cond] : state.test.cond ? CONDITIONS[state.test.cond] : null;
  const cond = assigned ? state.cond : state.test.cond;
  const fig = assigned ? state.figureVersion : state.test.figureVersion;
  const surprise = assigned
    ? (state.surpriseText === null ? "n/a" : state.surpriseText ? "shown" : "hidden")
    : (c && c.order !== "evidence_first" ? "n/a" : state.test.surpriseText);
  const pending = '<i>random</i>';
  setTestBar({
    visible: current !== "setup",
    items: [
      ["Condition", cond ? `${cond} · ${titleCase(c.order)} · ${titleCase(c.complexity)} · ${titleCase(c.anomaly)} anomaly` : pending],
      ["Figure", fig ? (fig === "line" ? "table + line" : "table only") : pending],
      ["Surprise text", surprise || pending],
      ["Organism question", state.mode === "main" ? "n/a" : ORG_Q[assigned
        ? (state.screens.flatMap((x) => (x.kind === "questions" ? x.page.items : [])).find((q) => q.pickOne === "organism_question") || {}).id
        : state.test.organismQuestion] || pending],
      ["Questions", state.mode],
      ["Read-locks", state.locks ? "on" : "off"],
      ["Safeguards", state.safeguards ? "on" : "off"],
      ["DataPipe", PIPE_ON ? "on" : "off"],
    ],
    canGoBack: state.position !== "end" && !(state.position === "pre" && state.preCursor === 0),
    canChange: state.position !== "end",
    onBack: () => go(-1, { task: current }),
    onChange: backToSetup,
  });
}

// ============================================================================
// 4. TEST SETUP, WELCOME, CONSENT (before the assignment)
// ============================================================================
const ORG_Q = { organism_complexity: "simple or complex", organism_more_to_know: "more to know" };   // short names of the two part 3 questions
const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ");
function setupGroups() {
  return [
    { key: "cond", title: "Condition", cols: 2,
      options: [{ value: "", label: "Random", wide: true }, ...Object.entries(CONDITIONS).map(([k, c]) => (
        { value: k, label: `<b>${k}</b> · ${titleCase(c.order)} · ${titleCase(c.complexity)} complexity · ${titleCase(c.anomaly)} anomaly` }))] },
    { key: "fig", title: "Evidence figure", cols: 3,
      options: [{ value: "", label: "Random" }, { value: "table", label: "Table only" }, { value: "line", label: "Table + line graphs" }] },
    { key: "surprise", title: "Surprise text", cols: 3,
      note: "The sentences that highlight the surprise in the evidence part. They exist only in the evidence-first conditions (1–4).",
      options: [{ value: "", label: "Random" }, { value: "shown", label: "Shown" }, { value: "hidden", label: "Hidden" }] },
    { key: "orgq", title: "Organism question", cols: 3,
      note: "Part 3, pilot questions only. Each participant gets one of two questions, chosen at random: how simple or complex the organism is as a whole, or how much more there is to know about how it works.",
      options: [{ value: "", label: "Random" }, { value: "organism_complexity", label: "Simple or complex" }, { value: "organism_more_to_know", label: "More to know" }] },
    { key: "mode", title: "Questions", cols: 2,
      options: [{ value: "pilot", label: "Pilot · all questions" }, { value: "main", label: "Main · Main questions only" }] },
    { key: "locks", title: "Read-locks", cols: 2,
      options: [{ value: "off", label: "Off · Continue works at once" }, { value: "on", label: "On · as for participants" }] },
    { key: "safeguards", title: "Safeguards", cols: 2,
      note: `Full screen, the minimum window size, blocked text selection, copy and paste, right-click, printing, devtools shortcuts and screenshot keys, hiding the study while its window is not active, and the leave-page warning.${NOFS && CONFIG.require_fullscreen ? " The address contains <code>nofs=1</code>, so full screen and the window-size lock stay off either way." : ""}`,
      options: [{ value: "off", label: "Off · copy, paste and any window allowed" }, { value: "on", label: "On · as for participants" }] },
  ];
}


function showSetup(el) {
  const groups = setupGroups();
  const sel = {
    cond: state.test.cond ? String(state.test.cond) : "",
    fig: state.test.figureVersion || "",
    surprise: state.test.surpriseText || "",
    orgq: state.test.organismQuestion || "",
    mode: state.mode,
    locks: state.locks ? "on" : "off",
    safeguards: state.safeguards ? "on" : "off",
  };
  el.innerHTML = card(`${eyebrow("Test setup · not shown to participants")}
    <h2>Choose what to test</h2>
    <p class="muted">You see this screen because the address contains <code>debug=1</code>. “Random” assigns that setting as it is for participants. While testing, a bar at the top shows these settings and lets you go back.</p>
    ${groups.map((g) => `
      <div class="setup-group" data-group="${g.key}">
        <div class="setup-title">${g.title}</div>
        ${g.note ? `<p class="small setup-note">${g.note}</p>` : ""}
        <div class="opt-grid" style="--cols:${g.cols}">${g.options.map((o) => `
          <button type="button" class="opt ${o.wide ? "wide" : ""}" data-value="${o.value}">${o.label}</button>`).join("")}</div>
      </div>`).join("")}
    <div class="btn-row"><button class="btn btn-lg" id="setup-start">Start</button></div>`, "card-narrow setup-card");

  const refresh = () => {
    groups.forEach((g) => el.querySelectorAll(`.setup-group[data-group="${g.key}"] .opt`).forEach((b) =>
      b.classList.toggle("selected", b.dataset.value === sel[g.key])));
    // the surprise text does not apply when an elaboration-first condition is fixed,
    // and the organism questions are pilot questions
    const c = CONDITIONS[sel.cond];
    el.querySelector('.setup-group[data-group="surprise"]').classList.toggle("disabled", !!c && c.order !== "evidence_first");
    el.querySelector('.setup-group[data-group="orgq"]').classList.toggle("disabled", sel.mode === "main");
  };
  el.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => {
    sel[b.closest(".setup-group").dataset.group] = b.dataset.value;
    refresh();
  }));
  refresh();

  el.querySelector("#setup-start").addEventListener("click", () => {
    state.test = { cond: sel.cond ? parseInt(sel.cond) : null, figureVersion: sel.fig || null, surpriseText: sel.surprise || null, organismQuestion: sel.orgq || null };
    state.mode = sel.mode;
    state.locks = sel.locks === "on";
    state.safeguards = sel.safeguards === "on";
    if (state.safeguards) enableSafeguards(); else disableSafeguards();
    state.needsAssignment = true;          // (re)assign with these settings after consent
    go(+1, {
      task: "test_setup",
      test_cond: sel.cond || "random", test_figure: sel.fig || "random", test_surprise: sel.surprise || "random", test_organism_question: sel.orgq || "random",
      test_mode: sel.mode, test_locks: sel.locks, test_safeguards: sel.safeguards,
    });
  });
}

function showWelcome(el) {
  el.innerHTML = card(`${eyebrow("Welcome")}<h1>${rich(WELCOME.title)}</h1>
    ${WELCOME.paragraphs.map((p, k) => `<p${k === 0 ? ' class="lead"' : ""}>${rich(fillStudyValues(p))}</p>`).join("")}
    <div class="btn-row"><button class="btn btn-lg" id="card-btn">Continue</button></div>`, "card-narrow");
  el.querySelector("#card-btn").addEventListener("click", () => go(+1, { task: "welcome" }));
}

// The consent form, shown in full; "Save a copy (PDF)" works with the safeguards on.
function showConsent(el) {
  el.innerHTML = card(`${eyebrow("Before you begin")}
    <div class="consent-container">
      <h2>${rich(CONSENT.title)}</h2>
      <div class="consent-section">
        ${CONSENT.sections.map((s) => `<p><strong>${rich(s.label)}:</strong> ${rich(fillStudyValues(s.text))}</p>`).join("")}
      </div>
    </div>
    ${fullscreenRequired() ? `<p class="small consent-note">Clicking “I consent” switches your browser to full-screen mode for the rest of the study.</p>` : ""}
    <div class="btn-row">
      <button class="btn btn-lg btn-secondary" id="consent-pdf" type="button">Save a copy (PDF)</button>
      <button class="btn btn-lg" id="card-btn">I consent — begin the study</button>
    </div>`, "consent-card");
  let pdfSaves = 0;
  const pdfBtn = el.querySelector("#consent-pdf");
  pdfBtn.addEventListener("click", async () => {
    pdfBtn.disabled = true;
    try { await saveConsentPdf(); pdfSaves++; } catch (e) { console.error("Could not create the consent PDF:", e); }
    pdfBtn.disabled = false;
  });
  el.querySelector("#card-btn").addEventListener("click", () => {
    state.consented = true;
    const finish = () => go(+1, { task: "consent", consented: true, fullscreen_ok: isFullscreen(), consent_pdf_saves: pdfSaves });
    if (!fullscreenRequired()) return finish();
    requestFullscreenSafe().then(() => setTimeout(finish, 150));
  });
}

const preScreen = {
  type: PagePlugin,
  render: function (el, done) {
    const current = PRE[state.preCursor];
    state.position = "pre";
    screenName = current;
    leave = done;
    setPhase("intro");
    showProgress();
    showTestBar(current);
    ({ setup: showSetup, welcome: showWelcome, consent: showConsent })[current](el);
  },
  on_finish: recordScreenTime,
};
const preLoop = { timeline: [preScreen], loop_function: () => state.preCursor < PRE.length };

// ============================================================================
// 5. INSTRUCTIONS, STAGES, COMMENTS (after the assignment)
// ============================================================================
const stageEyebrow = (i, extra = "") => eyebrow(`Part ${i + 1} of ${N_STAGES}${extra}`);

function showInstructions(el) {
  const label = "Begin";
  el.innerHTML = card(`${eyebrow("Instructions")}<h2>${rich(INSTRUCTIONS.title)}</h2>
    <ul>${INSTRUCTIONS.bullets.map((b) => `<li>${rich(b)}</li>`).join("")}</ul>
    <div class="btn-row"><button class="btn btn-lg" id="card-btn">${label}</button></div>`, "card-narrow");
  const btn = el.querySelector("#card-btn");
  const nWords = countWords(INSTRUCTIONS.title) + INSTRUCTIONS.bullets.reduce((n, b) => n + countWords(b), 0);
  const seconds = state.locks ? CONFIG.instruction_lock_seconds : 0;   // a fixed lock, not by word count
  lockButton(btn, seconds, label);
  btn.addEventListener("click", () => go(+1, { task: "instructions", n_words: nWords, lock_seconds: seconds }));
}

// Picture sizes, in CSS pixels of displayed width. A picture is shown at `max`
// when the page fits the window. Wide pictures (the laboratory results with line
// graphs, the algae explanation) hold the most detail, so their `max` is the full
// width of the text. If the page would need scrolling, it first switches to a
// compact text style; if that is not enough the picture is shrunk, but never
// below `min`, where its labels are still readable. Only then does the page scroll.
// The algae explanation has a larger `min`, so on small windows its page scrolls a little.
const FIGURE_FRAME = 18;   // padding and border of the picture's frame
const ALGAE_PICTURE_MIN = 840;   // the algae explanation is hard to read below this, so its page may scroll a little
function figureLimits(layout, aspect, textWidth, stage, frame = FIGURE_FRAME) {
  if (layout === "side") return { max: 560, min: 380 };
  if (stage === "elaboration") return { max: textWidth - frame, min: Math.min(ALGAE_PICTURE_MIN, textWidth - frame) };
  return aspect > 2.4 ? { max: textWidth - frame, min: 640 } : { max: 660, min: 540 };
}
const pageOverflow = () => document.documentElement.scrollHeight - window.innerHeight;
// Fits a scenario page to the window; returns a function that removes the listeners.
function fitScenarioPage(el, layout, stage) {
  const cardEl = el.querySelector(".scenario-card");
  const textEl = el.querySelector(".scenario-text");
  const img = el.querySelector(".scenario-figure img");
  // sets the picture to `max`, or with shrink = true to the largest width that
  // avoids scrolling (not below `min`); returns true if the page fits the window
  const sizeFigure = (shrink) => {
    if (!img || !img.naturalWidth) return pageOverflow() <= 0;
    const aspect = img.naturalWidth / img.naturalHeight;
    // the width the picture may take: the text column, or the report's text when it sits inside the report
    const reportBody = img.closest(".report-body");
    let available = textEl.clientWidth;
    if (reportBody) {
      const cs = getComputedStyle(reportBody);
      available = reportBody.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    }
    const { max, min } = figureLimits(layout, aspect, available, stage, reportBody ? 0 : FIGURE_FRAME);
    img.style.width = `${max}px`;                       // also capped by its column (max-width: 100%)
    const overflow = pageOverflow();
    if (overflow <= 0 || !shrink) return overflow <= 0;
    const w = img.getBoundingClientRect().width;
    img.style.width = `${Math.max(Math.min(min, w), Math.floor(w - overflow * aspect))}px`;
    return pageOverflow() <= 0;
  };
  const fit = () => {
    cardEl.classList.remove("compact");
    if (sizeFigure(false)) return;           // fits as it is
    cardEl.classList.add("compact");         // tighter text before a smaller picture
    sizeFigure(true);
  };
  if (!img || img.complete) fit(); else img.addEventListener("load", fit, { once: true });
  window.addEventListener("resize", fit);
  return () => window.removeEventListener("resize", fit);
}

// Narration is plain text. A message is a speech bubble with its sender label:
// Bioenergy's on the left in green with the company's leaf logo, the team's own
// on the right in blue with a hard hat.
const ICON_LEAF = `<svg viewBox="2.5 2.5 19.5 19.5" aria-hidden="true"><path d="M4 20C4 10.5 10 4.5 20.5 4 20 14.5 14 20.5 4 20z" fill="#2E9C5A"/><path d="M4.6 19.4C8.2 14 12 10.4 16.6 7.8" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>`;
const ICON_HARD_HAT = `<svg viewBox="1.5 3.5 21 18" aria-hidden="true"><path d="M3.8 16.4a8.2 8.2 0 0 1 16.4 0z" fill="#F4B626"/><rect x="10.4" y="6" width="3.2" height="10.4" rx="1.4" fill="#D9930B"/><rect x="2.2" y="15.8" width="19.6" height="3.8" rx="1.9" fill="#D9930B"/></svg>`;
const ICON_REPORT = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="17" rx="2" fill="#fff" stroke="#245A96" stroke-width="1.6"/><rect x="9" y="2.4" width="6" height="3.6" rx="1.2" fill="#245A96"/><path d="M8.4 10.5h7.2M8.4 13.7h7.2M8.4 16.9h4.4" stroke="#245A96" stroke-width="1.5" stroke-linecap="round"/></svg>`;
// paragraphs to HTML; consecutive paragraphs that start with "* " become one bullet list
function paragraphsHtml(paragraphs) {
  const out = [];
  paragraphs.forEach((p) => {
    if (!p.startsWith("* ")) return out.push(`<p>${rich(p)}</p>`);
    const item = `<li>${rich(p.slice(2))}</li>`;
    if (out.length && out[out.length - 1].startsWith("<ul>")) out[out.length - 1] = out[out.length - 1].replace("</ul>", `${item}</ul>`);
    else out.push(`<ul>${item}</ul>`);
  });
  return out.join("");
}
// In the lab report the four temperatures are colored as in its picture:
// warm orange, cool light blue, cold blue, freezing dark blue.
const colorTemperatures = (html) => html.replace(/\b(warm|cool|cold|freezing)\b/g, '<span class="temp temp-$1">$1</span>');
// `figureHtml` is the page's picture when it belongs inside this block (the lab report)
function blockHtml(b, figureHtml = "") {
  const body = paragraphsHtml(b.paragraphs);
  if (b.kind === "report") {
    // the lab's report: a document box, not a speech bubble
    return `<div class="report"><div class="report-head">${ICON_REPORT}<span>${rich(b.label)}</span></div><div class="report-body">${colorTemperatures(body)}${figureHtml}</div></div>`;
  }
  if (b.kind !== "message") return body;
  const outgoing = b.label.startsWith("From your team");
  return `<div class="message ${outgoing ? "outgoing" : "incoming"}">
    <div class="message-avatar">${outgoing ? ICON_HARD_HAT : ICON_LEAF}</div>
    <div class="message-bubble"><div class="message-label">${rich(b.label)}</div>${body}</div>
  </div>`;
}

function showScenario(el, s) {
  const { page, stageIdx: i } = s;
  const label = s.lastPage && s.hasQuestions ? "Continue to the questions" : "Continue";
  const figure = page.figure
    ? `<div class="scenario-figure"><img src="${imageUrl(page.figure)}" alt="${rich(page.alt)}" draggable="${state.safeguards ? "false" : "true"}"></div>`
    : "";
  const inReport = page.figureInReport;      // the picture sits inside the lab report box
  el.innerHTML = card(`${stageEyebrow(i)}
    <div class="scenario ${page.layout}">
      <div class="scenario-text">${page.blocks.map((b) => blockHtml(b, inReport && b.kind === "report" ? figure : "")).join("")}</div>
      ${inReport ? "" : figure}
    </div>
    <div class="scenario-foot">
      <span></span>
      <button class="btn btn-lg" id="card-btn">${label}</button>
      <span class="small">You will not be able to come back to this page.</span>
    </div>`, `scenario-card layout-${page.layout}`);
  cleanup = fitScenarioPage(el, page.layout, s.stage);
  const btn = el.querySelector("#card-btn");
  const nWords = pageWordCount(page);          // the read-lock grows with the text; some pages add seconds of their own
  lockButton(btn, lock(nWords, page.lockExtra), label);
  btn.addEventListener("click", () => {
    const img = el.querySelector(".scenario-figure img");
    go(+1, {
      task: "scenario",
      stage_index: i + 1, stage: s.stage,
      scenario_page: s.pageNo, n_scenario_pages: s.nPages,
      layout: page.layout, figure: page.figure,
      figure_width_px: img ? Math.round(img.getBoundingClientRect().width) : null,
      compact_text: el.querySelector(".scenario-card").classList.contains("compact"),
      needed_scrolling: document.documentElement.scrollHeight > window.innerHeight + 1,
      viewport_width: window.innerWidth, viewport_height: window.innerHeight,
      n_words: nWords,
      lock_seconds: lock(nWords, page.lockExtra),
    });
  });
}

function showQuestions(el, s) {
  const { page, stageIdx: i } = s;
  state.currentItems = page.items;
  el.innerHTML = card(`${stageEyebrow(i, " · Questions")}
    ${questionsHtml(page.items)}
    <div class="btn-row"><button class="btn btn-lg" id="q-submit" disabled>Continue</button></div>`, "card-narrow question-card");
  const btn = el.querySelector("#q-submit");
  // state.answers holds what was answered before, so a tester who goes back finds it filled in
  const q = bindQuestions(el, page.items, () => { btn.disabled = !q.isComplete(); }, state.answers);
  btn.disabled = !q.isComplete();
  btn.addEventListener("click", () => {
    if (!q.isComplete()) return;
    const results = q.results();
    // every answer also becomes a participant-level column named after the item id
    const props = {};
    results.forEach((r) => {
      props[r.id] = r.response;
      if (r.correct !== null) props[`${r.id}_correct`] = r.correct;
      state.answers[r.id] = { value: r.response, index: r.response_index };
    });
    jsPsych.data.addProperties(props);
    state.currentItems = [];
    go(+1, {
      task: "questions",
      stage_index: i + 1, stage: s.stage,
      page: page.key, page_index: s.pageNo,
      item_ids: JSON.stringify(page.items.map((x) => x.id)),
      responses: JSON.stringify(results),
    });
  });
}

function showComments(el) {
  el.innerHTML = card(`${eyebrow("Almost done")}
    <p class="q-label">${rich(FEEDBACK_PROMPT)}</p>
    <textarea class="open-textarea" id="text-answer" rows="5" placeholder="Type your answer here (optional)"></textarea>
    <div class="btn-row"><button class="btn btn-lg" id="text-submit">Continue</button></div>`, "card-narrow");
  const ta = el.querySelector("#text-answer");
  el.querySelector("#text-submit").addEventListener("click", () => {
    jsPsych.data.addProperties({ general_feedback: ta.value.trim() });
    go(+1, { task: "general_feedback", response: ta.value.trim() });
  });
}

const mainScreen = {
  type: PagePlugin,
  render: function (el, done) {
    const s = state.screens[state.cursor];
    state.position = "main";
    screenName = s.kind === "scenario" ? `scenario_${s.stage}_${s.pageNo}` : s.kind === "questions" ? `questions_${s.page.key}` : s.kind;
    leave = done;
    if (s.kind === "instructions") setPhase("intro");
    else if (s.kind === "comments") setPhase("wrap");
    else setPhase(`part${s.stageIdx + 1}`, s.sub);
    showProgress();
    showTestBar(s.kind);
    ({ instructions: showInstructions, scenario: showScenario, questions: showQuestions, comments: showComments })[s.kind](el, s);
  },
  on_finish: recordScreenTime,
};
const mainLoop = { timeline: [mainScreen], loop_function: () => !state.backToPre && state.cursor < state.screens.length };

// ============================================================================
// 6. DEBRIEF (the data are saved after it, by endOfStudy in section 1)
// ============================================================================
const finalize = {
  type: jsPsychCallFunction,
  data: { task: "finalize" },
  func: function () {
    state.position = "end";                 // no going back once the data are final
    showTestBar("finalize");
    showProgress();
    jsPsych.data.addProperties({
      completion_status: "completed",
      completion_time: new Date().toISOString(),
      total_time_ms: Math.round(performance.now() - T0),   // from the page loading to the comments being sent
      ...integrityProps(),
    });
  },
};

const debrief = {
  type: PagePlugin,
  data: { task: "debrief" },
  on_start: function () {
    setPhase("wrap");
    state.finished = true;
    hideFullscreenOverlay();
    if (isFullscreen() && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  },
  render: function (el, done) {
    // without DataPipe nothing is uploaded, so the data can be downloaded here
    const download = !PIPE_ON
      ? `<div class="download-box"><p class="muted">DataPipe is not in use, so nothing is uploaded.</p>
          <button class="btn btn-secondary" id="download-btn" type="button">Download data (CSV)</button></div>`
      : "";
    const label = prolificPID ? "Complete and return to Prolific" : "Complete study";
    el.innerHTML = card(`${eyebrow("Thank you")}<h1>${rich(DEBRIEF.title)}</h1>
      ${DEBRIEF.paragraphs.map((p) => `<p>${rich(p)}</p>`).join("")}${download}
      ${prolificPID ? '<p class="muted">Click below to save your responses and return to Prolific.</p>' : ""}
      <div class="btn-row"><button class="btn btn-lg" id="card-btn">${label}</button></div>`, "card-narrow");
    const b = el.querySelector("#download-btn");
    if (b) b.addEventListener("click", () => jsPsych.data.get().localSave("csv", DATA_FILE));
    el.querySelector("#card-btn").addEventListener("click", () => done({ screen: "debrief" }));
  },
  on_finish: recordScreenTime,
};

// ============================================================================
// 7. TIMELINE
// ============================================================================
const preload = {
  type: jsPsychPreload,
  images: () => state.stages.flatMap((s) => scenarioOf(s).pages).filter((p) => p.figure).map((p) => imageUrl(p.figure)),
  show_progress_bar: true,
  message: "<p>Loading…</p>",
  data: { task: "preload" },
};
const timeline = [
  {
    // repeats only when a tester goes back from the instructions to the screens before them
    timeline: [preLoop, assignCondition, preload, mainLoop],
    loop_function: () => {
      if (!state.backToPre) return false;
      state.backToPre = false;
      return true;
    },
  },
  finalize,
  debrief,
];

// ============================================================================
// 8. START
// ============================================================================
installIntegrityListeners();
if (CONFIG.block_mobile && isMobileDevice() && !NOFS && !DEBUG) {
  document.getElementById("frame-top").style.display = "none";
  target.innerHTML = `<div class="end-wrap">${card(`${eyebrow(STUDY.title)}
    <h1>Please use a desktop or laptop computer</h1>
    <p>This study cannot be completed on a phone or tablet. Please return on a computer with a full-size browser window.</p>`, "card-narrow")}</div>`;
} else {
  // participants get the safeguards from the start; a tester chooses on the test-setup screen
  if (!DEBUG) enableSafeguards();
  const start = () => jsPsych.run(timeline);
  if (DEBUG) {
    // dev only: expose internals and load the bot (a separate chunk, never fetched in production)
    document.documentElement.classList.add("testing");
    Object.assign(window, { jsPsych, experimentState: state });
    import("./autoplay.js").then(start);
  } else {
    start();
  }
}
