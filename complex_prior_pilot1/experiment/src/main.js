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
 * comments -> save -> debrief.
 *
 * URL flags: ?debug=1  testing mode: test-setup screen first, safeguards and
 *                      read-locks off unless switched on there, loads the dev bot
 *            ?nofs=1   no fullscreen requirement and no viewport lock (dev only)
 *            ?condition=k   forces assignment cell k (0-31) when DataPipe is disabled
 * With ?debug=1 the first screen is a test-setup screen where the tester picks the
 * condition, the figure version, the surprise text, pilot / main questions,
 * read-locks and safeguards; ?cond=1..8, ?fig=table|line, ?surprise=shown|hidden,
 * ?mode=pilot|main, ?locks=1 and ?safeguards=1 prefill it.
 */
import { initJsPsych } from "jspsych";
import jsPsychPreload from "@jspsych/plugin-preload";
import jsPsychCallFunction from "@jspsych/plugin-call-function";
import jsPsychPipe from "@jspsych-contrib/plugin-pipe";
// fonts are bundled, so the page makes no third-party requests
import "@fontsource/lora/latin-400.css";
import "@fontsource/lora/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "./styles.css";

import PagePlugin from "./page-plugin.js";
import { CONFIG, DATAPIPE, PROLIFIC, STUDY, WELCOME, INSTRUCTIONS, FEEDBACK_PROMPT, DEBRIEF, CONSENT, fillStudyValues } from "./config.js";
import { CONDITIONS, STAGE_SEQUENCE, N_CELLS, assignmentFromIndex, indexFromAssignment, scenario, questionPages, randomizePages } from "./content.js";
import { imageUrl } from "./images.js";
import { state, integrityProps, fullscreenRequired, DEBUG, DEV_FLAGS, NOFS, URL_PARAMS, prolificPID, studyID, sessionID, subjectId } from "./state.js";
import { buildFrame, setPhase, updateProgress, card, lockButton, rich, questionsHtml, bindQuestions, N_STAGES } from "./ui.js";
import { saveConsentPdf } from "./consent-pdf.js";
import { requestFullscreenSafe, isFullscreen, hideFullscreenOverlay, isMobileDevice, enableSafeguards, installIntegrityListeners } from "./integrity.js";

document.title = STUDY.title;
const lock = (seconds) => (state.locks ? seconds : 0);
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

const jsPsych = initJsPsych({
  display_element: "jspsych-target",
  on_finish: function () {
    if (prolificPID) {
      window.location.href = `https://app.prolific.com/submissions/complete?cc=${PROLIFIC.completion_code}`;
    } else {
      target.innerHTML = `<div class="end-wrap">${card(`${eyebrow(STUDY.title)}<h1>All done</h1><p>You can now close this window.</p>`, "card-narrow card-center")}</div>`;
    }
  },
});

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
function applyAssignment(index, source) {
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
  // welcome, consent, instructions + (scenario + question screens) per stage + comments, debrief
  const screens = state.stages.reduce((n, s) => n + scenarioOf(s).pages.length + questionPages(s, state.cond, state.mode).length, 0);
  state.totalSteps = 3 + screens + 2;
}

const scenarioOf = (stage) => scenario(stage, state.cond, { surpriseText: state.surpriseText !== false, figureVersion: state.figureVersion });

const randomCell = () => randomInt(0, N_CELLS - 1);
const assignCondition = {
  type: jsPsychCallFunction,
  async: true,
  data: { task: "condition_assignment" },
  func: function (done) {
    if (!DATAPIPE.enabled) {
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
      applyAssignment(ok ? c : randomCell(), ok ? "datapipe" : "random_fallback");
      done();
    };
    setTimeout(() => settle(null), DATAPIPE.condition_timeout_ms);
    Promise.resolve().then(() => jsPsychPipe.getCondition(DATAPIPE.experiment_id)).then((c) => settle(parseInt(c)), () => settle(null));
  },
};

