# Complexity priors, pilot 1, vignette 1 — jsPsych experiment

A jsPsych 8 experiment built from
[`../complex_prior_pilot1_vignette1_script.md`](../complex_prior_pilot1_vignette1_script.md).
Participants read a five-part scenario about a technology on an alien planet
(text plus a picture per part) and answer questions after each part.

It is a Node project: jsPsych and its plugins come from npm and
[Vite](https://vite.dev) bundles everything into a static site. The UI and the
integrity layer follow `prag_net_memo/experiment/speaker_selective_truth` (card
layout, phase stepper, read-locked pages, fullscreen enforcement, DataPipe).

## Run it

```bash
npm install
```

```bash
npm run dev
```

Then open <http://localhost:8765/?debug=1> for testing, or
<http://localhost:8765/> for the experiment exactly as a participant gets it
(fullscreen, read-locks, random assignment, no shortcuts).

### Testing mode

With `debug=1` in the address, the first screen is a **test setup** screen that
participants never see. On it you choose:

- **Condition**: one of the 8 conditions of the script's design table, or Random.
- **Evidence figure**: table only, table + line graphs, or Random.
- **Surprise text**: shown, hidden, or Random (evidence-first conditions only).
- **Questions**: Pilot (all questions) or Main (Main questions only).
- **Read-locks**: off (Continue works at once) or on (as for participants).
- **Safeguards**: off or on (as for participants).

"Random" leaves that setting to the normal assignment. With the safeguards off,
which is the default in testing mode, you can select, copy and paste text,
right-click, use devtools shortcuts, save the pictures, use any window size or a
phone, stay out of full screen, and leave the page without a warning. Testing
mode also loads the test bot (`__autoplay()` in the browser console). Runs made
this way have `debug_mode = true` in the data, and `safeguards = false` unless
you switched them on.

| URL flag | effect |
|---|---|
| `debug=1` | testing mode: shows the test setup screen |
| `cond=1..8`, `fig=table\|line`, `surprise=shown\|hidden`, `mode=pilot\|main`, `locks=1`, `safeguards=1` | with `debug=1`: prefill the test setup screen |
| `nofs=1` | without `debug=1`: the participant version, but with no fullscreen requirement and no viewport lock |
| `condition=k` | forces assignment cell `k` (0–31) when DataPipe is disabled |

The flags always work on the dev server. On the built site they work only while
`CONFIG.allow_dev_flags` is `true`.

Build the static site (output in `dist/`, deployable to any static host):

```bash
npm run build
```

```bash
npm run preview
```

## Files

| file | role |
|---|---|
| `src/content.js` | the scenario text, page breaks, figure names, questions and randomization for every condition, transcribed from the script; also the design table and the assignment cells |
| `src/config.js` | DataPipe and Prolific settings, pilot / main mode, read-lock times, and the text around the scenario (welcome, informed consent, instructions, final comments, debrief), also transcribed from the script |
| `src/consent-pdf.js` | writes the consent form to a PDF when a participant clicks "Save a copy (PDF)" |
| `src/main.js` | the jsPsych timeline |
| `src/ui.js` | stepper frame, cards, read-lock, and the question components (7-point scale, multiple choice, open response) |
| `src/integrity.js` | fullscreen, viewport lock, mobile block, protections, tab / blur logging |
| `src/page-plugin.js` | a small jsPsych plugin for hand-built screens |
| `src/images.js` | resolves picture names to URLs; the pictures stay in `../complex_prior_pilot1_vignette1_images/` |
| `src/state.js`, `src/styles.css`, `src/autoplay.js` | run-time state, styles, the debug-only test bot |
| `dev/check_script.mjs` | checks `content.js` against the script (`npm run check:script`) |
| `dev/walk.cjs`, `dev/integrity_test.cjs` | browser tests (see *Testing*) |

## Keeping the experiment in sync with the script

The script is the source of truth for everything participants read: the
scenario, the questions, and the welcome, consent, instruction, final-comment
and debrief text. After editing it, mirror the change in `src/content.js` (or
`src/config.js` for the text around the scenario) and run:

```bash
npm run check:script
```

For all 8 conditions, both surprise-text settings and both figure versions, this
renders the scenario and the questions from `content.js` and compares them with
the script: every paragraph and page break, every figure name (and that the file
exists), every question with its scale or options, measure label and Main / Pilot
tag, the "Presentation order" notes that say what is randomized, the order of the
stages, and the design table. It also compares the text in `config.js` with the
script, and checks that the randomization does what the notes say. It exits with
an error and lists each difference.

## Design

**Conditions.** The 8 conditions of the script's design table: order (evidence
first / elaboration first) × complexity (low / high) × evidence (heat / color
anomaly). Two more things are randomized independently, as the script's
underlining specifies:

- **Evidence figure**: table only, or table plus line graphs (all conditions).
- **Surprise text**: whether the underlined sentences of the evidence stage are
  shown (evidence-first conditions only; the three underlined pieces are shown or
  hidden together).

Crossing these gives **32 assignment cells**. Cell `k` maps to condition
`k % 8 + 1`, figure `table` for `k` in 0–7 and 16–23 (else `line`), and surprise
text shown for `k` in 0–15 (else hidden). With DataPipe enabled, `k` is its
condition counter, so consecutive participants fill every cell once per 32.
Without DataPipe, or if DataPipe does not answer within 8 s, `k` is drawn at
random. `condition_source` records which: `datapipe`, `random`,
`random_fallback`, `url`, or `test_setup` when a tester fixed it.

**Timeline.** welcome → consent (enters fullscreen) → assignment → picture
preload → one instruction page → five parts → optional comments → save →
debrief. Each part is one **scenario screen** (two in part 3; Continue locked for
`CONFIG.scenario_lock_seconds`) followed by its **question screens**. The
consent page has a **Save a copy (PDF)** button, which also works with the
safeguards on.

**Randomized order.** As the script's "Presentation order" notes say: in part 2
the two question blocks (perceived complexity, perceived scientific
understanding) come in random order; in part 3 the answer options of the
construction team's goal question are shuffled with "I don't remember" kept last,
and the two relevance questions come in random order. Everything else follows
the order of the script's tables.

**Page layout.** Parts 1 and 2 show the text on the left and the picture on the
right. Part 3 is two pages: text only, then text above the picture. Parts 4 and 5
show the text above the picture. Each picture has a maximum and a minimum
displayed width (`figureLimits` in `src/main.js`). It is shown at the maximum
when the page fits the window; otherwise it shrinks towards the minimum, and if
that is not enough the page switches to a compact text style. With this, every
scenario page fits without scrolling in a window of 1366 × 768 or larger; in the
smallest allowed window (1024 × 600) the longer pages scroll a little.

**Pilot and main mode.** `CONFIG.mode = "pilot"` asks every question of the
script; `"main"` asks only those tagged Main. Participants always get
`CONFIG.mode`; in testing mode it is chosen on the test setup screen. Pilot mode has 42 questions in the
evidence-first conditions and 41 in the elaboration-first ones; main mode has 22
and 21.

**Choices that the script does not specify** (all easy to change):

- The scenario text and picture are **not visible while answering**, and there is
  no Back button. Several questions offer "I don't remember", so they are treated
  as memory questions.
- Questions are grouped onto screens of one to four related items (the `page` key
  of each item in `content.js`).
- Every question must be answered. Open responses need at least
  `CONFIG.open_min_chars` (10) characters.
- No feedback is given on the memory questions and nobody is screened out;
  correctness is recorded only.
- The stepper shows neutral labels (Part 1 … Part 5).
- The study title shown to participants ("Planet Settlement Study") is set in
  `src/config.js`.

## Integrity measures

As in the reference experiment, nothing here ends the study; everything is
recorded for exclusion decisions at analysis time.

- **Fullscreen** is entered on consent. Leaving it shows a blocking overlay with a
  *Return to full screen* button (`fullscreen_exit_count`, `fullscreen_exit_log`).
- **Tab switching**: `tab_hidden_count`, `tab_hidden_total_ms`, `window_blur_count`.
- **Viewport lock** below 1024 × 600 (`viewport_lock_count`), **mobile block**,
  blocked context menu, copy / cut / paste (`paste_attempts`) and devtools
  shortcuts, and a leave-page warning between consent and debrief.
- **Read-locks** on the instruction and scenario pages; reading time is each
  scenario row's `rt`.

The page loads nothing from other servers: jsPsych, the fonts and the pictures
are all bundled. Only DataPipe (when enabled) and the Prolific redirect are
contacted.

## Data

One CSV per participant (uploaded through DataPipe, or downloadable on the last
screen when DataPipe is disabled or the upload failed).

