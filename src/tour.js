// The How it works tour: short steps that each scroll to and highlight one part of the page. It opens on a first
// visit and from the How it works button. When a feature is added, give it a step here and its text in i18n.js;
// a browser check fails if a tab, form section, header control, or loan button has no step that names it.

const TOUR_SEEN_KEY = "loan-poacher-tour-seen";

// Each step's text, the parts of the page it can point at (the first one found is used), and the tab to show first.
const TOUR_STEPS = [
  { key: "tour.welcome", targets: [".brand"] },
  { key: "tour.basics", targets: ["#amount"] },
  { key: "tour.details", targets: ["#credit-score"] },
  { key: "tour.income", targets: ["#income-field"] },
  { key: "tour.history", targets: ["#history"] },
  { key: "tour.results", targets: ["#results .card", "#results"], tab: "recommendations-tab" },
  { key: "tour.saved", targets: ["#saved-tab"] },
  { key: "tour.filters", targets: ["#filters-tab"] },
  { key: "tour.look", targets: [".settings"] },
  { key: "tour.reopen", targets: ["#show-guide"] },
];

let tourStep = 0;

// A label without a trailing count or colon, like "Saved loans" from "Saved loans (2)" or "Finish" from "Finish:".
function plainLabel(text) {
  return text
    .replace(/\s*[(（][^)）]*[)）]\s*$/, "")
    .replace(/\s*[:：]\s*$/, "")
    .trim();
}

// The app's own names for its parts, in the chosen language, so the tour always matches what is on screen.
function tourLabels() {
  return {
    situation: t("form.title"),
    apr: t("form.apr"),
    income: t("form.income"),
    history: plainLabel(t("history.title")),
    recommendations: t("results.title"),
    savedTab: plainLabel(t("tabs.saved", { count: "" })),
    filtersTab: plainLabel(t("tabs.filters", { count: "", max: "" })),
    save: t("card.save"),
    graph: t("graph.show"),
    gotIt: t("received.label"),
    theme: plainLabel(t("header.theme")),
    finish: plainLabel(t("header.finish")),
    page: plainLabel(t("header.mode")),
    language: plainLabel(t("header.language")),
    howItWorks: t("header.howItWorks"),
    black: t("theme.black"),
    gray: t("theme.gray"),
    metallic: t("finish.metallic"),
    neon: t("finish.neon"),
    light: t("mode.light"),
    dark: t("mode.dark"),
    next: t("tour.next"),
    back: t("tour.back"),
    skip: t("tour.skip"),
  };
}

// The part of the page a step points at: for a form field, its whole label.
function tourTarget(step) {
  for (const selector of step.targets) {
    const element = document.querySelector(selector);
    if (element !== null) return element.matches("input, select") ? (element.closest("label") ?? element) : element;
  }
  return null;
}

function clearTourHighlight() {
  document.querySelector(".tour-highlight")?.classList.remove("tour-highlight");
}

function showTourStep(index) {
  tourStep = index;
  const step = TOUR_STEPS[index];
  if (step.tab !== undefined) selectTab(step.tab);
  document.getElementById("tour-counter").textContent = t("tour.step", { number: index + 1, total: TOUR_STEPS.length });
  document.getElementById("tour-text").textContent = t(step.key, tourLabels());
  document.getElementById("tour-back").disabled = index === 0;
  document.getElementById("tour-next").textContent = t(index === TOUR_STEPS.length - 1 ? "tour.done" : "tour.next");

  clearTourHighlight();
  const target = tourTarget(step);
  if (target === null) return;
  target.classList.add("tour-highlight");
  const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "auto" });
}

function setTourOpen(open) {
  document.getElementById("guide").hidden = !open;
  document.getElementById("show-guide").setAttribute("aria-expanded", String(open));
}

function openTour() {
  setTourOpen(true);
  showTourStep(0);
  document.getElementById("tour-next").focus({ preventScroll: true });
}

// Closes the tour and remembers it was seen, so it doesn't open by itself again.
function closeTour() {
  setTourOpen(false);
  clearTourHighlight();
  try {
    localStorage.setItem(TOUR_SEEN_KEY, "true");
  } catch {
    // Without storage the tour simply opens on every visit.
  }
}

// Shows the current step again in the chosen language, while the tour is open.
function refreshTour() {
  if (!document.getElementById("guide").hidden) showTourStep(tourStep);
}

function setUpTour() {
  document.getElementById("show-guide").addEventListener("click", openTour);
  document.getElementById("tour-next").addEventListener("click", () => {
    if (tourStep === TOUR_STEPS.length - 1) closeTour();
    else showTourStep(tourStep + 1);
  });
  document.getElementById("tour-back").addEventListener("click", () => showTourStep(Math.max(0, tourStep - 1)));
  document.getElementById("tour-skip").addEventListener("click", closeTour);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !document.getElementById("guide").hidden) closeTour();
  });

  let seen = false;
  try {
    seen = localStorage.getItem(TOUR_SEEN_KEY) === "true";
  } catch {
    // Show the tour below.
  }
  if (seen) setTourOpen(false);
  else openTour();
}
