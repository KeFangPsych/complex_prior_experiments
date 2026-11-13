/**
 * content.js — vignette 1: scenario text, figures and questions.
 *
 * Transcribed from ../complex_prior_pilot1_vignette1_script.md, which stays the
 * source of truth: `npm run check:script` renders every condition from this file
 * and fails if any paragraph, page break, figure name, question, scale, Main/Pilot
 * tag or presentation-order note differs from the script. Edit the script first, then mirror the change here.
 *
 * This module has no browser dependencies so that Node can import it.
 */

// Design table of the script (three-factor, between participants).
export const CONDITIONS = {
  1: { order: "evidence_first", complexity: "low", anomaly: "heat" },
  2: { order: "evidence_first", complexity: "low", anomaly: "color" },
  3: { order: "evidence_first", complexity: "high", anomaly: "heat" },
  4: { order: "evidence_first", complexity: "high", anomaly: "color" },
  5: { order: "elaboration_first", complexity: "low", anomaly: "heat" },
  6: { order: "elaboration_first", complexity: "low", anomaly: "color" },
  7: { order: "elaboration_first", complexity: "high", anomaly: "heat" },
  8: { order: "elaboration_first", complexity: "high", anomaly: "color" },
};

// Two things are randomized independently of the condition: the version of the
// evidence figure, and (evidence-first conditions only) whether the underlined
// surprise sentences are shown. Crossing them with the 8 conditions gives 32
// assignment cells; cell k (e.g. the DataPipe condition counter) maps to
//   condition      k % 8 + 1
//   figureVersion  "table" for k in 0-7 and 16-23, "line" otherwise
//   surpriseText   true for k in 0-15, false for 16-31
// so consecutive counter values fill every cell once per 32 participants.
export const N_CELLS = 32;
export function assignmentFromIndex(index) {
  const k = ((index % N_CELLS) + N_CELLS) % N_CELLS;
  return {
    cond: (k % 8) + 1,
    figureVersion: Math.floor(k / 8) % 2 === 0 ? "table" : "line",
    surpriseText: Math.floor(k / 16) % 2 === 0,
  };
}

/** The cell index of an assignment (inverse of assignmentFromIndex). */
export function indexFromAssignment({ cond, figureVersion, surpriseText }) {
  return (cond - 1) + (figureVersion === "line" ? 8 : 0) + (surpriseText ? 0 : 16);
}

// Stage keys in presentation order (stages 1-5 of the script).
export const STAGE_SEQUENCE = {
  evidence_first: ["planet", "complexity", "explanation1", "evidence", "elaboration"],
  elaboration_first: ["planet", "complexity", "explanation1", "elaboration", "evidence"],
};

// The output that shows the anomaly (and depends on the algae), and the other one.
const outputs = (anomaly) =>
  anomaly === "heat"
    ? { anom: "heat", other: "purple pigment" }
    : { anom: "purple pigment", other: "heat" };

const IMG = "vignette1_img";

