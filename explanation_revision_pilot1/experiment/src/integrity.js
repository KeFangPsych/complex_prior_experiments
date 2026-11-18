/**
 * integrity.js — fullscreen enforcement, viewport lock, mobile block, copy /
 * devtools / screenshot protections, tab-hidden and window-blur logging, leave-page warning.
 * Nothing here ends the study; everything is counted for exclusion decisions at
 * analysis time (see integrityProps in state.js).
 */
import { CONFIG } from "./config.js";
import { state, integrity, fullscreenRequired } from "./state.js";

function makeOverlay(id, inner) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("div");
    el.id = id;
    document.body.appendChild(el);
  }
  el.innerHTML = `<div class="overlay-box">${inner}</div>`;
  return el;
}

// ---- fullscreen ----
export function requestFullscreenSafe() {
  const el = document.documentElement;
  const fn = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!fn) return Promise.resolve(false);
  try {
    const p = fn.call(el);
    return p && p.then ? p.then(() => true).catch(() => false) : Promise.resolve(true);
  } catch (e) {
    return Promise.resolve(false);
  }
}
export function isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); }

function showFullscreenOverlay() {
  const el = makeOverlay("fullscreen-overlay", `
    <h2>Please return to full screen</h2>
    <p>This study must be completed in full-screen mode.</p>
    <p class="muted">Leaving full screen is recorded. Click below to continue.</p>
    <button class="btn btn-lg" id="fs-return-btn">Return to full screen</button>`);
  el.style.display = "flex";
  document.getElementById("fs-return-btn").addEventListener("click", () => {
    requestFullscreenSafe().then((ok) => { if (ok || isFullscreen()) el.style.display = "none"; });
  });
}
export function hideFullscreenOverlay() {
  const el = document.getElementById("fullscreen-overlay");
  if (el) el.style.display = "none";
}
function onFullscreenChange() {
  if (isFullscreen()) {
    integrity.fullscreen_entered = true;
    hideFullscreenOverlay();
    return;
  }
  if (!fullscreenRequired() || !state.consented || state.finished) return;
  if (integrity.fullscreen_entered) {
    integrity.fullscreen_exit_count++;
    integrity.fullscreen_exit_log.push({ t: new Date().toISOString(), phase: state.phase });
    showFullscreenOverlay();
  }
}

// ---- viewport ----
export function checkViewport() {
  if (!fullscreenRequired() || state.finished) return;
  const min = CONFIG.min_viewport;
  const tooSmall = window.innerWidth < min.width || window.innerHeight < min.height;
  let el = document.getElementById("viewport-lock-overlay");
  if (tooSmall) {
    if (!el || el.style.display !== "flex") integrity.viewport_lock_count++;
    el = makeOverlay("viewport-lock-overlay", `
      <h2>Please enlarge your browser window</h2>
      <p>This study needs a window of at least ${min.width} × ${min.height} pixels.</p>
      <p class="muted">Your window is currently ${window.innerWidth} × ${window.innerHeight}. The study will continue automatically once the window is large enough.</p>`);
    el.style.display = "flex";
  } else if (el) {
    el.style.display = "none";
  }
}

export function isMobileDevice() {
  const ua = navigator.userAgent || "";
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
    (navigator.maxTouchPoints > 1 && window.innerWidth < 900);
}

