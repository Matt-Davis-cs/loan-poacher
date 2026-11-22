// Every federal student loan rule Loan Poacher uses, in one place, with where it came from and when it was checked.
// Federal rates reset every July 1 and the law can change, so these rules are only good for one school year:
// after validThrough the app tells visitors the numbers may be out of date, and the test "the federal rules are for
// the current school year" fails. Then re-check the sources below, update this file, and record it in PLAN.md
// (CLAUDE.md has the standing rule).

const FEDERAL_RULES = {
  schoolYear: "2026–27",
  validThrough: "2027-06-30",
  checkedOn: "2026-11-22",
  // Direct Loan rates for loans first disbursed July 1, 2026 to June 30, 2027 (fixed for the life of the loan).
  rates: { undergraduate: 6.52, graduate: 8.07, professional: 8.07 },
  // The loan fee for loans first disbursed from October 1, 2020 to October 1, 2027.
  originationFeePercent: 1.057,
  // Yearly limits: undergraduates by dependency and year in school (1st, 2nd, 3rd or later), unchanged in July 2026;
  // graduate and professional students (law, medicine, and similar) under the July 2026 law, which also ended Grad
  // PLUS loans for new borrowers.
  annualLimits: {
    undergraduate: { dependent: [5500, 6500, 7500], independent: [9500, 10500, 12500] },
    graduate: 20500,
    professional: 50000,
  },
  sources: [
    "https://fsapartners.ed.gov/knowledge-center/library/electronic-announcements/2026-06-04/interest-rates-federal-direct-loans-first-disbursed-between-july-1-2026-and-june-30-2027",
    "https://studentaid.gov/understand-aid/types/loans/subsidized-unsubsidized",
    "https://www.washington.edu/financialaid/2026/06/05/federal-loan-updates-for-2026-27/",
    "https://finaid.umich.edu/loan-changes",
  ],
};

const STUDY_LEVELS = ["undergraduate", "graduate", "professional"];

// Whether the school year these rules cover has ended by `today`.
function federalRulesExpired(today) {
  return today > new Date(`${FEDERAL_RULES.validThrough}T23:59:59`);
}

if (typeof module !== "undefined") {
  module.exports = { FEDERAL_RULES, STUDY_LEVELS, federalRulesExpired };
}
