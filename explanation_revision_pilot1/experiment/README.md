# Explanation revision, pilot 1, vignette 1 — jsPsych experiment

A jsPsych 8 experiment built from
[`../explanation_revision_pilot1_vignette1_script.md`](../explanation_revision_pilot1_vignette1_script.md).
Participants take the role of a member of a construction team on an alien
planet. They read a five-part scenario about a technology offered by a company
(text plus a picture per part) and answer questions after each part. What the
company and the team write to each other is shown as speech bubbles with a
sender label (the company's on the left in green with its logo, the team's on
the right in blue with a hard hat), and the test results as a lab report box
that also holds the laboratory-observations picture and colors the four
temperature words (warm, cool, cold, freezing); everything else is the
narrator's text.

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
- **Organism question**: which of the two part 3 organism questions is shown
  ("simple or complex" or "more to know"), or Random (pilot questions only).
- **Questions**: Pilot (all questions) or Main (Main questions only).
- **Read-locks**: off (Continue works at once) or on (as for participants).
- **Safeguards**: off or on (as for participants).

While you test, a dark bar under the progress bar shows the settings in use
(the condition and the two randomizations appear as "random" until they are
assigned after consent) and has two buttons:

- **← Back** goes to the previous screen, all the way back to the test setup
  screen. Answers you gave are filled in again when you return to a question
  screen, and the assignment and all random orders stay the same.
- **Change settings** jumps to the test setup screen. Pressing Start there
  assigns again with the new settings and clears the answers.

Participants have neither the bar nor a way back. Every Back press is logged as
a `test_back` row, and screens visited twice appear twice in the data.

"Random" leaves that setting to the normal assignment. With the safeguards off,
which is the default in testing mode, you can select, copy and paste text,
right-click, print, take screenshots, use devtools shortcuts, save the pictures,
use any window size or a phone, stay out of full screen, switch windows without
the study being covered, and leave the page without a warning. Testing
mode also loads the test bot (`__autoplay()` in the browser console). Runs made
this way have `debug_mode = true` in the data, and `safeguards = false` unless
you switched them on.

| URL flag | effect |
|---|---|
| `debug=1` | testing mode: shows the test setup screen |
| `cond=1..8`, `fig=table\|line`, `surprise=shown\|hidden`, `orgq=complexity\|more`, `mode=pilot\|main`, `locks=1`, `safeguards=1` | with `debug=1`: prefill the test setup screen |
| `nofs=1` | without `debug=1`: the participant version, but with no fullscreen requirement and no viewport lock |
| `condition=k` | forces assignment cell `k` (0–31) when DataPipe is not used |
| `nopipe=1` | nothing is sent to DataPipe: no counter request, no upload; the last screen offers the data as a download |
| `allowauto=1` | lets an automated browser open the participant version, which otherwise turns it away (the browser tests use this) |

The flags always work on the dev server. On the built site they work only while
`CONFIG.allow_dev_flags` is `true`.

Build the static site (output in `dist/`, deployable to any static host):

```bash
npm run build
```

```bash
npm run preview
```

## Online version (GitHub Pages)

Every push to `main` that touches `explanation_revision_pilot1/` rebuilds the experiment
and publishes it (workflow `.github/workflows/deploy-pages.yml`; it runs
`npm run check:script` first and does not publish if that fails):

- participant version: <https://kefangpsych.github.io/explanation_revision_experiments/pilot1_vignette1/>
- testing mode: <https://kefangpsych.github.io/explanation_revision_experiments/pilot1_vignette1/?debug=1>

These addresses contain the repository's name
(`explanation_revision_experiments`). If the repository is renamed again, they
change with it and the old ones stop working, so update them here, in the
workflow file's comment and in the Prolific study URL.

One-time setup in the repository: Settings → Pages → Build and deployment →
Source: **GitHub Actions**. The site saves to the DataPipe experiment named in
`src/config.js` (see *DataPipe and Prolific* below). Do not push to `main`
while data are being collected: every push republishes the site, and
participants who are part-way through would get a mix of old and new files.

## Files

