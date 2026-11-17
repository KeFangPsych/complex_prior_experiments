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
 * For every run it checks: no page errors; the assignment columns; the scenario
 * pages in the script's order with the script's figures; exactly the questions
 * content.js lists for the condition and mode, each with an answer column, in the
 * script's order except where the script says it is random; that the recorded
 * random orders are the ones shown; that the check questions are scored
 * correct when the bot answers them correctly; that every randomization listed
 * in content.js (RANDOMIZATIONS) has its column; and that every screen has its
 * time, in its row (rt) and in the participant-level column rt_<screen>.
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
  const config = await import("../src/config.js");
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const problems = [];
  let runs = 0;
  const orders = { planet: new Set(), final: new Set(), goal: new Set(), relevance: new Set(), orgq: new Set(), agree: new Set() };   // randomized orders seen across runs
  const scrolled = new Set();                                                    // scenario pages that did not fit the window

  async function run({ cond, mode, fig, surprise, checks = "correct", shots = false, clickSetup = false, orgq = null }) {
    const tag = `cond ${cond} ${mode} ${fig} ${surprise} checks=${checks}${clickSetup ? " (chosen on the setup screen)" : ""}`;
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
    await page.goto(clickSetup ? `${BASE}/?debug=1&nofs=1&nopipe=1` : `${BASE}/?debug=1&nofs=1&nopipe=1&cond=${cond}&mode=${mode}&fig=${fig}&surprise=${surprise}`);
    await page.waitForFunction(() => typeof window.__autoplay === "function" && document.querySelector("#setup-start"));
    // either the URL flags prefill the test-setup screen, or the choices are clicked on it
    if (clickSetup) {
      for (const [group, value] of Object.entries({ cond, fig, surprise, mode, ...(orgq ? { orgq } : {}) })) {
        const opt = page.locator(`.setup-group[data-group="${group}"] .opt[data-value="${value}"]`);
        if (group === "surprise" && content.CONDITIONS[cond].order !== "evidence_first") {
          if (!(await page.locator('.setup-group[data-group="surprise"].disabled').count())) bad("surprise group is not disabled for an elaboration-first condition");
        } else await opt.click();
      }
    }
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
    expect("condition_source", last.condition_source, "test_setup");
    expect("condition_index", content.assignmentFromIndex(last.condition_index).cond, cond);

    // scenario screens: one row per page, in the script's order, with the script's figure
    const scenarios = data.filter((r) => r.task === "scenario");
    const wantScenario = stages.flatMap((s) => content.scenario(s, cond, { figureVersion: fig }).pages.map((p, n) => ({ stage: s, page: n + 1, figure: p.figure, layout: p.layout })));
    expect("scenario screens", scenarios.map((r) => ({ stage: r.stage, page: r.scenario_page, figure: r.figure, layout: r.layout })), wantScenario);
    scenarios.filter((r) => r.needed_scrolling).forEach((r) => scrolled.add(`${r.stage} p${r.scenario_page} (${r.figure})`));

    // question screens: the script's order, except where the script says the order is random
    // (in pilot mode, part 3 shows one of two organism questions, chosen at random)
    const ORG = ["organism_complexity", "organism_more_to_know"];
    const orgShown = last.organism_question;
    if (mode === "pilot") {
      if (!ORG.includes(orgShown)) bad(`organism_question is ${JSON.stringify(orgShown)}`);
      if (orgq && orgShown !== orgq) bad(`organism question: chose ${orgq} on the setup screen, got ${orgShown}`);
      orders.orgq.add(String(orgShown));
    } else if ("organism_question" in last) bad("organism_question recorded in main mode");
    const asked = (q) => !ORG.includes(q.id) || q.id === orgShown;
    const canon = stages.flatMap((s) => content.questionPages(s, cond, mode).map((p) => ({ stage: s, key: p.key, ids: p.items.filter(asked).map((q) => q.id) })));
    const gotPages = data.filter((r) => r.task === "questions").map((r) => ({ stage: r.stage, key: r.page, ids: JSON.parse(r.item_ids) }));
    // put the randomized parts back into script order before comparing: the two
    // planet blocks, the three end-evaluation blocks, and the relevance questions
    const GROUPS = [["planet_complexity", "planet_understanding"], ["complexity", "trust", "utility"]];
    const unshuffle = (pages) => {
      const out = pages.map((p) => ({ ...p, ids: p.key === "goal" ? ["team_goal", ...p.ids.filter((x) => x !== "team_goal").sort()] : p.key === "explanation2_agree" ? [...p.ids].sort() : p.ids }));
      GROUPS.forEach((group) => {
        const at = out.map((p, k) => (group.includes(p.key) ? k : -1)).filter((k) => k >= 0);
        const sorted = at.map((k) => out[k]).sort((a, b) => group.indexOf(a.key) - group.indexOf(b.key));
        at.forEach((k, n) => { out[k] = sorted[n]; });
      });
      return out;
    };
    expect("question screens", unshuffle(gotPages), unshuffle(canon));
    // the recorded orders are the orders that were shown
    expect("order_planet_blocks", last.order_planet_blocks, gotPages.filter((p) => p.key.startsWith("planet_")).map((p) => p.key).join(","));
    orders.planet.add(last.order_planet_blocks);
    expect("order_final_blocks", last.order_final_blocks, gotPages.filter((p) => GROUPS[1].includes(p.key)).map((p) => p.key).join(","));
    orders.final.add(last.order_final_blocks);
    const goalRow = data.filter((r) => r.task === "questions").flatMap((r) => JSON.parse(r.responses)).find((a) => a.id === "team_goal");
    const goalItem = content.questions("explanation1", cond).find((q) => q.id === "team_goal");
    expect("team_goal_option_order", last.team_goal_option_order, goalRow.option_order.map((k) => goalItem.options[k]).join(" | "));
    if (!last.team_goal_option_order.endsWith("I don't remember")) bad("team_goal: \"I don't remember\" is not the last option");
    orders.goal.add(last.team_goal_option_order);
    if (c.order === "evidence_first") {
      expect("order_agree_statements", last.order_agree_statements, gotPages.find((p) => p.key === "explanation2_agree").ids.join(","));
      orders.agree.add(last.order_agree_statements);
    } else if ("order_agree_statements" in last) bad("order_agree_statements recorded in an elaboration-first condition");
    if (mode === "pilot") {
      expect("order_relevance", last.order_relevance, gotPages.find((p) => p.key === "goal").ids.filter((x) => x !== "team_goal").join(","));
      orders.relevance.add(last.order_relevance);
    } else if ("order_relevance" in last) bad("order_relevance recorded in main mode");

    const items = stages.flatMap((s) => content.questionPages(s, cond, mode).flatMap((p) => p.items)).filter(asked);
    const answered = data.filter((r) => r.task === "questions").flatMap((r) => JSON.parse(r.responses));
    expect("answered ids", answered.map((a) => a.id).sort(), items.map((q) => q.id).sort());
    items.forEach((q) => {
      const v = last[q.id];
      if (q.type === "likert" && !(Number.isInteger(v) && v >= 1 && v <= content.SCALE_POINTS)) bad(`${q.id}: scale answer ${JSON.stringify(v)}`);
      if (q.type === "choice" && !q.options.includes(v)) bad(`${q.id}: choice answer ${JSON.stringify(v)}`);
      if (q.type === "open" && !(typeof v === "string" && v.length >= config.CONFIG.open_min_chars)) bad(`${q.id}: open answer ${JSON.stringify(v)}`);
      if (q.type === "choice" && q.correct !== null && checks !== "random") expect(`${q.id}_correct`, last[`${q.id}_correct`], checks === "correct");
    });
    // no answer column for a question that was not asked
    const all = new Set(Object.keys(content.CONDITIONS).flatMap((k) => content.STAGE_SEQUENCE[content.CONDITIONS[k].order].flatMap((s) => content.questions(s, Number(k)).map((q) => q.id))));
    const askedIds = new Set(items.map((q) => q.id));
    [...all].filter((id) => !askedIds.has(id) && id in last).forEach((id) => bad(`${id}: has a column but was not asked`));

    // every randomization has its column (pilot-only ones in pilot mode)
    content.RANDOMIZATIONS.forEach((r) => r.columns.forEach((col) => {
      const applies = r.appliesTo === "Pilot" ? mode === "pilot" : r.appliesTo === "Evidence-first conditions" ? c.order === "evidence_first" || col === "surprise_text" : true;
      if (applies && (last[col] === undefined || last[col] === null || last[col] === "")) bad(`randomization column ${col} is empty`);
      if (!applies && col in last) bad(`randomization column ${col} recorded although it does not apply`);
    }));
    // every screen has its time: in its row, and in the participant-level column rt_<screen>
    const SCREEN_TASKS = ["test_setup", "welcome", "consent", "instructions", "scenario", "questions", "general_feedback", "debrief"];
    const screenRows = data.filter((r) => SCREEN_TASKS.includes(r.task));
    const wantScreens = ["setup", "welcome", "consent", "instructions",
      ...stages.flatMap((s) => [
        ...content.scenario(s, cond, { figureVersion: fig }).pages.map((_, n) => `scenario_${s}_${n + 1}`),
        ...content.questionPages(s, cond, mode).map((p) => `questions_${p.key}`)]),
      "comments", "debrief"];
    expect("screens with a time", screenRows.map((r) => r.screen).sort(), [...wantScreens].sort());
    screenRows.forEach((r) => {
      if (!(Number.isInteger(r.rt) && r.rt >= 0)) bad(`${r.screen}: rt is ${JSON.stringify(r.rt)}`);
      if (last[`rt_${r.screen}`] !== r.rt) bad(`rt_${r.screen} is ${JSON.stringify(last[`rt_${r.screen}`])}, the row has ${r.rt}`);
      if (!(Number.isInteger(r.screen_hidden_ms) && Number.isInteger(r.screen_blur_count))) bad(`${r.screen}: no away time`);
    });
    if (!(Number.isInteger(last.total_time_ms) && last.total_time_ms > 0)) bad(`total_time_ms is ${JSON.stringify(last.total_time_ms)}`);
    // each item has the time of its first and last answer
    answered.forEach((a) => { if (!(Number.isInteger(a.first_ms) && Number.isInteger(a.last_ms) && a.last_ms >= a.first_ms)) bad(`${a.id}: answer times ${a.first_ms}, ${a.last_ms}`); });
    // scenario rows carry the page's word count (the bot runs with the read-locks off)
    const wantWords = stages.flatMap((s) => content.scenario(s, cond, { surpriseText: surprise === "shown", figureVersion: fig }).pages.map(content.pageWordCount));
    expect("n_words", scenarios.map((r) => r.n_words), wantWords);
    expect("lock_seconds", scenarios.map((r) => r.lock_seconds), wantWords.map(() => 0));
    for (const k of ["screenshot_key_count", "tab_hidden_count", "window_blur_count", "paste_attempts"]) if (!Number.isInteger(last[k])) bad(`${k} is ${JSON.stringify(last[k])}`);
    return { tag, rows: data.length, screens: scenarios.length + gotPages.length, questions: items.length };
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
  // the same settings chosen by clicking on the test-setup screen instead of URL flags
  out.push(await run({ cond: 3, mode: "main", fig: "line", surprise: "hidden", clickSetup: true }));
  out.push(await run({ cond: 6, mode: "pilot", fig: "table", surprise: "shown", clickSetup: true, orgq: "organism_complexity" }));
  out.push(await run({ cond: 2, mode: "pilot", fig: "line", surprise: "hidden", clickSetup: true, orgq: "organism_more_to_know" }));
  if (shotCond) out.push(await run({ cond: shotCond, mode: "pilot", fig: "line", surprise: "shown", shots: true }));
  await browser.close();

  // across the runs, every randomization produced more than one order
  Object.entries(orders).forEach(([name, seen]) => { if (seen.size < 2) problems.push(`randomization "${name}": only one order seen in ${runs} runs`); });
  out.forEach((r) => console.log(`${r.tag}: ${r.rows} rows, ${r.screens} scenario/question screens, ${r.questions} questions`));
  if (problems.length) {
    console.error(`\nFAILED — ${problems.length} problem(s) in ${runs} runs`);
    problems.forEach((p) => console.error(" - " + p));
    process.exit(1);
  }
  console.log(`\nScenario pages that needed scrolling at 1280 x 900: ${scrolled.size ? [...scrolled].join("; ") : "none"}`);
  console.log(`walk passed — ${runs} runs, no problems.`);
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
