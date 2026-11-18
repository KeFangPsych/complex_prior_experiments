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
// ?allowauto=1 (testing only): lets an automated browser open the participant
// version, which is otherwise turned away (the browser tests need this)
export const ALLOW_AUTO = DEV_FLAGS && urlParams.get("allowauto") === "1";
// ?nopipe=1 (testing only): nothing is sent to DataPipe; the data can be downloaded at the end
export const NOPIPE = DEV_FLAGS && urlParams.get("nopipe") === "1";
// a testing flag's value, if it is one of `allowed` (testing mode only)
const flag = (name, allowed) => (DEBUG && allowed.includes(urlParams.get(name)) ? urlParams.get(name) : null);

export const prolificPID = urlParams.get("PROLIFIC_PID") || null;
export const studyID = urlParams.get("STUDY_ID") || null;
export const sessionID = urlParams.get("SESSION_ID") || null;
// A random ID names the data file. The Prolific ID is a column inside the file and
// is kept out of the file name, as DataPipe advises. "test_" marks a visit that
// did not come from Prolific or that used testing mode.
export const subjectId = (prolificPID && !DEBUG ? "p_" : "test_") + Math.random().toString(36).substring(2, 12).padEnd(10, "0") + "_" + Date.now();

export const state = {
  phase: "intro",
  // "pilot" (all questions) | "main" (Main only). Fixed by CONFIG.mode for
  // participants; in testing mode it is chosen on the test-setup screen.
  mode: flag("mode", ["pilot", "main"]) || CONFIG.mode,
  // Safeguards: fullscreen, viewport lock, blocked text selection / copy / paste /
  // context menu / printing / devtools shortcuts / screenshot keys, the cover shown
  // while the window is not active, and the leave-page warning. Always on for
  // participants; off in testing mode unless switched on on the test-setup screen.
  safeguards: !DEBUG || urlParams.get("safeguards") === "1",
  // read-locks on the instruction and scenario pages (off by default in testing mode)
  locks: !DEBUG || urlParams.get("locks") === "1",
  // testing mode: what the tester fixed on the test-setup screen (null = assign as
  // usual). The URL flags ?cond= ?fig= ?surprise= ?mode= ?locks=1 ?safeguards=1
  // ?orgq=complexity|more prefill that screen.
  test: {
    cond: DEBUG && CONDITIONS[parseInt(urlParams.get("cond"))] ? parseInt(urlParams.get("cond")) : null,
    figureVersion: flag("fig", ["table", "line"]),
    surpriseText: flag("surprise", ["shown", "hidden"]),
    // which of the two organism questions of part 3 is shown (pilot): an item id
    organismQuestion: { complexity: "organism_complexity", more: "organism_more_to_know" }[flag("orgq", ["complexity", "more"])] || null,
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
  saveResult: null,         // DataPipe's answer to the final upload: { ok, status, body }
  saved: false,             // true once the data are stored (or no upload is due); the leave-page warning stops then
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
  screenshot_key_count: 0,       // presses of a screenshot key or shortcut (see integrity.js)
  screenshot_key_log: [],        // [{t, phase, key}]
  // ---- signs of automation or AI use (see "AI safeguards" in the README) ----
  automation_signals: [],        // what the browser gives away at the start, e.g. "webdriver"
  untrusted_event_count: 0,      // clicks / keys / input made by a script, not by the user (ignored when the safeguards are on)
  pointer_move_count: 0,         // mouse movements
  click_count: 0,
  dead_center_click_count: 0,    // clicks on the exact centre of a button (automation tools click there)
  key_count: 0,
  screens_total: 0,              // screens left with a click ...
  screens_without_pointer_moves: 0,   // ... of which without any mouse movement before it
  open_bulk_insert_count: 0,     // times more than two characters entered an open response at once
  open_typing: [],               // per open response: { id, keys, median_key_interval_ms }
  canary_items: [],              // open responses that contain the hidden note's word
  honeypot_value: "",            // text entered into the hidden field
  self_reported_ai_use: false,   // answered "Yes" to the question on AI tools
  _hiddenSince: null,
};
/**
 * The signs of automation or AI use that this run shows, as short names. They are
 * prompts for a closer look at the participant's data, not proof.
 */
export function aiFlags() {
  const f = [...integrity.automation_signals];
  if (integrity.self_reported_ai_use) f.push("self_reported");
  if (integrity.untrusted_event_count > 0) f.push("scripted_events");
  if (integrity.canary_items.length > 0) f.push("hidden_note_word");
  if (integrity.honeypot_value) f.push("hidden_field_filled");
  if (integrity.open_bulk_insert_count > 0) f.push("text_inserted_at_once");
  // typing faster than any person: the middle gap between keys under 40 ms over at least 20 keys
  if (integrity.open_typing.some((t) => t.keys >= 20 && t.median_key_interval_ms !== null && t.median_key_interval_ms < 40)) f.push("machine_fast_typing");
  // text in an open response that was not typed key by key
  if (integrity.open_typing.some((t) => t.chars >= 20 && t.keys < t.chars / 2)) f.push("text_without_keystrokes");
  if (integrity.screens_total >= 6 && integrity.screens_without_pointer_moves >= integrity.screens_total / 2) f.push("no_pointer_movement");
  if (integrity.dead_center_click_count >= 5 && integrity.dead_center_click_count >= integrity.click_count / 2) f.push("dead_center_clicks");
  return f;
}
/** Total ms the tab has been hidden so far, including a period that is still running. */
export const hiddenMsNow = () => integrity.tab_hidden_total_ms + (integrity._hiddenSince === null ? 0 : performance.now() - integrity._hiddenSince);
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
    screenshot_key_count: integrity.screenshot_key_count,
    screenshot_key_log: JSON.stringify(integrity.screenshot_key_log),
    ai_flags: aiFlags().join(","),
    automation_signals: integrity.automation_signals.join(","),
    untrusted_event_count: integrity.untrusted_event_count,
    pointer_move_count: integrity.pointer_move_count,
    click_count: integrity.click_count,
    dead_center_click_count: integrity.dead_center_click_count,
    key_count: integrity.key_count,
    screens_without_pointer_moves: integrity.screens_without_pointer_moves,
    open_bulk_insert_count: integrity.open_bulk_insert_count,
    hidden_note_word_items: integrity.canary_items.join(","),
    hidden_field_value: integrity.honeypot_value,
  };
}
