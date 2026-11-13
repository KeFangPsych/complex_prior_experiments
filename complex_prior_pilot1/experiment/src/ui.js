/**
 * ui.js — the fixed frame (phase stepper + progress bar), cards, the read-lock,
 * and the question components (7-point scale, multiple choice, open response).
 */
import { CONFIG } from "./config.js";
import { state } from "./state.js";

// ============================================================================
// FRAME: PHASE STEPPER + PROGRESS BAR
// ============================================================================
export const N_STAGES = 5;
export const PHASES = [
  { key: "intro", label: "Welcome" },
  ...Array.from({ length: N_STAGES }, (_, i) => ({ key: `part${i + 1}`, label: `Part ${i + 1}` })),
  { key: "wrap", label: "Finish" },
];

export function buildFrame() {
  const frame = document.createElement("div");
  frame.className = "frame-top";
  frame.id = "frame-top";
  frame.innerHTML = `
    <div class="stepper"><div class="steps" id="steps">
      ${PHASES.map((p, i) => `${i > 0 ? '<div class="step-sep"></div>' : ""}
        <div class="step" data-phase="${p.key}"><span class="step-dot"></span><span class="step-label">${p.label}</span><span class="sub-steps" data-sub="${p.key}"></span></div>`).join("")}
    </div></div>
    <div class="progress-track"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
    <div class="test-bar" id="test-bar" hidden></div>`;
  document.body.prepend(frame);
}

/** Marks `key` as the active phase; `sub` = { now, total } draws the screens within it. */
export function setPhase(key, sub) {
  state.phase = key;
  const idx = PHASES.findIndex((p) => p.key === key);
  document.querySelectorAll(".step").forEach((el, i) => {
    el.classList.toggle("active", i === idx);
    el.classList.toggle("done", i < idx);
  });
  document.querySelectorAll(".sub-steps").forEach((el) => (el.innerHTML = ""));
  if (sub && sub.total > 1) {
    const holder = document.querySelector(`.sub-steps[data-sub="${key}"]`);
    if (holder) {
      holder.innerHTML = Array.from({ length: sub.total }, (_, i) =>
        `<span class="sub-pip ${i + 1 < sub.now ? "done" : i + 1 === sub.now ? "now" : ""}"></span>`).join("");
    }
  }
}

/** Sets the progress bar to a fraction between 0 and 1. */
export function setProgress(frac) {
  const fill = document.getElementById("progress-fill");
  if (fill) fill.style.width = `${Math.round(Math.max(0, Math.min(frac, 1)) * 1000) / 10}%`;
}

/**
 * Testing mode only: the bar under the progress bar. `items` are [label, value]
 * pairs (value may contain HTML); onBack / onChange are the two buttons.
 */
export function setTestBar({ visible, items, canGoBack, canChange, onBack, onChange }) {
  const bar = document.getElementById("test-bar");
  if (!bar) return;
  bar.hidden = !visible;
  if (!visible) return;
  bar.innerHTML = `
    <button type="button" class="test-btn" id="test-back" ${canGoBack ? "" : "disabled"}>← Back</button>
    <div class="test-items"><span class="test-tag">Testing</span>${items.map(([k, v]) => `<span class="test-item"><span class="k">${k}</span> ${v}</span>`).join("")}</div>
    <button type="button" class="test-btn" id="test-change" ${canChange ? "" : "disabled"}>Change settings</button>`;
  bar.querySelector("#test-back").addEventListener("click", onBack);
  bar.querySelector("#test-change").addEventListener("click", onChange);
}

// ============================================================================
// CARDS AND BUTTONS
// ============================================================================
export function card(inner, cls = "") { return `<div class="page-inner"><div class="card ${cls}">${inner}</div></div>`; }

