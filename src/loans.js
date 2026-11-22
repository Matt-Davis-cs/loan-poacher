// Sample lender data and the scoring logic for Loan Poacher.
// Rates are illustrative sample values, not live quotes.

// The browser loads i18n.js before this file; tests running in Node load it here.
const i18n = typeof module !== "undefined" ? require("./i18n.js") : { t, formatYears };

// The repayment term a student can pick, in whole years.
const MIN_YEARS = 1;
const MAX_YEARS = 50;

// A loan whose required payment is more than this many times what the student can put in each month is rated at
// most OVER_BUDGET_CAP points, since it can't really be afforded however good its rate is (Matthew's choice, 2026-11-21).
// Its score is shrunk into 0 to OVER_BUDGET_CAP rather than cut off there, so better loans still rank above worse ones.
const OVER_BUDGET_LIMIT = 1.5;
const OVER_BUDGET_CAP = 2;

// The rate types a student can choose: Any (every loan at its fixed rate, as before), Fixed, or Variable.
// Private lenders also offer variable rates (sample ranges in variableApr); Federal and state programs don't.
const RATE_TYPES = ["any", "fixed", "variable"];

// The APR range a student can set as a filter, in percent.
const MIN_APR_FILTER = 0;
const MAX_APR_FILTER = 30;

// The yearly income a student can enter, and the share of it (in percent) they can put toward a loan.
const MAX_ANNUAL_INCOME = 10000000;
// The most a student can enter for their other monthly debt payments.
const MAX_OTHER_DEBT_PAYMENTS = 1000000;
// Private lenders often want every monthly debt payment, this loan's included, to stay under this share of income;
// past it a private loan starts losing a point, and it loses the whole point at DEBT_TO_INCOME_FULL_CUT.
const DEBT_TO_INCOME_LIMIT = 0.36;
const DEBT_TO_INCOME_FULL_CUT = 0.5;
const MIN_INCOME_SHARE = 1;
const MAX_INCOME_SHARE = 100;