// ============================================================================
// 3. TEST SETUP (testing mode only, never shown to participants)
//    Lets the tester fix the condition, the two independent randomizations, the
//    question set and the read-locks before the study starts.
// ============================================================================
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
    { key: "mode", title: "Questions", cols: 2,
      options: [{ value: "pilot", label: "Pilot · all questions" }, { value: "main", label: "Main · Main questions only" }] },
    { key: "locks", title: "Read-locks", cols: 2,
      options: [{ value: "off", label: "Off · Continue works at once" }, { value: "on", label: "On · as for participants" }] },
    { key: "safeguards", title: "Safeguards", cols: 2,
      note: `Full screen, the minimum window size, blocked text selection, copy and paste, right-click and devtools shortcuts, and the leave-page warning.${NOFS && CONFIG.require_fullscreen ? " The address contains <code>nofs=1</code>, so full screen and the window-size lock stay off either way." : ""}`,
      options: [{ value: "off", label: "Off · copy, paste and any window allowed" }, { value: "on", label: "On · as for participants" }] },
  ];
}

const testSetup = {
  type: PagePlugin,
  data: { task: "test_setup" },
  on_start: () => setPhase("intro"),
  render: function (el, done) {
    const groups = setupGroups();
    const sel = {
      cond: state.test.cond ? String(state.test.cond) : "",
      fig: state.test.figureVersion || "",
      surprise: state.test.surpriseText || "",
      mode: state.mode,
      locks: state.locks ? "on" : "off",
      safeguards: state.safeguards ? "on" : "off",
    };
    el.innerHTML = card(`${eyebrow("Test setup · not shown to participants")}
      <h2>Choose what to test</h2>
      <p class="muted">You see this screen because the address contains <code>debug=1</code>. “Random” assigns that setting as it is for participants.</p>
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
      // the surprise text does not apply when an elaboration-first condition is fixed
      const c = CONDITIONS[sel.cond];
      el.querySelector('.setup-group[data-group="surprise"]').classList.toggle("disabled", !!c && c.order !== "evidence_first");
    };
    el.querySelectorAll(".opt").forEach((b) => b.addEventListener("click", () => {
      sel[b.closest(".setup-group").dataset.group] = b.dataset.value;
      refresh();
    }));
    refresh();

    el.querySelector("#setup-start").addEventListener("click", () => {
      state.test = { cond: sel.cond ? parseInt(sel.cond) : null, figureVersion: sel.fig || null, surpriseText: sel.surprise || null };
      state.mode = sel.mode;
      state.locks = sel.locks === "on";
      state.safeguards = sel.safeguards === "on";
      if (state.safeguards) enableSafeguards();
      done({
        test_cond: sel.cond || "random", test_figure: sel.fig || "random", test_surprise: sel.surprise || "random",
        test_mode: sel.mode, test_locks: sel.locks, test_safeguards: sel.safeguards,
      });
    });
  },
};

// ============================================================================
// 4. WELCOME, CONSENT, INSTRUCTIONS
// ============================================================================
// A card with one in-card button.
function cardButtonPage({ task, html, label = "Continue", cls = "card-narrow", phase, lockSeconds = 0, onStart = null, onRender = null, onClick = null }) {
  return {
    type: PagePlugin,
    data: { task },
    on_start: function () { if (phase) setPhase(phase); if (onStart) onStart(); },
    render: function (el, done) {
      const inner = typeof html === "function" ? html() : html;
      const lab = typeof label === "function" ? label() : label;
      el.innerHTML = card(`${inner}<div class="btn-row"><button class="btn btn-lg" id="card-btn">${lab}</button></div>`, cls);
      const btn = el.querySelector("#card-btn");
      lockButton(btn, lock(lockSeconds), lab);
      btn.addEventListener("click", () => (onClick ? onClick(done) : done()));
      if (onRender) onRender(el);
    },
    on_finish: updateProgress,
  };
}

const welcome = cardButtonPage({
  task: "welcome", phase: "intro",
  html: `${eyebrow(STUDY.title)}<h1>${rich(WELCOME.title)}</h1>
    ${WELCOME.paragraphs.map((p, k) => `<p${k === 0 ? ' class="lead"' : ""}>${rich(fillStudyValues(p))}</p>`).join("")}`,
});

// The consent form; "Save a copy (PDF)" works with the safeguards on.
const consent = {
  type: PagePlugin,
  data: { task: "consent" },
  on_start: () => setPhase("intro"),
  render: function (el, done) {
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
      </div>`, "card-narrow");
    let pdfSaves = 0;
    const pdfBtn = el.querySelector("#consent-pdf");
    pdfBtn.addEventListener("click", async () => {
      pdfBtn.disabled = true;
      try { await saveConsentPdf(); pdfSaves++; } catch (e) { console.error("Could not create the consent PDF:", e); }
      pdfBtn.disabled = false;
    });
    el.querySelector("#card-btn").addEventListener("click", () => {
      state.consented = true;
      const finish = () => done({ consented: true, fullscreen_ok: isFullscreen(), consent_pdf_saves: pdfSaves });
      if (!fullscreenRequired()) return finish();
      requestFullscreenSafe().then(() => setTimeout(finish, 150));
    });
  },
  on_finish: updateProgress,
};