| file | role |
|---|---|
| `src/content.js` | the scenario text (narration and messages), page breaks, figure names, questions and randomization for every condition, transcribed from the script; also the design table and the assignment cells |
| `src/config.js` | DataPipe and Prolific settings, pilot / main mode, the read-lock rule, and the text around the scenario (welcome, informed consent, instructions, final comments, debrief), also transcribed from the script |
| `src/consent-pdf.js` | writes the consent form to a PDF when a participant clicks "Save a copy (PDF)" |
| `src/main.js` | the jsPsych timeline and the screens; the screens from welcome to the final comments are drawn from a cursor, which is what lets testing mode go back |
| `src/ui.js` | stepper frame, cards, read-lock, and the question components (5-point rating scale, multiple choice, open response) |
| `src/integrity.js` | fullscreen, viewport lock, mobile block, copy / print / screenshot protections, tab / blur logging |
| `src/page-plugin.js` | a small jsPsych plugin for hand-built screens |
| `src/images.js` | resolves picture names to URLs; the pictures stay in `../explanation_revision_pilot1_vignette1_images/` |
| `src/state.js`, `src/styles.css`, `src/autoplay.js` | run-time state, styles, the debug-only test bot |
| `dev/check_script.mjs` | checks `content.js` against the script (`npm run check:script`) |
| `dev/count_cells.mjs`, `dev/csv.mjs` | counts completed participants per cell and prints a top-up list (`npm run cells -- <folder>`) |
| `dev/datapipe_test.cjs` | browser test of the DataPipe and Prolific connection against stand-ins for both (`npm run test:datapipe`) |
| `dev/readability.mjs` | readability report for everything participants read (`npm run readability`) |
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
the script: every paragraph, every message with its sender label, every page break, every figure name (and that the file
exists), every question with its scale or options, measure label and Main / Pilot / Alternative
tag, the "Presentation order" notes that say what is randomized, the order of the
stages, and the design table. It also compares the text in `config.js` with the
script, checks that the randomization does what the notes say, and checks the
script's "Randomization and timing" summary: its table must list exactly what
`content.js` randomizes, and its read-lock sentence must state the numbers in
`config.js`. It exits with an error and lists each difference.

```bash
npm run readability
```

prints, for every scenario page and question, the word count, the average
sentence length, the Flesch Reading Ease and the Flesch-Kincaid grade, and lists
sentences over 25 words and words of three or more syllables.

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
text shown for `k` in 0–15 (else hidden). With DataPipe in use, `k` is its
condition counter (`assignment_counter` in the data), so consecutive
participants fill every cell once per 32, and every 8 in a row cover the 8
conditions. Without DataPipe, or if DataPipe refuses or does not answer within
8 s, `k` is drawn at random. `condition_source` records which: `datapipe`,
`random`, `random_fallback`, `url`, or `test_setup` when a tester fixed it. In
a top-up batch (`ASSIGNMENT.top_up_cells`, see *DataPipe and Prolific*) the
counter runs through the listed cells instead, and `top_up` is `true`.

**Timeline.** welcome → consent (enters fullscreen) → assignment → picture
preload → one instruction page → five parts → the AI-tool question and optional comments → debrief →
the data are saved → back to Prolific. Each part is one or two **scenario screens**: part 3 and the evidence
part have two (in the evidence part, asking for the sample, then the lab report
with the picture), and so does part 5 of the evidence-first conditions (the
team's question, then the company's reply), followed by its **question
screens**. On every scenario screen Continue is locked for a reading time that
depends on the amount of text, and on the instruction page for 10 seconds (see
*Read-locks* below). The
consent form is shown in full (the page scrolls only if the window is too short
for it) and has a **Save a copy (PDF)** button, which also works with the
safeguards on. Text marked with `**…**` in the script is shown in bold.

**Everything that is randomized.** This is the complete list; it is also in the
script ("Randomization and timing"), and `RANDOMIZATIONS` in `src/content.js`
holds it for the checks. Nothing else is random: all other pages, questions and
answer options keep the script's order.

| what | versions | who | how it is drawn | data column |
|---|---|---|---|---|
| Condition (order × complexity × evidence) | 8 | everyone | assignment cell | `cond`, `order`, `complexity`, `anomaly` (also `goal_relevance`, `stage_order`, `condition_index`, `condition_source`) |
| Evidence figure | table only / table with line graphs | everyone | assignment cell | `evidence_figure` |
| Surprise text (the underlined pieces, all or none) | shown / hidden | evidence-first conditions | assignment cell | `surprise_text` (`not_applicable` in the other conditions) |
| Order of the two part 2 question blocks | 2 orders | everyone | per participant | `order_planet_blocks` |
| Order of the answer options of the team's goal question ("I don't remember" last) | 24 orders | everyone | per participant | `team_goal_option_order` |
| Order of the two relevance questions | 2 orders | pilot mode | per participant | `order_relevance` |
| Which organism question is shown in part 3 | 2 questions | pilot mode | per participant | `organism_question` |
| Order of the two agree / disagree statements about the algae explanation (end evaluations) | 2 orders | evidence-first conditions | per participant | `order_agree_statements` |
| Order of the complexity, source-trust and utility blocks of the end evaluations | 6 orders | everyone | per participant | `order_final_blocks` |

