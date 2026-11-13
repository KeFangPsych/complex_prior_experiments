/**
 * integrity.js — fullscreen enforcement, viewport lock, mobile block, copy /
 * devtools protections, tab-hidden and window-blur logging, leave-page warning.
 * Nothing here ends the study; everything is counted for exclusion decisions at
 * analysis time (see integrityProps in state.js).
 */
import { CONFIG } from "./config.js";
import { state, integrity, NOFS } from "./state.js";

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
  if (NOFS || !state.consented || state.finished) return;
  if (integrity.fullscreen_entered) {
    integrity.fullscreen_exit_count++;
    integrity.fullscreen_exit_log.push({ t: new Date().toISOString(), phase: state.phase });
    showFullscreenOverlay();
  }
}

// ---- viewport ----
export function checkViewport() {
  if (NOFS || state.finished) return;
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

// ---- protections (production only) ----
export function applyProductionProtections() {
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  // copy / cut / paste are blocked everywhere, including the free-text boxes (typing only)
  ["copy", "cut", "paste"].forEach((ev) => document.addEventListener(ev, (e) => {
    e.preventDefault();
    if (ev === "paste") integrity.paste_attempts++;
  }, true));
  document.addEventListener("drop", (e) => { if (e.target && e.target.tagName === "TEXTAREA") e.preventDefault(); }, true);
  document.addEventListener("keydown", (e) => {
    const k = (e.key || "").toLowerCase();
    const mod = e.ctrlKey || e.metaKey;
    if (e.key === "F12" || (mod && e.shiftKey && ["i", "j", "c"].includes(k)) || (mod && ["u", "s", "p"].includes(k))) {
      e.preventDefault();
    }
  });
}

// ---- listeners that are always on ----
export function installIntegrityListeners() {
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
  window.addEventListener("blur", () => { integrity.window_blur_count++; });
  window.onbeforeunload = function () {
    if (state.consented && !state.finished) return "The study is not finished. If you leave now your progress will be lost.";
    return undefined;
  };
}
