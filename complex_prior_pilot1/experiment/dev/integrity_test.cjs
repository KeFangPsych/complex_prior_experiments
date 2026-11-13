/**
 * dev/integrity_test.cjs — the experiment as a participant gets it (no ?debug,
 * no ?nofs), driven with real pointer clicks and key presses.
 *
 *   npm run dev            # in another terminal
 *   node dev/integrity_test.cjs
 *
 * Checks: the consent form can be saved as a PDF; consent enters fullscreen; leaving it shows the blocking overlay and
 * returning hides it; the instruction and scenario pages are read-locked; a question
 * screen cannot be submitted until every item is answered; an open response
 * needs the minimum length; the context menu, text selection and copy are
 * blocked; the viewport lock and the mobile block appear. It also checks testing
 * mode (?debug=1): all of those safeguards are off unless switched on on the
 * test-setup screen. Takes about 30 s because it waits out the read-locks.
 * Needs Playwright (see dev/walk.cjs).
 */
const { chromium, devices } = require("playwright");
const BASE = process.env.BASE_URL || "http://localhost:8765";

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const results = [];
  const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail });

  // ---- 1. fullscreen, read-locks, question gating (condition 1: evidence first, low, heat) ----
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${BASE}/?condition=0`);
  await page.click("#card-btn");                                         // welcome
  // the whole consent form is on the page (no scrolling box), and can be saved as a PDF with the safeguards on
  await page.waitForSelector("#consent-pdf");
  check("consent form is shown in full", await page.evaluate(() => { const s = document.querySelector(".consent-section"); return s.querySelectorAll("p").length === 9 && s.scrollHeight <= s.clientHeight + 1; }));
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#consent-pdf")]);
  const pdf = require("fs").readFileSync(await download.path());
  check("consent page saves a PDF", download.suggestedFilename() === "informed_consent.pdf" && pdf.subarray(0, 5).toString() === "%PDF-" && pdf.length > 3000, `${download.suggestedFilename()}, ${pdf.length} bytes`);
  await page.click("#card-btn");                                         // consent -> fullscreen
  await page.waitForSelector(".eyebrow:text('Instructions')");
  check("consent enters fullscreen", await page.evaluate(() => !!document.fullscreenElement));

  check("instructions are read-locked", await page.isDisabled("#card-btn"));
  await page.evaluate(() => document.exitFullscreen());
  await page.waitForSelector("#fs-return-btn", { state: "visible" });
  check("leaving fullscreen shows the overlay", true);
  await page.click("#fs-return-btn");
  await page.waitForFunction(() => document.getElementById("fullscreen-overlay").style.display === "none");
  check("returning hides the overlay", await page.evaluate(() => !!document.fullscreenElement));
  check("context menu is blocked", await page.evaluate(() => !document.body.dispatchEvent(new MouseEvent("contextmenu", { cancelable: true, bubbles: true }))));

  await page.waitForSelector("#card-btn:not([disabled])", { timeout: 10000 });
  await page.click("#card-btn");                                         // -> part 1 scenario
  await page.waitForSelector(".scenario-text");
  check("scenario page is read-locked", await page.isDisabled("#card-btn"));
  check("scenario picture is loaded", await page.evaluate(() => { const i = document.querySelector(".scenario-figure img"); return i.complete && i.naturalWidth > 0; }));
  check("text and picture fit the window", await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 1));
  await page.waitForSelector("#card-btn:not([disabled])", { timeout: 15000 });
  await page.click("#card-btn");                                         // -> part 2 scenario
  await page.waitForFunction(() => document.querySelector(".eyebrow").textContent.startsWith("Part 2"));
  await page.waitForSelector("#card-btn:not([disabled])", { timeout: 15000 });
  await page.click("#card-btn");                                         // -> part 2 questions

  // question screen: three scales in pilot mode; Continue only after all are answered
  await page.waitForSelector("#q-submit");
  const n = await page.locator(".q-item").count();
  check("scenario is hidden on the question screen", (await page.locator(".scenario-text, .scenario-figure").count()) === 0);
  for (let i = 0; i < n; i++) {
    check(`Continue is locked with ${i} of ${n} answered`, await page.isDisabled("#q-submit"));
    await page.locator(".q-item").nth(i).locator(".likert-opt").nth(2 + i).click();
  }
  check("Continue unlocks when all are answered", await page.isEnabled("#q-submit"));
  check("the clicked option is marked", (await page.locator(".likert-opt.selected").count()) === n);

  // jump ahead to the open-response screen with real clicks
  const answerPage = async () => {
    for (const item of await page.locator(".q-item").all()) {
      const type = await item.getAttribute("data-type");
      if (type === "likert") await item.locator(".likert-opt").nth(3).click();
      else if (type === "choice") await item.locator(".choice").first().click();
      else await item.locator("textarea").fill("A long enough answer for the test.");
    }
    await page.click("#q-submit");
  };
  for (let guard = 0; guard < 20; guard++) {
    await page.waitForSelector("#q-submit, #card-btn");
    if (await page.locator("#card-btn").count()) {
      await page.waitForSelector("#card-btn:not([disabled])", { timeout: 15000 });
      await page.click("#card-btn");
      continue;
    }
    if (await page.locator(".q-item[data-type='open']").count()) break;
    await answerPage();
  }
  const ta = page.locator(".q-item[data-type='open'] textarea");
  await ta.pressSequentially("too short");
  check("a short open response keeps Continue locked", await page.isDisabled("#q-submit"));
  await ta.pressSequentially(" but now long enough");
  check("a long enough open response unlocks Continue", await page.isEnabled("#q-submit"));
  check("leave-page warning is armed", await page.evaluate(() => typeof window.onbeforeunload() === "string"));
  check("no page errors", errors.length === 0, errors.join("; "));
  await page.close();

  // ---- 1b. participant view: text cannot be selected or copied ----
  const copyAllowed = () => document.dispatchEvent(new ClipboardEvent("copy", { cancelable: true, bubbles: true }));
  const selectable = () => getComputedStyle(document.querySelector(".card p")).userSelect !== "none";
  const pp = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await pp.goto(`${BASE}/`);
  await pp.waitForSelector("#card-btn");
  check("participants: no test-setup screen", (await pp.locator("#setup-start").count()) === 0);
  check("participants: text cannot be selected", !(await pp.evaluate(selectable)));
  check("participants: copy is blocked", !(await pp.evaluate(copyAllowed)));
  await pp.close();

  // ---- 1c. testing mode: safeguards off by default, on when chosen ----
  const pt = await browser.newPage({ viewport: { width: 900, height: 560 } });   // below the minimum window size
  await pt.goto(`${BASE}/?debug=1`);
  await pt.waitForSelector("#setup-start");
  await pt.click("#setup-start");
  await pt.waitForSelector("#card-btn");
  check("testing: text can be selected", await pt.evaluate(selectable));
  check("testing: copy is allowed", await pt.evaluate(copyAllowed));
  check("testing: paste is allowed", await pt.evaluate(() => document.dispatchEvent(new ClipboardEvent("paste", { cancelable: true, bubbles: true }))));
  check("testing: context menu is allowed", await pt.evaluate(() => document.body.dispatchEvent(new MouseEvent("contextmenu", { cancelable: true, bubbles: true }))));
  check("testing: no viewport lock in a small window", (await pt.locator("#viewport-lock-overlay").count()) === 0);
  await pt.click("#card-btn");                                           // welcome
  check("testing: consent does not mention full screen", !/full-screen/.test(await pt.textContent(".card")));
  await pt.click("#card-btn");                                           // consent
  await pt.waitForSelector(".eyebrow:text('Instructions')");
  check("testing: consent does not enter fullscreen", !(await pt.evaluate(() => !!document.fullscreenElement)));
  check("testing: no leave-page warning", await pt.evaluate(() => window.onbeforeunload() === undefined));
  await pt.close();

  const ps = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await ps.goto(`${BASE}/?debug=1`);
  await ps.waitForSelector("#setup-start");
  await ps.locator('.setup-group[data-group="safeguards"] .opt[data-value="on"]').click();
  await ps.click("#setup-start");
  await ps.waitForSelector("#card-btn");
  check("testing with safeguards on: copy is blocked", !(await ps.evaluate(copyAllowed)));
  check("testing with safeguards on: text cannot be selected", !(await ps.evaluate(selectable)));
  await ps.click("#card-btn");
  await ps.click("#card-btn");
  await ps.waitForSelector(".eyebrow:text('Instructions')");
  check("testing with safeguards on: consent enters fullscreen", await ps.evaluate(() => !!document.fullscreenElement));
  await ps.close();

  // ---- 2. viewport lock ----
  const p2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await p2.goto(`${BASE}/`);
  await p2.waitForSelector("#card-btn");
  await p2.setViewportSize({ width: 900, height: 700 });
  await p2.waitForFunction(() => (document.getElementById("viewport-lock-overlay") || { style: {} }).style.display === "flex");
  check("a small window shows the viewport lock", true);
  await p2.setViewportSize({ width: 1280, height: 900 });
  await p2.waitForFunction(() => document.getElementById("viewport-lock-overlay").style.display === "none");
  check("enlarging the window removes it", true);
  await p2.close();

  // ---- 3. mobile block ----
  const ctx = await browser.newContext({ ...devices["iPhone 13"] });
  const p3 = await ctx.newPage();
  await p3.goto(`${BASE}/`);
  await p3.waitForSelector("h1");
  check("phones are turned away", /desktop or laptop/.test(await p3.textContent("h1")) && (await p3.locator("#card-btn").count()) === 0);
  await browser.close();

  results.forEach((r) => console.log(`${r.ok ? "ok  " : "FAIL"} ${r.name}${r.detail ? " — " + r.detail : ""}`));
  const failed = results.filter((r) => !r.ok).length;
  console.log(failed ? `\nFAILED — ${failed} of ${results.length} checks` : `\nintegrity test passed — ${results.length} checks.`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error("FAILED", e); process.exit(1); });