// ---- screenshots ----
// A web page cannot stop the operating system from capturing the screen, and it
// cannot see most screenshot shortcuts. What is done here, while the safeguards
// are on and between consent and the end:
//   - the study is covered while its window is not active (capture tools such as
//     the Windows Snipping Tool take the focus away);
//   - it is covered as soon as a screenshot key or shortcut is seen: PrintScreen,
//     or Cmd / Win + Shift held together (macOS Cmd+Shift+3/4/5, Windows Win+Shift+S);
//   - after PrintScreen the clipboard is overwritten;
//   - printing shows an empty page (styles.css) and Ctrl/Cmd+P is blocked.
// Each key press is counted (screenshot_key_count, screenshot_key_log). A phone
// camera, or a capture tool started in another way, cannot be detected.
const shield = { blurred: false, keys: false, timer: null, lastCount: 0 };
const shieldApplies = () => state.safeguards && state.consented && !state.finished;
function updateShield() {
  const on = shieldApplies() && (shield.blurred || shield.keys);
  let el = document.getElementById("capture-shield");
  if (!on) { if (el) el.style.display = "none"; return; }
  if (!el || el.style.display !== "flex") {
    el = makeOverlay("capture-shield", `
      <h2>The study is hidden</h2>
      <p>The study is hidden while this window is not active, and when a screenshot key is pressed.</p>
      <p class="muted">Please do not take screenshots. Click here to continue.</p>`);
    el.onclick = () => { shield.keys = false; shield.blurred = !document.hasFocus(); updateShield(); };
    el.style.display = "flex";
  }
}
// uncovers the study `ms` after the screenshot keys were let go
function releaseShieldKeys(ms) {
  clearTimeout(shield.timer);
  shield.timer = setTimeout(() => { shield.keys = false; updateShield(); }, ms);
}
function onCaptureKey(e) {
  if (!shieldApplies()) return;
  const printScreen = e.key === "PrintScreen" || e.code === "PrintScreen";
  const combo = e.metaKey && e.shiftKey;
  if (!printScreen && !combo) {
    if (shield.keys && e.type === "keyup") releaseShieldKeys(800);   // the shortcut keys were let go
    return;
  }
  e.preventDefault();
  clearTimeout(shield.timer);
  // one count per press: PrintScreen may arrive as keydown, keyup or both, and held keys repeat
  const now = performance.now();
  if (!shield.keys && now - shield.lastCount > 1000) {
    shield.lastCount = now;
    integrity.screenshot_key_count++;
    integrity.screenshot_key_log.push({ t: new Date().toISOString(), phase: state.phase, key: printScreen ? "PrintScreen" : `Meta+Shift${/^(Meta|Shift|OS)$/.test(e.key) ? "" : "+" + e.key}` });
  }
  shield.keys = true;
  updateShield();
  if (printScreen) {
    // replaces the captured picture on the clipboard, where the browser allows it
    try { navigator.clipboard.writeText("").catch(() => {}); } catch (err) { /* not available */ }
    releaseShieldKeys(1500);
  }
}

// ---- automation and AI use ----
// What the browser gives away about being driven by a program. Browsers run by
// automation tools (Playwright, Puppeteer, Selenium and the AI agents built on
// them) set navigator.webdriver; headless ones also say so in their name.
export function automationSignals() {
  const s = [];
  try {
    if (navigator.webdriver) s.push("webdriver");
    if (/HeadlessChrome|PhantomJS|Puppeteer|Playwright|Selenium/i.test(navigator.userAgent || "")) s.push("headless_browser");
    if (window.callPhantom || window._phantom || window.__nightmare || window.domAutomation || window.domAutomationController) s.push("automation_tool");
    if (document.documentElement.getAttribute("webdriver") !== null || Object.getOwnPropertyNames(window).some((k) => /^\$?cdc_|^__(selenium|webdriver|puppeteer|nightmare)/.test(k))) s.push("automation_marks");
  } catch (e) { /* a browser that refuses these checks is treated as ordinary */ }
  return s;
}

// With the safeguards on, clicks, key presses and text input that a script made
// (event.isTrusted is false) are ignored inside the study, and counted. This
// stops answers being filled in by code run in the page, a bookmarklet or a
// simple extension. Tools that drive the browser from outside make trusted
// events and are not stopped by this; the counters below are for those.
function installAutomationListeners() {
  ["click", "mousedown", "mouseup", "keydown", "keyup", "input", "change"].forEach((ev) => document.addEventListener(ev, (e) => {
    if (e.isTrusted || !state.safeguards) return;
    const t = e.target;
    if (!(t instanceof Element) || !t.closest("#jspsych-target, #capture-shield, #fullscreen-overlay")) return;
    e.stopImmediatePropagation();
    e.preventDefault();
    integrity.untrusted_event_count++;
  }, true));
  // how the page is operated: mouse movements, clicks, keys (counted always, never blocked)
  document.addEventListener("mousemove", (e) => { if (e.isTrusted) integrity.pointer_move_count++; }, { capture: true, passive: true });
  document.addEventListener("keydown", (e) => { if (e.isTrusted) integrity.key_count++; }, true);
  document.addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    integrity.click_count++;
    // a click on the exact centre of a button: where automation tools click, and people almost never do
    const el = e.target instanceof Element ? e.target.closest(".likert-opt, .choice, .btn") : null;
    if (el && e.detail > 0) {
      const r = el.getBoundingClientRect();
      if (Math.abs(e.clientX - (r.left + r.width / 2)) <= 1 && Math.abs(e.clientY - (r.top + r.height / 2)) <= 1) integrity.dead_center_click_count++;
    }
  }, true);
}