// ============================================================================
// SCENARIO TEXT
//   scenario(stage, cond, { surpriseText, figureVersion }) -> { pages: [...] }
//   Each page: { paragraphs, figure (file name or null), alt, layout }
//   **double asterisks** in a paragraph would mark bold, as in the script (none at present).
//     layout "side"     text on the left, picture on the right
//            "stacked"  text above the picture
//            "text"     text only
//   surpriseText   true / false: the underlined sentences of the evidence stage
//                  (evidence-first conditions only)
//   figureVersion  "table" / "line": which version of the evidence figure
// ============================================================================
export function scenario(stage, cond, { surpriseText = true, figureVersion = "table" } = {}) {
  const c = CONDITIONS[cond];
  const { anom, other } = outputs(c.anomaly);
  const evidenceFirst = c.order === "evidence_first";
  const page = (paragraphs, figure = null, alt = "", layout = "text") => ({ paragraphs, figure, alt, layout });

  if (stage === "planet") {
    return { pages: [page([
      "People are planning a place for people to live on an alien planet. The planet has water, air, and various kinds of small living things called organisms.",
      "In science, the planet and its living organisms have been studied extensively and are now very well understood.",
    ], `${IMG}1_planet_scene.png`,
    "Two people in space suits look over a planet with water and red rocks. An inset shows small organisms.", "side")] };
  }

  if (stage === "complexity") {
    const low = c.complexity === "low";
    return { pages: [page([
      `Scientific findings show that biological processes (the ways living things work) on this planet are usually ${low ? "simple" : "complex"}.`,
      low
        ? "These processes usually involve a few chemical reactions and only a few factors matter for what happens."
        : "These processes usually involve many chemical reactions and many different factors that affect what happens. The factors affect each other in complicated ways. The effect of one factor often changes when other factors change.",
      "In science, these processes have been studied for years and are now very well understood.",
    ], `${IMG}2_${low ? "low" : "high"}_complex.png`,
    low
      ? "Diagram of the planet's biology: a few elements, simple chemistry and simple organisms, with few links between them."
      : "Diagram of the planet's biology: diverse elements, complex chemistry and complex organisms, with many links between them.", "side")] };
  }

  if (stage === "explanation1") {
    return { pages: [
      page([
        "A construction team is building apartments on this planet. The planet has four seasons: warm, cool, moderately cold, and extremely cold. The construction team needs technology that can produce heat to keep apartments warm.",
        "An energy company called Bioenergy suggests one of its technologies that uses a small organism found on the planet. Scientific findings indicate that this organism is typical of other organisms on the planet in terms of how simple or complex it is.",
        "The company understands very well how the organism works because it has closely studied the organism.",
      ]),
      page([
        "The company explains the technology relies on part of the organism's biological process.",
        "In this process, the organism uses a certain gas from the air to produce heat and a purple substance called a pigment. More pigment makes the organism look more purple. The pigment is harmless and has no known practical use. When more of this gas is available, the organism produces more heat and more purple pigment.",
        "The company also explains that the planet's air holds more of this gas when the weather is colder. So in colder weather, there is more gas around the organism.",
      ], `${IMG}3_explanation1.png`,
      "The company explains: with more gas, the organism can produce more heat and more purple pigment. Colder weather means more gas in the air.", "stacked"),
    ] };
  }

  if (stage === "evidence") {
    // the underlined sentences exist only in the evidence-first conditions
    const s = evidenceFirst && surpriseText;
    return { pages: [page([
      "Before deciding whether to use the technology, the construction team gets a sample of the organism from the company.",
      "The construction team mainly wants to know if the organism can produce heat as explained.",
      "The construction team tests the sample in a laboratory at four different temperatures. During the tests, more of the gas is available when it is colder, just as on the planet.",
      "As it gets colder, from warm to cool to moderately cold, the organism produces more heat and more purple pigment." + (s ? " This is expected." : ""),
      `When it is extremely cold, the organism still produces more ${other}` + (s ? ", as expected" : "") +
        `. But it produces less ${anom} than when it is moderately cold.` +
        (s ? " This is unexpected, because more gas is available for the organism to use." : ""),
    ], `${IMG}4_evidence_${c.anomaly}_anomaly${figureVersion === "line" ? "_line" : ""}.png`,
    "Laboratory observations at four temperatures, from warm to extremely cold: gas available, organism color and heat output.", "stacked")] };
  }

  if (stage === "elaboration") {
    return { pages: [page([
      ...(evidenceFirst ? ["The construction team asks the company about this unexpected result."] : []),
      `The company ${evidenceFirst ? "explains" : "further explains"} that even smaller living things called algae live inside the organism. The organism can produce ${anom} only with the help of the algae.`,
      `The algae need liquid water to stay active. When they are active, more gas leads them to produce more ${anom}. When there is too little liquid water, they become less active and produce less ${anom}.`,
      `As the weather gets colder, more gas is available in the air. When it is moderately cold, the algae use the extra gas to produce more ${anom}.`,
      `But when it is extremely cold, most of the water available to the algae freezes. As a result, the algae become less active and produce less ${anom}, even though more gas is available.`,
      `The organism produces ${other} on its own, without the algae. So it keeps producing more ${other} as the weather gets colder.`,
    ], `${IMG}5_explanation2_${c.anomaly}_anomaly.png`,
    "The company explains what happens inside the organism when it is moderately cold and when it is extremely cold.", "stacked")] };
  }

  throw new Error(`Unknown stage: ${stage}`);
}