const LENDERS = [
  {
    id: "federal",
    name: "Federal Direct Loan",
    type: "Federal",
    url: "https://studentaid.gov/understand-aid/types/loans/subsidized-unsubsidized",
    aprMin: 6.39,
    aprMax: 6.39,
    variableApr: null,
    originationFeePercent: 1.057,
    minCreditScore: null,
    maxAmount: 7500,
    flexibility: 10,
    acceptsInternational: false,
  },
  {
    id: "sallie-mae",
    name: "Sallie Mae",
    type: "Private",
    url: "https://www.salliemae.com/student-loans/",
    aprMin: 4.5,
    aprMax: 15.5,
    variableApr: { min: 3.7, max: 15.0 },
    originationFeePercent: 0,
    minCreditScore: 650,
    maxAmount: 150000,
    flexibility: 6,
    acceptsInternational: true,
  },
  {
    id: "sofi",
    name: "SoFi",
    type: "Private",
    url: "https://www.sofi.com/private-student-loans/",
    aprMin: 4.0,
    aprMax: 14.8,
    variableApr: { min: 3.2, max: 14.3 },
    originationFeePercent: 0,
    minCreditScore: 650,
    maxAmount: 150000,
    flexibility: 6,
    acceptsInternational: false,
  },
  {
    id: "college-ave",
    name: "College Ave",
    type: "Private",
    url: "https://www.collegeave.com/",
    aprMin: 4.1,
    aprMax: 16.0,
    variableApr: { min: 3.3, max: 15.5 },
    originationFeePercent: 0,
    minCreditScore: 640,
    maxAmount: 150000,
    flexibility: 5,
    acceptsInternational: true,
  },
  {
    id: "earnest",
    name: "Earnest",
    type: "Private",
    url: "https://www.earnest.com/student-loans",
    aprMin: 4.0,
    aprMax: 16.5,
    variableApr: { min: 3.2, max: 16.0 },
    originationFeePercent: 0,
    minCreditScore: 650,
    maxAmount: 150000,
    flexibility: 7,
    acceptsInternational: false,
  },
  {
    id: "ascent",
    name: "Ascent",
    type: "Private",
    url: "https://www.ascentfunding.com/",
    aprMin: 4.5,
    aprMax: 15.7,
    variableApr: { min: 3.7, max: 15.2 },
    originationFeePercent: 0,
    minCreditScore: 540,
    maxAmount: 200000,
    flexibility: 5,
    acceptsInternational: false,
  },
  {
    id: "citizens",
    name: "Citizens",
    type: "Private",
    url: "https://www.citizensbank.com/student-loans/",
    aprMin: 4.2,
    aprMax: 15.9,
    variableApr: { min: 3.4, max: 15.4 },
    originationFeePercent: 0,
    minCreditScore: 670,
    maxAmount: 150000,
    flexibility: 5,
    acceptsInternational: true,
  },
  // Nonprofit state programs, shown only to residents of that state.
  {
    id: "mefa",
    name: "MEFA",
    type: "State",
    state: "MA",
    url: "https://www.mefa.org/",
    aprMin: 4.6,
    aprMax: 8.5,
    variableApr: null,
    originationFeePercent: 0,
    minCreditScore: 670,
    maxAmount: 150000,
    flexibility: 6,
    acceptsInternational: false,
  },
  {
    id: "risla",
    name: "RISLA",
    type: "State",
    state: "RI",
    url: "https://www.risla.com/",
    aprMin: 4.3,
    aprMax: 7.9,
    variableApr: null,
    originationFeePercent: 0,
    minCreditScore: 680,
    maxAmount: 150000,
    flexibility: 7,
    acceptsInternational: false,
  },
  {
    id: "njclass",
    name: "NJCLASS",
    type: "State",
    state: "NJ",
    url: "https://www.hesaa.org/",
    aprMin: 4.9,
    aprMax: 8.2,
    variableApr: null,
    originationFeePercent: 0,
    minCreditScore: 670,
    maxAmount: 150000,
    flexibility: 6,
    acceptsInternational: false,
  },
  {
    id: "chesla",
    name: "CHESLA",
    type: "State",
    state: "CT",
    url: "https://www.chesla.org/",
    aprMin: 4.5,
    aprMax: 7.6,
    variableApr: null,
    originationFeePercent: 0,
    minCreditScore: 680,
    maxAmount: 150000,
    flexibility: 6,
    acceptsInternational: false,
  },
];

const RESIDENCY_STATUSES = ["citizen", "permanent-resident", "international"];

// How much each part counts toward a rating; they add up to 1.
const RATING_WEIGHTS = { affordability: 0.4, rate: 0.3, flexibility: 0.2, fee: 0.1 };

// A cosigner lets a student qualify and price as if their score were at least the cosigner's.
// When the cosigner's score isn't given, "a cosigner with good credit" is taken to mean this.
const COSIGNER_CREDIT_SCORE = 720;
// A cosigner whose cash and assets cover less than this share of the amount is weaker backing,
// so lenders count their score this many points lower.
const COSIGNER_CAPITAL_SHARE = 0.25;
const THIN_CAPITAL_SCORE_CUT = 50;
const MAX_COSIGNER_CAPITAL = 100000000;

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

// Standard amortized monthly payment.
function monthlyPayment(principal, aprPercent, years) {
  const months = years * 12;
  const monthlyRate = aprPercent / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  return (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -months));
}

// Paying `payment` each month for at most `years`: what is still owed at the start and after each year (the last
// entry is exactly $0, in the year the loan is paid off), how many months that takes, and the total paid. The last
// payment is only what is left, and at the standard payment the loan ends with the term.
function repaymentPlan(principal, aprPercent, years, payment) {
  const monthlyRate = aprPercent / 100 / 12;
  const balances = [principal];
  let balance = principal;
  let totalPaid = 0;
  for (let month = 1; month <= years * 12; month++) {
    const owed = balance * (1 + monthlyRate);
    if (owed <= payment || month === years * 12) {
      balances.push(0);
      return { balances, months: month, totalPaid: totalPaid + owed };
    }
    balance = owed - payment;
    totalPaid += payment;
    if (month % 12 === 0) balances.push(balance);
  }
  return { balances, months: 0, totalPaid };
}

