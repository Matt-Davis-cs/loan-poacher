// The report behind ?debug=1: what was entered and how each lender's rating was scored, as plain English text that
// can be copied when someone reports a rating that looks wrong. It only reads the results; nothing is sent or saved.

// The browser loads loans.js before this file; tests running in Node load it here.
const loanLogic = typeof module !== "undefined" ? require("./loans.js") : { RATING_WEIGHTS, formatMoney };

function formatCents(value) {
  return "$" + value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPercent(fraction) {
  return `${Math.round(fraction * 100)}%`;
}

function historyGiven(inputs) {
  return Boolean(inputs.incarceratedNow || inputs.pastSentence || inputs.federalDefault || inputs.recentBankruptcy)
    || (inputs.otherDebtPayments ?? null) !== null;
}

function describeInputs(inputs) {
  return [
    `${loanLogic.formatMoney(inputs.amount)} this year`,
    `${loanLogic.formatMoney(inputs.monthlyBudget)}/month budget`,
    inputs.years === 1 ? "1 year" : `${inputs.years} years`,
    `credit score: ${inputs.creditScore ?? "not given"}`,
    `APR filter: ${inputs.minApr ?? "any"}% to ${inputs.maxApr ?? "any"}%`,
    `rate type: ${inputs.rateType ?? "any"}`,
    `residency: ${inputs.residency}`,
    `state: ${inputs.state ?? "not given"}`,
    inputs.hasCosigner
      ? `cosigner: yes (score: ${inputs.cosignerCreditScore ?? "not given"}, `
        + `cash and assets: ${inputs.cosignerCapital === null ? "not given" : loanLogic.formatMoney(inputs.cosignerCapital)})`
      : "cosigner: no",
    inputs.annualIncome === null || inputs.annualIncome === undefined
      ? "income: not given"
      : `income: ${loanLogic.formatMoney(inputs.annualIncome)}/year, ${inputs.incomeShare}% toward loans `
        + `(${loanLogic.formatMoney((inputs.annualIncome * inputs.incomeShare) / 100 / 12)}/month)`,
    `history: ${historyGiven(inputs) ? "given (answers are private and not shown)" : "not given"}`,
    `age: ${(inputs.age ?? null) === null ? "not given" : "given (not shown)"}`,
  ].join(", ");
}

function describeResult(result, place, inputs) {
  const heading = `#${place} ${result.lender.name} (${result.lender.type})`;
  if (result.fromHistory) return `${heading}: 0/10, unavailable because of an answer in Your history`;
  if (!result.eligible) return `${heading}: 0/10, unavailable: ${result.summary}`;

  const { parts } = result;
  const coverageText = parts.coverage < 1
    ? `covers ${loanLogic.formatMoney(result.coveredAmount)} of ${loanLogic.formatMoney(inputs.amount)} (${formatPercent(parts.coverage)})`
    : "covers the whole amount";
  const measure = parts.fromIncome > inputs.monthlyBudget ? "the income share" : "budget";
  const extraLine = result.payment > result.requiredPayment
    ? [`   paying ${formatCents(result.payment)}/month from income, paid off within ${result.balances.length - 1} years`]
    : [];
  return [
    `${heading}: ${result.rating}/10 (score ${result.rawScore.toFixed(2)})`,
    `   APR ${result.apr.toFixed(2)}% (${result.rateType}), ${coverageText}, required payment ${formatCents(result.requiredPayment)}/month = ` +
      `${formatPercent(parts.budgetRatio)} of ${measure} (${formatPercent(parts.wholeAmountRatio)} for the whole amount)`,
    ...extraLine,
    `   affordability ${parts.affordability.toFixed(2)}, rate ${parts.rate.toFixed(2)}, ` +
      `flexibility ${parts.flexibility.toFixed(2)}, fee ${parts.fee.toFixed(2)}, coverage cut ×${parts.coverageMultiplier.toFixed(2)}` +
      (parts.historyCut > 0 ? `, Your history −${parts.historyCut.toFixed(2)}` : "") +
      (parts.overBudgetCap ? ", then shrunk to 0–2 for being over 150% of what can be paid" : ""),
  ].join("\n");
}

function debugReport(inputs, ranked) {
  const weights = loanLogic.RATING_WEIGHTS;
  return [
    "Loan Poacher debug report",
    `Entered: ${describeInputs(inputs)}`,
    `Score = 10 × (affordability × ${weights.affordability} + rate × ${weights.rate} + ` +
      `flexibility × ${weights.flexibility} + fee × ${weights.fee}) × coverage cut − any Your history cut (never below 0); ` +
      "the rating is the score rounded.",
    "Affordability is 1 while the required payment for the whole amount is at most 70% of the budget (or of the " +
      "income share, when that is larger), and 0 at 150% or more.",
    "",
    ...ranked.map((result, index) => describeResult(result, index + 1, inputs)),
  ].join("\n");
}

if (typeof module !== "undefined") {
  module.exports = { debugReport };
}