// ============================================================================
// QUESTIONS
//   Each item: { id, use ("main" | "pilot" | "alternative"), measure, page, type, prompt, ... }
//     use "alternative": kept in the script as an alternative measure, never asked
//     likert  low, high, mid (label of the midpoint, optional); answered 1-5
//     choice  options, correct (index of the right answer, optional)
//     open    free text
//   `page` groups consecutive items onto one screen. `id` is the column name in
//   the data. `measure` is the label used in the script tables.
//   Randomization (applied by randomizePages, described in the script under
//   "Presentation order"; everything else keeps the script's order):
//     pageShuffle   consecutive screens whose items share this key swap places at random
//     itemShuffle   consecutive items on a screen that share this key are shuffled
//     shuffleOptions / pinLast   a choice item's options are shuffled, except the last `pinLast`
//     randomPresence   the item is shown with this probability (recorded as <id>_shown)
// ============================================================================
// every rating scale runs from 1 to SCALE_POINTS
export const SCALE_POINTS = 5;
export const SCALE_MID = (SCALE_POINTS + 1) / 2;
const likert = (id, use, measure, page, prompt, low, high, mid = null) => ({ id, use, measure, page, type: "likert", prompt, low, high, mid });
const choice = (id, use, measure, page, prompt, options, correct = null) => ({ id, use, measure, page, type: "choice", prompt, options, correct });
const open = (id, use, measure, page, prompt) => ({ id, use, measure, page, type: "open", prompt });

const AMOUNT = (noun) => [`Less ${noun}`, `About the same amount of ${noun}`, `More ${noun}`, "I don't remember"];

function predictionItems() {
  return [
    likert("pred_heat", "main", "Heat prediction", "prediction",
      "How much heat would you expect the organism to produce when it is extremely cold, compared with when it is moderately cold?",
      "Much less heat", "Much more heat", "About the same amount of heat"),
    likert("pred_pigment", "main", "Pigment prediction", "prediction",
      "How much purple pigment would you expect the organism to produce when it is extremely cold, compared with when it is moderately cold?",
      "Much less purple pigment", "Much more purple pigment", "About the same amount of purple pigment"),
  ];
}

// Primary and secondary measures asked after the last stage, in both orders. The
// complexity, trust and utility blocks (one screen each) come in random order.
function finalMeasures() {
  const blocks = ["complexity", "trust", "utility"];
  return [
    likert("complexity_overall", "main", "Complexity (primary)", "complexity",
      "How simple or complex is the way this organism works?", "Very simple", "Very complex"),
    likert("complexity_other_factors", "main", "Complexity (primary)", "complexity",
      "Besides what has been explained so far, how many other factors do you think affect how this organism works?", "None", "Very many"),
    likert("complexity_other_factors_heat", "main", "Complexity (primary)", "complexity",
      "Besides what has been explained so far, how likely is it that other factors affect how much heat this organism produces?", "Very unlikely", "Very likely"),
    likert("trust_tell", "main", "Source trust / Cooperativeness (primary)", "trust",
      "How much do you trust the company to tell the construction team what it needs to know?", "Not at all", "Completely"),
    likert("trust_care", "main", "Source trust / Cooperativeness (primary)", "trust",
      "When explaining the technology, how much does the company care about what is best for the construction team?", "Not at all", "Very much"),
    likert("trust_help", "main", "Source trust / Cooperativeness (primary)", "trust",
      "When the company chose what to explain, how much was it trying to help the construction team make a good decision?", "Not at all", "Very much"),
    likert("utility_coldest", "main", "Utility (secondary control)", "utility",
      "How well would the technology keep apartments warm in the planet's coldest season?", "Not well at all", "Very well"),
    likert("utility_overall", "main", "Utility (secondary control)", "utility",
      "How good is this technology for heating apartments?", "Not at all good", "Very good"),
    likert("expl2_explains", "main", "Further measure: explanation 2 evaluations", "explanation2",
      "How well does the company's explanation about the algae explain the test results?", "Not well at all", "Very well"),
    likert("expl2_real_reason", "main", "Further measure: explanation 2 evaluations", "explanation2",
      "How likely is it that the algae processes are the real reason for the test results when it was extremely cold?", "Very unlikely", "Very likely"),
  ].map((q) => (blocks.includes(q.page) ? { ...q, pageShuffle: "final_blocks" } : q));
}

function observedItems(c) {
  return [
    choice("obs_heat", "main", "Observed heat production", "observed",
      "How much heat did the organism produce when it was extremely cold, compared with when it was moderately cold?",
      AMOUNT("heat"), c.anomaly === "heat" ? 0 : 2),
    choice("obs_pigment", "main", "Observed pigment production", "observed",
      "How much purple pigment did the organism produce when it was extremely cold, compared with when it was moderately cold?",
      AMOUNT("purple pigment"), c.anomaly === "color" ? 0 : 2),
  ];
}