const instructions = cardButtonPage({
  task: "instructions", phase: "intro", label: "Begin",
  lockSeconds: CONFIG.instruction_lock_seconds,
  html: `${eyebrow("Instructions")}<h2>${rich(INSTRUCTIONS.title)}</h2>
    <ul>${INSTRUCTIONS.bullets.map((b) => `<li>${rich(b)}</li>`).join("")}</ul>`,
});

// ============================================================================
// 5. STAGES: scenario screen(s), then question screens
// ============================================================================
const stageEyebrow = (i, extra = "") => eyebrow(`Part ${i + 1} of ${N_STAGES}${extra}`);
const stagePhase = (i) => `part${i + 1}`;

// Picture sizes, in CSS pixels of displayed width. A picture is shown at `max`
// when the page fits the window. If the page would need scrolling, the picture is
// shrunk, but never below `min`, where its labels are still readable; if that is
// not enough, the page switches to a compact text style and the picture is sized
// again. Only then does the page scroll. Wide pictures (the laboratory results
// with line graphs, the algae explanation) hold more detail and get larger limits.
function figureLimits(layout, aspect) {
  if (layout === "side") return { max: 560, min: 380 };
  return aspect > 2.4 ? { max: 860, min: 680 } : { max: 660, min: 540 };
}
const pageOverflow = () => document.documentElement.scrollHeight - window.innerHeight;
// Fits a scenario page to the window; returns a function that removes the listeners.
function fitScenarioPage(el, layout) {
  const cardEl = el.querySelector(".scenario-card");
  const img = el.querySelector(".scenario-figure img");
  // sets the picture to its largest width that avoids scrolling; true if the page now fits
  const sizeFigure = () => {
    if (!img || !img.naturalWidth) return pageOverflow() <= 0;
    const aspect = img.naturalWidth / img.naturalHeight;
    const { max, min } = figureLimits(layout, aspect);
    img.style.width = `${max}px`;                       // also capped by its column (max-width: 100%)
    const overflow = pageOverflow();
    if (overflow <= 0) return true;
    const w = img.getBoundingClientRect().width;
    img.style.width = `${Math.max(Math.min(min, w), Math.floor(w - overflow * aspect))}px`;
    return pageOverflow() <= 0;
  };
  const fit = () => {
    cardEl.classList.remove("compact");
    if (!sizeFigure()) { cardEl.classList.add("compact"); sizeFigure(); }
  };
  if (!img || img.complete) fit(); else img.addEventListener("load", fit, { once: true });
  window.addEventListener("resize", fit);
  return () => window.removeEventListener("resize", fit);
}