**Every answer is a participant-level column** named after the item's `id` in
`content.js` (for example `complexity_overall`, `trust_tell`, `pred_heat`,
`obs_heat`, `open_decrease`), so the **last row of the file holds the complete
record**. Scales are stored as 1–7, multiple choice as the option text, open
responses as text. Multiple-choice questions with a right answer also get
`<id>_correct`. A question that was not asked in the participant's condition or
mode has no value.

Other participant-level columns: `subject_id`, `prolific_pid`, `study_id`,
`session_id`, `mode`, `condition_index`, `condition_source`, `cond` (1–8),
`order`, `complexity`, `anomaly`, `goal_relevance`, `evidence_figure`,
`surprise_text` (`shown` / `hidden` / `not_applicable`), `stage_order`,
`general_feedback`, `completion_status`, `debug_mode`, `nofs_mode`, `safeguards`, and the
integrity counters above. The random orders that were drawn are recorded in
`order_planet_blocks` (for example `planet_understanding,planet_complexity`),
`order_relevance` (pilot mode) and `team_goal_option_order` (the options as
displayed, separated by ` | `). `response_index` and `<id>_correct` always refer
to the option's position in the script, not on the screen.

Row-level detail, by `task`:

| `task` | columns |
|---|---|
| `scenario` | one row per scenario page: `stage_index`, `stage`, `scenario_page`, `n_scenario_pages`, `layout`, `figure`, `figure_width_px` (displayed width), `compact_text`, `needed_scrolling`, `viewport_width`, `viewport_height`, `n_words`, `lock_seconds`, `rt` (reading time, ms) |
| `questions` | `stage_index`, `stage`, `page`, `page_index`, `item_ids`, `rt`, and `responses`: JSON with one entry per item (`id`, `use`, `type`, `measure`, `response`, `response_index`, `correct`, `position`, `option_order`, `first_ms`, `last_ms`, `n_changes`) |
| `consent` | `consented`, `fullscreen_ok`, `consent_pdf_saves` |
| `test_setup` | testing mode only: `test_cond`, `test_figure`, `test_surprise`, `test_mode`, `test_locks`, `test_safeguards` |
| `save_data` | `success`, `attempts` |

Predictions (`pred_heat`, `pred_pigment`) are asked after part 3 in the
evidence-first conditions and after part 4 in the elaboration-first ones; the
`stage_index` of their `questions` row says which.

## Testing

`npm run check:script` needs nothing but Node. The browser tests need the dev
server running in another terminal and Playwright, which is not a dependency of
this project:

```bash
npm i --no-save playwright
```

```bash
npx playwright install chromium
```

```bash
npm run test:walk
```

```bash
npm run test:integrity
```

- `test:walk` runs the whole experiment with the test bot in all 8 conditions ×
  pilot / main mode, plus two runs that pick their settings by clicking on the
  test setup screen, and checks the data against `content.js`: assignment columns,
  scenario pages and figures, exactly the expected question screens (in the
  script's order except where it is randomized), that the recorded random orders
  are the ones shown, a valid answer for every question, the scoring of the
  memory questions, and no page errors. It also reports any scenario page that
  needed scrolling.
  `node dev/walk.cjs --shots 3` also saves a screenshot of every screen of
  condition 3 to `dev/shots/`.
- `test:integrity` uses the page as a participant gets it, with real clicks:
  saving the consent PDF, fullscreen on consent and the overlay on leaving it,
  read-locks, that text and picture fit the window, Continue
  locked until every item is answered, the open-response minimum, blocked
  selection and copy, the viewport lock and the mobile block. It also checks that
  testing mode has all of these off unless they are switched on.

Set `BASE_URL` to test another address (for example the built site under
`npm run preview`), and `CHROME_PATH` to use an existing Chrome.

## Before collecting data

- Fill in `STUDY.minutes` and `STUDY.payment` in `src/config.js`. They replace
  the "XX" and "$X" placeholders in the welcome text, the consent form and the
  consent PDF. Check the consent form against the approved protocol; it mentions
  attention checks, and the experiment currently has none.
- Fill in `DATAPIPE.experiment_id`, set `enabled: true`, and turn on DataPipe's
  condition assignment with **32 conditions** (or a multiple of 32).
- Fill in `PROLIFIC.completion_code`.
- Set `CONFIG.mode` (`"pilot"` or `"main"`).
- Set `CONFIG.allow_dev_flags` to `false`, then `npm run build` and deploy `dist/`.
- Each picture is 1.3–2 MB (about 9 MB per participant); they are preloaded
  before the scenario starts. Compressing the PNGs would shorten that wait.
