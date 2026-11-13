/**
 * config.js — settings and participant-facing text that is NOT part of the
 * vignette script (welcome, consent, instructions, debrief). The story and the
 * questions live in content.js.
 *
 * Everything marked REPLACE must be filled in before data collection.
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
// STUDY TEXT VALUES — REPLACE with the values of your protocol.
// ============================================================================
export const STUDY = {
  title: "Planet Settlement Study",       // shown to participants (eyebrow, browser tab)
  duration: "about 10 to 15 minutes",     // REPLACE after timing the pilot
  payment: "[PAYMENT AMOUNT]",            // REPLACE
};

export const CONFIG = {
  experiment_name: "complex_prior_pilot1_vignette1",
  experiment_version: "0.1.0",

  // "pilot": every question of the script (Main + Pilot).
  // "main":  only the questions tagged Main.
  // In debug mode, ?mode=main / ?mode=pilot overrides this.
  mode: "pilot",

  // The URL flags used for testing (?debug=1, ?nofs=1, ?condition=k, ...) always
  // work on the dev server. This decides whether they also work on the built
  // site: keep true to test a build, set to false before collecting data.
  allow_dev_flags: true,

  // Read-locks: Continue unlocks after this many seconds (0 in debug mode).
  story_lock_seconds: 8,          // story pages (text + picture)
  instruction_lock_seconds: 4,    // instruction page

  // Open-response questions need at least this many characters.
  open_min_chars: 10,

  // Integrity (see README). ?nofs=1 turns off fullscreen and the viewport lock.
  require_fullscreen: true,
  min_viewport: { width: 1024, height: 600 },
  block_mobile: true,
  production_protections: true,   // context menu / copy / devtools shortcuts (off with ?debug=1)
};

// ============================================================================
// WELCOME / INSTRUCTIONS / DEBRIEF — not in the vignette script; edit freely.
// ============================================================================
export const WELCOME_HTML = `
  <h1>A story about a new planet</h1>
  <p class="lead">In this study you will read a short story about a fictional planet. The story is told in <strong>five parts</strong>, each with a short text and a picture. After each part you will answer questions about it.</p>
  <p>The study takes ${STUDY.duration}. Please complete it in one sitting, in full-screen mode, without switching to other windows.</p>`;

export const INSTRUCTIONS_HTML = `
  <h2>How the study works</h2>
  <ul>
    <li>Each part of the story has a <strong>short text and a picture</strong>. Please read the text and look at the picture carefully.</li>
    <li>After each part you will answer questions about it. The text and the picture are <strong>not shown while you answer</strong>, and you <strong>cannot go back</strong> to earlier parts.</li>
    <li>Some questions ask what you remember from the story. Others ask for your own judgment; for those, there are no right or wrong answers.</li>
  </ul>`;

export const FEEDBACK_PROMPT = "Was anything in the story or the questions confusing or unclear? Do you have any other comments about the study?";

export const DEBRIEF_HTML = `
  <h1>You have completed the study</h1>
  <p>Thank you for taking part. The planet, the organism and the company in the story are fictional.</p>
  <p>We are studying how people think about explanations of how things work, and how they judge the people who give those explanations.</p>`;

// ============================================================================
// CONSENT — PLACEHOLDER. REPLACE this text with the consent form approved for
// this study before collecting any data.
// ============================================================================
export const CONSENT_HTML = `
  <div class="consent-container">
    <h2>Consent to Participate in Research</h2>
    <div class="consent-section">
      <p><strong>[PLACEHOLDER — replace this section with the consent form approved for this study.]</strong></p>
      <p><strong>DESCRIPTION:</strong> You are invited to participate in a research study in which you read a short story and answer questions about it.</p>
      <p><strong>TIME INVOLVEMENT:</strong> Your participation will take ${STUDY.duration}.</p>
      <p><strong>PAYMENTS:</strong> You will receive ${STUDY.payment} as payment for your participation.</p>
      <p><strong>RISKS AND BENEFITS:</strong> [As approved for this study.]</p>
      <p><strong>PARTICIPANT'S RIGHTS:</strong> [As approved for this study.]</p>
      <p><strong>CONTACT INFORMATION:</strong> [Researcher and IRB contact details.]</p>
      <p>Please click “I consent” to indicate that you have read this form and agree to participate.</p>
    </div>
  </div>`;
