/**
 * dev/datapipe_test.cjs — checks the DataPipe and Prolific connection without
 * touching either service: the browser's requests to pipe.jspsych.org and
 * app.prolific.com are intercepted and answered here, the way the services'
 * documentation says they answer.
 *
 *   npm run dev                  # in another terminal
 *   npm run test:datapipe
 *
 * Runs the whole study with the test bot (testing mode) and checks that
 *   - the condition counter is requested once and mapped to the right cell;
 *   - the data are uploaded once, as a CSV that passes DataPipe's default
 *     validation, under a file name without the Prolific ID, with the Prolific
 *     IDs, the assignment and every screen time inside;
 *   - the participant is then sent to Prolific's completion URL with the code;
 *   - a refused upload shows the download page and is not retried, an upload
 *     that did not reach DataPipe is tried again, a refused condition request
 *     falls back to a random cell, a condition fixed by a tester asks for no
 *     counter value, and ?nopipe=1 contacts DataPipe not at all;
 *   - saving as you go starts only after consent, and a staging database that
 *     cannot be reached does not hold up the end of the study.
 * It needs DATAPIPE.enabled and an experiment ID in src/config.js.
 */
const { chromium } = require("playwright");
const zlib = require("zlib");

const BASE = process.env.BASE_URL || "http://localhost:8765";
const PID = "5a9d64f5f6dfdd0001eaa73d";
const EMPTY = ["", "null"];   // how a missing value is written in the CSV

