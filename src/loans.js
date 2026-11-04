// Sample lender data and the scoring logic for Loan Poacher.
// Rates are illustrative sample values, not live quotes.

// The browser loads i18n.js before this file; tests running in Node load it here.
const i18n = typeof module !== "undefined" ? require("./i18n.js") : { t };

const LENDERS = [
  {
    id: "federal",
    name: "Federal Direct Loan",
    type: "Federal",
    url: "https://studentaid.gov/understand-aid/types/loans/subsidized-unsubsidized",
    aprMin: 6.39,
    aprMax: 6.39,
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
    originationFeePercent: 0,
    minCreditScore: 680,
    maxAmount: 150000,
    flexibility: 6,
    acceptsInternational: false,
  },
];

const RESIDENCY_STATUSES = ["citizen", "permanent-resident", "international"];

// A cosigner with good credit lets a student qualify and price as if their score were at least this.
const COSIGNER_CREDIT_SCORE = 720;

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

// What is still owed at the start and after each year of payments; the last entry is exactly $0.
function repaymentBalances(principal, aprPercent, years) {
  const monthlyRate = aprPercent / 100 / 12;
  const payment = monthlyPayment(principal, aprPercent, years);
  const balances = [principal];
  let balance = principal;
  for (let month = 1; month <= years * 12; month++) {
    balance = balance * (1 + monthlyRate) - payment;
    if (month % 12 === 0) balances.push(balance);
  }
  balances[years] = 0;
  return balances;
}

// Better credit moves the estimate from the top of a lender's range toward the bottom.
function estimateApr(lender, creditScore) {
  if (lender.aprMin === lender.aprMax) return lender.aprMin;
  if (creditScore === null) return (lender.aprMin + lender.aprMax) / 2;
  const position = clamp((creditScore - 600) / (800 - 600), 0, 1);
  return lender.aprMax - position * (lender.aprMax - lender.aprMin);
}

function effectiveCreditScore(creditScore, hasCosigner) {
  if (!hasCosigner) return creditScore;
  return Math.max(creditScore ?? 0, COSIGNER_CREDIT_SCORE);
}

// Returns a list of error messages; empty means the inputs are usable.
function validateInputs({ amount, monthlyBudget, years, creditScore, residency }) {
  const errors = [];
  if (!Number.isFinite(amount) || amount < 500 || amount > 200000) {
    errors.push(i18n.t("error.amount"));
  }
  if (!Number.isFinite(monthlyBudget) || monthlyBudget <= 0) {
    errors.push(i18n.t("error.monthlyBudget"));
  }
  if (![5, 10, 15, 20].includes(years)) {
    errors.push(i18n.t("error.years"));
  }
  if (creditScore !== null && (!Number.isFinite(creditScore) || creditScore < 300 || creditScore > 850)) {
    errors.push(i18n.t("error.creditScore"));
  }
  if (!RESIDENCY_STATUSES.includes(residency)) {
    errors.push(i18n.t("error.residency"));
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

function evaluateLender(lender, inputs) {
  const { amount, monthlyBudget, years, creditScore, hasCosigner } = inputs;
  const score = effectiveCreditScore(creditScore, hasCosigner);

  const reason = ineligibilityReason(lender, inputs, score);
  if (reason !== null) {
    return { lender, eligible: false, rating: 0, rawScore: 0, summary: reason };
  }

  const coveredAmount = Math.min(amount, lender.maxAmount);
  const coverage = coveredAmount / amount;
  const apr = estimateApr(lender, score);
  const principal = coveredAmount * (1 + lender.originationFeePercent / 100);
  const payment = monthlyPayment(principal, apr, years);
  const totalCost = payment * years * 12;

  const budgetRatio = payment / monthlyBudget;
  const affordability = budgetRatio <= 0.7 ? 1 : clamp(1 - (budgetRatio - 0.7) / 0.8, 0, 1);
  const rateScore = clamp((16 - apr) / (16 - 4), 0, 1);
  const flexibilityScore = lender.flexibility / 10;
  const feeScore = clamp(1 - lender.originationFeePercent / 5, 0, 1);
  const weighted = 0.4 * affordability + 0.3 * rateScore + 0.2 * flexibilityScore + 0.1 * feeScore;
  const rawScore = 10 * weighted * (0.5 + 0.5 * coverage);

  const parts = [];
  const rateLabel = lender.aprMin === lender.aprMax ? "fixed" : score === null ? "typical" : "estimated";
  parts.push(i18n.t(`summary.rate.${rateLabel}`, { apr: apr.toFixed(2), payment: formatMoney(payment), years }));
  if (budgetRatio <= 1) {
    parts.push(i18n.t("summary.fitsBudget", { budget: formatMoney(monthlyBudget) }));
  } else {
    parts.push(i18n.t("summary.overBudget", { amount: formatMoney(payment - monthlyBudget) }));
  }
  if (coverage < 1) {
    parts.push(i18n.t("summary.partialCoverage", { amount: formatMoney(coveredAmount) }));
  }
  if (lender.minCreditScore !== null && score === null) {
    parts.push(i18n.t("summary.needsCreditCheck"));
  }
  parts.push(i18n.t("summary.perks", { perks: i18n.t(`perks.${lender.id}`) }));

  return {
    lender,
    eligible: true,
    apr,
    payment,
    totalCost,
    balances: repaymentBalances(principal, apr, years),
    coveredAmount,
    rawScore,
    rating: Math.round(rawScore),
    summary: parts.join(i18n.t("summary.separator")),
  };
}

// Lenders open to this student's location: every national lender, plus their own state's program.
function lendersForLocation(state, lenders = LENDERS) {
  return lenders.filter((lender) => lender.state === undefined || lender.state === state);
}

// Every lender available in the student's location, best first.
function rankLenders(inputs, lenders = LENDERS) {
  return lendersForLocation(inputs.state, lenders)
    .map((lender) => evaluateLender(lender, inputs))
    .sort((a, b) => b.rawScore - a.rawScore);
}

if (typeof module !== "undefined") {
  module.exports = {
    LENDERS,
    monthlyPayment,
    repaymentBalances,
    estimateApr,
    validateInputs,
    evaluateLender,
    lendersForLocation,
    rankLenders,
    formatMoney,
  };
}