/** Locks a button for `seconds`, showing a countdown, then restores `label`. */
export function lockButton(btn, seconds, label, onUnlock) {
  if (!btn) return;
  if (seconds <= 0) { btn.disabled = false; btn.innerHTML = label; if (onUnlock) onUnlock(); return; }
  let left = seconds;
  btn.disabled = true;
  btn.innerHTML = `${label} <span class="lock-count">${left}</span>`;
  const id = setInterval(() => {
    left--;
    if (left <= 0) { clearInterval(id); btn.disabled = false; btn.innerHTML = label; if (onUnlock) onUnlock(); }
    else btn.innerHTML = `${label} <span class="lock-count">${left}</span>`;
  }, 1000);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Plain text to HTML; **double asterisks** become bold. */
export const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

// ============================================================================
// QUESTIONS
// ============================================================================
const STATEMENT_SPLIT = "this statement? ";

function promptHtml(q) {
  // "How much do you agree ... with this statement? <statement>" -> statement on its own line
  const i = q.prompt.indexOf(STATEMENT_SPLIT);
  if (i < 0) return `<p class="q-label">${esc(q.prompt)}</p>`;
  const cut = i + STATEMENT_SPLIT.length;
  return `<p class="q-label">${esc(q.prompt.slice(0, cut).trim())}</p><div class="statement">${esc(q.prompt.slice(cut))}</div>`;
}

function itemHtml(q) {
  let body = "";
  if (q.type === "likert") {
    body = `<div class="likert">
      <div class="likert-scale">${[1, 2, 3, 4, 5, 6, 7].map((v) => `
        <button type="button" class="likert-opt" data-val="${v}" aria-label="${v}"><span class="likert-dot"></span><span class="likert-num">${v}</span></button>`).join("")}
      </div>
      <div class="likert-anchors"><span class="low">${esc(q.low)}</span><span class="mid">${q.mid ? esc(q.mid) : ""}</span><span class="high">${esc(q.high)}</span></div>
    </div>`;
  } else if (q.type === "choice") {
    // options in display order; data-idx keeps the option's index in the script
    const order = q.optionOrder || q.options.map((_, i) => i);
    body = `<div class="choice-list">${order.map((i) => `
      <div class="choice" data-idx="${i}"><span class="choice-radio"></span><span class="choice-text">${esc(q.options[i])}</span></div>`).join("")}</div>`;
  } else {
    body = `<textarea class="open-textarea" rows="4" placeholder="Type your answer here"></textarea>
      <p class="small open-hint">Please write at least ${CONFIG.open_min_chars} characters.</p>`;
  }
  return `<div class="q-item" data-id="${q.id}" data-type="${q.type}">${promptHtml(q)}${body}</div>`;
}

export function questionsHtml(items) { return items.map(itemHtml).join(""); }

/**
 * Wires the items rendered by questionsHtml inside `root`. Calls onChange() after
 * every answer. `initial` optionally pre-fills answers. Returns { isComplete(), results() }; results() has one entry per
 * item: { id, use, type, measure, response, response_index, correct, position,
 * option_order, first_ms, last_ms, n_changes } (times since the screen appeared;
 * response_index is the option's index in the script, option_order the display
 * order of those indices, position the item's place on the screen).
 */
export function bindQuestions(root, items, onChange, initial = {}) {
  const t0 = performance.now();
  const answers = {};
  items.forEach((q) => { answers[q.id] = { value: null, index: null, first_ms: null, last_ms: null, n_changes: 0 }; });
  // `initial` ({ id: { value, index } }) fills in earlier answers (testing mode, after going back)
  items.forEach((q) => {
    const was = initial[q.id];
    if (!was || was.value === null || was.value === undefined) return;
    const el = root.querySelector(`.q-item[data-id="${q.id}"]`);
    const mark = q.type === "likert" ? el.querySelector(`.likert-opt[data-val="${was.value}"]`)
      : q.type === "choice" ? el.querySelector(`.choice[data-idx="${was.index}"]`) : null;
    if (mark) mark.classList.add("selected");
    if (q.type === "open") el.querySelector("textarea").value = was.value;
    Object.assign(answers[q.id], { value: was.value, index: was.index ?? null });
  });
  const record = (id, value, index = null) => {
    const a = answers[id], now = Math.round(performance.now() - t0);
    if (a.first_ms === null) a.first_ms = now;
    if (a.value !== value) a.n_changes++;
    a.value = value; a.index = index; a.last_ms = now;
    onChange();
  };

  items.forEach((q) => {
    const el = root.querySelector(`.q-item[data-id="${q.id}"]`);
    if (q.type === "likert") {
      const opts = el.querySelectorAll(".likert-opt");
      opts.forEach((b) => b.addEventListener("click", () => {
        opts.forEach((o) => o.classList.remove("selected"));
        b.classList.add("selected");
        record(q.id, parseInt(b.dataset.val));
      }));
    } else if (q.type === "choice") {
      const opts = el.querySelectorAll(".choice");
      opts.forEach((c) => c.addEventListener("click", () => {
        opts.forEach((o) => o.classList.remove("selected"));
        c.classList.add("selected");
        const i = parseInt(c.dataset.idx);
        record(q.id, q.options[i], i);
      }));
    } else {
      const ta = el.querySelector("textarea");
      ta.addEventListener("input", () => record(q.id, ta.value));
    }
  });

  const answered = (q) => {
    const v = answers[q.id].value;
    return q.type === "open" ? typeof v === "string" && v.trim().length >= CONFIG.open_min_chars : v !== null;
  };
  return {
    isComplete: () => items.every(answered),
    results: () => items.map((q, position) => {
      const a = answers[q.id];
      return {
        id: q.id, use: q.use, type: q.type, measure: q.measure,
        response: q.type === "open" && a.value !== null ? a.value.trim() : a.value,
        response_index: a.index,
        correct: q.type === "choice" && q.correct !== null ? a.index === q.correct : null,
        position: position + 1,
        option_order: q.type === "choice" ? (q.optionOrder || q.options.map((_, i) => i)) : null,
        first_ms: a.first_ms, last_ms: a.last_ms, n_changes: a.n_changes,
      };
    }),
  };
}