// What is still owed at the start and after each year of standard payments; the last entry is exactly $0.
function repaymentBalances(principal, aprPercent, years) {
  return repaymentPlan(principal, aprPercent, years, monthlyPayment(principal, aprPercent, years)).balances;
}

// What the student puts toward a loan each month from their income: a share of their yearly income, or 0 without one.
function monthlyFromIncome({ annualIncome = null, incomeShare = null }) {
  if (!Number.isFinite(annualIncome) || !Number.isFinite(incomeShare)) return 0;
  return (annualIncome * incomeShare) / 100 / 12;
}

// Better credit moves the estimate from the top of a lender's range toward the bottom.
function estimateApr(lender, creditScore) {
  if (lender.aprMin === lender.aprMax) return lender.aprMin;
  if (creditScore === null) return (lender.aprMin + lender.aprMax) / 2;
  const position = clamp((creditScore - 600) / (800 - 600), 0, 1);
  return lender.aprMax - position * (lender.aprMax - lender.aprMin);
}

// The score lenders see from the cosigner, or null without one.
function cosignerScore({ amount, hasCosigner, cosignerCreditScore = null, cosignerCapital = null }) {
  if (!hasCosigner) return null;
  const score = cosignerCreditScore ?? COSIGNER_CREDIT_SCORE;
  const thinCapital = cosignerCapital !== null && cosignerCapital < amount * COSIGNER_CAPITAL_SHARE;
  return thinCapital ? score - THIN_CAPITAL_SCORE_CUT : score;
}

function effectiveCreditScore(inputs) {
  const backing = cosignerScore(inputs);
  if (backing === null) return inputs.creditScore;
  return Math.max(inputs.creditScore ?? 0, backing);
}

// Returns a list of error messages; empty means the inputs are usable.
function validateInputs({
  amount,
  monthlyBudget,
  years,
  creditScore,
  residency,
  minApr = null,
  maxApr = null,
  hasCosigner = false,
  cosignerCreditScore = null,
  cosignerCapital = null,
  annualIncome = null,
  incomeShare = null,
  otherDebtPayments = null,
}) {
  const errors = [];
  if (!Number.isFinite(amount) || amount < 500 || amount > 200000) {
    errors.push(i18n.t("error.amount"));
  }
  if (!Number.isFinite(monthlyBudget) || monthlyBudget <= 0) {
    errors.push(i18n.t("error.monthlyBudget"));
  }
  if (!Number.isInteger(years) || years < MIN_YEARS || years > MAX_YEARS) {
    errors.push(i18n.t("error.years"));
  }
  if (creditScore !== null && (!Number.isFinite(creditScore) || creditScore < 300 || creditScore > 850)) {
    errors.push(i18n.t("error.creditScore"));
  }
  if (!RESIDENCY_STATUSES.includes(residency)) {
    errors.push(i18n.t("error.residency"));
  }
  if (hasCosigner && cosignerCreditScore !== null
    && (!Number.isFinite(cosignerCreditScore) || cosignerCreditScore < 300 || cosignerCreditScore > 850)) {
    errors.push(i18n.t("error.cosignerScore"));
  }
  if (hasCosigner && cosignerCapital !== null
    && (!Number.isFinite(cosignerCapital) || cosignerCapital < 0 || cosignerCapital > MAX_COSIGNER_CAPITAL)) {
    errors.push(i18n.t("error.cosignerCapital"));
  }
  const aprInRange = (apr) => apr === null || (Number.isFinite(apr) && apr >= MIN_APR_FILTER && apr <= MAX_APR_FILTER);
  if (!aprInRange(minApr) || !aprInRange(maxApr) || (minApr !== null && maxApr !== null && minApr > maxApr)) {
    errors.push(i18n.t("error.aprRange"));
  }
  if (annualIncome !== null && (!Number.isFinite(annualIncome) || annualIncome < 0 || annualIncome > MAX_ANNUAL_INCOME)) {
    errors.push(i18n.t("error.income"));
  }
  // The share only matters once there is an income to take it from.
  if (annualIncome !== null
    && (!Number.isFinite(incomeShare) || incomeShare < MIN_INCOME_SHARE || incomeShare > MAX_INCOME_SHARE)) {
    errors.push(i18n.t("error.incomeShare"));
  }
  if (otherDebtPayments !== null
    && (!Number.isFinite(otherDebtPayments) || otherDebtPayments < 0 || otherDebtPayments > MAX_OTHER_DEBT_PAYMENTS)) {
    errors.push(i18n.t("error.otherDebts"));
  }
  return errors;
}

