/**
 * content.js — vignette 1 text, figures and questions.
 *
 * Transcribed from ../complex_prior_pilot1_vignette1_script.md, which stays the
 * source of truth: `npm run check:script` renders every condition from this file
 * and fails if any paragraph, figure name, question, scale or Main/Pilot tag
 * differs from the script. Edit the script first, then mirror the change here.
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
// STORY TEXT
//   story(stage, cond, { surpriseText, figureVersion }) -> { paragraphs, figure, alt }
//   surpriseText   true / false: the underlined sentences of the evidence stage
//                  (evidence-first conditions only)
//   figureVersion  "table" / "line": which version of the evidence figure
// ============================================================================
export function story(stage, cond, { surpriseText = true, figureVersion = "table" } = {}) {
  const c = CONDITIONS[cond];
  const { anom, other } = outputs(c.anomaly);
  const evidenceFirst = c.order === "evidence_first";

  if (stage === "planet") {
    return {
      paragraphs: [
        "Scientists are planning a place for people to live on an alien planet. The planet has water, air, and some small living things called organisms.",
        "Scientists have closely studied the planet and its living things and understand them very well.",
      ],
      figure: `${IMG}1_planet_scene.png`,
      alt: "Two people in space suits look over a planet with water and red rocks. An inset shows small organisms.",
    };
  }

  if (stage === "complexity") {
    const low = c.complexity === "low";
    return {
      paragraphs: [
        `Scientists found that biological processes (the ways living things work) on this planet are usually ${low ? "simple" : "complex"}.`,
        low
          ? "These processes usually involve a few chemical reactions and only a few factors that affect what happens. The factors affect each other in limited ways. The effect of one factor usually stays the same, even when other factors change."
          : "These processes usually involve many chemical reactions and many different factors that affect what happens. The factors affect each other in complicated ways. The effect of one factor often changes when other factors change.",
        "Scientists have studied these processes in detail for many years. They understand them very well.",
      ],
      figure: `${IMG}2_${low ? "low" : "high"}_complex.png`,
      alt: low
        ? "Diagram of the planet's biology: a few elements, simple chemistry and simple organisms, with few links between them."
        : "Diagram of the planet's biology: diverse elements, complex chemistry and complex organisms, with many links between them.",
    };
  }

  if (stage === "explanation1") {
    return {
      paragraphs: [
        "A construction team is building apartments on this planet. The construction team needs technology that can produce heat to keep apartments warm. The planet has four seasons: warm, cool, moderately cold, and extremely cold.",
        "An energy company suggests one of its technologies that uses a small organism found on the planet. Scientists found that this organism is typical of other organisms on the planet in terms of how simple or complex it is. The company understands very well how the organism works because it has closely studied the organism with scientists.",
        "The company explains the process that the technology relies on. In this process, the organism uses a certain gas from the air to produce heat and a purple substance called a pigment. More pigment makes the organism look more purple. The pigment is harmless and has no known practical use. When more of this gas is available, the organism produces more heat and more purple pigment.",
        "The company also explains that the planet's air holds more of this gas when the weather is colder. So in colder weather, there is more gas around the organism.",
      ],
      figure: `${IMG}3_explanation1.png`,
      alt: "The company explains: with more gas, the organism can produce more heat and more purple pigment. Colder weather means more gas in the air.",
    };
  }

  if (stage === "evidence") {
    const increase = "As it gets colder, from warm to moderately cold, the organism produces more heat and more purple pigment.";
    const result = evidenceFirst
      ? [
          increase + (surpriseText ? " This is expected." : ""),
          `But when it is extremely cold, the organism produces less ${anom} than when it is moderately cold.` +
            (surpriseText ? " This is unexpected, because more gas is available for the organism to use." : "") +
            ` The organism keeps producing more ${other}` + (surpriseText ? ", as expected" : "") + ".",
        ]
      : [
          increase,
          `When it is extremely cold, the organism produces less ${anom} than when it is moderately cold, but it keeps producing more ${other}.`,
        ];
    return {
      paragraphs: [
        (evidenceFirst ? "Before deciding whether to use the technology" : "After the explanation") +
          ", the construction team gets a sample of the organism from the company.",
        "The team mainly wants to know if the organism can produce heat as explained.",
        "The team tests the sample in a laboratory at four different temperatures. These temperatures match the average temperatures of the planet's four seasons: warm, cool, moderately cold, and extremely cold. During the tests, more of the gas is available when it is colder, just as on the planet.",
        ...result,
      ],
      figure: `${IMG}4_evidence_${c.anomaly}_anomaly${figureVersion === "line" ? "_line" : ""}.png`,
      alt: "Laboratory observations at four temperatures, from warm to extremely cold: gas available, organism color and heat output.",
    };
  }

  if (stage === "elaboration") {
    return {
      paragraphs: [
        ...(evidenceFirst ? ["The construction team asks the company about this unexpected result."] : []),
        `The company ${evidenceFirst ? "explains" : "further explains"} that even smaller living things called algae live inside the organism. The organism can produce ${anom} only with the help of the algae.`,
        `The algae need liquid water to stay active. When they are active, more gas leads them to produce more ${anom}. When there is too little liquid water, they become less active and produce less ${anom}.`,
        `As the weather gets colder, more gas is available in the air. When it is moderately cold, the algae use the extra gas to produce more ${anom}.`,
        `But when it is extremely cold, most of the water available to the algae freezes. As a result, the algae become less active and produce less ${anom}, even though more gas is available.`,
        `The organism produces ${other} on its own, without the algae. So it keeps producing more ${other} as the weather gets colder.`,
      ],
      figure: `${IMG}5_explanation2_${c.anomaly}_anomaly.png`,
      alt: "The company explains what happens inside the organism when it is moderately cold and when it is extremely cold.",
    };
  }

  throw new Error(`Unknown stage: ${stage}`);
}

// ============================================================================
// QUESTIONS
//   Each item: { id, use ("main" | "pilot"), measure, page, type, prompt, ... }
//     likert  low, high, mid (label of 4, optional); answered 1-7
//     choice  options (shown in this order), correct (index of the right answer, optional)
//     open    free text
//   `page` groups consecutive items onto one screen. `id` is the column name in
//   the data. `measure` is the label used in the script tables.
// ============================================================================
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

// Primary and secondary measures asked after the last stage, in both orders.
function finalMeasures() {
  return [
    likert("complexity_overall", "main", "Complexity (primary)", "complexity",
      "How simple or complex is the way this organism works?", "Very simple", "Very complex"),
    likert("complexity_other_factors", "main", "Complexity (primary)", "complexity",
      "Besides what has been explained so far, how many other factors do you think affect how this organism works?", "None", "Very many"),
    likert("complexity_other_factors_heat", "main", "Complexity (primary)", "complexity",
      "Besides what has been explained so far, how likely is it that other factors affect how much heat this organism produces?", "Very unlikely", "Very likely"),
    likert("trust_tell", "main", "Source trust / Cooperativeness (primary)", "trust",
      "How much do you trust the company to tell the team what the team needs to know?", "Not at all", "Completely"),
    likert("trust_care", "main", "Source trust / Cooperativeness (primary)", "trust",
      "When explaining the technology, how much does the company care about what is best for the construction team?", "Not at all", "Very much"),
    likert("trust_help", "main", "Source trust / Cooperativeness (primary)", "trust",
      "When the company chose what to explain, how much was it trying to help the team make a good decision?", "Not at all", "Very much"),
    likert("utility_coldest", "main", "Utility (secondary control)", "utility",
      "How well would the technology keep apartments warm in the planet's coldest season?", "Not well at all", "Very well"),
    likert("utility_overall", "main", "Utility (secondary control)", "utility",
      "How good is this technology for heating apartments?", "Not at all good", "Very good"),
    likert("expl2_explains", "main", "Further measure: explanation 2 evaluations", "explanation2",
      "How well does the company's explanation about the algae explain the test results?", "Not well at all", "Very well"),
    likert("expl2_real_reason", "main", "Further measure: explanation 2 evaluations", "explanation2",
      "How likely is it that the algae processes are the real reason for the test results when it was extremely cold?", "Very unlikely", "Very likely"),
  ];
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
      `The organism produces less ${anom} when it is extremely cold. How much does this matter for the team's goal of keeping apartments warm?`, "Not at all", "Very much"),
  ];
}

function algaeDependenceItem(c) {
  return choice("algae_dependence", "main", "Causal knowledge: dependence on algae", "algae",
    "Which of these can the organism produce only with the help of the algae?",
    ["Heat only", "Purple pigment only", "Both heat and purple pigment", "Neither heat nor purple pigment", "I don't remember"],
    c.anomaly === "heat" ? 0 : 1);
}

function algaePilotItems(c) {
  const { anom, other } = outputs(c.anomaly);
  return [
    choice("ck_liquid_water", "pilot", "Causal knowledge: liquid water", "algae",
      "According to the company, what happens to the amount of liquid water available to the algae when it is extremely cold?",
      ["There is less liquid water", "There is about the same amount of liquid water", "There is more liquid water", "I don't remember"], 0),
    choice("ck_algae_activity", "pilot", "Causal knowledge: algae activity", "algae",
      "According to the company, what happens to the algae when there is too little liquid water?",
      ["They become less active", "They stay about as active", "They become more active", "I don't remember"], 0),
    open("open_decrease", "pilot", `Alternative measure of causal knowledge: explain the decrease, ${c.anomaly} anomaly version`, "algae_open",
      `Why does the organism produce less ${anom} when it is extremely cold, even though more gas is available?`),
    open("open_increase", "pilot", `Alternative measure of causal knowledge: explain the continuing increase, ${c.anomaly} anomaly version`, "algae_open",
      `Why does the organism keep producing more ${other} when it is extremely cold?`),
  ];
}

/** All questions (main and pilot) that follow `stage` in condition `cond`, in script order. */
export function questions(stage, cond) {
  const c = CONDITIONS[cond];
  const evidenceFirst = c.order === "evidence_first";

  if (stage === "planet") return [];

  if (stage === "complexity") {
    const cx = "Perceived complexity of biological processes", un = "Perceived scientific understanding";
    return [
      likert("planet_complexity_overall", "main", cx, "planet_complexity",
        "Overall, how simple or complex are the biological processes on this planet?", "Very simple", "Very complex"),
      likert("planet_complexity_factors", "pilot", cx, "planet_complexity",
        "How many different factors usually affect a biological process on this planet?", "Very few", "Very many"),
      likert("planet_complexity_interaction", "pilot", cx, "planet_complexity",
        "How much does the effect of one factor change when other factors change?", "Not at all", "Very much"),
      likert("planet_understanding_overall", "main", un, "planet_understanding",
        "How well do scientists understand the biological processes on this planet?", "Not well at all", "Very well"),
      likert("planet_understanding_factors", "pilot", un, "planet_understanding",
        "How well do scientists understand which factors affect these processes?", "Not well at all", "Very well"),
      likert("planet_understanding_interaction", "pilot", un, "planet_understanding",
        "How well do scientists understand how these factors affect one another?", "Not well at all", "Very well"),
    ];
  }

  if (stage === "explanation1") {
    return [
      // predictions follow explanation 1 only when the evidence comes next
      ...(evidenceFirst ? predictionItems() : []),
      choice("team_goal", "main", "Construction team's goal", "goal",
        "What is the construction team's main reason for considering the technology?",
        ["To keep apartments warm in cold weather", "To produce purple pigment", "To study how the organism changes color", "To increase the amount of gas in the air", "I don't remember"], 0),
      likert("relevance_heat", "pilot", "Relevance of heat", "goal",
        "How important is the amount of heat produced for the team's goal of keeping apartments warm?", "Not at all important", "Extremely important"),
      likert("relevance_pigment", "pilot", "Relevance of pigment", "goal",
        "How important is the amount of purple pigment produced for the team's goal of keeping apartments warm?", "Not at all important", "Extremely important"),
      choice("ck_weather_gas", "pilot", "Causal knowledge: weather and gas", "explanation1_check",
        "According to the company, what happens to the amount of the gas in the air when the weather gets colder?",
        ["There is less gas", "There is about the same amount of gas", "There is more gas", "I don't remember"], 2),
      choice("ck_gas_outputs", "pilot", "Causal knowledge: gas and outputs", "explanation1_check",
        "According to the company, what does the organism produce from the gas?",
        ["Heat only", "Purple pigment only", "Both heat and purple pigment", "I don't remember"], 2),
      open("open_explanation1", "pilot", "Alternative measure of causal knowledge", "explanation1_open",
        "In your own words, explain how the weather, the gas, the heat, and the purple pigment are connected."),
      likert("company_knowledge", "pilot", "Company knowledge", "organism",
        "How well does the company understand how the organism works?", "Not well at all", "Very well"),
      likert("organism_complexity", "pilot", "Complexity of the organism's processes", "organism",
        "How simple or complex are the biological processes inside this organism?", "Very simple", "Very complex"),
      likert("explanation1_left_out", "pilot", "Complexity of the organism's processes", "organism",
        "How likely is it that the company's explanation left out other details about how the organism works?", "Very unlikely", "Very likely"),
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
    if (!evidenceFirst) return [...predictionItems(), algaeDependenceItem(c), ...algaePilotItems(c)];
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
      ...algaePilotItems(c),
      likert("company_knew_algae", "pilot", "Knowledge check", "company",
        "How likely is it that the company already knew about the algae when it first explained the organism?", "Very unlikely", "Very likely"),
    ];
  }

  throw new Error(`Unknown stage: ${stage}`);
}

/** Questions for one stage in the given mode, grouped into screens. mode: "pilot" (all) | "main" (Main only). */
export function questionPages(stage, cond, mode) {
  const items = questions(stage, cond).filter((q) => mode === "pilot" || q.use === "main");
  const pages = [];
  items.forEach((q) => {
    const last = pages[pages.length - 1];
    if (last && last.key === q.page) last.items.push(q);
    else pages.push({ key: q.page, items: [q] });
  });
  return pages;
}

/** The text of an item as it is written in the script's question tables. */
export function scriptText(q) {
  if (q.type === "likert") return `${q.prompt} (1 = ${q.low}; ${q.mid ? `4 = ${q.mid}; ` : ""}7 = ${q.high})`;
  if (q.type === "choice") return `${q.prompt} (${q.options.join("; ")})`;
  return `${q.prompt} (Open response)`;
}