function evidencePilotItems(c) {
  const { anom } = outputs(c.anomaly);
  return [
    likert("surprise", "pilot", "Difference from expectations / Surprise", "evidence_check",
      "How different are these results from what you expected based on the company's explanation?", "Not at all different", "Extremely different"),
    choice("gas_availability", "pilot", "Gas availability", "evidence_check",
      "How much gas was available when it was extremely cold, compared with when it was moderately cold?", AMOUNT("gas"), 2),
    likert("anomaly_relevance", "pilot", `Anomaly relevance, ${c.anomaly} anomaly version`, "evidence_check",
      `The organism produces less ${anom} when it is extremely cold. How much does this matter for the construction team's goal of keeping apartments warm?`, "Not at all", "Very much"),
  ];
}

function algaeDependenceItem(c) {
  return choice("algae_dependence", "main", "Causal knowledge: dependence on algae", "algae",
    "Which of these can the organism produce only with the help of the algae?",
    ["Heat only", "Purple pigment only", "Both heat and purple pigment", "Neither heat nor purple pigment", "I don't remember"],
    c.anomaly === "heat" ? 0 : 1);
}

// The causal-knowledge measure for the algae explanation: two open responses.
function algaeOpenItems(c) {
  const { anom, other } = outputs(c.anomaly);
  return [
    open("open_decrease", "pilot", `Causal knowledge: explain the decrease, ${c.anomaly} anomaly version`, "algae_open",
      `Why does the organism produce less ${anom} when it is extremely cold, even though more gas is available?`),
    open("open_increase", "pilot", `Causal knowledge: explain the continuing increase, ${c.anomaly} anomaly version`, "algae_open",
      `Why does the organism keep producing more ${other} when it is extremely cold?`),
  ];
}
// Alternatives to those open responses; documented in the script, not asked.
function algaeAlternativeItems() {
  return [
    choice("ck_liquid_water", "alternative", "Alternative measure of causal knowledge: liquid water", "algae",
      "According to the company, what happens to the amount of liquid water available to the algae when it is extremely cold?",
      ["There is less liquid water", "There is about the same amount of liquid water", "There is more liquid water", "I don't remember"], 0),
    choice("ck_algae_activity", "alternative", "Alternative measure of causal knowledge: algae activity", "algae",
      "According to the company, what happens to the algae when there is too little liquid water?",
      ["They become less active", "They stay about as active", "They become more active", "I don't remember"], 0),
  ];
}

