/**
 * page-plugin.js — a minimal jsPsych plugin for hand-built screens.
 *
 *   { type: PagePlugin, render: (el, done) => { el.innerHTML = ...; ...; done({ ...data }) } }
 *
 * `render` draws into the display element and calls done(data) to end the trial.
 * The trial's `rt` (ms since the screen appeared) is added to the data.
 */
import { ParameterType } from "jspsych";

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
    },
  };

  constructor(jsPsych) { this.jsPsych = jsPsych; }

  trial(displayElement, trial) {
    const t0 = performance.now();
    let finished = false;
    trial.render(displayElement, (data = {}) => {
      if (finished) return;
      finished = true;
      displayElement.innerHTML = "";
      window.scrollTo(0, 0);
      this.jsPsych.finishTrial({ rt: Math.round(performance.now() - t0), ...data });
    });
  }
}
