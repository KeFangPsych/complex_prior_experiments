/**
 * dev/check_script.mjs — verifies src/content.js and src/config.js against the
 * vignette script.
 *
 *   npm run check:script
 *
 * For every condition (1-8), both settings of the surprise text and both figure
 * versions, it checks that
 *   - the scenario of each stage is, page by page and in order, exactly the
 *     narration and messages (with their sender labels) of the matching script
 *     section (underlined text kept or removed, "Page break" lines honoured);
 *   - the figure file is the one the script names, and exists in the image folder;
 *   - the questions are, in order, exactly the rows of the script's question table
 *     that apply to the condition: same text, scale / options, measure label and
 *     Main / Pilot tag;
 *   - the "Presentation order" notes (what is randomized) are the same.
 * It also checks the welcome, consent, instruction, final-comment and debrief
 * text against the script, the assignment cells, that the randomization does
 * what the notes say, and the script's "Randomization and timing" summary: its
 * table lists exactly what content.js randomizes, with the data columns, and its
 * read-lock sentence states the numbers of config.js. Exits with code 1 on any mismatch.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCK_EXTRA, CONDITIONS, STAGE_SEQUENCE, N_CELLS, assignmentCells, cellFromCounter, assignmentFromIndex, indexFromAssignment, scenario, pageParagraphs, questions, questionPages, randomizePages, orderNotes, scriptText, RANDOMIZATIONS } from "../src/content.js";
import { CONFIG, WELCOME, CONSENT, INSTRUCTIONS, FEEDBACK_PROMPT, DEBRIEF, fillStudyValues } from "../src/config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(here, "../../complex_prior_pilot1_vignette1_script.md");
const IMAGES = path.join(here, "../../complex_prior_pilot1_vignette1_images");

const unescape = (s) => s.replace(/\\([_=()*.\-#])/g, "$1");
const md = fs.readFileSync(SCRIPT, "utf8").split("\n");

// ---- split the script into "## " sections and "### " subsections ----
const sections = [];
let sec = null, sub = null;
for (const line of md) {
  if (line.startsWith("## ")) { sec = { title: unescape(line.replace(/[#*]/g, "").trim()), intro: [], subs: [] }; sections.push(sec); sub = null; }
  else if (line.startsWith("### ")) { sub = { title: unescape(line.replace(/[#*]/g, "").trim()), lines: [] }; sec.subs.push(sub); }
  else if (sec) (sub ? sub.lines : sec.intro).push(line);
}
const section = (re) => {
  const hits = sections.filter((s) => re.test(s.title));
  if (hits.length !== 1) throw new Error(`Expected one script section matching ${re}, found ${hits.length}`);
  return hits[0];
};
const condsIn = (title) => {
  const m = title.match(/\bcond ([\d, ]+)/);
  return m ? m[1].split(",").map((x) => parseInt(x)) : null;
};

// ---- pages of a block of lines: narration and messages in reading order, plus the figure ----
// A message is a block quote whose first line is its bold sender label; one
// labelled "Lab report" is a report. A quoted line starting with "* " is a bullet.
// `complexity` ("low" | "high") picks the word of a "[simple / complex]" alternative.
function parseBlock(lines, surpriseText, complexity) {
  const newPage = () => ({ blocks: [], figures: [], figureInReport: false });
  const pages = [newPage()];
  let quote = null;                                   // the message being read
  const clean = (line) => {
    const s = surpriseText ? line.replace(/<\/?ins>/g, "") : line.replace(/<ins>.*?<\/ins>/g, "");
    const picked = s.replace(/\[([^\]\/]+) \/ ([^\]\/]+)\]/g, (_, low, high) => (complexity === "low" ? low : high));
    return unescape(picked).replace(/\s+/g, " ").replace(/ \./g, ".").trim();
  };
  for (const raw of lines) {
    const line = raw.trim();
    const page = pages[pages.length - 1];
    if (line.startsWith(">")) {
      const text = line.replace(/^>\s?/, "").trim();
      if (!text) continue;
      if (text.startsWith("*Figure:")) {              // a picture inside the lab report
        page.figures.push(...unescape(text).match(/vignette1_[A-Za-z0-9_]+(?:\.png)?/g));
        page.figureInReport = quote && quote.kind === "report";
        continue;
      }
      if (!quote) {
        const label = text.match(/^\*\*(.+)\*\*$/);
        const name = label ? unescape(label[1]) : null;
        quote = { kind: name && name.startsWith("Lab report") ? "report" : "message", label: name, paragraphs: label ? [] : [clean(text)] };
        page.blocks.push(quote);
      } else quote.paragraphs.push(clean(text));
      continue;
    }
    if (!line) continue;                              // a blank line does not end a message; any other line does
    quote = null;
    if (line.startsWith("|") || line.startsWith("* ")) continue;
    if (/^\*Page break\*$/i.test(line)) { pages.push(newPage()); continue; }
    if (line.startsWith("*Figure:")) {
      page.figures.push(...unescape(line).match(/vignette1_[A-Za-z0-9_]+(?:\.png)?/g));
      continue;
    }
    if (/^\*[^*\s].*[^*]\*$/.test(line)) continue;    // an italic note for researchers
    const last = page.blocks[page.blocks.length - 1];
    if (last && last.kind === "narration") last.paragraphs.push(clean(line));
    else page.blocks.push({ kind: "narration", paragraphs: [clean(line)] });
  }
  return pages;
}

// ---- question rows and presentation-order notes of a section ----
function parseQuestions(sec, cond) {
  const rows = [], notes = [];
  sec.subs.filter((s) => /questions/i.test(s.title)).forEach((s) => s.lines.forEach((line) => {
    if (line.startsWith("* ")) { notes.push(unescape(line.slice(2).trim())); return; }
    const m = line.match(/^\| (Main|Pilot|Alternative) \| (.*?) \| (.*) \|$/);
    if (!m) return;
    const label = unescape(m[2]);
    const conds = condsIn(label);
    if (conds && !conds.includes(cond)) return;
    rows.push({ use: m[1].toLowerCase(), measure: label.replace(/ \(cond [^)]*\)/, ""), text: unescape(m[3]) });
  }));
  return { rows, notes };
}

const SECTION_FOR = {
  planet: () => /^Stage 1:/,
  complexity: () => /^Stage 2:/,
  explanation1: () => /^Stage 3:/,
  evidence: (c) => (c.order === "evidence_first" ? /^Stage 4, evidence-first/ : /^Stage 5, elaboration-first/),
  elaboration: (c) => (c.order === "evidence_first" ? /^Stage 5, evidence-first/ : /^Stage 4, elaboration-first/),
};

const errors = [];
let checked = 0;
const fail = (where, msg) => errors.push(`${where}: ${msg}`);
const same = (where, what, got, want) => {
  checked++;
  if (got !== want) fail(where, `${what}\n     experiment: ${JSON.stringify(got)}\n     script:     ${JSON.stringify(want)}`);
};
const newEmptyPage = { blocks: [], figures: [], figureInReport: false };
const sameList = (where, what, got, want) => {
  same(where, `number of ${what}`, got.length, want.length);
  got.forEach((g, k) => same(where, `${what} ${k + 1}`, g, want[k]));
};

// ============================================================================
// 1. Text around the scenario (welcome, consent, instructions, comments, debrief)
// ============================================================================
// non-empty lines of a section, without italic researcher notes (*...*; a bullet "* ..." is not one)
const plainLines = (re) => section(re).intro.map((l) => l.trim()).filter((l) => l && !/^\*[^*\s].*[^*]\*$/.test(l)).map(unescape);
// (the script shows the duration and the payment filled in, as participants see them)
sameList("welcome screen", "lines", [`**${WELCOME.title}**`, ...WELCOME.paragraphs.map(fillStudyValues)], plainLines(/^Welcome screen/));
sameList("informed consent", "lines", [`**${CONSENT.title}**`, ...CONSENT.sections.map((s) => `**${s.label}:** ${fillStudyValues(s.text)}`)], plainLines(/^Informed consent/));
if (/\bXX\b|\$X\b/.test(JSON.stringify([WELCOME, CONSENT].map((x) => JSON.parse(fillStudyValues(JSON.stringify(x))))))) fail("study values", "a duration or payment placeholder is not filled in");
sameList("instructions", "lines", [`**${INSTRUCTIONS.title}**`, ...INSTRUCTIONS.bullets.map((b) => `* ${b}`)], plainLines(/^Instructions/));
sameList("final comments", "lines", [`${FEEDBACK_PROMPT} (Open response, optional)`], plainLines(/^Final comments/));
sameList("debrief", "lines", [`**${DEBRIEF.title}**`, ...DEBRIEF.paragraphs], plainLines(/^Debrief/));
// the scales in the script are 5-point: no anchor above 5
if (md.some((l) => /^\| (Main|Pilot|Alternative) \|/.test(l) && /; [6-9] \\= /.test(l))) fail("scales", "the script has a scale anchor above 5");
// the word "story" is not shown to participants
const shown = JSON.stringify([WELCOME, CONSENT, INSTRUCTIONS, FEEDBACK_PROMPT, DEBRIEF]);
if (/\bstor(y|ies)\b/i.test(shown)) fail("text around the scenario", 'contains the word "story"');

// ============================================================================
// 2. Scenario and questions, per condition
// ============================================================================
for (const cond of Object.keys(CONDITIONS).map(Number)) {
  const c = CONDITIONS[cond];
  STAGE_SEQUENCE[c.order].forEach((stage, i) => {
    const sec = section(SECTION_FOR[stage](c));
    const stageNo = parseInt(sec.title.match(/^Stage (\d)/)[1]);
    if (stageNo !== i + 1) fail(`cond ${cond} ${stage}`, `is stage ${i + 1} in the experiment but stage ${stageNo} in the script`);
    // the condition-specific subsection (if any) follows the common intro
    const condSubs = sec.subs.filter((s) => { const cs = condsIn(s.title); return cs && cs.includes(cond) && !/questions|measurements/i.test(s.title); });
    if (condSubs.length > 1) fail(`cond ${cond} ${stage}`, "more than one condition subsection matches");
    const lines = [...sec.intro, ...(condSubs[0] ? condSubs[0].lines : [])];

    for (const surpriseText of [true, false]) for (const figureVersion of ["table", "line"]) {
      const where = `cond ${cond}, ${stage}, surprise text ${surpriseText ? "shown" : "hidden"}, ${figureVersion} figure`;
      const want = parseBlock(lines, surpriseText, c.complexity);
      const got = scenario(stage, cond, { surpriseText, figureVersion }).pages;
      same(where, "number of pages", got.length, want.length);
      got.forEach((pg, n) => {
        const w = want[n] || newEmptyPage;
        const at = `${where}, page ${n + 1}`;
        same(at, "number of blocks", pg.blocks.length, w.blocks.length);
        pg.blocks.forEach((b, k) => {
          const wb = w.blocks[k] || { paragraphs: [] };
          same(at, `block ${k + 1} kind`, b.kind, wb.kind);
          if (b.kind !== "narration") same(at, `block ${k + 1} label`, b.label, wb.label);
          sameList(`${at}, block ${k + 1}`, "paragraphs", b.paragraphs, wb.paragraphs);
        });
        // figure: the script names none, one file, or two versions (table first, line second)
        const wantFig = w.figures.length === 2 ? w.figures[figureVersion === "line" ? 1 : 0] : w.figures[0] || null;
        same(at, "figure", pg.figure, wantFig);
        same(at, "figure inside the lab report", pg.figureInReport, !!w.figureInReport);
        if (pg.figure && !fs.existsSync(path.join(IMAGES, pg.figure))) fail(where, `image file not found: ${pg.figure}`);
        if ((pg.layout === "text") !== !pg.figure) fail(where, `page ${n + 1}: layout "${pg.layout}" does not fit ${pg.figure ? "a page with" : "a page without"} a figure`);
        if (/\bstor(y|ies)\b/i.test(pageParagraphs(pg).join(" "))) fail(where, 'contains the word "story"');
      });
    }

    // questions
    const where = `cond ${cond}, ${stage} questions`;
    const want = parseQuestions(sec, cond);
    const got = questions(stage, cond);
    same(where, "number of questions", got.length, want.rows.length);
    got.forEach((q, k) => {
      const w = want.rows[k] || {};
      same(where, `question ${k + 1} (${q.id}) text`, scriptText(q), w.text);
      same(where, `question ${k + 1} (${q.id}) Main/Pilot`, q.use, w.use);
      same(where, `question ${k + 1} (${q.id}) measure`, q.measure, w.measure);
      if (q.type === "choice" && q.correct !== null && !(q.correct >= 0 && q.correct < q.options.length)) fail(where, `${q.id}: correct index out of range`);
    });
    sameList(where, "presentation-order notes", orderNotes(stage, cond), want.notes);
    // every randomization flag in content.js is covered by a note, and vice versa
    const flagged = got.some((q) => q.pageShuffle || q.itemShuffle || q.shuffleOptions || q.pickOne);
    if (flagged !== orderNotes(stage, cond).length > 0) fail(where, "randomization flags and presentation-order notes do not agree");
    // alternatives are documented but never asked; main mode keeps exactly the Main rows
    const pilotIds = questionPages(stage, cond, "pilot").flatMap((p) => p.items.map((q) => q.id));
    same(where, "questions asked in pilot mode", pilotIds.length, want.rows.filter((w) => w.use !== "alternative").length);
    const mainIds = questionPages(stage, cond, "main").flatMap((p) => p.items.map((q) => q.id));
    same(where, "Main-only questions", mainIds.length, want.rows.filter((w) => w.use === "main").length);
  });
  const ids = STAGE_SEQUENCE[c.order].flatMap((s) => questions(s, cond).map((q) => q.id));
  const dup = ids.filter((id, k) => ids.indexOf(id) !== k);
  if (dup.length) fail(`cond ${cond}`, `duplicate question ids: ${dup.join(", ")}`);
}

// ============================================================================
// 3. Design table and assignment cells
// ============================================================================
md.filter((l) => /^\| \d \|/.test(l)).forEach((l) => {
  const [cond, order, complexity, evidence, ...stages] = l.split("|").slice(1, -1).map((x) => x.trim());
  const c = CONDITIONS[cond];
  const where = `design table, cond ${cond}`;
  same(where, "order", c.order, order.toLowerCase().replace(" ", "_"));
  same(where, "complexity", c.complexity, complexity.toLowerCase());
  same(where, "evidence", c.anomaly, evidence.toLowerCase());
  const label = { planet: "Common planet", complexity: `${c.complexity === "low" ? "LC" : "HC"} planet`, explanation1: "Explanation 1", evidence: `Evidence-${evidence}`, elaboration: "Explanation 2" };
  same(where, "stage order", STAGE_SEQUENCE[c.order].map((s) => label[s]).join(" > "), stages.join(" > "));
});

// the assignment cells cross condition x figure version x surprise text exactly once
const cells = Array.from({ length: N_CELLS }, (_, k) => assignmentFromIndex(k));
same("assignment cells", "distinct cells", new Set(cells.map((a) => `${a.cond}|${a.figureVersion}|${a.surpriseText}`)).size, 8 * 2 * 2);
same("assignment cells", "wrap-around", JSON.stringify(assignmentFromIndex(N_CELLS + 5)), JSON.stringify(assignmentFromIndex(5)));
cells.forEach((a, k) => {
  if (!CONDITIONS[a.cond]) fail("assignment cells", `cell ${k} has no condition`);
  same("assignment cells", `index of cell ${k}`, indexFromAssignment(a), k);
});

// the counter runs through all 32 cells in order, or through the cells of a top-up list
same("assignment cells", "all cells in order", assignmentCells(null).join(), Array.from({ length: N_CELLS }, (_, k) => k).join());
same("assignment cells", "counter beyond 31 wraps", cellFromCounter(37, assignmentCells(null)), 5);
same("assignment cells", "top-up list", [0, 1, 2, 3, 4, 5, 6].map((c) => cellFromCounter(c, assignmentCells([3, 3, 17]))).join(), "3,3,17,3,3,17,3");
same("assignment cells", "empty top-up list means all cells", assignmentCells([]).length, N_CELLS);

// ============================================================================
// 4. Randomization does what the notes say (2000 draws per case)
// ============================================================================
const N = 2000;
const tally = (fn) => { const t = {}; for (let n = 0; n < N; n++) { const k = fn(); t[k] = (t[k] || 0) + 1; } return t; };
const roughlyEven = (where, counts, nOutcomes) => {
  checked++;
  const keys = Object.keys(counts);
  if (keys.length !== nOutcomes) return fail(where, `expected ${nOutcomes} different orders, saw ${keys.length}`);
  const expected = N / nOutcomes;
  keys.forEach((k) => { if (Math.abs(counts[k] - expected) > 5 * Math.sqrt(expected)) fail(where, `order "${k}" drawn ${counts[k]} times, expected about ${expected}`); });
};
for (const mode of ["pilot", "main"]) {
  // stage 2: the two blocks swap, the order inside a block stays
  const canon = questionPages("complexity", 1, mode);
  roughlyEven(`randomization, stage 2 blocks (${mode})`, tally(() => {
    const r = randomizePages(canon);
    r.pages.forEach((p) => {
      const want = canon.find((x) => x.key === p.key).items.map((q) => q.id).join();
      if (p.items.map((q) => q.id).join() !== want) fail("randomization, stage 2", `order inside block ${p.key} changed`);
    });
    if (r.orders.order_planet_blocks !== r.pages.map((p) => p.key).join(",")) fail("randomization, stage 2", "recorded order differs from the order used");
    return r.orders.order_planet_blocks;
  }), 2);
  // stage 3: goal options shuffled with "I don't remember" last; relevance questions swap; nothing else moves
  const canon3 = questionPages("explanation1", 1, mode);
  const goalOrders = tally(() => {
    const r = randomizePages(canon3);
    const goal = r.pages.flatMap((p) => p.items).find((q) => q.id === "team_goal");
    if (goal.optionOrder[goal.optionOrder.length - 1] !== goal.options.length - 1) fail("randomization, goal options", '"I don\'t remember" is not last');
    if ([...goal.optionOrder].sort().join() !== goal.options.map((_, k) => k).join()) fail("randomization, goal options", "an option is missing or repeated");
    if (r.pages.map((p) => p.key).join() !== canon3.map((p) => p.key).join()) fail("randomization, stage 3", "the order of the screens changed");
    if (r.pages.some((p) => p.items.some((q) => q.use === "alternative"))) fail("randomization, stage 3", "an alternative question is asked");
    const fixed = (pages) => pages.flatMap((p) => p.items.map((q) => q.id)).filter((id) => !id.startsWith("relevance_") && !id.startsWith("organism_")).join();
    if (fixed(r.pages) !== fixed(canon3)) fail("randomization, stage 3", "a question other than the relevance pair moved");
    return goal.optionOrder.join("");
  });
  roughlyEven(`randomization, goal options (${mode})`, goalOrders, 24);
  if (mode === "pilot") {
    roughlyEven("randomization, relevance questions", tally(() => randomizePages(canon3).orders.order_relevance), 2);
    // exactly one of the two organism questions is shown, each about half the time, and the record matches
    const ORG = ["organism_complexity", "organism_more_to_know"];
    const shownOrg = (r) => r.pages.flatMap((p) => p.items).filter((q) => ORG.includes(q.id)).map((q) => q.id);
    roughlyEven("randomization, organism question", tally(() => {
      const r = randomizePages(canon3);
      const ids = shownOrg(r);
      if (ids.length !== 1) fail("randomization, organism question", `${ids.length} of the two questions shown`);
      if (r.orders.organism_question !== ids[0]) fail("randomization, organism question", "recorded value differs from what is shown");
      return ids[0];
    }), 2);
    for (const id of ORG) same("randomization, organism question", `fixed to ${id}`, shownOrg(randomizePages(canon3, Math.random, { organism_question: id })).join(), id);
  }
}
// end evaluations: the complexity, trust and utility blocks swap places; nothing else moves
for (const [cond, stage] of [[1, "elaboration"], [5, "evidence"]]) for (const mode of ["pilot", "main"]) {
  const canon = questionPages(stage, cond, mode);
  const blocks = ["complexity", "trust", "utility"];
  const where = `randomization, end evaluations (cond ${cond}, ${mode})`;
  roughlyEven(where, tally(() => {
    const r = randomizePages(canon);
    const keys = r.pages.map((p) => p.key);
    // (a screen key can occur twice in a stage, so other screens are compared by position)
    r.pages.forEach((p, k) => {
      const ref = blocks.includes(p.key) ? canon.find((x) => x.key === p.key) : canon[k];
      // (the two agree / disagree statements have their own random order, checked below)
      const ids = (pg) => (pg.key === "explanation2_agree" ? pg.items.map((q) => q.id).sort() : pg.items.map((q) => q.id)).join();
      if (ids(p) !== ids(ref)) fail(where, `order inside ${p.key} changed`);
    });
    // the three blocks stay in the same three places, and every other screen keeps its place
    canon.forEach((p, k) => { if (blocks.includes(p.key) ? !blocks.includes(keys[k]) : keys[k] !== p.key) fail(where, `screen ${k + 1} (${p.key}) moved`); });
    if (r.orders.order_final_blocks !== keys.filter((k) => blocks.includes(k)).join(",")) fail(where, "recorded order differs from the order used");
    return r.orders.order_final_blocks;
  }), 6);
}
// the two agree / disagree statements swap (evidence-first conditions); nothing else on that screen
for (const mode of ["pilot", "main"]) {
  const canon = questionPages("elaboration", 1, mode);
  roughlyEven(`randomization, agree statements (${mode})`, tally(() => {
    const r = randomizePages(canon);
    const pg = r.pages.find((p) => p.key === "explanation2_agree");
    if (pg.items.length !== 2) fail("randomization, agree statements", "the screen does not have exactly the two statements");
    if (r.orders.order_agree_statements !== pg.items.map((q) => q.id).join(",")) fail("randomization, agree statements", "recorded order differs from the order used");
    return r.orders.order_agree_statements;
  }), 2);
}
same("randomization, agree statements", "not asked when the elaboration comes first", questionPages("evidence", 5, "pilot").some((p) => p.key === "explanation2_agree"), false);
// no randomization anywhere else
for (const [cond, stage] of [[1, "planet"], [1, "evidence"], [5, "planet"], [5, "elaboration"]]) {
  const canon = questionPages(stage, cond, "pilot");
  const r = randomizePages(canon);
  same(`randomization, ${stage} (cond ${cond})`, "order", JSON.stringify(r.pages), JSON.stringify(canon));
  same(`randomization, ${stage} (cond ${cond})`, "recorded orders", Object.keys(r.orders).length, 0);
}

// ============================================================================
// 5. The script's "Randomization and timing" summary
// ============================================================================
{
  const where = "randomization and timing summary";
  const intro = section(/^Randomization and timing/).intro.map((l) => l.trim());
  const rows = intro.filter((l) => l.startsWith("|") && !/^\| (Randomized|:-)/.test(l)).map((l) => l.split("|").slice(1, -1).map((x) => unescape(x.trim())).join(" | "));
  sameList(where, "table rows", RANDOMIZATIONS.map((r) => [r.what, r.versions, r.appliesTo, r.columns.map((c) => `\`${c}\``).join(", ")].join(" | ")), rows);
  // every random order that randomizePages can draw has a row in the table, and the other way round
  const drawn = new Set();
  for (const cond of Object.keys(CONDITIONS).map(Number)) for (const mode of ["pilot", "main"]) {
    const keys = STAGE_SEQUENCE[CONDITIONS[cond].order].flatMap((s) => questionPages(s, cond, mode).map((p) => p.key));
    // (the data have a column rt_questions_<screen key>, so a key occurs once per participant)
    const twice = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (twice.length) fail(`cond ${cond} ${mode}`, `question screen key used twice: ${twice.join(", ")}`);
    for (let n = 0; n < 20; n++) STAGE_SEQUENCE[CONDITIONS[cond].order].forEach((s) => Object.keys(randomizePages(questionPages(s, cond, mode)).orders).forEach((k) => drawn.add(k)));
  }
  const ASSIGNED = ["cond", "order", "complexity", "anomaly", "evidence_figure", "surprise_text"];   // set by the assignment cell
  const listed = RANDOMIZATIONS.flatMap((r) => r.columns);
  same(where, "columns of the random orders", [...drawn].sort().join(), listed.filter((c) => !ASSIGNED.includes(c)).sort().join());
  same(where, "columns of the assignment", listed.filter((c) => ASSIGNED.includes(c)).sort().join(), [...ASSIGNED].sort().join());
  const lockLine = `Reading time: on each scenario page and on the instruction page, the Continue button stays locked for 1 second per ${CONFIG.read_lock_words_per_second} words of text, and for at least ${CONFIG.read_lock_min_seconds} seconds. Four pages have more to take in and stay locked for longer: the first page of Stage 3 (${LOCK_EXTRA.explanation1_intro} seconds more), Bioenergy's first message (${LOCK_EXTRA.explanation1_message} seconds more), the lab report (${LOCK_EXTRA.lab_report} seconds more) and the algae explanation (${LOCK_EXTRA.algae} seconds more).`;
  same(where, "read-lock sentence", intro.find((l) => l.startsWith("Reading time:")) || null, lockLine);
  // exactly those four kinds of page carry extra seconds
  for (const cond of Object.keys(CONDITIONS).map(Number)) {
    const extras = STAGE_SEQUENCE[CONDITIONS[cond].order].flatMap((s) => scenario(s, cond).pages.map((pg, n) => `${s} ${n + 1}: ${pg.lockExtra}`)).filter((x) => !x.endsWith(": 0"));
    const algaePage = CONDITIONS[cond].order === "evidence_first" ? 2 : 1;
    same(`${where}, cond ${cond}`, "pages with extra lock seconds", [...extras].sort().join("; "),
      [`explanation1 1: ${LOCK_EXTRA.explanation1_intro}`, `explanation1 2: ${LOCK_EXTRA.explanation1_message}`, `evidence 2: ${LOCK_EXTRA.lab_report}`, `elaboration ${algaePage}: ${LOCK_EXTRA.algae}`].sort().join("; "));
  }
  const openLine = `Open responses: each open-response question needs at least ${CONFIG.open_min_chars} characters. The final comments are optional.`;
  same(where, "open-response sentence", intro.find((l) => l.startsWith("Open responses:")) || null, openLine);
}

if (errors.length) {
  console.error(`check:script FAILED — ${errors.length} mismatch(es) in ${checked} comparisons\n`);
  errors.slice(0, 60).forEach((e) => console.error(" - " + e));
  if (errors.length > 60) console.error(` ... and ${errors.length - 60} more`);
  process.exit(1);
}
console.log(`check:script passed — ${checked} comparisons across ${Object.keys(CONDITIONS).length} conditions match the script.`);
