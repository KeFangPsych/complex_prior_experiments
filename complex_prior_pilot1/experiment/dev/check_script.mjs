/**
 * dev/check_script.mjs — verifies src/content.js against the vignette script.
 *
 *   npm run check:script
 *
 * For every condition (1-8), both settings of the surprise text and both figure
 * versions, it checks that
 *   - the story paragraphs of each stage are, in order, exactly the paragraphs of
 *     the matching script section (underlined text kept or removed);
 *   - the figure file is the one the script names, and exists in the image folder;
 *   - the questions are, in order, exactly the rows of the script's question table
 *     that apply to the condition: same text, scale / options, measure label and
 *     Main / Pilot tag.
 * Exits with code 1 on any mismatch.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONDITIONS, STAGE_SEQUENCE, N_CELLS, assignmentFromIndex, indexFromAssignment, story, questions, questionPages, scriptText } from "../src/content.js";

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

// ---- paragraphs and figure of a block of lines ----
function parseBlock(lines, surpriseText) {
  const paragraphs = [], figures = [];
  for (const raw of lines) {
    let line = raw.trim();
    if (!line || line.startsWith("|") || line.startsWith("* ")) continue;
    if (line.startsWith("*Figure:")) {
      figures.push(...unescape(line).match(/vignette1_[A-Za-z0-9_]+(?:\.png)?/g));
      continue;
    }
    line = surpriseText ? line.replace(/<\/?ins>/g, "") : line.replace(/<ins>.*?<\/ins>/g, "");
    paragraphs.push(unescape(line).replace(/\s+/g, " ").replace(/ \./g, ".").trim());
  }
  return { paragraphs, figures };
}

// ---- question rows of a section (the "... questions" subsection) ----
function parseQuestions(sec, cond) {
  const rows = [];
  sec.subs.filter((s) => /questions/i.test(s.title)).forEach((s) => s.lines.forEach((line) => {
    const m = line.match(/^\| (Main|Pilot) \| (.*?) \| (.*) \|$/);
    if (!m) return;
    const label = unescape(m[2]);
    const conds = condsIn(label);
    if (conds && !conds.includes(cond)) return;
    rows.push({ use: m[1].toLowerCase(), measure: label.replace(/ \(cond [^)]*\)/, ""), text: unescape(m[3]) });
  }));
  return rows;
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
      const want = parseBlock(lines, surpriseText);
      const got = story(stage, cond, { surpriseText, figureVersion });
      same(where, "number of paragraphs", got.paragraphs.length, want.paragraphs.length);
      got.paragraphs.forEach((p, k) => same(where, `paragraph ${k + 1}`, p, want.paragraphs[k]));
      // figure: the script names one file, or two versions (table first, line second)
      const wantFig = want.figures.length === 2 ? want.figures[figureVersion === "line" ? 1 : 0] : want.figures[0];
      same(where, "figure", got.figure, wantFig);
      if (!fs.existsSync(path.join(IMAGES, got.figure))) fail(where, `image file not found: ${got.figure}`);
    }

    // questions
    const where = `cond ${cond}, ${stage} questions`;
    const want = parseQuestions(sec, cond);
    const got = questions(stage, cond);
    same(where, "number of questions", got.length, want.length);
    got.forEach((q, k) => {
      const w = want[k] || {};
      same(where, `question ${k + 1} (${q.id}) text`, scriptText(q), w.text);
      same(where, `question ${k + 1} (${q.id}) Main/Pilot`, q.use, w.use);
      same(where, `question ${k + 1} (${q.id}) measure`, q.measure, w.measure);
      if (q.type === "choice" && q.correct !== null && !(q.correct >= 0 && q.correct < q.options.length)) fail(where, `${q.id}: correct index out of range`);
    });
    // main mode keeps exactly the Main rows; ids are unique within a condition
    const mainIds = questionPages(stage, cond, "main").flatMap((p) => p.items.map((q) => q.id));
    same(where, "Main-only questions", mainIds.length, want.filter((w) => w.use === "main").length);
  });
  const ids = STAGE_SEQUENCE[c.order].flatMap((s) => questions(s, cond).map((q) => q.id));
  const dup = ids.filter((id, k) => ids.indexOf(id) !== k);
  if (dup.length) fail(`cond ${cond}`, `duplicate question ids: ${dup.join(", ")}`);
}

// the design table of the script matches CONDITIONS
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

if (errors.length) {
  console.error(`check:script FAILED — ${errors.length} mismatch(es) in ${checked} comparisons\n`);
  errors.forEach((e) => console.error(" - " + e));
  process.exit(1);
}
console.log(`check:script passed — ${checked} comparisons across ${Object.keys(CONDITIONS).length} conditions match the script.`);