function formatMoney(value) {
  return "$" + Math.round(value).toLocaleString("en-US");
}

// Why the student can't get this loan, or null if they can.
function ineligibilityReason(lender, inputs, score) {
  if (inputs.residency === "international") {
    if (lender.type === "Federal") {
      return i18n.t("reason.federalResidency");
    }
    if (!lender.acceptsInternational) {
      return i18n.t("reason.citizensOnly");
    }
    if (!inputs.hasCosigner) {
      return i18n.t("reason.internationalCosigner");
    }
  }
  if (lender.minCreditScore !== null && score !== null && score < lender.minCreditScore) {
    return i18n.t("reason.creditScore", { score: lender.minCreditScore });
  }
  return null;
}

// Why Your history rules out a federal loan, or null: federal student loans aren't available while serving a sentence
// in a correctional facility, or while a federal student loan is in default.
function historyReason(lender, inputs) {
  if (lender.type !== "Federal") return null;
  if (inputs.incarceratedNow) return i18n.t("reason.incarcerated");
  if (inputs.federalDefault) return i18n.t("reason.federalDefault");
  return null;
}

// Every monthly debt payment, this loan's required payment included, as a share of monthly income; null without both.
function debtToIncomeRatio({ annualIncome = null, otherDebtPayments = null }, requiredPayment) {
  if (!Number.isFinite(annualIncome) || annualIncome <= 0 || !Number.isFinite(otherDebtPayments)) return null;
  return (otherDebtPayments + requiredPayment) / (annualIncome / 12);
}

// What Your history does to an available loan: rating points taken off, and the notes that explain them. Federal
// loans never lose points (a past sentence only gets a note saying so). Private and state loans lose 1 point for a
// sentence, past or present; up to 1 point once debts pass DEBT_TO_INCOME_LIMIT of income; and 1 point for a recent
// bankruptcy, unless the student's own credit score was entered, since it already reflects the bankruptcy.
function historyEffects(lender, inputs, requiredPayment) {
  if (lender.type === "Federal") {
    return { cut: 0, notes: inputs.pastSentence ? [{ kind: "info", text: i18n.t("summary.recordFederal") }] : [] };
  }
  let cut = 0;
  const notes = [];
  if (inputs.pastSentence || inputs.incarceratedNow) {
    cut += 1;
    notes.push({ kind: "record", text: i18n.t("summary.recordPrivate") });
  }
  const debtToIncome = debtToIncomeRatio(inputs, requiredPayment);
  if (debtToIncome !== null && debtToIncome > DEBT_TO_INCOME_LIMIT) {
    cut += clamp((debtToIncome - DEBT_TO_INCOME_LIMIT) / (DEBT_TO_INCOME_FULL_CUT - DEBT_TO_INCOME_LIMIT), 0, 1);
    notes.push({ kind: "debt", text: i18n.t("summary.debtToIncome", { percent: Math.round(debtToIncome * 100) }) });
  }
  if (inputs.recentBankruptcy) {
    if ((inputs.creditScore ?? null) === null) cut += 1;
    notes.push({ kind: "bankruptcy", text: i18n.t("summary.bankruptcy") });
  }
  return { cut, notes };
}

// Why this loan's estimated APR is outside the range the student set, or null if it is inside (or no range is set).
function aprFilterReason(apr, { minApr = null, maxApr = null }) {
  if (maxApr !== null && apr > maxApr) {
    return i18n.t("reason.aprAboveMax", { apr: apr.toFixed(2), limit: maxApr });
  }
  if (minApr !== null && apr < minApr) {
    return i18n.t("reason.aprBelowMin", { apr: apr.toFixed(2), limit: minApr });
  }
  return null;
}

