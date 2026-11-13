/**
 * state.js — run-time state shared by the modules.
 */
import { CONFIG } from "./config.js";
import { CONDITIONS } from "./content.js";

const urlParams = new URLSearchParams(window.location.search);
export const URL_PARAMS = urlParams;
// testing flags: always on the dev server, on the built site only if allowed
export const DEV_FLAGS = import.meta.env.DEV || CONFIG.allow_dev_flags;
export const DEBUG = DEV_FLAGS && urlParams.get("debug") === "1";
export const NOFS = (DEV_FLAGS && urlParams.get("nofs") === "1") || !CONFIG.require_fullscreen;
// a testing flag's value, if it is one of `allowed` (testing mode only)
const flag = (name, allowed) => (DEBUG && allowed.includes(urlParams.get(name)) ? urlParams.get(name) : null);

export const prolificPID = urlParams.get("PROLIFIC_PID") || null;
export const studyID = urlParams.get("STUDY_ID") || null;
export const sessionID = urlParams.get("SESSION_ID") || null;
export const subjectId = prolificPID || "test_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now();

export const state = {
  phase: "intro",
  // "pilot" (all questions) | "main" (Main only). Fixed by CONFIG.mode for
  // participants; in testing mode it is chosen on the test-setup screen.
  mode: flag("mode", ["pilot", "main"]) || CONFIG.mode,
  // Safeguards: fullscreen, viewport lock, blocked text selection / copy / paste /
  // context menu / devtools shortcuts, and the leave-page warning. Always on for
  // participants; off in testing mode unless switched on on the test-setup screen.
  safeguards: !DEBUG || urlParams.get("safeguards") === "1",
  // read-locks on the instruction and scenario pages (off by default in testing mode)
  locks: !DEBUG || urlParams.get("locks") === "1",
  // testing mode: what the tester fixed on the test-setup screen (null = assign as
  // usual). The URL flags ?cond= ?fig= ?surprise= ?mode= ?locks=1 ?safeguards=1
  // ?leftout=shown|hidden prefill that screen.
  test: {
    cond: DEBUG && CONDITIONS[parseInt(urlParams.get("cond"))] ? parseInt(urlParams.get("cond")) : null,
    figureVersion: flag("fig", ["table", "line"]),
    surpriseText: flag("surprise", ["shown", "hidden"]),
    leftOut: flag("leftout", ["shown", "hidden"]),   // the left-out-details question of part 3 (pilot)
  },
  consented: false,
  finished: false,
  // assignment (set by applyAssignment in main.js)
  conditionIndex: null,
  cond: null,               // 1-8, as in the script's design table
  order: null,              // "evidence_first" | "elaboration_first"
  complexity: null,         // "low" | "high"
  anomaly: null,            // "heat" | "color"
  figureVersion: null,      // "table" | "line"
  surpriseText: null,       // true | false in evidence-first conditions, null otherwise
  stages: [],               // stage keys in presentation order
  // navigation (see sections 3-5 of main.js)
  position: "pre",          // "pre" (before the assignment) | "main" | "end"
  preCursor: 0,             // index into the screens before the assignment
  screens: [],              // the screens after the assignment, built by buildScreens
  cursor: 0,                // index into `screens`
  backToPre: false,         // testing mode: go back from the instructions to consent / setup
  needsAssignment: true,    // false once assigned; a tester's "Start" on the setup screen sets it again
  answers: {},              // { item id: { value, index } }, to refill a screen a tester returns to
  currentItems: [],         // items on the screen being shown (used by the dev bot)
  saveFailed: false,
};

/** Whether fullscreen and the viewport lock apply right now. */
export const fullscreenRequired = () => state.safeguards && !NOFS;

// Integrity counters; written to the data at the end (see integrityProps).
export const integrity = {
  fullscreen_entered: false,
  fullscreen_exit_count: 0,
  fullscreen_exit_log: [],       // [{t, phase}]
  tab_hidden_count: 0,
  tab_hidden_total_ms: 0,
  window_blur_count: 0,
  viewport_lock_count: 0,
  paste_attempts: 0,
  _hiddenSince: null,
};
export function integrityProps() {
  return {
    fullscreen_entered: integrity.fullscreen_entered,
    fullscreen_exit_count: integrity.fullscreen_exit_count,
    fullscreen_exit_log: JSON.stringify(integrity.fullscreen_exit_log),
    tab_hidden_count: integrity.tab_hidden_count,
    tab_hidden_total_ms: Math.round(integrity.tab_hidden_total_ms),
    window_blur_count: integrity.window_blur_count,
    viewport_lock_count: integrity.viewport_lock_count,
    paste_attempts: integrity.paste_attempts,
  };
}
