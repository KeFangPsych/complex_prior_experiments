/**
 * dev/count_cells.mjs — counts completed participants per assignment cell and
 * per condition, and prints the list for a top-up batch.
 *
 *   npm run cells -- <folder with the data files> [--per-cell N] [--include-tests]
 *
 * Download the data folder from Google Drive (or point this at a synced copy).
 * Every .csv file in it is one participant who finished. DataPipe's
 * ".partial.json" files are participants who quit part-way; they never count
 * toward a cell, and are summarized separately (how many, and the last screen
 * each one finished).
 * A file counts when its last row has completion_status = "completed" and it is
 * not a test run (debug_mode), unless --include-tests is given. If the same
 * Prolific ID finished more than once, only the earliest file counts and the
 * others are listed.
 *
 * DataPipe's counter moves on when someone starts, whether or not they finish,
 * so after dropouts the cells are not exactly equal. The printed
 * `top_up_cells` list names each cell once for every participant it is short of
 * the target (--per-cell, default: the largest cell). Paste it into ASSIGNMENT
 * in src/config.js, deploy, and recruit that many more participants; then set it
 * back to null. Run this again afterwards, because a top-up batch has dropouts too.
 */
import fs from "node:fs";
import path from "node:path";
import { parseCsv } from "./csv.mjs";
import { CONDITIONS, N_CELLS, assignmentFromIndex } from "../src/content.js";

const args = process.argv.slice(2);
const perCellAt = args.indexOf("--per-cell");
const folder = args.find((a, i) => !a.startsWith("--") && !(perCellAt >= 0 && i === perCellAt + 1));
if (!folder || !fs.existsSync(folder)) {
  console.error("Usage: npm run cells -- <folder with the data files> [--per-cell N] [--include-tests]");
  process.exit(1);
}
const includeTests = args.includes("--include-tests");
const perCellArg = perCellAt >= 0 ? parseInt(args[perCellAt + 1]) : null;

const files = fs.readdirSync(folder).filter((f) => f.toLowerCase().endsWith(".csv")).sort();
const partialFiles = fs.readdirSync(folder).filter((f) => f.endsWith(".partial.json")).sort();
const partial = partialFiles.length;
const skipped = { unreadable: [], incomplete: [], test: [], duplicate: [] };
const kept = [];
for (const f of files) {
  let last;
  try { const rows = parseCsv(fs.readFileSync(path.join(folder, f), "utf8")); last = rows[rows.length - 1]; } catch (e) { last = null; }
  if (!last || last.condition_index === undefined || last.condition_index === "") { skipped.unreadable.push(f); continue; }
  if (last.completion_status !== "completed") { skipped.incomplete.push(f); continue; }
  if (last.debug_mode === "true" && !includeTests) { skipped.test.push(f); continue; }
  kept.push({ file: f, cell: parseInt(last.condition_index), pid: last.prolific_pid || "", start: last.start_time || "", source: last.condition_source });
}
// one file per Prolific ID: the earliest
kept.sort((a, b) => a.start.localeCompare(b.start));
const seen = new Set();
const counted = kept.filter((p) => {
  if (!p.pid || p.pid === "null") return true;
  if (seen.has(p.pid)) { skipped.duplicate.push(p.file); return false; }
  seen.add(p.pid);
  return true;
});

const perCell = Array(N_CELLS).fill(0);
counted.forEach((p) => { perCell[p.cell]++; });
const perCond = {};
perCell.forEach((n, k) => { const c = assignmentFromIndex(k).cond; perCond[c] = (perCond[c] || 0) + n; });

console.log(`${files.length} data file(s) in ${folder}; ${counted.length} completed participant(s) counted.`);
Object.entries(skipped).forEach(([why, list]) => { if (list.length) console.log(`  not counted, ${why}: ${list.length} (${list.slice(0, 5).join(", ")}${list.length > 5 ? ", …" : ""})`); });
if (partial) console.log(`  ${partial} partial file(s) from participants who did not finish (not counted; summarized at the end).`);
const fallback = counted.filter((p) => p.source === "random_fallback").length;
if (fallback) console.log(`  ${fallback} participant(s) got a random cell because DataPipe's counter did not answer.`);