function evaluateLender(lender, inputs) {
  const { amount, monthlyBudget, years } = inputs;
  const score = effectiveCreditScore(inputs);

  const reason = ineligibilityReason(lender, inputs, score);
  if (reason !== null) {
    return { lender, eligible: false, rating: 0, rawScore: 0, summary: reason };
  }
  const privateReason = historyReason(lender, inputs);
  if (privateReason !== null) {
    // fromHistory keeps the ?debug=1 report from showing the reason, which would reveal the answer.
    return { lender, eligible: false, rating: 0, rawScore: 0, summary: privateReason, fromHistory: true };
  }

  const rateType = RATE_TYPES.includes(inputs.rateType) ? inputs.rateType : "any";
  // A lender without a variable range (Federal, state programs) only offers fixed rates.
  const variableApr = lender.variableApr ?? null;
  if (rateType === "variable" && variableApr === null) {
    return { lender, eligible: false, rating: 0, rawScore: 0, summary: i18n.t("reason.fixedOnly") };
  }
  const usesVariable = rateType === "variable";
  const rates = usesVariable ? { aprMin: variableApr.min, aprMax: variableApr.max } : lender;

  const coveredAmount = Math.min(amount, lender.maxAmount);
  const coverage = coveredAmount / amount;
  const apr = estimateApr(rates, score);
  const aprReason = aprFilterReason(apr, inputs);
  if (aprReason !== null) {
    return { lender, eligible: false, rating: 0, rawScore: 0, summary: aprReason };
  }
  const principal = coveredAmount * (1 + lender.originationFeePercent / 100);
  const requiredPayment = monthlyPayment(principal, apr, years);
  const standardCost = requiredPayment * years * 12;
  // A share of income bigger than the required payment goes toward the loan, paying it off before the term.
  const fromIncome = monthlyFromIncome(inputs);
  const paysExtra = fromIncome > requiredPayment;
  const payment = paysExtra ? fromIncome : requiredPayment;
  const plan = paysExtra ? repaymentPlan(principal, apr, years, payment) : null;
  const totalCost = paysExtra ? plan.totalPaid : standardCost;
  const balances = paysExtra ? plan.balances : repaymentBalances(principal, apr, years);

  // Affordability: the required payment against the most the student can put in, their budget or income share.
  const available = Math.max(monthlyBudget, fromIncome);
  const budgetRatio = requiredPayment / available;
  // Judged as if the uncovered rest were borrowed on the same terms, so covering less never looks more affordable.
  const wholeAmountRatio = budgetRatio / coverage;
  const affordability = wholeAmountRatio <= 0.7 ? 1 : clamp(1 - (wholeAmountRatio - 0.7) / 0.8, 0, 1);
  const rateScore = clamp((16 - apr) / (16 - 4), 0, 1);
  const flexibilityScore = lender.flexibility / 10;
  const feeScore = clamp(1 - lender.originationFeePercent / 5, 0, 1);
  const weighted =
    RATING_WEIGHTS.affordability * affordability +
    RATING_WEIGHTS.rate * rateScore +
    RATING_WEIGHTS.flexibility * flexibilityScore +
    RATING_WEIGHTS.fee * feeScore;
  // Covering only part of the amount already counts against affordability above, so this extra cut stays small.
  const coverageMultiplier = 0.8 + 0.2 * coverage;
  const history = historyEffects(lender, inputs, requiredPayment);
  // Judged on the whole amount, like affordability, so covering only part never escapes the cap.
  const overBudgetCap = wholeAmountRatio > OVER_BUDGET_LIMIT;
  const uncappedScore = Math.max(0, 10 * weighted * coverageMultiplier - history.cut);
  const rawScore = overBudgetCap ? (uncappedScore * OVER_BUDGET_CAP) / 10 : uncappedScore;

  // Each sentence of the summary, with its kind so the card can show the most serious one up front.
  const parts = [];
  const say = (kind, key, params) => parts.push({ kind, text: i18n.t(key, params) });
  const rateLabel = lender.aprMin === lender.aprMax ? "fixed" : score === null ? "typical" : "estimated";
  const paidOffYears = balances.length - 1;
  say("rate", `summary.rate.${rateLabel}`, { apr: apr.toFixed(2), payment: formatMoney(payment), term: i18n.formatYears(paidOffYears) });
  if (paysExtra) {
    say("budget", "summary.fromIncome", {
      share: String(inputs.incomeShare),
      term: i18n.formatYears(years),
      saved: formatMoney(standardCost - totalCost),
    });
  } else if (budgetRatio <= 1) {
    say("budget", "summary.fitsBudget", { budget: formatMoney(monthlyBudget) });
  } else {
    say("overBudget", "summary.overBudget", { amount: formatMoney(requiredPayment - available) });
  }
  if (overBudgetCap) {
    const times = wholeAmountRatio < 10 ? wholeAmountRatio.toFixed(1) : String(Math.round(wholeAmountRatio));
    say("cap", "summary.farOverBudget", { times });
  }
  if (coverage < 1) {
    say("partial", "summary.partialCoverage", { amount: formatMoney(coveredAmount) });
  }
  if (lender.minCreditScore !== null && score === null) {
    say("creditCheck", "summary.needsCreditCheck");
  }
  if (usesVariable) {
    say("variable", "summary.variableWarning");
  } else if (rateType === "any" && variableApr !== null) {
    say("info", "summary.alsoVariable", { apr: variableApr.min.toFixed(2) });
  }
  parts.push(...history.notes);
  say("info", "summary.perks", { perks: i18n.t(`perks.${lender.id}`) });
  const { short, more } = shortSummary(parts);

  return {
    lender,
    eligible: true,
    rateType: usesVariable ? "variable" : "fixed",
    apr,
    payment,
    requiredPayment,
    totalCost,
    balances,
    coveredAmount,
    rawScore,
    rating: Math.round(rawScore),
    // Each part of the rating from 0 to 1, for the ?debug=1 report.
    parts: {
      affordability,
      rate: rateScore,
      flexibility: flexibilityScore,
      fee: feeScore,
      budgetRatio,
      wholeAmountRatio,
      available,
      fromIncome,
      coverage,
      coverageMultiplier,
      historyCut: history.cut,
      overBudgetCap,
    },
    summary: parts.map((part) => part.text).join(i18n.t("summary.separator")),
    summaryShort: short,
    summaryMore: more,
  };
}