"Assignment cell" means the three settings are crossed into the 32 cells
described above, so they are balanced when DataPipe's counter is used.
"Per participant" means an independent draw in the browser with every version
equally likely, made once when the condition is assigned. In addition, every
`questions` row records the items in the order shown (`item_ids`) and, for each
item, its `position` on the screen and its `option_order`. `npm run test:walk`
checks that each of these columns is filled and matches what was shown, and
`npm run check:script` checks that each version comes up about equally often.

**Read-locks.** Continue stays locked for 1 second per 5 words of text
(300 words per minute, `CONFIG.read_lock_words_per_second`) and for at least 10
seconds (`CONFIG.read_lock_min_seconds`). This applies to every scenario page;
the words counted are the page's paragraphs and sender labels. The instruction
page has a fixed lock of 10 seconds (`CONFIG.instruction_lock_seconds`).

The exceptions, set from reading times in testing and stated in the script:
the lab report stays locked for 6 seconds more than its word count gives
(`LOCK_EXTRA` in `src/content.js`), and four pages have a set time
(`LOCK_FIXED`). The resulting locks:

| page | lock |
|---|---|
| instructions | 10 s |
| part 1; part 2 | 11 s; 10 s (simple) or 14 s (complex) |
| part 3, page 1; page 2 (company's first message) | 12 s (set); 25 s (set) |
| evidence part, page 1 (asking for the sample) | 5 s (set) |
| lab report | 23 s with the surprise text, 20 s without |
| the team's question (evidence first) | 10 s |
| algae explanation | 40 s (set), in both orders |

The welcome and consent pages have no lock. The lock used is recorded in each
row (`lock_seconds`, `n_words`).

**Page layout.** Parts 1 and 2 show the text on the left and the picture on the
right. Part 3 is two pages: text only, then text above the picture. Parts 4 and 5
show the text above the picture. Each picture has a maximum and a minimum
displayed width (`figureLimits` in `src/main.js`). The two most detailed
pictures, the laboratory results with line graphs and the algae explanation, are
shown as wide as the text. A picture is shown at its maximum when the page fits
the window; otherwise the page first switches to a compact text style, and only
then shrinks the picture towards its minimum. The algae explanation is hard to
read when small, so its minimum is 840px and its page scrolls a little on a
1366 × 768 screen. Every other scenario page fits without scrolling in a window
of 1366 × 768 or larger; in the smallest allowed window (1024 × 600) the longer
pages scroll.

**Pilot and main mode.** `CONFIG.mode = "pilot"` asks every question of the
script; `"main"` asks only those tagged Main. Participants always get
`CONFIG.mode`; in testing mode it is chosen on the test setup screen. Pilot mode has 39
questions in the evidence-first conditions and 38 in the elaboration-first
ones; main mode has 23 and 22.
Rows tagged **Alternative** in the script are documented alternatives and are
never asked.

**Choices that the script does not specify** (all easy to change):

- The scenario text and picture are **not visible while answering**, and there is
  no Back button. Several questions offer "I don't remember", so they are treated
  as memory questions.
- Questions are grouped onto screens of one to four related items (the `page` key
  of each item in `content.js`).
- Every question must be answered. Open responses need at least
  `CONFIG.open_min_chars` (50) characters; a counter under the box shows how
  many are written. The script states the number.
- No feedback is given on the memory questions and nobody is screened out;
  correctness is recorded only.
- The stepper shows neutral labels (Part 1 … Part 5).
- The title in the browser tab and on the end screens ("Decision-Making Study")
  is `STUDY.title` in `src/config.js`.

## Integrity measures

As in the reference experiment, nothing here ends the study; everything is
recorded for exclusion decisions at analysis time.

- **Fullscreen** is entered on consent. Leaving it shows a blocking overlay with a
  *Return to full screen* button (`fullscreen_exit_count`, `fullscreen_exit_log`).
- **Tab switching**: `tab_hidden_count`, `tab_hidden_total_ms`, `window_blur_count`.
- **Viewport lock** below 1024 × 600 (`viewport_lock_count`), **mobile block**,
  blocked context menu, copy / cut / paste (`paste_attempts`) and devtools
  shortcuts, and a leave-page warning between consent and debrief.
- **Screenshots.** A web page cannot stop the operating system from capturing
  the screen, so this makes screenshots harder and records attempts; it does not
  make them impossible. Between consent and the end, the study is covered by a
  blank screen (a) while its window is not active, which is what happens when a
  capture tool such as the Windows Snipping Tool opens, and (b) as soon as a
  screenshot key is seen: PrintScreen, or Cmd / Win + Shift held together (the
  start of Cmd+Shift+3/4/5 on a Mac and Win+Shift+S on Windows). After
  PrintScreen the clipboard is overwritten where the browser allows it. Printing
  gives an empty page, and Ctrl/Cmd+P and Ctrl/Cmd+S are blocked. Key presses
  are counted in `screenshot_key_count` and listed in `screenshot_key_log`. A
  phone camera, a browser extension, or a capture tool started some other way
  cannot be detected.
- **Read-locks** on the instruction and scenario pages (see *Read-locks* above);
  reading time is each scenario row's `rt`.

All of these are off in testing mode unless Safeguards (or Read-locks) is
switched on on the test setup screen.

The page loads nothing from other servers: jsPsych, the fonts and the pictures
are all bundled. Only DataPipe and the Prolific redirect are contacted, and
DataPipe only after consent: one request for the condition counter, a
connection to its staging database (Google Firebase) for the screens sent as
they happen, and the upload at the end.

## AI safeguards

A web page cannot prove that a person, and not an AI system, is answering. An
AI agent that operates an ordinary browser through the screen, the way a person
does, looks like a person to the page. What the experiment does is turn away
the tools it can recognise, make AI use awkward, and record signs of it so that
suspect participants can be looked at and excluded.

**Stopped outright** (participants only; off in testing mode unless Safeguards
is on):

- **Automated browsers.** A browser driven by an automation tool (Playwright,
  Puppeteer, Selenium, and AI agents built on them) announces itself
  (`navigator.webdriver`, or "Headless" in its name). The participant version
  shows such a browser a page saying the study cannot be opened in an
  automated browser, and nothing else.
- **Scripted answers.** Clicks, key presses and text entered by a script
  (code run in the page, a bookmarklet, a simple extension) are ignored and
  counted in `untrusted_event_count`.
- **Copying the questions out and pasting answers in.** Text cannot be
  selected, copied, pasted or dropped, and screenshots are hindered (see
  *Integrity measures*). An answer from a chatbot has to be retyped by hand.
- **Testing mode.** With `CONFIG.allow_dev_flags` set to `false`, the test
  setup screen, the test bot and every URL flag are gone from the site.

**Asked of participants.** The instruction page says to answer alone and not to
use AI tools or other outside help. The last screen, above the comments, asks:
"Did you use any AI tool (such as a chatbot or an AI assistant) to help you
during this study? Your answer will not affect your payment." (Yes / No,
required; column `ai_tool_use`.) Say in the Prolific study description too that
AI tools are not allowed.