/** All questions (main and pilot) that follow `stage` in condition `cond`, in script order. */
export function questions(stage, cond) {
  const c = CONDITIONS[cond];
  const evidenceFirst = c.order === "evidence_first";

  if (stage === "planet") return [];

  if (stage === "complexity") {
    const cx = "Perceived complexity of biological processes", un = "Perceived scientific understanding";
    // the two blocks (one screen each) are shown in random order
    return [
      likert("planet_complexity_overall", "main", cx, "planet_complexity",
        "Overall, how simple or complex are the biological processes on this planet?", "Very simple", "Very complex"),
      likert("planet_complexity_factors", "pilot", cx, "planet_complexity",
        "How many different factors usually affect a biological process on this planet?", "Very few", "Very many"),
      likert("planet_complexity_interaction", "pilot", cx, "planet_complexity",
        "How much does the effect of one factor change when other factors change?", "Not at all", "Very much"),
      likert("planet_understanding_overall", "main", un, "planet_understanding",
        "How well does science understand the biological processes on this planet?", "Not well at all", "Very well"),
      likert("planet_understanding_factors", "pilot", un, "planet_understanding",
        "How well does science understand which factors affect these processes?", "Not well at all", "Very well"),
      likert("planet_understanding_interaction", "pilot", un, "planet_understanding",
        "How well does science understand how these factors affect one another?", "Not well at all", "Very well"),
    ].map((q) => ({ ...q, pageShuffle: "planet_blocks" }));
  }

  if (stage === "explanation1") {
    return [
      // predictions follow explanation 1 only when the evidence comes next
      ...(evidenceFirst ? predictionItems() : []),
      { ...choice("team_goal", "main", "Construction team's goal", "goal",
        "What is the construction team's main reason for considering the technology?",
        ["To keep apartments warm in cold weather", "To produce purple pigment", "To study how the organism changes color", "To increase the amount of gas in the air", "I don't remember"], 0),
        shuffleOptions: true, pinLast: 1 },
      { ...likert("relevance_heat", "pilot", "Relevance of heat", "goal",
        "How important is the amount of heat produced for the construction team's goal?", "Not at all important", "Extremely important"), itemShuffle: "relevance" },
      { ...likert("relevance_pigment", "pilot", "Relevance of pigment", "goal",
        "How important is the amount of purple pigment produced for the construction team's goal?", "Not at all important", "Extremely important"), itemShuffle: "relevance" },
      likert("company_knowledge", "pilot", "Company knowledge", "organism",
        "How well does the company understand how the organism works?", "Not well at all", "Very well"),
      likert("organism_complexity", "pilot", "Complexity of the organism's processes", "organism",
        "How simple or complex are the biological processes inside this organism?", "Very simple", "Very complex"),
      { ...likert("explanation1_left_out", "pilot", "Complexity of the organism's processes", "organism",
        "How likely is it that the company's explanation left out other details about how the organism works?", "Very unlikely", "Very likely"), randomPresence: 0.5 },
      open("open_explanation1", "pilot", "Causal knowledge", "explanation1_open",
        "In your own words, explain how the weather, the gas, the heat, and the purple pigment are connected."),
      // alternatives to the open response; documented in the script, not asked
      choice("ck_weather_gas", "alternative", "Alternative measure of causal knowledge: weather and gas", "explanation1_check",
        "According to the company, what happens to the amount of the gas in the air when the weather gets colder?",
        ["There is less gas", "There is about the same amount of gas", "There is more gas", "I don't remember"], 2),
      choice("ck_gas_outputs", "alternative", "Alternative measure of causal knowledge: gas and outputs", "explanation1_check",
        "According to the company, what does the organism produce from the gas?",
        ["Heat only", "Purple pigment only", "Both heat and purple pigment", "I don't remember"], 2),
    ];
  }

  if (stage === "evidence") {
    if (evidenceFirst) return [...observedItems(c), ...evidencePilotItems(c)];
    const cf = "Further measure: explanation 1 counterfactual evaluations";
    return [
      ...finalMeasures(),
      likert("expl2_true", "main", "Further measure: explanation 2 evaluations", "explanation2",
        "How likely is it that the company's explanation about the algae is true?", "Very unlikely", "Very likely"),
      likert("expl2_necessary", "main", cf, "counterfactual",
        "How necessary was it for the company to add its explanation about the algae?", "Not at all necessary", "Absolutely necessary"),
      likert("omission_acceptable_hypothetical", "main", cf, "counterfactual",
        "Suppose the company had not mentioned the algae. How acceptable would that have been?", "Not at all acceptable", "Completely acceptable"),
      ...observedItems(c),
      ...evidencePilotItems(c),
      likert("company_knowledge_final", "pilot", "Company knowledge", "company",
        "How well does the company understand how the organism works?", "Not well at all", "Very well"),
    ];
  }

  if (stage === "elaboration") {
    if (!evidenceFirst) return [...predictionItems(), algaeDependenceItem(c), ...algaeOpenItems(c), ...algaeAlternativeItems()];
    const e2 = "Further measure: explanation 2 evaluations", cf = "Further measure: explanation 1 counterfactual evaluations";
    return [
      algaeDependenceItem(c),
      ...finalMeasures(),
      likert("expl2_reasonable_addition", "main", e2, "explanation2_agree",
        "How much do you agree or disagree with this statement? The company's explanation about the algae is a reasonable addition to its first explanation.", "Strongly disagree", "Strongly agree"),
      likert("expl2_excuses", "main", e2, "explanation2_agree",
        "How much do you agree or disagree with this statement? The company seems to be making excuses for the test results.", "Strongly disagree", "Strongly agree"),
      likert("should_have_mentioned", "main", cf, "counterfactual",
        "Should the company have mentioned the algae in its first explanation?", "Definitely not", "Definitely yes"),
      likert("omission_acceptable", "main", cf, "counterfactual",
        "How acceptable was it for the company to leave the algae out of its first explanation?", "Not at all acceptable", "Completely acceptable"),
      ...algaeOpenItems(c),
      likert("company_knew_algae", "pilot", "Knowledge check", "company",
        "How likely is it that the company already knew about the algae when it first explained the organism?", "Very unlikely", "Very likely"),
      ...algaeAlternativeItems(),
    ];
  }

  throw new Error(`Unknown stage: ${stage}`);
}

