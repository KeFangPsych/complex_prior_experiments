/**
 * dev/readability.mjs — readability report for everything participants read.
 *
 *   npm run readability
 *
 * Renders every distinct scenario page and question from src/content.js and the
 * text around the scenario from src/config.js, and prints for each: number of
 * words, average sentence length, Flesch Reading Ease (higher is easier; 60-70
 * is plain English, 70-80 fairly easy) and Flesch-Kincaid grade (US school
 * grade). It lists sentences of more than 25 words and the words of three or
 * more syllables, which are what the two formulas penalize.
 *
 * Syllables are counted with a spelling rule, so the scores are approximate
 * (about ±1 grade); they are meant for comparing pages and spotting hard spots.
 */
import { CONDITIONS, STAGE_SEQUENCE, scenario, pageParagraphs, questions, countWords } from "../src/content.js";
import { WELCOME, INSTRUCTIONS, FEEDBACK_PROMPT, DEBRIEF, CONSENT, fillStudyValues } from "../src/config.js";

const LONG_SENTENCE = 25;

function syllables(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|[^aeiouytd]ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}
const plain = (t) => t.replace(/\*\*/g, "").replace(/^\* /, "");
const wordsOf = (t) => plain(t).split(/\s+/).map((w) => w.replace(/^[^A-Za-z0-9$]+|[^A-Za-z0-9]+$/g, "")).filter(Boolean);
// sentences: split after . ? ! or : followed by a space and a capital, and at paragraph ends
const sentencesOf = (paragraphs) => paragraphs.flatMap((p) => plain(p).split(/(?<=[.?!])\s+(?=[A-Z"])/)).map((s) => s.trim()).filter((s) => /[A-Za-z]/.test(s));

function measure(paragraphs) {
  const sentences = sentencesOf(paragraphs);
  const words = paragraphs.flatMap(wordsOf);
  const syl = words.reduce((n, w) => n + syllables(w), 0);
  const wps = words.length / sentences.length, spw = syl / words.length;
  return {
    words: words.length, sentences: sentences.length, wps,
    ease: 206.835 - 1.015 * wps - 84.6 * spw,
    grade: 0.39 * wps + 11.8 * spw - 15.59,
    long: sentences.filter((s) => wordsOf(s).length > LONG_SENTENCE),
    hard: [...new Set(words.filter((w) => syllables(w) >= 3).map((w) => w.toLowerCase()))],
  };
}
const fmt = (m) => `${String(m.words).padStart(4)} words  ${m.wps.toFixed(1).padStart(5)} words/sentence  ease ${m.ease.toFixed(0).padStart(3)}  grade ${m.grade.toFixed(1).padStart(4)}`;

function report(title, paragraphs, { detail = true } = {}) {
  const m = measure(paragraphs);
  console.log(`${title}\n    ${fmt(m)}`);
  if (detail && m.hard.length) console.log(`    3+ syllables: ${m.hard.join(", ")}`);
  m.long.forEach((s) => console.log(`    LONG (${wordsOf(s).length} words): ${s}`));
  return m;
}

const all = [];
const keep = (m) => { all.push(m); return m; };

console.log("=== Text around the scenario ===");
keep(report("Welcome", WELCOME.paragraphs.map(fillStudyValues)));
keep(report("Instructions", INSTRUCTIONS.bullets));
keep(report("Final comments", [FEEDBACK_PROMPT]));
keep(report("Debrief", DEBRIEF.paragraphs));
report("Informed consent (protocol text, not counted in the overall score)", CONSENT.sections.map((s) => fillStudyValues(s.text)));

console.log("\n=== Scenario pages (each distinct page once) ===");
const seen = new Set();
for (const cond of Object.keys(CONDITIONS).map(Number)) {
  const c = CONDITIONS[cond];
  STAGE_SEQUENCE[c.order].forEach((stage, i) => scenario(stage, cond).pages.forEach((page, n) => {
    const paragraphs = pageParagraphs(page);
    const key = paragraphs.join("\n");
    if (seen.has(key)) return;
    seen.add(key);
    keep(report(`Part ${i + 1} (${stage}), page ${n + 1} — first in cond ${cond}: ${c.order.replace("_", " ")}, ${c.complexity} complexity, ${c.anomaly} anomaly`, paragraphs));
  }));
}

console.log("\n=== Questions (each distinct question once; prompt and answer labels) ===");
const seenQ = new Set();
const qRows = [];
for (const cond of Object.keys(CONDITIONS).map(Number)) {
  STAGE_SEQUENCE[CONDITIONS[cond].order].forEach((stage) => questions(stage, cond).filter((q) => q.use !== "alternative").forEach((q) => {
    if (seenQ.has(q.prompt)) return;
    seenQ.add(q.prompt);
    const m = measure([q.prompt]);
    qRows.push({ q, m });
  }));
}
qRows.sort((a, b) => b.m.grade - a.m.grade);
qRows.forEach(({ q, m }) => console.log(`  grade ${m.grade.toFixed(1).padStart(4)}  ${String(countWords(q.prompt)).padStart(2)} words  [${q.id}] ${plain(q.prompt)}`));
const qAll = measure(qRows.map(({ q }) => q.prompt));
console.log(`\n  All questions together: ${fmt(qAll)}`);

const total = measure([...seen].flatMap((k) => k.split("\n")));
console.log("\n=== Overall ===");
console.log(`  Scenario text:  ${fmt(total)}`);
console.log(`  Questions:      ${fmt(qAll)}`);
const hardest = all.slice().sort((a, b) => b.grade - a.grade)[0];
console.log(`  Hardest page: grade ${hardest.grade.toFixed(1)}; sentences over ${LONG_SENTENCE} words on scenario and surrounding pages: ${all.reduce((n, m) => n + m.long.length, 0)}`);