// ---- protections ----
let protectionsApplied = false;
function applyProductionProtections() {
  if (protectionsApplied) return;
  protectionsApplied = true;
  // (each handler does nothing while a tester has the safeguards switched off)
  document.addEventListener("contextmenu", (e) => { if (state.safeguards) e.preventDefault(); });
  // copy / cut / paste are blocked everywhere, including the free-text boxes (typing only)
  ["copy", "cut", "paste"].forEach((ev) => document.addEventListener(ev, (e) => {
    if (!state.safeguards) return;
    e.preventDefault();
    if (ev === "paste") integrity.paste_attempts++;
  }, true));
  document.addEventListener("drop", (e) => { if (state.safeguards && e.target && e.target.tagName === "TEXTAREA") e.preventDefault(); }, true);
  ["keydown", "keyup"].forEach((ev) => document.addEventListener(ev, onCaptureKey, true));
  document.addEventListener("keydown", (e) => {
    if (!state.safeguards) return;
    const k = (e.key || "").toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === "F12" || (mod && e.shiftKey && ["i", "j", "c"].includes(k)) || (mod && ["u", "s", "p"].includes(k))) {
      e.preventDefault();
    }
  });
}

/**
 * Switches the safeguards on: text cannot be selected, copy / cut / paste, the
 * context menu, printing, devtools shortcuts and screenshot keys are blocked, the
 * study is covered while its window is not active, and the viewport lock applies.
 * (Fullscreen is entered on consent; see fullscreenRequired in state.js.)
 * Called at start for participants, and from the test-setup screen if the tester
 * asks for it. In testing mode it is otherwise never called.
 */
export function enableSafeguards() {
  state.safeguards = true;
  document.documentElement.classList.add("no-select");
  if (CONFIG.production_protections) applyProductionProtections();
  checkViewport();
}

/** Testing mode: switches the safeguards off again (after "Change settings"). */
export function disableSafeguards() {
  state.safeguards = false;
  document.documentElement.classList.remove("no-select");
  hideFullscreenOverlay();
  shield.keys = false;
  updateShield();
  const lockEl = document.getElementById("viewport-lock-overlay");
  if (lockEl) lockEl.style.display = "none";
  if (isFullscreen() && document.exitFullscreen) document.exitFullscreen().catch(() => {});
}

// ---- listeners that are always on (logging only) ----
export function installIntegrityListeners() {
  installAutomationListeners();
  document.addEventListener("fullscreenchange", onFullscreenChange);
  document.addEventListener("webkitfullscreenchange", onFullscreenChange);
  window.addEventListener("resize", checkViewport);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      integrity._hiddenSince = performance.now();
      integrity.tab_hidden_count++;
    } else if (integrity._hiddenSince !== null) {
      integrity.tab_hidden_total_ms += performance.now() - integrity._hiddenSince;
      integrity._hiddenSince = null;
    }
  });
  window.addEventListener("blur", () => { integrity.window_blur_count++; shield.blurred = true; updateShield(); });
  window.addEventListener("focus", () => { shield.blurred = false; updateShield(); });
  window.onbeforeunload = function () {
    if (state.safeguards && state.consented && !state.saved) return "The study is not finished. If you leave now your progress will be lost.";
    return undefined;
  };
}
