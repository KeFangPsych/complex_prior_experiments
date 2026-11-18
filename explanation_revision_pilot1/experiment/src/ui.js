/**
 * ui.js — the fixed frame (phase stepper + progress bar), cards, the read-lock,
 * and the question components (7-point scale, multiple choice, open response).
 */
import { CONFIG, AI_GUARD } from "./config.js";
import { SCALE_POINTS } from "./content.js";
import { state, integrity } from "./state.js";

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

const median = (list) => { if (!list.length) return null; const s = [...list].sort((x, y) => x - y); return Math.round(s[Math.floor(s.length / 2)]); };
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** Plain text to HTML; **double asterisks** become bold. */
export const rich = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

// ============================================================================
// QUESTIONS
// ============================================================================
const STATEMENT_SPLIT = "this statement? ";

// Not visible on the page (styles.css, .for-machines), but part of its text: a
// note to AI systems on every open-response question, and a field on every
// question screen that only a program would fill in. See AI_GUARD in config.js.
const canaryHtml = () => `<span class="for-machines">${esc(AI_GUARD.canary_note)}</span>`;
export const honeypotHtml = () => `<div class="for-machines"><label>${esc(AI_GUARD.honeypot_label)} <input type="text" id="hp-field" tabindex="-1" autocomplete="off"></label></div>`;
/** What was entered into the hidden field of the screen in `root` ("" for a human). */
export const honeypotValue = (root) => { const f = root.querySelector("#hp-field"); return f ? f.value.trim() : ""; };
/** True if `text` contains the hidden note's word. */
export const hasCanaryWord = (text) => new RegExp(`\\b${AI_GUARD.canary_word}\\b`, "i").test(text || "");

function promptHtml(q) {
  // "How much do you agree ... with this statement? <statement>" -> statement on its own line
  const i = q.prompt.indexOf(STATEMENT_SPLIT);
  // (**double asterisks** in a question mark emphasis, as in the script)
  if (i < 0) return `<p class="q-label">${rich(q.prompt)}${q.type === "open" ? canaryHtml() : ""}</p>`;
  const cut = i + STATEMENT_SPLIT.length;
  return `<p class="q-label">${rich(q.prompt.slice(0, cut).trim())}</p><div class="statement">${rich(q.prompt.slice(cut))}</div>`;
}

function itemHtml(q) {
  let body = "";
  if (q.type === "likert") {
    body = `<div class="likert">
      <div class="likert-scale" style="--points:${SCALE_POINTS}">${Array.from({ length: SCALE_POINTS }, (_, k) => k + 1).map((v) => `
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
      <p class="small open-hint">Please write at least ${CONFIG.open_min_chars} characters. <span class="open-count">0 / ${CONFIG.open_min_chars}</span></p>`;
  }
  return `<div class="q-item" data-id="${q.id}" data-type="${q.type}">${promptHtml(q)}${body}</div>`;
}

export function questionsHtml(items) { return items.map(itemHtml).join("") + honeypotHtml(); }

/**
 * Wires the items rendered by questionsHtml inside `root`. Calls onChange() after
 * every answer. `initial` optionally pre-fills answers. Returns { isComplete(), results() }; results() has one entry per
 * item: { id, use, type, measure, response, response_index, correct, position,
 * option_order, first_ms, last_ms, n_changes, typing } (times since the screen appeared;
 * typing, for open responses only, says how the text was entered: { chars, keys,
 * backspaces, typing_ms, median_key_interval_ms, bulk_inserts, bulk_chars };
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
      // how the text is entered: keys pressed and the gaps between them, and text
      // that arrives more than two characters at once (pasted, dropped or inserted by a program)
      const typing = answers[q.id].typing = { keys: 0, backspaces: 0, first: null, last: null, gaps: [], bulk_inserts: 0, bulk_chars: 0, prevLen: ta.value.length };
      ta.addEventListener("keydown", (e) => {
        if (!e.isTrusted || e.ctrlKey || e.metaKey) return;
        if (e.key === "Backspace" || e.key === "Delete") typing.backspaces++;
        else if (e.key.length !== 1 && e.key !== "Enter") return;
        const now = performance.now();
        typing.keys++;
        if (typing.first === null) typing.first = now;
        if (typing.last !== null) typing.gaps.push(now - typing.last);
        typing.last = now;
      });
      ta.addEventListener("input", (e) => {
        const grown = ta.value.length - typing.prevLen;
        typing.prevLen = ta.value.length;
        // (a word chosen from an input method or a spelling correction arrives at once and is ordinary)
        if (grown > 2 && !e.isComposing && !/Composition|Replacement/.test(e.inputType || "")) {
          typing.bulk_inserts++;
          typing.bulk_chars += grown;
          integrity.open_bulk_insert_count++;
        }
      });
      // shows how much of the minimum is written
      const count = el.querySelector(".open-count");
      const showCount = () => {
        const n = ta.value.trim().length;
        count.textContent = `${n} / ${CONFIG.open_min_chars}`;
        count.classList.toggle("reached", n >= CONFIG.open_min_chars);
      };
      showCount();
      ta.addEventListener("input", () => { showCount(); record(q.id, ta.value); });
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
        typing: a.typing ? {
          chars: (a.value || "").trim().length, keys: a.typing.keys, backspaces: a.typing.backspaces,
          typing_ms: a.typing.first === null ? null : Math.round(a.typing.last - a.typing.first),
          median_key_interval_ms: median(a.typing.gaps),
          bulk_inserts: a.typing.bulk_inserts, bulk_chars: a.typing.bulk_chars,
        } : null,
      };
    }),
  };
}