function makeStage(i) {
  const scenarioPage = {
    type: PagePlugin,
    data: { task: "scenario" },
    on_start: function () {
      if (state.stageIdx !== i || state.scenarioPages.length === 0) {
        // first screen of the stage: lay out its scenario pages and draw the question order
        const stage = state.stages[i];
        const { pages, orders } = randomizePages(questionPages(stage, state.cond, state.mode));
        Object.assign(state, { stageIdx: i, scenarioPages: scenarioOf(stage).pages, scenarioIdx: 0, pages, pageIdx: 0, currentItems: [] });
        if (Object.keys(orders).length) jsPsych.data.addProperties(orders);
      }
      setPhase(stagePhase(i), { now: 1 + state.scenarioIdx, total: state.scenarioPages.length + state.pages.length });
    },
    render: function (el, done) {
      const stage = state.stages[i];
      const page = state.scenarioPages[state.scenarioIdx];
      const lastPage = state.scenarioIdx === state.scenarioPages.length - 1;
      const label = lastPage && state.pages.length ? "Continue to the questions" : "Continue";
      const figure = page.figure
        ? `<div class="scenario-figure"><img src="${imageUrl(page.figure)}" alt="${rich(page.alt)}" draggable="${state.safeguards ? "false" : "true"}"></div>`
        : "";
      el.innerHTML = card(`${stageEyebrow(i)}
        <div class="scenario ${page.layout}">
          <div class="scenario-text">${page.paragraphs.map((p) => `<p>${rich(p)}</p>`).join("")}</div>
          ${figure}
        </div>
        <div class="scenario-foot">
          <span></span>
          <button class="btn btn-lg" id="card-btn">${label}</button>
          <span class="small">You will not be able to come back to this page.</span>
        </div>`, `scenario-card layout-${page.layout}`);
      const unfit = fitScenarioPage(el, page.layout);
      const btn = el.querySelector("#card-btn");
      lockButton(btn, lock(CONFIG.scenario_lock_seconds), label);
      btn.addEventListener("click", () => {
        const img = el.querySelector(".scenario-figure img");
        unfit();
        done({
          stage_index: i + 1, stage,
          scenario_page: state.scenarioIdx + 1, n_scenario_pages: state.scenarioPages.length,
          layout: page.layout, figure: page.figure,
          figure_width_px: img ? Math.round(img.getBoundingClientRect().width) : null,
          compact_text: el.querySelector(".scenario-card").classList.contains("compact"),
          needed_scrolling: document.documentElement.scrollHeight > window.innerHeight + 1,
          viewport_width: window.innerWidth, viewport_height: window.innerHeight,
          n_words: page.paragraphs.join(" ").split(/\s+/).length,
          lock_seconds: lock(CONFIG.scenario_lock_seconds),
        });
      });
    },
    on_finish: function () { state.scenarioIdx++; updateProgress(); },
  };

  const questionPage = {
    type: PagePlugin,
    data: { task: "questions" },
    on_start: () => setPhase(stagePhase(i), { now: state.scenarioPages.length + 1 + state.pageIdx, total: state.scenarioPages.length + state.pages.length }),
    render: function (el, done) {
      const page = state.pages[state.pageIdx];
      state.currentItems = page.items;
      el.innerHTML = card(`${stageEyebrow(i, " · Questions")}
        ${questionsHtml(page.items)}
        <div class="btn-row"><button class="btn btn-lg" id="q-submit" disabled>Continue</button></div>`, "card-narrow question-card");
      const btn = el.querySelector("#q-submit");
      const q = bindQuestions(el, page.items, () => { btn.disabled = !q.isComplete(); });
      btn.addEventListener("click", () => {
        if (!q.isComplete()) return;
        const results = q.results();
        // every answer also becomes a participant-level column named after the item id
        const props = {};
        results.forEach((r) => {
          props[r.id] = r.response;
          if (r.correct !== null) props[`${r.id}_correct`] = r.correct;
        });
        jsPsych.data.addProperties(props);
        done({
          stage_index: i + 1, stage: state.stages[i],
          page: page.key, page_index: state.pageIdx + 1,
          item_ids: JSON.stringify(page.items.map((x) => x.id)),
          responses: JSON.stringify(results),
        });
      });
    },
    on_finish: function () {
      state.pageIdx++;
      state.currentItems = [];
      if (state.pageIdx >= state.pages.length) state.scenarioPages = [];   // stage done
      updateProgress();
    },
  };

  return {
    timeline: [
      { timeline: [scenarioPage], loop_function: () => state.scenarioIdx < state.scenarioPages.length },
      {
        timeline: [questionPage],
        conditional_function: () => state.pages.length > 0,
        loop_function: () => state.pageIdx < state.pages.length,
      },
    ],
  };
}