/** Questions for one stage in the given mode, grouped into screens. mode: "pilot" (all) | "main" (Main only). */
export function questionPages(stage, cond, mode) {
  const items = questions(stage, cond).filter((q) => q.use === "main" || (q.use === "pilot" && mode === "pilot"));
  const pages = [];
  items.forEach((q) => {
    const last = pages[pages.length - 1];
    if (last && last.key === q.page) last.items.push(q);
    else pages.push({ key: q.page, items: [q] });
  });
  return pages;
}

/**
 * The "Presentation order" notes of the script for a stage: what is randomized.
 * check:script compares these with the script, so a randomization cannot be added
 * here (or in the script) without the other.
 */
export function orderNotes(stage, cond) {
  // the end evaluations follow the last stage: elaboration when the evidence came first, evidence otherwise
  const lastStage = STAGE_SEQUENCE[CONDITIONS[cond].order][4];
  if (stage === lastStage) {
    return ["The three question blocks Complexity (primary), Source trust / Cooperativeness (primary) and Utility (secondary control) are shown in random order. The order of the questions within a block is fixed. All other questions follow the order of the table."];
  }
  if (stage === "complexity") {
    return ["The two question blocks (perceived complexity, perceived scientific understanding) are shown in random order. The order of the questions within a block is fixed. In the main study each block has one question, so this randomizes the order of the two questions."];
  }
  if (stage === "explanation1") {
    return [
      "The answer options of the construction team's goal question are shown in random order, except that \"I don't remember\" is always last.",
      "The two relevance questions (heat, pigment) are shown in random order.",
      "The question on whether the company's explanation left out other details is shown to a random half of the participants.",
    ];
  }
  return [];
}

function shuffled(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// applies `fn` to each maximal run of consecutive elements that share a (non-empty) key
function mapRuns(list, keyOf, fn) {
  const out = [];
  for (let i = 0; i < list.length;) {
    const key = keyOf(list[i]);
    let j = i + 1;
    while (key && j < list.length && keyOf(list[j]) === key) j++;
    out.push(...(key && j - i > 1 ? fn(list.slice(i, j), key) : list.slice(i, j)));
    i = j;
  }
  return out;
}

/**
 * Applies the randomizations to the screens of one stage (from questionPages).
 * Returns { pages, orders }: `pages` in presentation order, where a choice item
 * with shuffled options has `optionOrder` (original option indices in display
 * order); `orders` maps a data column name to what was drawn. `presence` can fix
 * whether an item with randomPresence is shown (used by the test-setup screen).
 */
export function randomizePages(pages, rand = Math.random, presence = {}) {
  const orders = {};
  // an item with randomPresence is shown with that probability, unless `presence`
  // ({ id: true | false }) fixes it; a screen left without items is dropped
  const shown = (q) => {
    if (q.randomPresence === undefined) return true;
    const keep = q.id in presence ? !!presence[q.id] : rand() < q.randomPresence;
    orders[`${q.id}_shown`] = keep;
    return keep;
  };
  let out = pages.map((p) => ({ key: p.key, items: p.items.filter(shown) })).filter((p) => p.items.length > 0).map((p) => ({
    key: p.key,
    items: mapRuns(p.items, (q) => q.itemShuffle, (run, key) => {
      const s = shuffled(run, rand);
      orders[`order_${key}`] = s.map((q) => q.id).join(",");
      return s;
    }).map((q) => {
      if (!q.shuffleOptions) return q;
      const n = q.options.length - (q.pinLast || 0);
      const order = [...shuffled([...Array(n).keys()], rand), ...Array.from({ length: q.options.length - n }, (_, k) => n + k)];
      orders[`${q.id}_option_order`] = order.map((k) => q.options[k]).join(" | ");
      return { ...q, optionOrder: order };
    }),
  }));
  const groupOf = (p) => (p.items.every((q) => q.pageShuffle && q.pageShuffle === p.items[0].pageShuffle) ? p.items[0].pageShuffle : null);
  out = mapRuns(out, groupOf, (run, key) => {
    const s = shuffled(run, rand);
    orders[`order_${key}`] = s.map((p) => p.key).join(",");
    return s;
  });
  return { pages: out, orders };
}

/** The text of an item as it is written in the script's question tables. */
export function scriptText(q) {
  if (q.type === "likert") return `${q.prompt} (1 = ${q.low}; ${q.mid ? `${SCALE_MID} = ${q.mid}; ` : ""}${SCALE_POINTS} = ${q.high})`;
  if (q.type === "choice") return `${q.prompt} (${q.options.join("; ")})`;
  return `${q.prompt} (Open response)`;
}