**Hidden checks for AI systems** (`AI_GUARD` in `src/config.js`; quoted in the
script). Both are part of the page's text but placed off-screen, so a person
does not see them, while an AI system that reads the page's text does:

- Every open-response question carries a note telling AI systems to include
  the word "marigold" in their answer. An answer containing it is listed in
  `hidden_note_word_items`.
- Every question screen has a field that says it is for automated agents.
  Anything typed into it is saved in `hidden_field_value`.

A screen reader reads both out, which is why each says that human participants
should ignore it. An AI system that works from screenshots does not see them,
and a careful one may ignore them.

**Recorded for every participant**, for exclusion decisions at analysis time:

| column | what it shows |
|---|---|
| `ai_flags` | the signs below that this participant shows, as a comma-separated list (empty for most people) |
| `automation_signals` | what the browser gave away at the start (`webdriver`, `headless_browser`, …); only possible in a test run, since participants with any are turned away |
| `untrusted_event_count` | scripted clicks, keys or input that were ignored |
| `hidden_note_word_items`, `hidden_field_value` | the two hidden checks |
| `open_bulk_insert_count` | times more than two characters entered an open response at once (inserted by a program, dictated, or pasted past the block) |
| `pointer_move_count`, `click_count`, `key_count` | how the page was operated; each screen's row also has `screen_pointer_moves`, `screen_clicks`, `screen_keys` |
| `screens_without_pointer_moves` | screens left with a click that no mouse movement came before |
| `dead_center_click_count` | clicks on the exact centre of a button, which is where automation tools click and people almost never do |
| `paste_attempts`, `tab_hidden_count`, `window_blur_count`, `screenshot_key_count` | from *Integrity measures*: leaving the window is what consulting a chatbot looks like |

For each open response, the `typing` entry in the `responses` column records
how the text was entered: `chars`, `keys`, `backspaces`, `typing_ms`,
`median_key_interval_ms`, `bulk_inserts`, `bulk_chars`. Text typed by a person
has about as many keys as characters, some backspaces, and a middle gap between
keys of roughly 80 to 250 ms.

The names that can appear in `ai_flags`:

| flag | rule |
|---|---|
| `webdriver`, `headless_browser`, `automation_tool`, `automation_marks` | the browser's own signs of automation |
| `self_reported` | answered "Yes" to the question on AI tools |
| `scripted_events` | `untrusted_event_count` above 0 |
| `hidden_note_word` | an open response contains the hidden note's word |
| `hidden_field_filled` | the hidden field has text |
| `text_inserted_at_once` | `open_bulk_insert_count` above 0 |
| `text_without_keystrokes` | an open response of 20 or more characters with fewer than half as many keys |
| `machine_fast_typing` | an open response typed with a middle gap between keys under 40 ms, over 20 or more keys |
| `no_pointer_movement` | at least half of the screens were left without any mouse movement |
| `dead_center_clicks` | 5 or more dead-centre clicks, making up at least half of all clicks |

A flag is a reason to look at a participant's data, not proof: dictation
software inserts text at once, and someone using only the keyboard moves no
mouse. The test bot, which is an automated browser that never moves the mouse
and does not type, is flagged with `webdriver`, `no_pointer_movement`,
`text_inserted_at_once` and `text_without_keystrokes`, and the tests check
that.

Not covered: a person who reads the questions aloud to a voice assistant or
photographs the screen and retypes the answers, and an AI agent that operates
the participant's own browser through the screen. For those, the timing, the
window-leaving counts and the content of the open responses are the evidence.
Prolific's own authenticity checks work only with Qualtrics, Gorilla and
Prolific's task builder, not with a site like this one.

## Data

One CSV per participant who finishes, uploaded through DataPipe to the storage connected to
the DataPipe experiment (a Google Drive folder) when the participant clicks the
button on the debrief screen. The file is named after `subject_id`, a random ID
(`p_…` for Prolific participants, `test_…` for testing-mode runs and visits
without a Prolific ID); the Prolific ID is the column `prolific_pid` inside the
file, not part of the name. If DataPipe cannot be reached, the upload is tried
up to `DATAPIPE.save_attempts` times (`save_attempts` in the data is set when a
retry was needed). If the data still cannot be stored, or DataPipe refuses
them, the participant gets a page with a download button and the way back to
Prolific. Without DataPipe (`?nopipe=1`, or `DATAPIPE.enabled: false`) the
debrief screen offers the file as a download. A participant who quits
part-way leaves a `….partial.json` file instead (see *Unfinished sessions* under
*DataPipe and Prolific*).

**Every answer is a participant-level column** named after the item's `id` in
`content.js` (for example `complexity_overall`, `trust_tell`, `pred_heat`,
`obs_heat`, `open_decrease`), so the **last row of the file holds the complete
record**. Scales are stored as 1–5, multiple choice as the option text, open
responses as text. Multiple-choice questions with a right answer also get
`<id>_correct`. A question that was not asked in the participant's condition or
mode has no value.

Other participant-level columns: `subject_id`, `prolific_pid`, `study_id`,
`session_id`, `mode`, `condition_index`, `condition_source`,
`assignment_counter`, `top_up`, `cond` (1–8),
`order`, `complexity`, `anomaly`, `goal_relevance`, `evidence_figure`,
`surprise_text` (`shown` / `hidden` / `not_applicable`), `stage_order`,
`ai_tool_use` (`Yes` / `No`), `general_feedback`, `completion_status`, `start_time`, `completion_time`,
`total_time_ms`, `debug_mode`, `nofs_mode`, `automation_allowed`, `datapipe`
(`main`, `test` or `off`), `datapipe_stream`, `safeguards`, the screen times
`rt_<screen>` (see *Timing* below), the integrity counters above and the
columns of *AI safeguards*. The random orders that were drawn are recorded in
`order_planet_blocks` (for example `planet_understanding,planet_complexity`),
`order_final_blocks` (for example `trust,complexity,utility`),
`order_agree_statements` (evidence-first conditions),
`order_relevance` (pilot mode), `organism_question` (pilot mode; the id of
the part 3 organism question that was shown) and `team_goal_option_order` (the options as
displayed, separated by ` | `). `response_index` and `<id>_correct` always refer
to the option's position in the script, not on the screen.

Row-level detail, by `task`:

| `task` | columns |
|---|---|
| `welcome`, `general_feedback` | `rt`; `general_feedback` (the last screen) also has `response` (the comments) and `responses` (the AI-tool question, in the same form as on a question screen) |
| `instructions` | `n_words`, `lock_seconds`, `rt` |
| `scenario` | one row per scenario page: `stage_index`, `stage`, `scenario_page`, `n_scenario_pages`, `layout`, `figure`, `figure_width_px` (displayed width), `compact_text`, `needed_scrolling`, `viewport_width`, `viewport_height`, `n_words`, `lock_seconds`, `rt` (reading time, ms) |
| `questions` | `stage_index`, `stage`, `page`, `page_index`, `item_ids`, `rt`, and `responses`: JSON with one entry per item (`id`, `use`, `type`, `measure`, `response`, `response_index`, `correct`, `position`, `option_order`, `first_ms`, `last_ms`, `n_changes`, and for open responses `typing`) |
| `consent` | `consented`, `fullscreen_ok`, `consent_pdf_saves` |
| `test_back` | testing mode only: a Back or Change settings press (`from_task`, or `to: "setup"`) |
| `test_setup` | testing mode only: `test_cond`, `test_figure`, `test_surprise`, `test_organism_question`, `test_mode`, `test_locks`, `test_safeguards` |
| `debrief` | `rt` (until the participant clicks the button that saves the data) |

**Timing.** Every screen a participant sees has a row with:

- `rt`: milliseconds from the screen appearing to the click that leaves it;
- `screen`: the screen's name: `welcome`, `consent`, `instructions`,
  `scenario_<stage>_<page>` (for example `scenario_explanation1_2`),
  `questions_<screen key>` (for example `questions_trust`; the key is the `page`
  of the items in `content.js`), `comments`, `debrief` (and `setup` in testing mode);
- `screen_hidden_ms` and `screen_blur_count`: how much of `rt` the tab was
  hidden, and how often the window lost focus during it, so that a long time can
  be told apart from a participant who was away;
- `screen_pointer_moves`, `screen_clicks`, `screen_keys`: mouse movements,
  clicks and key presses during the screen (see *AI safeguards*);
- `time_elapsed` (added by jsPsych): milliseconds from the start of the
  experiment to the end of that screen.

The same `rt` is also written to a participant-level column **`rt_<screen>`**
(for example `rt_scenario_planet_1`, `rt_questions_prediction`, `rt_comments`, `rt_debrief`),
so the last row holds every screen time next to the answers. Within a question
screen, each item's entry in `responses` has `first_ms` and `last_ms`, the time
from the screen appearing to the first and to the last answer given to that item
(for an open response, the first and last keystroke), and `n_changes`.
`total_time_ms` is the time from the page loading to the final comments being
sent, and `start_time` / `completion_time` are the clock times.

Not timed: the short "Loading…" screen while the pictures preload (its length
shows in `time_elapsed`), and the upload itself, which happens after the last
row is written. `npm run test:walk` checks that every screen has its `rt`, its
`rt_<screen>` column and its away time, and that every item has its answer
times.

Predictions (`pred_heat`, `pred_color`) are asked after part 3 in the
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
  memory questions, a filled column for every randomization, a time for every
  screen and every answer, and no page errors. It also reports any scenario page
  that needed scrolling.
  `node dev/walk.cjs --shots 3` also saves a screenshot of every screen of
  condition 3 to `dev/shots/`.
- `test:integrity` uses the page as a participant gets it, with real clicks:
  saving the consent PDF, fullscreen on consent and the overlay on leaving it,
  read-locks and that their length follows the word count, the cover on
  screenshot keys and on an inactive window, the empty printout, that text and
  picture fit the window, Continue
  locked until every item is answered, the open-response minimum, blocked
  selection and copy, the viewport lock and the mobile block. It also checks that
  testing mode has all of these off unless they are switched on, and that its
  settings bar, Back (with answers refilled) and Change settings work, and it
  checks the AI safeguards: an automated browser is turned away, a scripted
  click is ignored, the hidden note and field cannot be seen, and an answer
  with the hidden word, a filled hidden field and text that was not typed are
  flagged while text typed at a human pace is not. It takes about two minutes,
  because it waits out the read-locks.

- `test:datapipe` runs the whole study eight times with stand-ins for DataPipe
  and Prolific (the browser's requests to both are answered by the test, in the
  way their documentation describes), so it needs no account and writes no
  data. It checks the counter request and the cell it maps to, the uploaded
  file (name, format, Prolific IDs, assignment, every screen time), the return
  to Prolific with the completion code, the retry of an upload that did not
  arrive, the download page when DataPipe refuses the data, the random fallback
  when the counter is switched off, that `nopipe=1` contacts nothing, that
  nothing is sent before consent, and that a staging database that cannot be
  reached does not hold up the end of the study.

Set `BASE_URL` to test another address (for example the built site under
`npm run preview`), and `CHROME_PATH` to use an existing Chrome.

## DataPipe and Prolific

