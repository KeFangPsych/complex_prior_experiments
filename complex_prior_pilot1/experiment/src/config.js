/**
 * config.js — settings, and the participant-facing text around the scenario
 * (welcome, informed consent, instructions, final comments, debrief). The
 * scenario text and the questions live in content.js.
 *
 * The text here mirrors the vignette script (.md); `npm run check:script`
 * compares the two. Edit the script first, then mirror the change here.
 * Everything marked REPLACE must be filled in before data collection.
 *
 * This module has no browser dependencies so that Node can import it.
 */

// ============================================================================
// DATAPIPE — create a project at https://pipe.jspsych.org/, paste the ID, set
// enabled. Turn on its condition assignment with 32 conditions (or a multiple):
// the counter is mapped onto condition x figure version x surprise text
// (see assignmentFromIndex in content.js). If the counter cannot be read within
// condition_timeout_ms, the cell is drawn at random instead.
// ============================================================================
export const DATAPIPE = {
  experiment_id: "REPLACE_WITH_YOUR_DATAPIPE_EXPERIMENT_ID",
  enabled: false,
  condition_timeout_ms: 8000,
  save_attempts: 3,
};

// ============================================================================
// PROLIFIC — participants arriving with ?PROLIFIC_PID=... are redirected here
// when they finish.
// ============================================================================
export const PROLIFIC = {
  completion_code: "REPLACE_WITH_YOUR_PROLIFIC_COMPLETION_CODE",
};

// ============================================================================
// STUDY VALUES — REPLACE with the values of your protocol. In the text below,
// "XX" stands for `minutes` and "$X" for `payment`; they are filled in when the
// page is drawn (and in the consent PDF), so the script keeps the placeholders.
// ============================================================================
export const STUDY = {
  title: "Decision-Making Study",     // shown to participants (browser tab, end screens)
  minutes: "XX",                      // REPLACE, e.g. "12"
  payment: "$X",                      // REPLACE, e.g. "$2.50"
};
/** Fills the duration and payment placeholders of a text. */
export const fillStudyValues = (text) => text.replace(/\bXX\b/g, STUDY.minutes).replace(/\$X\b/g, STUDY.payment);

export const CONFIG = {
  experiment_name: "complex_prior_pilot1_vignette1",
  experiment_version: "0.4.0",

  // "pilot": every question of the script (Main + Pilot).
  // "main":  only the questions tagged Main.
  // In debug mode, ?mode=main / ?mode=pilot overrides this.
  mode: "pilot",

  // The URL flags used for testing (?debug=1, ?nofs=1, ?condition=k, ...) always
  // work on the dev server. This decides whether they also work on the built
  // site: keep true to test a build, set to false before collecting data.
  allow_dev_flags: true,

  // Read-locks: Continue unlocks after this many seconds (off in testing mode
  // unless switched on on the test-setup screen).
  scenario_lock_seconds: 8,       // scenario pages (text, or text + picture)
  instruction_lock_seconds: 4,    // instruction page

  // Open-response questions need at least this many characters.
  open_min_chars: 10,

  // Integrity (see README). ?nofs=1 turns off fullscreen and the viewport lock.
  require_fullscreen: true,
  min_viewport: { width: 1024, height: 600 },
  block_mobile: true,
  production_protections: true,   // context menu / copy / devtools shortcuts (off in testing mode)
};

// ============================================================================
// TEXT AROUND THE SCENARIO. Plain text; **double asterisks** mark bold.
// ============================================================================
export const WELCOME = {
  title: "Decision-Making Study",
  paragraphs: [
    "In this study you will read about a hypothetical scenario. It is presented in five parts, each with a short text and a picture. After each part you will answer questions about it.",
    "We are interested in what decisions you will make in the scenario, so make your decisions as you would in real life.",
    "The study takes about XX minutes. Please complete it in one sitting, in full-screen mode, without switching to other windows.",
  ],
};

export const INSTRUCTIONS = {
  title: "How the study works",
  bullets: [
    "Each part has a short text and a picture. Please read the text and look at the picture carefully.",
    "After each part you will answer questions about the text you read and the picture you saw. The text and the picture are not shown while you answer, and you cannot go back to earlier parts.",
    "Please answer the questions to the best of your ability.",
  ],
};

export const FEEDBACK_PROMPT = "Was anything in the scenario or the questions confusing or unclear? Do you have any other comments about the study?";

export const DEBRIEF = {
  title: "You have completed the study",
  paragraphs: [
    "Thank you for taking part. The planet, the organism and the company in the scenario are fictional.",
    "We are studying how people think about explanations of how things work, and how they judge the people who give those explanations.",
  ],
};

// ============================================================================
// INFORMED CONSENT — shown on the consent page and written into the PDF that
// participants can save from that page.
// ============================================================================
export const CONSENT = {
  title: "Informed Consent",
  sections: [
    { label: "Purpose of the research", text: "To understand more about how individuals evaluate explanations from other people and make decisions. This study will specifically ask participants to read, understand and evaluate explanations in a hypothetical setting." },
    { label: "Procedures", text: "Participation in this study will involve answering a series of questions in an online survey. This study is being conducted online using a web browser and internet." },
    { label: "Time required", text: "This survey will take about XX mins. The task will last the amount of time advertised on Prolific. You are free to withdraw from the study at any time." },
    { label: "Compensation", text: "You will receive a payment of $X for completing this study. If you do not complete this study or fail to answer most of the attention checks, compensation may not be granted." },
    { label: "Risks and Benefits", text: "There are no risks beyond those of everyday life that we are aware of from taking part in this study. While you may not receive direct benefits, you will contribute to knowledge about actions and preferences." },
    { label: "Confidentiality", text: "Only the researchers involved in this study and those responsible for research oversight will have access to the information you provide. Study data will be stored securely, in compliance with Stanford University standards, minimizing the risk of confidentiality breach. Your responses will be de-identified. De-identified data may be shared with other researchers." },
    { label: "Voluntary participation", text: "Your participation is completely voluntary, and you may quit at any time. Refusal to participate or stopping your participation will involve no penalty or loss of benefits to which you are otherwise entitled." },
    { label: "Questions", text: "If you have questions or concerns about this research, please contact: Ke Fang (fangke@stanford.edu, 516-288-2692) You may also contact the Protocol Director, Robert Hawkins (rdhawkins@stanford.edu)." },
    { label: "Independent Contact", text: "If your questions, concerns, suggestions, or complaints that are not being addressed by the researcher, or research-related harm, please contact the Stanford Institutional Review Board (IRB) to speak to someone independent of the research team at 650-723-2480 or toll free at 1-866-680-2906, or email at irbnonmed@stanford.edu. You can also write to the Stanford IRB, Stanford University, 1705 El Camino Real, Palo Alto, CA 94306." },
  ],
  pdf_filename: "informed_consent.pdf",
};
