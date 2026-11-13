/**
 * autoplay.js — development-only bot that walks through the experiment. It is
 * loaded only when the page is opened with ?debug=1 (use with &nofs=1, because
 * synthetic clicks cannot enter fullscreen). Not part of the deployed task.
 *
 *   __autoplay({ checks, tick, shot })
 *     checks  "correct" | "wrong" | "random" — how to answer the multiple-choice
 *             questions that have a right answer (default "correct")
 *     tick    ms between actions (default 40)
 *     shot    if true, calls window.__shot(label) (exposed by dev/walk.cjs) once
 *             per distinct screen before acting on it
 *   Resolves with jsPsych.data.get().values() when the last screen is done.
 */
window.__autoplay = function (opts = {}) {
  const o = Object.assign({ checks: "correct", tick: 40, shot: false }, opts);
  const state = window.experimentState, jsPsych = window.jsPsych;
  const $ = (s) => document.querySelector(s);
  const rand = (n) => Math.floor(Math.random() * n);
  let busy = false, lastShot = "", shots = 0;

  const screenLabel = () => {
    const c = $("#jspsych-content"); if (!c) return "";
    const eb = c.querySelector(".eyebrow"), h = c.querySelector("h1, h2, .q-label, .scenario-text p");
    return [eb ? eb.textContent : "", h ? h.textContent : ""].join(" | ").replace(/\s+/g, " ").trim().slice(0, 80);
  };

  function answer(q) {
    const el = $(`.q-item[data-id="${q.id}"]`);
    if (q.type === "likert") {
      if (!el.querySelector(".likert-opt.selected")) { const opts = el.querySelectorAll(".likert-opt"); opts[rand(opts.length)].click(); }
    } else if (q.type === "choice") {
      if (el.querySelector(".choice.selected")) return;
      let idx = rand(q.options.length);
      if (q.correct !== null && o.checks === "correct") idx = q.correct;
      if (q.correct !== null && o.checks === "wrong") idx = (q.correct + 1) % q.options.length;
      el.querySelector(`.choice[data-idx="${idx}"]`).click();
    } else {
      const ta = el.querySelector("textarea");
      if (!ta.value) { ta.value = `autoplay answer to ${q.id}`; ta.dispatchEvent(new Event("input", { bubbles: true })); }
    }
  }

  return new Promise((resolve) => {
    const id = setInterval(async () => {
      if (busy) return;
      const done = () => { clearInterval(id); resolve(jsPsych.data.get().values()); };
      if (!$("#jspsych-content")) return done();                    // experiment finished
      if (o.shot && window.__shot) {
        const label = screenLabel();
        if (label && label !== lastShot) {
          lastShot = label; busy = true;
          try { await window.__shot(`${String(++shots).padStart(2, "0")}_${label}`); } finally { busy = false; }
          return;
        }
      }
      let b;
      if ((b = $("#setup-start"))) return b.click();              // test setup: keep the prefilled choices
      if ((b = $("#q-submit"))) {
        state.currentItems.forEach(answer);
        if (!b.disabled) b.click();
        return;
      }
      if ((b = $("#text-submit"))) return b.click();
      if ((b = $("#card-btn")) && !b.disabled) return b.click();
    }, o.tick);
  });
};
console.log("[dev] autoplay loaded: call __autoplay({...})");