// ============================================================================
// 6. COMMENTS, SAVE, DEBRIEF
// ============================================================================
const generalFeedback = {
  type: PagePlugin,
  data: { task: "general_feedback" },
  on_start: () => setPhase("wrap"),
  render: function (el, done) {
    el.innerHTML = card(`${eyebrow("Almost done")}
      <p class="q-label">${rich(FEEDBACK_PROMPT)}</p>
      <textarea class="open-textarea" id="text-answer" rows="5" placeholder="Type your answer here (optional)"></textarea>
      <div class="btn-row"><button class="btn btn-lg" id="text-submit">Continue</button></div>`, "card-narrow");
    const ta = el.querySelector("#text-answer");
    el.querySelector("#text-submit").addEventListener("click", () => {
      jsPsych.data.addProperties({ general_feedback: ta.value.trim() });
      done({ response: ta.value.trim() });
    });
  },
  on_finish: updateProgress,
};

const finalize = {
  type: jsPsychCallFunction,
  data: { task: "finalize" },
  func: function () {
    jsPsych.data.addProperties({
      completion_status: "completed",
      completion_time: new Date().toISOString(),
      ...integrityProps(),
    });
  },
};

// Uploads the CSV to DataPipe, retrying on failure; if every attempt fails the
// debrief screen offers the file as a download.
const saveData = {
  type: PagePlugin,
  data: { task: "save_data" },
  on_start: () => setPhase("wrap"),
  render: function (el, done) {
    el.innerHTML = card(`<h2>Saving your responses…</h2><div class="spinner"></div><p class="muted">Please do not close this window.</p>`, "card-narrow card-center");
    const csv = jsPsych.data.get().csv();
    const attempt = async (n) => {
      let ok = false;
      try {
        const result = await jsPsychPipe.saveData(DATAPIPE.experiment_id, `${subjectId}.csv`, csv);
        ok = !!result && !(result instanceof Error) && !result.error;
      } catch (e) {
        ok = false;
      }
      if (ok || n >= DATAPIPE.save_attempts) {
        state.saveFailed = !ok;
        done({ success: ok, attempts: n });
      } else {
        setTimeout(() => attempt(n + 1), DEBUG ? 100 : 1500);
      }
    };
    attempt(1);
  },
};

const debrief = cardButtonPage({
  task: "debrief", phase: "wrap",
  label: () => (prolificPID ? "Complete and return to Prolific" : "Complete study"),
  html: function () {
    // without DataPipe (or if saving failed) the data can be downloaded here
    const download = !DATAPIPE.enabled || state.saveFailed
      ? `<div class="download-box"><p class="muted">${state.saveFailed
          ? "Your responses could not be saved automatically. Please download them and send the file to the research team."
          : "DataPipe is disabled, so nothing was uploaded."}</p>
          <button class="btn btn-secondary" id="download-btn" type="button">Download data (CSV)</button></div>`
      : "";
    return `${eyebrow("Thank you")}<h1>${rich(DEBRIEF.title)}</h1>
      ${DEBRIEF.paragraphs.map((p) => `<p>${rich(p)}</p>`).join("")}${download}
      ${prolificPID ? '<p class="muted">Click below to complete the study and return to Prolific.</p>' : ""}`;
  },
  onStart: function () {
    state.finished = true;
    hideFullscreenOverlay();
    if (isFullscreen() && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  },
  onRender: function (el) {
    const b = el.querySelector("#download-btn");
    if (b) b.addEventListener("click", () => jsPsych.data.get().localSave("csv", `${subjectId}.csv`));
  },
});

// ============================================================================
// 7. TIMELINE
// ============================================================================
const timeline = [...(DEBUG ? [testSetup] : []), welcome, consent, assignCondition];
timeline.push({
  type: jsPsychPreload,
  images: () => state.stages.flatMap((s) => scenarioOf(s).pages).filter((p) => p.figure).map((p) => imageUrl(p.figure)),
  show_progress_bar: true,
  message: "<p>Loading…</p>",
  data: { task: "preload" },
});
timeline.push(instructions);
for (let i = 0; i < N_STAGES; i++) timeline.push(makeStage(i));
timeline.push(generalFeedback, finalize);
if (DATAPIPE.enabled) timeline.push(saveData);
timeline.push(debrief);

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
    Object.assign(window, { jsPsych, experimentState: state });
    import("./autoplay.js").then(start);
  } else {
    start();
  }
}