This follows DataPipe's documentation after its September 2026 update
(<https://pipe.jspsych.org/docs>) and Prolific's help centre
(<https://researcher-help.prolific.com>, articles dated May to September 2026).

**How it is wired.** The experiment uses DataPipe's client library,
`datapipe-client` (version pinned in `package.json`), which is also what
DataPipe's jsPsych extension is built on. The extension itself is not used
because it starts sending data when the page opens, before consent.

1. Nothing is sent to DataPipe before consent.
2. On consent, the experiment asks DataPipe for the next condition number and
   opens a "save as you go" session. From then on every finished screen is also
   sent to DataPipe's staging database (the welcome and consent screens are
   sent at that moment too).
3. When the participant leaves the debrief screen, the whole CSV is uploaded.
   DataPipe then discards the staged copy. Only after DataPipe has answered is
   a Prolific participant sent to
   `https://app.prolific.com/submissions/complete?cc=<code>`.
4. A participant who quits part-way leaves no CSV. About 10 minutes after their
   connection drops, DataPipe turns the staged screens into a file named
   `<file name>-<id>.partial.json` in the same folder (it can take another
   quarter of an hour to appear).

If the staging database cannot be reached (some networks block it), the study
runs and saves as usual; only the partial-file safety net is missing for that
participant.

### 1. The two DataPipe experiments

`src/config.js` names two DataPipe experiments:

| | DataPipe experiment | used by |
|---|---|---|
| `DATAPIPE.experiment_id` | `explanation_revision_pilot1` (ID `F7nDc8pPAps9`) | participants: every visit without `debug=1` |
| `DATAPIPE.test_experiment_id` | `explanation_revision_pilot1_test` (ID `cWTS1xxWbYg7`) | every run in testing mode (`debug=1`) |

So a testing-mode run never writes into the participants' folder and never
uses up one of their counter values. The column `datapipe` in the data says
which one a run used (`main`, `test` or `off`).

What each experiment's page on DataPipe should show:

| setting | test experiment | real experiment |
|---|---|---|
| Accept new data | on | on from the preview run until collection ends, then off |
| Accept base64 file uploads | off | off |
| Assign conditions in sequence | on, **32** conditions | on, **32** conditions |
| Stop after a set number of sessions | off | on, well above the Prolific places (for example 130 for 96) |
| Check submissions before storing them (validation) | on; Allow CSV and Allow JSON ticked; required field `trial_type` | the same |
| Generate Psych-DS metadata | off | off, unless you want that layout; it locks when the first file arrives |

Notes on these settings:

- **32 conditions** is the number of assignment cells (8 conditions × 2 figure
  versions × 2 surprise-text settings). The field starts at a smaller number;
  type 32 in. Never change it during collection.
- **The session limit counts finished participants only.** Partial files do
  not count. A participant who finishes after the limit is refused and gets
  the download page, so keep it above the number of Prolific places.
- **Validation** only checks that a finished file is well-formed and has a
  `trial_type` column, which every file from this experiment has. Partial
  files skip validation.
- **A counter cannot be reset.** Every participant-view visit that passes the
  consent page uses up one number of the real experiment for good.

### 2. Test in testing mode

1. Open the testing address (`…/pilot1_vignette1/?debug=1`), leave Condition on
   Random, press Start and go through the study (`__autoplay()` in the browser
   console does it in a few seconds). The bar under the progress bar shows
   `DataPipe test experiment`.
2. In the **test** experiment's Drive folder a file `test_….csv` should
   appear, and its dashboard should count one more completed session. In the
   file's last row, `condition_source` is `datapipe`, `datapipe` is `test`,
   and `assignment_counter` goes up by one from run to run.
3. Start another run, stop after a few screens and close the tab. Within about
   half an hour a `test_….partial.json` file should appear in the same folder.
   While you wait, the dashboard lists the session under *Sessions in
   progress*, first as *Connection lost*, then as *Stopped, being recovered*.
4. Switch *Accept new data* off on the test experiment and finish a run: you
   should get the "Your responses could not be saved" page with its download
   button. Switch it on again.

Add `&nopipe=1` to a testing address when a run should send nothing at all.

### 3. Set up the Prolific study

- **Study details.** Mark the study as desktop only and say so in the
  description; say there too that AI tools must not be used. Prolific shows
  the device setting to participants but does not enforce it; the experiment
  itself turns phones and tablets away. The study name may not contain the
  word "Prolific".
- **Data collection, study URL.** Choose the external study link, select
  *I'll use URL parameters*, and use
  `https://kefangpsych.github.io/explanation_revision_experiments/pilot1_vignette1/?PROLIFIC_PID={{%PROLIFIC_PID%}}&STUDY_ID={{%STUDY_ID%}}&SESSION_ID={{%SESSION_ID%}}`.
  Prolific adds these parameters itself when the option is selected; keep the
  three default names, which are the ones the experiment reads.
- **Completion paths.** Choose *I'll redirect them using a URL*, and copy the
  code from the completion URL that Prolific shows into
  `PROLIFIC.completion_code`. Choose *manually review* rather than *approve and
  pay*, so that you can check each data file first. The code is unique to each
  study, so a later study (the main study, or a duplicate) needs its own.
- **Recruit participants.** 96 places give three full rounds of the 32 cells
  (12 per condition); 100 give 12 or 13 per condition. Standard sample, one
  submission per participant. To keep pilot participants out of a later study,
  use the *Exclude participants from other studies* filter there (both studies
  must be in the same project).
- Save the study as a draft. Do not publish yet.

### 4. Go live

1. In `src/config.js`: put the Prolific completion code in
   `PROLIFIC.completion_code`, set `CONFIG.mode` (`"pilot"` or `"main"`), and
   set `CONFIG.allow_dev_flags` to `false`. Testing mode then no longer exists
   on the site, so nobody can use it to skip the read-locks and safeguards.
2. Push, and wait for the site to republish (the *Actions* tab on GitHub shows
   a green tick after about a minute).
3. On the real DataPipe experiment, check the settings in the table above and
   switch on the session limit.
4. **Preview once from Prolific**, from start to finish, in an ordinary
   browser window. Check that a `p_….csv` file arrives in the real folder with
   your Prolific ID inside, and that you end up back on Prolific with the
   submission marked complete. This run uses up counter value 0 and counts as
   one session; delete the file afterwards (step 5 then tops up that cell).
5. Publish the study. Do not push to `main` until collection is over: every
   push republishes the site.

While it runs, the real experiment's DataPipe dashboard shows the completed
sessions and the sessions in progress.

### 5. Keep the conditions balanced

DataPipe hands out the 32 cells in a fixed order and moves on as soon as a
participant asks, whether or not that participant finishes. Prolific replaces
people who return the study or time out, and the replacement gets the next
number. So the participants who *start* are exactly balanced, and the
participants who *finish* are slightly uneven, by about as many as dropped out.

To even them out afterwards, download the data folder and run

```bash
npm run cells -- path/to/the/data/folder
```

It counts the completed participants per condition and per cell (leaving out
test runs, unfinished files, and a second file from the same Prolific ID) and
prints a line such as `top_up_cells: [3, 17, 30]`. Paste it into `ASSIGNMENT`
in `src/config.js`, push, and add that many places to the Prolific study. The
counter then runs through only those cells. Set it back to `null` afterwards.
Leave DataPipe's number of conditions at 32 for a top-up. A top-up batch has
dropouts too, so run the count once more at the end.

The same command summarizes the partial files: how many participants quit, and
the last screen each one finished.

### 6. Afterwards

- Switch *Accept new data* and *Assign conditions in sequence* off on DataPipe.
  Anyone who reads the site's code can see the experiment ID, and the ID is all
  it takes to send a file. The switches, the session limit and validation are
  what keep stray files out.
- The files contain Prolific IDs (`prolific_pid`, `study_id`, `session_id`).
  Keep the Drive folder private and remove these columns before sharing data.

### Unfinished sessions (partial files)

`DATAPIPE.stream: true` is what keeps the screens of participants who quit.
Things to know about the partial files:

- They are JSON, a list with one entry per screen that reached DataPipe, each
  with the same columns as a row of the CSV at that moment. The condition and
  the Prolific IDs are in every entry, because sending starts after consent
  and assignment.
- They hold data from people who left, some of whom meant to withdraw. The
  protocol has to allow keeping it; Prolific counts returning a study as one
  way of withdrawing consent. To stop collecting them, set
  `DATAPIPE.stream: false`.
- A participant whose connection drops for less than 10 minutes and who then
  carries on leaves no partial file.
- A screen whose row is larger than 16 KiB (a very long open response) is
  missing from a partial file. Finished files are not affected.
- They do not count toward the session limit or toward a cell.

## Before collecting data

- `STUDY.minutes` (15) and `STUDY.payment` ($6.30) in `src/config.js` fill the
  duration and payment into the welcome text, the consent form and the consent
  PDF. If they change, change the script too; `check:script` compares the
  filled-in text. Check the consent form against the approved protocol; it
  mentions attention checks, and the experiment currently has none.
- Follow *DataPipe and Prolific* above (experiment ID, completion code,
  `CONFIG.mode`, `CONFIG.allow_dev_flags`).
- Each picture is 1.3–2 MB (about 9 MB per participant); they are preloaded
  before the scenario starts. Compressing the PNGs would shorten that wait.
