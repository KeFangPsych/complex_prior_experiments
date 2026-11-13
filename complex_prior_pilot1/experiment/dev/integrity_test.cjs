/**
 * dev/integrity_test.cjs — the experiment as a participant gets it (no ?debug,
 * no ?nofs), driven with real pointer clicks and key presses.
 *
 *   npm run dev            # in another terminal
 *   node dev/integrity_test.cjs
 *
 * Checks: consent enters fullscreen; leaving it shows the blocking overlay and
 * returning hides it; the instruction and story pages are read-locked; a question
 * screen cannot be submitted until every item is answered; an open response
 * needs the minimum length; the context menu is blocked; the viewport lock and
 * the mobile block appear. Takes about 30 s because it waits out the read-locks.
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
  await page.click("#card-btn");                                         // -> part 1 story
  await page.waitForSelector(".story-text");
  check("story page is read-locked", await page.isDisabled("#card-btn"));
  check("story picture is loaded", await page.evaluate(() => { const i = document.querySelector(".story-figure img"); return i.complete && i.naturalWidth > 0; }));
  await page.waitForSelector("#card-btn:not([disabled])", { timeout: 15000 });
  await page.click("#card-btn");                                         // -> part 2 story
  await page.waitForFunction(() => document.querySelector(".eyebrow").textContent.startsWith("Part 2"));
  await page.waitForSelector("#card-btn:not([disabled])", { timeout: 15000 });
  await page.click("#card-btn");                                         // -> part 2 questions

  // question screen: three scales in pilot mode; Continue only after all are answered
  await page.waitForSelector("#q-submit");
  const n = await page.locator(".q-item").count();
  check("story is hidden on the question screen", (await page.locator(".story-text, .story-figure").count()) === 0);
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
