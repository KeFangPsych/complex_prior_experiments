/**
 * page-plugin.js — a minimal jsPsych plugin for hand-built screens.
 *
 *   { type: PagePlugin, render: (el, done) => { el.innerHTML = ...; ...; done({ ...data }) } }
 *
 * `render` draws into the display element and calls done(data) to end the trial.
 * Added to the data: `rt` (ms since the screen appeared), and how much of that
 * time the participant was away: `screen_hidden_ms` (the tab was hidden) and
 * `screen_blur_count` (times the window lost focus).
 */
import { ParameterType } from "jspsych";
import { integrity, hiddenMsNow } from "./state.js";

export default class PagePlugin {
  static info = {
    name: "page",
    version: "1.0.0",
    parameters: {
      /** (displayElement, done) => void */
      render: { type: ParameterType.FUNCTION, default: undefined },
    },
    data: {
      /** Milliseconds from the screen appearing to done() being called. */
      rt: { type: ParameterType.INT },
      /** Milliseconds of `rt` during which the tab was hidden. */
      screen_hidden_ms: { type: ParameterType.INT },
      /** Times the window lost focus while the screen was shown. */
      screen_blur_count: { type: ParameterType.INT },
    },
  };

  constructor(jsPsych) { this.jsPsych = jsPsych; }

  trial(displayElement, trial) {
    const t0 = performance.now();
    const hidden0 = hiddenMsNow(), blur0 = integrity.window_blur_count;
    let finished = false;
    trial.render(displayElement, (data = {}) => {
      if (finished) return;
      finished = true;
      displayElement.innerHTML = "";
      window.scrollTo(0, 0);
      this.jsPsych.finishTrial({
        rt: Math.round(performance.now() - t0),
        screen_hidden_ms: Math.round(hiddenMsNow() - hidden0),
        screen_blur_count: integrity.window_blur_count - blur0,
        ...data,
      });
    });
  }
}
