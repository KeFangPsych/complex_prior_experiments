/**
 * dev/walk.cjs — runs the experiment in headless Chromium with the in-page bot
 * and checks the data against src/content.js.
 *
 *   npm run dev                      # in another terminal (serves http://localhost:8765)
 *   node dev/walk.cjs                # all 8 conditions x pilot / main mode
 *   node dev/walk.cjs --shots 3      # also screenshot every screen of condition 3 into dev/shots/
 *
 * Needs Playwright (not a dependency of this project):
 *   npm i --no-save playwright && npx playwright install chromium
 * BASE_URL overrides the address; CHROME_PATH points at an existing Chrome / Chromium.
 *
 * For every run it checks: no page errors; the assignment columns; one story row
 * per stage in the script's order; exactly the questions content.js lists for the
 * condition and mode, each with an answer column; and that the check questions
 * are scored correct when the bot answers them correctly.
 */
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || "http://localhost:8765";
const args = process.argv.slice(2);
const shotCond = args.includes("--shots") ? parseInt(args[args.indexOf("--shots") + 1]) || 1 : null;
const shotDir = path.join(__dirname, "shots");

(async () => {
  const content = await import("../src/content.js");
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const problems = [];
  let runs = 0;

  async function run({ cond, mode, fig, surprise, checks = "correct", shots = false }) {
    const tag = `cond ${cond} ${mode} ${fig} ${surprise} checks=${checks}`;
    const bad = (msg) => problems.push(`${tag}: ${msg}`);
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: shots ? 2 : 1 });
    page.on("pageerror", (e) => bad("pageerror: " + e.message));
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") bad(`console ${m.type()}: ${m.text()}`); });
    if (shots) {
      fs.mkdirSync(shotDir, { recursive: true });
      await page.exposeFunction("__shot", async (label) => {
        await page.waitForTimeout(350);
        await page.screenshot({ path: path.join(shotDir, label.replace(/[^a-z0-9]+/gi, "_").slice(0, 70) + ".png"), fullPage: true });
      });
    }
    await page.goto(`${BASE}/?debug=1&nofs=1&cond=${cond}&mode=${mode}&fig=${fig}&surprise=${surprise}`);
    await page.waitForFunction(() => typeof window.__autoplay === "function" && document.querySelector("#card-btn"));
    const data = await page.evaluate((o) => window.__autoplay(o), { checks, shot: shots });
    await page.close();
    runs++;

    // ---- checks ----
    const c = content.CONDITIONS[cond];
    const last = data[data.length - 1];
    const stages = content.STAGE_SEQUENCE[c.order];
    const expect = (name, got, want) => { if (JSON.stringify(got) !== JSON.stringify(want)) bad(`${name}: got ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`); };
    expect("cond", last.cond, cond);
    expect("order", last.order, c.order);
    expect("complexity", last.complexity, c.complexity);
    expect("anomaly", last.anomaly, c.anomaly);
    expect("mode", last.mode, mode);
    expect("evidence_figure", last.evidence_figure, fig);
    expect("surprise_text", last.surprise_text, c.order === "evidence_first" ? surprise : "not_applicable");
    expect("completion_status", last.completion_status, "completed");

    const stories = data.filter((r) => r.task === "story");
    expect("story stages", stories.map((r) => r.stage), stages);
    stories.forEach((r) => expect(`figure of ${r.stage}`, r.figure, content.story(r.stage, cond, { figureVersion: fig }).figure));

    const wantPages = stages.flatMap((s) => content.questionPages(s, cond, mode).map((p) => ({ stage: s, key: p.key, ids: p.items.map((q) => q.id) })));
    const gotPages = data.filter((r) => r.task === "questions").map((r) => ({ stage: r.stage, key: r.page, ids: JSON.parse(r.item_ids) }));
    expect("question screens", gotPages, wantPages);

    const items = stages.flatMap((s) => content.questionPages(s, cond, mode).flatMap((p) => p.items));
    const answered = data.filter((r) => r.task === "questions").flatMap((r) => JSON.parse(r.responses));
    expect("answered ids", answered.map((a) => a.id), items.map((q) => q.id));
    items.forEach((q) => {
      const v = last[q.id];
      if (q.type === "likert" && !(Number.isInteger(v) && v >= 1 && v <= 7)) bad(`${q.id}: scale answer ${JSON.stringify(v)}`);
      if (q.type === "choice" && !q.options.includes(v)) bad(`${q.id}: choice answer ${JSON.stringify(v)}`);
      if (q.type === "open" && !(typeof v === "string" && v.length >= 10)) bad(`${q.id}: open answer ${JSON.stringify(v)}`);
      if (q.type === "choice" && q.correct !== null && checks !== "random") expect(`${q.id}_correct`, last[`${q.id}_correct`], checks === "correct");
    });
    // no answer column for a question that was not asked
    const all = new Set(Object.keys(content.CONDITIONS).flatMap((k) => content.STAGE_SEQUENCE[content.CONDITIONS[k].order].flatMap((s) => content.questions(s, Number(k)).map((q) => q.id))));
    const asked = new Set(items.map((q) => q.id));
    [...all].filter((id) => !asked.has(id) && id in last).forEach((id) => bad(`${id}: has a column but was not asked`));
    return { tag, rows: data.length, screens: stories.length + gotPages.length, questions: items.length };
  }

  const out = [];
  for (const cond of [1, 2, 3, 4, 5, 6, 7, 8]) {
    for (const mode of ["pilot", "main"]) {
      // alternate the two secondary factors so that every combination is exercised
      const fig = (cond + (mode === "main" ? 1 : 0)) % 2 ? "table" : "line";
      const surprise = Math.floor((cond - 1) / 2 + (mode === "main" ? 1 : 0)) % 2 ? "hidden" : "shown";
      out.push(await run({ cond, mode, fig, surprise }));
    }
  }
  out.push(await run({ cond: 1, mode: "pilot", fig: "table", surprise: "shown", checks: "wrong" }));
  if (shotCond) out.push(await run({ cond: shotCond, mode: "pilot", fig: "line", surprise: "shown", shots: true }));
  await browser.close();

  out.forEach((r) => console.log(`${r.tag}: ${r.rows} rows, ${r.screens} story/question screens, ${r.questions} questions`));
  if (problems.length) {
    console.error(`\nFAILED — ${problems.length} problem(s) in ${runs} runs`);
    problems.forEach((p) => console.error(" - " + p));
    process.exit(1);
  }
  console.log(`\nwalk passed — ${runs} runs, no problems.`);
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