// The order warnings are kept visible in when a card's summary is folded, most serious first (Matthew's choice).
const WARNING_ORDER = ["cap", "overBudget", "debt", "bankruptcy", "record", "variable", "partial", "creditCheck"];

// Splits a summary into what a folded card shows (the rate line, then the most serious warning, or the budget or
// income line when there is none) and the rest, kept in order, for More details.
function shortSummary(parts) {
  const rate = parts.find((part) => part.kind === "rate");
  const kept =
    WARNING_ORDER.map((kind) => parts.find((part) => part.kind === kind)).find((part) => part !== undefined)
    ?? parts.find((part) => part.kind === "budget");
  const shown = [rate, kept].filter((part) => part !== undefined);
  return {
    short: shown.map((part) => part.text),
    more: parts.filter((part) => !shown.includes(part)).map((part) => part.text),
  };
}

// An unavailable loan's one-line reason is its whole summary, with nothing more to show.
function withShortSummary(result) {
  return result.summaryShort === undefined ? { ...result, summaryShort: [result.summary], summaryMore: [] } : result;
}

// Lenders open to this student's location: every national lender, plus their own state's program.
function lendersForLocation(state, lenders = LENDERS) {
  return lenders.filter((lender) => lender.state === undefined || lender.state === state);
}

// Every lender available in the student's location, best first.
function rankLenders(inputs, lenders = LENDERS) {
  return lendersForLocation(inputs.state, lenders)
    .map((lender) => withShortSummary(evaluateLender(lender, inputs)))
    .sort((a, b) => b.rawScore - a.rawScore);
}

if (typeof module !== "undefined") {
  module.exports = {
    LENDERS,
    RATING_WEIGHTS,
    monthlyPayment,
    repaymentBalances,
    repaymentPlan,
    estimateApr,
    validateInputs,
    evaluateLender,
    lendersForLocation,
    rankLenders,
    formatMoney,
  };
}