console.log("\nPer condition:");
Object.keys(CONDITIONS).forEach((c) => {
  const d = CONDITIONS[c];
  console.log(`  ${c}  ${d.order.replace("_", " ").padEnd(17)} ${d.complexity.padEnd(4)} ${d.anomaly.padEnd(5)}  ${String(perCond[c] || 0).padStart(3)}`);
});
console.log("\nPer cell (cell: condition, figure, surprise text -> completed):");
perCell.forEach((n, k) => {
  const a = assignmentFromIndex(k);
  const surprise = CONDITIONS[a.cond].order === "evidence_first" ? (a.surpriseText ? "shown" : "hidden") : "n/a";
  console.log(`  ${String(k).padStart(2)}: cond ${a.cond}, ${a.figureVersion.padEnd(5)}, ${surprise.padEnd(6)} -> ${n}`);
});

const target = perCellArg ?? Math.max(...perCell);
const topUp = perCell.flatMap((n, k) => Array(Math.max(0, target - n)).fill(k));
// interleave, so that a batch cut short still spreads over the cells
const rounds = [];
topUp.forEach((k) => { const r = rounds.find((x) => !x.includes(k)); if (r) r.push(k); else rounds.push([k]); });
const list = rounds.flat();
console.log(`\nTarget per cell: ${target} (${target * N_CELLS} participants in all).`);
if (!list.length) console.log("Every cell has reached the target. No top-up needed.");
else {
  console.log(`${list.length} more participant(s) needed. For a top-up batch, set in src/config.js:\n`);
  console.log(`  top_up_cells: [${list.join(", ")}],\n`);
  console.log(`and recruit ${list.length} more on Prolific. Set it back to null afterwards.`);
}

// ---- participants who quit part-way (partial files): where they stopped ----
if (partial) {
  // a partial file is the list of the screens' rows that reached DataPipe, as JSON
  const rowsOf = (f) => {
    let data = JSON.parse(fs.readFileSync(path.join(folder, f), "utf8"));
    if (!Array.isArray(data)) data = data.trials || data.data || Object.values(data);
    return data.map((r) => (typeof r === "string" ? JSON.parse(r) : r)).filter((r) => r && typeof r === "object");
  };
  const stops = {}, finishedPids = new Set(counted.map((p) => p.pid).filter((x) => x && x !== "null"));
  let unreadable = 0, tests = 0, alsoFinished = 0;
  for (const f of partialFiles) {
    let rows;
    try { rows = rowsOf(f); } catch (e) { unreadable++; continue; }
    const screens = rows.filter((r) => r.screen);
    const last = screens[screens.length - 1] || rows[rows.length - 1];
    if (!last) { unreadable++; continue; }
    if ((last.debug_mode === true || last.debug_mode === "true") && !includeTests) { tests++; continue; }
    if (last.prolific_pid && finishedPids.has(last.prolific_pid)) alsoFinished++;
    const where = `${last.screen || last.task || "?"}${last.cond ? ` (cond ${last.cond})` : ""}`;
    stops[where] = (stops[where] || 0) + 1;
  }
  console.log(`\nParticipants who quit part-way: ${Object.values(stops).reduce((a, b) => a + b, 0)}${tests ? ` (plus ${tests} test run(s))` : ""}${unreadable ? `, ${unreadable} file(s) unreadable` : ""}.`);
  if (alsoFinished) console.log(`  ${alsoFinished} of them have the Prolific ID of someone who also finished (a second attempt, or a file DataPipe recovered twice).`);
  if (Object.keys(stops).length) {
    console.log("  Last screen finished before quitting:");
    Object.entries(stops).sort((a, b) => b[1] - a[1]).forEach(([where, n]) => console.log(`    ${String(n).padStart(3)}  ${where}`));
  }
}