(async () => {
  const { parseCsv, isRectangular } = await import("./csv.mjs");
  const { DATAPIPE, PROLIFIC, pipeExperimentId } = await import("../src/config.js");
  const TEST_ID = pipeExperimentId(true);     // the bot runs in testing mode, which uses the test experiment
  const content = await import("../src/content.js");
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const results = [];
  const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });

  // One run of the study. `condition` and `data` say how the two DataPipe endpoints answer:
  // a number / "ok", an HTTP error { status, error }, or "abort" (the request never arrives).
  // `session`: how the "save as you go" session request is answered: "unavailable"
  // (HTTP 503, so only the final upload is used) or "started" (a session whose
  // staging database cannot be reached from the test, like a network that blocks it).
  async function run({ query = "", condition = 37, data = ["ok"], prolific = true, session = "unavailable" }) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const seen = { condition: [], data: [], session: [], other: [], prolific: null };
    const body = (req) => {
      const buf = req.postDataBuffer();
      const gz = (req.headers()["content-encoding"] || "") === "gzip";
      return JSON.parse((gz ? zlib.gunzipSync(buf) : buf).toString("utf8"));
    };
    await page.route("https://pipe.jspsych.org/**", async (route) => {
      const req = route.request();
      const url = new URL(req.url());
      const json = (status, obj) => route.fulfill({ status, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify(obj) });
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST" } });
      if (url.pathname === "/api/condition/") {
        seen.condition.push(body(req));
        return typeof condition === "number" ? json(200, { message: "Success", condition }) : json(condition.status, { error: condition.error, message: "refused" });
      }
      if (url.pathname === "/api/data/") {
        const answer = data[Math.min(seen.data.length, data.length - 1)];
        seen.data.push(body(req));
        if (answer === "abort") return route.abort("failed");
        return answer === "ok" ? json(201, { message: "Success" }) : json(answer.status, { error: answer.error, message: "refused" });
      }
      if (url.pathname === "/api/session/") {
        seen.session.push({ ...body(req), afterCondition: seen.condition.length > 0 });
        return session === "started"
          ? json(200, { sessionId: "mockSession123", databaseURL: "https://datapipe-mock-default-rtdb.firebaseio.com", maxTrialBytes: 16384, maxTrials: 1000, flushIntervalMs: 10000, flushEveryNTrials: 10, maxDisconnects: 20 })
          : json(503, { error: "SESSION_START_ERROR", message: "unavailable" });
      }
      seen.other.push(url.pathname);
      return json(404, { error: "NOT_MOCKED" });
    });
    // the staging database itself is not reachable from the test
    await page.route(/firebaseio\.com|firebasedatabase\.app/, (route) => route.abort("failed"));
    await page.route("https://app.prolific.com/**", (route) => {
      seen.prolific = route.request().url();
      return route.fulfill({ status: 200, contentType: "text/html", body: "<h1 id='prolific-stub'>Prolific</h1>" });
    });
    const ids = prolific ? `&PROLIFIC_PID=${PID}&STUDY_ID=study123&SESSION_ID=session456` : "";
    await page.goto(`${BASE}/?debug=1&nofs=1${ids}${query}`);
    await page.waitForFunction(() => typeof window.__autoplay === "function" && document.querySelector("#setup-start"));
    await page.evaluate(() => { window.__autoplay({ tick: 15 }); });
    // the end: Prolific's page, the "could not be saved" page, or "All done"
    const end = await Promise.race([
      page.waitForSelector("#prolific-stub", { timeout: 90000 }).then(() => "prolific"),
      page.waitForSelector(".end-wrap #download-btn", { timeout: 90000 }).then(() => "not_saved"),
      page.waitForFunction(() => /All done/.test((document.querySelector(".end-wrap h1") || {}).textContent || ""), null, { timeout: 90000 }).then(() => "all_done"),
    ]);
    const last = (k) => { const rows = parseCsv(seen.data[k].data); return rows[rows.length - 1]; };
    return { page, seen, end, last };
  }

  // ---- A. everything works, Prolific participant ----
  {
    const { page, seen, end, last } = await run({});
    const up = seen.data[0] || {};
    const row = seen.data.length ? last(0) : {};
    check("A: the condition counter is asked once, with the experiment ID", seen.condition.length === 1 && seen.condition[0].experimentID === TEST_ID);
    check("A: the data are uploaded once", seen.data.length === 1 && up.experimentID === TEST_ID);
    check("A: a testing-mode run uses the test experiment, not the participants' one", TEST_ID !== DATAPIPE.experiment_id && row.datapipe === "test" && row.debug_mode === "true", `${up.experimentID}`);
    check("A: the file name is a random ID without the Prolific ID", /^test_[a-z0-9]{10}_\d+\.csv$/.test(up.filename || "") && !(up.filename || "").includes(PID), up.filename);
    check("A: the CSV passes DataPipe's default validation (same width in every row, a trial_type column)", isRectangular(up.data || "x,y\n1") && "trial_type" in row);
    check("A: counter 37 is cell 5", row.condition_index === "5" && row.assignment_counter === "37" && row.condition_source === "datapipe" && String(content.assignmentFromIndex(5).cond) === row.cond, `${row.condition_index}, ${row.assignment_counter}, ${row.condition_source}`);
    check("A: the Prolific IDs are in the data", row.prolific_pid === PID && row.study_id === "study123" && row.session_id === "session456");
    check("A: the file is the complete record", row.completion_status === "completed" && row.subject_id + ".csv" === up.filename && Number(row.rt_debrief) >= 0 && row.rt_debrief !== "" && row.trust_tell !== "");
    check("A: the participant is sent to Prolific's completion URL", end === "prolific" && seen.prolific === `https://app.prolific.com/submissions/complete?cc=${PROLIFIC.completion_code}`, seen.prolific);
    check("A: nothing else is sent to DataPipe", seen.other.length === 0, seen.other.join());
    check("A: saving as you go is asked for once, after consent, under the same file name", seen.session.length === 1 && seen.session[0].experimentID === TEST_ID && seen.session[0].filename === up.filename && row.datapipe_stream === "true", JSON.stringify(seen.session));
    check("A: without a staging session the upload carries no session id", up.sessionId === undefined);
    await page.close();
  }
  // ---- B. DataPipe refuses the data (for example data collection is switched off) ----
  {
    const { page, seen, end } = await run({ data: [{ status: 400, error: "DATA_COLLECTION_NOT_ACTIVE" }] });
    check("B: a refused upload shows the download page", end === "not_saved" && /could not be saved/.test(await page.textContent(".end-wrap h1")));
    check("B: a refusal is not tried again", seen.data.length === 1);
    const [download] = await Promise.all([page.waitForEvent("download"), page.click("#download-btn")]);
    check("B: the participant can download the data", /^test_.*\.csv$/.test(download.suggestedFilename()), download.suggestedFilename());
    check("B: and still has the way back to Prolific", (await page.getAttribute("#prolific-link", "href")) === `https://app.prolific.com/submissions/complete?cc=${PROLIFIC.completion_code}` && seen.prolific === null);
    check("B: no leave-page warning any more", await page.evaluate(() => window.onbeforeunload() === undefined));
    await page.close();
  }
  // ---- C. the first upload does not reach DataPipe, the second does ----
  {
    const { page, seen, end, last } = await run({ data: ["abort", "ok"] });
    check("C: an upload that did not arrive is tried again", seen.data.length === 2 && end === "prolific");
    check("C: the retry is recorded and uses the same file name", last(1).save_attempts === "2" && seen.data[0].filename === seen.data[1].filename);
    await page.close();
  }
  // ---- D. the retry finds the file already there: the first attempt had arrived ----
  {
    const { page, seen, end } = await run({ data: ["abort", { status: 400, error: "FILE_EXISTS" }] });
    check("D: FILE_EXISTS on a retry counts as saved", seen.data.length === 2 && end === "prolific");
    await page.close();
  }
  // ---- E. condition assignment is switched off: a random cell, and the study goes on ----
  {
    const { page, seen, end, last } = await run({ condition: { status: 400, error: "CONDITION_ASSIGNMENT_NOT_ACTIVE" } });
    const row = last(0);
    check("E: a refused condition request falls back to a random cell", end === "prolific" && row.condition_source === "random_fallback" && EMPTY.includes(row.assignment_counter) && /^\d+$/.test(row.condition_index), `${row.condition_source}, cell ${row.condition_index}, counter ${JSON.stringify(row.assignment_counter)}`);
    await page.close();
  }
  // ---- F. a tester fixed the condition: no counter value is used up ----
  {
    const { page, seen, end, last } = await run({ query: "&cond=3" });
    check("F: a fixed condition asks for no counter value", seen.condition.length === 0 && last(0).cond === "3" && last(0).condition_source === "test_setup" && end === "prolific");
    await page.close();
  }
  // ---- G. no Prolific ID: saved, no redirect ----
  {
    const { page, seen, end, last } = await run({ prolific: false });
    check("G: without a Prolific ID the study ends on its own page", end === "all_done" && seen.data.length === 1 && seen.prolific === null && EMPTY.includes(last(0).prolific_pid), `${end}, ${seen.data.length} upload(s), pid ${JSON.stringify((seen.data.length ? last(0) : {}).prolific_pid)}`);
    await page.close();
  }
  // ---- H. ?nopipe=1: DataPipe is not contacted ----
  {
    const { page, seen, end } = await run({ query: "&nopipe=1" });
    check("H: nopipe=1 sends nothing to DataPipe", seen.condition.length + seen.data.length + seen.other.length === 0 && end === "prolific");
    await page.close();
  }
  // ---- J. a staging session starts but its database cannot be reached: the study still ends, and the upload names the session ----
  {
    const t0 = Date.now();
    const { page, seen, end } = await run({ session: "started" });
    check("J: a blocked staging database does not hold up the end of the study", end === "prolific" && seen.data.length === 1, `${Math.round((Date.now() - t0) / 1000)} s`);
    check("J: the upload names the staging session, so DataPipe can discard the staged copy", seen.data[0] && seen.data[0].sessionId === "mockSession123");
    await page.close();
  }
  // ---- I. a participant (no testing mode) is assigned by the real experiment ----
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const asked = [];
    await page.route("https://pipe.jspsych.org/**", async (route) => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST" } });
      asked.push({ path: new URL(req.url()).pathname, id: JSON.parse(req.postData() || "{}").experimentID });
      return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*" }, body: JSON.stringify({ message: "Success", condition: 3 }) });
    });
    await page.goto(`${BASE}/?nofs=1&allowauto=1&PROLIFIC_PID=${PID}`);
    await page.click("#card-btn");                       // welcome
    await page.waitForSelector("#consent-pdf");
    check("I: nothing is sent to DataPipe before consent", asked.length === 0, JSON.stringify(asked));
    await page.click("#card-btn");                       // consent -> assignment
    await page.waitForSelector(".eyebrow:text('Instructions')");
    await page.waitForTimeout(500);
    check("I: after consent a participant's condition and staging session come from the real experiment",
      asked.length === 2 && asked[0].path === "/api/condition/" && asked[1].path === "/api/session/" && asked.every((a) => a.id === DATAPIPE.experiment_id && a.id !== TEST_ID), JSON.stringify(asked));
    await page.close();
  }
  await browser.close();

  results.forEach((r) => console.log(`${r.ok ? "ok  " : "FAIL"} ${r.name}${r.detail ? " — " + r.detail : ""}`));
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\nFAILED — ${failed} of ${results.length} checks` : `\ndatapipe test passed — ${results.length} checks.`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
