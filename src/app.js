// Wires the form, color picker, language picker, and results list for Loan Poacher.

const COLOR_STORAGE_KEY = "loan-poacher-colors";
// Where the theme was kept before the color slider; read once so an old choice carries over, then removed.
const OLD_THEME_STORAGE_KEY = "loan-poacher-theme";
const LANGUAGE_STORAGE_KEY = "loan-poacher-language";

// Reaches localStorage only when used, so a blocked storage throws inside saved.js's try blocks.
const pageStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};
let savedLoanIds = readSavedLoanIds(pageStorage);
let loanComments = readLoanComments(pageStorage);
let receivedLoanIds = readReceivedLoanIds(pageStorage);
let filterPresets = readFilterPresets(pageStorage);
// The ?debug=1 address shows how each rating was scored, for investigating a rating someone reports as wrong.
const DEBUG_MODE = new URLSearchParams(location.search).get("debug") === "1";
// Which repayment graphs are open, so they stay open when the form changes and the cards are redrawn.
const openGraphs = new Set();
// Which cards have More details open, so they stay open when the form changes and the cards are redrawn.
const openDetails = new Set();

const US_STATES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky",
  LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

function readNumber(id) {
  const text = document.getElementById(id).value.trim();
  return text === "" ? null : Number(text);
}

function readInputs() {
  return {
    amount: readNumber("amount"),
    monthlyBudget: readNumber("monthly-budget"),
    years: readNumber("years-box"),
    creditScore: readNumber("credit-score"),
    minApr: readNumber("apr-min"),
    maxApr: readNumber("apr-max"),
    rateType: document.getElementById("rate-type").value,
    residency: document.getElementById("residency").value,
    state: document.getElementById("state").value || null,
    hasCosigner: document.getElementById("has-cosigner").checked,
    cosignerCreditScore: readNumber("cosigner-score"),
    cosignerCapital: readNumber("cosigner-capital"),
    annualIncome: readNumber("annual-income"),
    incomeShare: readNumber("income-share"),
    incarceratedNow: document.getElementById("history-incarcerated").checked,
    pastSentence: document.getElementById("history-past-sentence").checked,
    federalDefault: document.getElementById("history-federal-default").checked,
    recentBankruptcy: document.getElementById("history-bankruptcy").checked,
    otherDebtPayments: readNumber("other-debts"),
  };
}

// Shows the cosigner's details only while "I have a cosigner" is ticked.
function showCosignerDetails() {
  document.getElementById("cosigner-details").hidden = !document.getElementById("has-cosigner").checked;
}

function setUpCosigner() {
  document.getElementById("has-cosigner").addEventListener("change", showCosignerDetails);
  showCosignerDetails();
}

// Shows the chosen term next to its label, like "10 years"; blank while the typed term is not a usable number.
function showTerm() {
  const years = readNumber("years-box");
  document.getElementById("years-text").textContent = Number.isInteger(years) && years >= 1 ? formatYears(years) : "";
}

// Moves the term slider to the typed term, when the typed term is a whole number the slider can show.
function syncTermSlider() {
  const slider = document.getElementById("years");
  const years = readNumber("years-box");
  if (Number.isInteger(years) && years >= Number(slider.min) && years <= Number(slider.max)) slider.value = String(years);
}

// Keeps the slider and the typed term in step; the typed box is what the recommendations read.
function setUpTerm() {
  const slider = document.getElementById("years");
  const box = document.getElementById("years-box");
  slider.addEventListener("input", () => {
    box.value = slider.value;
    showTerm();
  });
  box.addEventListener("input", () => {
    syncTermSlider();
    showTerm();
  });
}

function setUpStates() {
  const select = document.getElementById("state");
  for (const [code, name] of Object.entries(US_STATES)) {
    select.append(new Option(name, code));
  }
}

// Tells the student whether their state added a state-run loan program to the list.
function updateLocationNote(state) {
  const note = document.getElementById("location-note");
  if (state === null) {
    note.hidden = true;
    return;
  }
  const statePrograms = LENDERS.filter((lender) => lender.state === state);
  note.textContent = statePrograms.length > 0
    ? t("location.statePrograms", {
      programs: statePrograms.map((lender) => lender.name).join(", "),
      state: US_STATES[state],
    })
    : t("location.noStatePrograms", { state: US_STATES[state] });
  note.hidden = false;
}

// The comment button at the bottom of a saved loan, and the box it opens; comments save as they are typed.
function renderCommentArea(lender) {
  const area = document.createElement("div");
  area.className = "comment-area";

  const commentText = document.createElement("p");
  commentText.className = "comment-text";

  const editor = document.createElement("label");
  editor.className = "comment-editor";
  editor.hidden = true;
  const editorLabel = document.createElement("span");
  editorLabel.textContent = t("comment.label", { lender: lender.name });
  const box = document.createElement("textarea");
  box.rows = 3;
  box.maxLength = MAX_COMMENT_LENGTH;
  box.placeholder = t("comment.placeholder");
  box.value = loanComments[lender.id] ?? "";
  const status = document.createElement("span");
  status.className = "comment-status";
  status.setAttribute("aria-live", "polite");
  editor.append(editorLabel, box, status);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "comment-button";
  button.setAttribute("aria-expanded", "false");

  const showComment = () => {
    const comment = loanComments[lender.id] ?? "";
    commentText.textContent = comment;
    commentText.hidden = comment === "" || !editor.hidden;
    button.textContent = `💬 ${comment === "" ? t("comment.add") : t("comment.edit")}`;
  };
  box.addEventListener("input", () => {
    loanComments = setLoanComment(pageStorage, loanComments, lender.id, box.value);
    status.textContent = t("comment.savedStatus");
    showComment();
  });
  button.addEventListener("click", () => {
    editor.hidden = !editor.hidden;
    button.setAttribute("aria-expanded", String(!editor.hidden));
    status.textContent = "";
    showComment();
    if (!editor.hidden) box.focus();
  });
  showComment();

  area.append(commentText, editor, button);
  return area;
}

// The "I got this loan" button on a saved loan, and the Share link it reveals; it updates in place so a comment box
// open on another card stays open.
function renderLoanOutcome(lender) {
  const area = document.createElement("div");
  area.className = "loan-outcome";

  const appLink = publicAppLink(location.href);
  const shareArea = document.createElement("div");
  const share = document.createElement("a");
  share.className = "loan-link";
  share.href = xShareUrl(t("share.message"), appLink);
  share.target = "_blank";
  share.rel = "noopener noreferrer";
  share.textContent = t("share.onX");
  shareArea.append(share);
  if (appLink === null) {
    const note = document.createElement("p");
    note.className = "share-note";
    note.textContent = t("share.noLink");
    shareArea.append(note);
  }

  const button = document.createElement("button");
  button.type = "button";
  button.className = "received-button";
  const showOutcome = () => {
    const isReceived = receivedLoanIds.includes(lender.id);
    button.setAttribute("aria-pressed", String(isReceived));
    button.textContent = `${isReceived ? "✓ " : ""}${t("received.label")}`;
    shareArea.hidden = !isReceived;
  };
  button.addEventListener("click", () => {
    receivedLoanIds = toggleReceivedLoan(pageStorage, receivedLoanIds, lender.id);
    showOutcome();
    if (receivedLoanIds.includes(lender.id)) celebrate();
  });
  showOutcome();

  area.append(button, shareArea);
  return area;
}

// The button that shows a loan's repayment graph, and the space the graph opens in; each tab keeps its own open graphs.
function renderGraphControls(result, inSavedTab) {
  const graphKey = `${inSavedTab ? "saved" : "recommended"}-${result.lender.id}`;
  const graphArea = document.createElement("div");
  const button = document.createElement("button");
  button.type = "button";
  button.className = "graph-button";
  const showGraph = () => {
    const isOpen = openGraphs.has(graphKey);
    button.textContent = t(isOpen ? "graph.hide" : "graph.show");
    button.setAttribute("aria-expanded", String(isOpen));
    graphArea.replaceChildren(...(isOpen ? [renderRepaymentGraph(result.balances)] : []));
  };
  button.addEventListener("click", () => {
    if (!openGraphs.delete(graphKey)) openGraphs.add(graphKey);
    showGraph();
  });
  showGraph();
  return { button, graphArea };
}

// A card's summary: the rate line and its most serious warning, then More details for the rest.
function renderSummary(result, inSavedTab) {
  const summary = document.createElement("div");
  summary.className = "summary";
  const separator = t("summary.separator");
  const short = document.createElement("p");
  short.className = "summary-short";
  short.textContent = result.summaryShort.join(separator);
  summary.append(short);
  if (result.summaryMore.length === 0) return summary;

  const key = `${inSavedTab ? "saved" : "recommended"}-${result.lender.id}`;
  const more = document.createElement("p");
  more.className = "summary-more";
  more.id = `more-${key}`;
  more.textContent = result.summaryMore.join(separator);
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "details-toggle";
  toggle.setAttribute("aria-controls", more.id);
  const show = () => {
    const open = openDetails.has(key);
    more.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.textContent = t(open ? "card.fewerDetails" : "card.moreDetails");
  };
  toggle.addEventListener("click", () => {
    if (!openDetails.delete(key)) openDetails.add(key);
    show();
  });
  show();
  summary.append(more, toggle);
  return summary;
}

function renderCard(result, isBest, inSavedTab = false) {
  const card = document.createElement("article");
  card.className = "card" + (result.eligible ? "" : " ineligible");

  const header = document.createElement("div");
  header.className = "card-header";
  const title = document.createElement("h3");
  title.textContent = result.lender.name;
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = t(`type.${result.lender.type}`);
  title.append(" ", tag);
  if (result.eligible) {
    const rate = document.createElement("span");
    rate.className = "tag rate";
    rate.textContent = t(`tag.${result.rateType}`);
    title.append(" ", rate);
  }
  if (isBest) {
    const best = document.createElement("span");
    best.className = "tag best";
    best.textContent = t("card.best");
    title.append(" ", best);
  }
  const rating = document.createElement("div");
  rating.className = "rating";
  rating.textContent = `${result.rating}/10`;
  header.append(title, rating);

  const bar = document.createElement("div");
  bar.className = "bar";
  bar.setAttribute("aria-hidden", "true");
  const fill = document.createElement("div");
  fill.style.width = `${result.rating * 10}%`;
  bar.append(fill);

  card.append(header, bar);

  if (result.eligible) {
    const stats = document.createElement("dl");
    stats.className = "stats";
    for (const [label, value] of [
      [t("card.apr"), `${result.apr.toFixed(2)}%`],
      [t("card.monthly"), formatMoney(result.payment)],
      [t("card.totalRepaid"), formatMoney(result.totalCost)],
    ]) {
      const item = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = label;
      const detail = document.createElement("dd");
      detail.textContent = value;
      item.append(term, detail);
      stats.append(item);
    }
    card.append(stats);
  }

  const summary = renderSummary(withShortSummary(result), inSavedTab);

  const link = document.createElement("a");
  link.className = "loan-link";
  link.href = result.lender.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = t("card.viewLoan", { lender: result.lender.name });

  const isSaved = savedLoanIds.includes(result.lender.id);
  const save = document.createElement("button");
  save.type = "button";
  save.className = "save-button";
  save.setAttribute("aria-pressed", String(isSaved));
  save.textContent = isSaved ? t("card.saved") : t("card.save");
  save.addEventListener("click", () => {
    savedLoanIds = toggleSavedLoan(pageStorage, savedLoanIds, result.lender.id);
    update();
  });

  const actions = document.createElement("div");
  actions.className = "card-actions";
  actions.append(link, save);

  card.append(summary, actions);
  if (result.eligible) {
    const { button, graphArea } = renderGraphControls(result, inSavedTab);
    actions.append(button);
    card.append(graphArea);
  }
  if (inSavedTab) card.append(renderLoanOutcome(result.lender), renderCommentArea(result.lender));
  return card;
}

function emptyMessage(text) {
  const message = document.createElement("p");
  message.className = "empty";
  message.textContent = text;
  return message;
}

// Fills the Saved loans tab, in the order the student saved them, rated for what is in the form now.
function renderSavedLoans(inputs, hasErrors) {
  document.getElementById("saved-tab").textContent = t("tabs.saved", { count: savedLoanIds.length });
  const savedResults = document.getElementById("saved-results");
  if (savedLoanIds.length === 0) {
    savedResults.replaceChildren(emptyMessage(t("saved.empty")));
  } else if (hasErrors) {
    savedResults.replaceChildren(emptyMessage(t("results.fixForm")));
  } else {
    savedResults.replaceChildren(
      ...savedLoanIds.map((id) => renderCard(evaluateLender(LENDERS.find((lender) => lender.id === id), inputs), false, true)),
    );
  }
}

function update() {
  const inputs = readInputs();
  const errors = validateInputs(inputs);
  updateLocationNote(inputs.state);
  const errorList = document.getElementById("errors");
  const results = document.getElementById("results");
  errorList.replaceChildren(
    ...errors.map((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      return item;
    }),
  );

  renderSavedLoans(inputs, errors.length > 0);
  if (errors.length > 0) {
    results.replaceChildren(emptyMessage(t("results.fixForm")));
    showDebugReport(`Loan Poacher debug report\nThe form has errors, so nothing was scored:\n${errors.join("\n")}`);
    return;
  }

  const ranked = rankLenders(inputs);
  showDebugReport(debugReport(inputs, ranked));
  const cards = ranked.map((result, index) => renderCard(result, index === 0 && result.eligible));
  if (!ranked.some((result) => result.eligible)) {
    cards.unshift(emptyMessage(t("results.noneFit")));
  }
  results.replaceChildren(...cards);
}

function showDebugReport(text) {
  if (DEBUG_MODE) document.getElementById("debug-report").textContent = text;
}

function setUpDebugPanel() {
  if (!DEBUG_MODE) return;
  document.getElementById("debug-panel").hidden = false;
  const status = document.getElementById("debug-copy-status");
  document.getElementById("copy-debug-report").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(document.getElementById("debug-report").textContent);
      status.textContent = "✓ Copied";
    } catch {
      status.textContent = "Couldn't copy here: select the report text and copy it instead.";
    }
  });
}

const TAB_IDS = ["recommendations-tab", "saved-tab", "filters-tab"];

// Shows one tab's panel and hides the others.
function selectTab(tabId) {
  for (const id of TAB_IDS) {
    const tab = document.getElementById(id);
    tab.setAttribute("aria-selected", String(id === tabId));
    document.getElementById(tab.getAttribute("aria-controls")).hidden = id !== tabId;
  }
}

function setUpTabs() {
  for (const id of TAB_IDS) {
    document.getElementById(id).addEventListener("click", () => selectTab(id));
  }
}

// A one-line reminder of what a saved preset holds, like "$25,000, $300/month, 15 years · APR 0–9% · Massachusetts".
function presetSummary(filters) {
  const parts = [
    t("presets.summary", {
      amount: formatMoney(filters.amount),
      budget: formatMoney(filters.monthlyBudget),
      years: formatYears(filters.years),
    }),
  ];
  if (filters.minApr !== null || filters.maxApr !== null) {
    parts.push(t("presets.apr", { range: `${filters.minApr ?? MIN_APR_FILTER}–${filters.maxApr ?? MAX_APR_FILTER}%` }));
  }
  const residency = [...document.getElementById("residency").options].find((option) => option.value === filters.residency);
  if (filters.residency !== "citizen" && residency !== undefined) parts.push(residency.textContent);
  if (filters.rateType === "fixed" || filters.rateType === "variable") parts.push(t(`tag.${filters.rateType}`));
  if (filters.state !== null && filters.state in US_STATES) parts.push(US_STATES[filters.state]);
  if (filters.hasCosigner) parts.push(t("presets.cosigner"));
  return parts.join(" · ");
}

function showPresetStatus(text) {
  document.getElementById("preset-status").textContent = text;
}

// Fills the form from a preset, keeps the term slider, cosigner details, and state note in step with it, updates the
// recommendations, and shows them. The credit score and the cosigner's numbers are left as they are.
function applyFilterPreset({ filters }) {
  const setValue = (id, value) => {
    document.getElementById(id).value = value === null ? "" : String(value);
  };
  setValue("amount", filters.amount);
  setValue("monthly-budget", filters.monthlyBudget);
  setValue("years-box", filters.years);
  setValue("apr-min", filters.minApr);
  setValue("apr-max", filters.maxApr);
  setValue("rate-type", filters.rateType);
  setValue("residency", filters.residency);
  setValue("state", filters.state);
  document.getElementById("has-cosigner").checked = filters.hasCosigner;
  syncTermSlider();
  showTerm();
  showCosignerDetails();
  update();
  selectTab("recommendations-tab");
  document.getElementById("recommendations-tab").focus();
}

function renderFilterPreset(preset, index) {
  const item = document.createElement("div");
  item.className = "card preset";
  item.setAttribute("role", "group");
  const name = document.createElement("h3");
  name.className = "preset-name";
  name.id = `preset-name-${index}`;
  name.textContent = preset.name;
  item.setAttribute("aria-labelledby", name.id);

  const summary = document.createElement("p");
  summary.className = "preset-summary";
  summary.textContent = presetSummary(preset.filters);

  const apply = document.createElement("button");
  apply.type = "button";
  apply.className = "save-button";
  apply.textContent = t("presets.apply");
  apply.addEventListener("click", () => applyFilterPreset(preset));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "graph-button";
  remove.textContent = t("presets.delete");
  remove.addEventListener("click", () => {
    filterPresets = deleteFilterPreset(pageStorage, filterPresets, preset.name);
    renderFilterPresets();
    showPresetStatus(t("presets.deleted", { name: preset.name }));
    document.getElementById("preset-name").focus();
  });

  const actions = document.createElement("div");
  actions.className = "card-actions";
  actions.append(apply, remove);
  item.append(name, summary, actions);
  return item;
}

// Fills the Saved filters tab and its count, like "Saved filters (2/5)".
function renderFilterPresets() {
  document.getElementById("filters-tab").textContent = t("tabs.filters", {
    count: filterPresets.length,
    max: MAX_FILTER_PRESETS,
  });
  const list = document.getElementById("preset-list");
  if (filterPresets.length === 0) {
    list.replaceChildren(emptyMessage(t("presets.empty")));
  } else {
    list.replaceChildren(...filterPresets.map(renderFilterPreset));
  }
}

// Saves what is in the form under the typed name (or the next "Filters 1", "Filters 2"...), unless the form has an
// error, and says what happened: saved, updated, or saved in place of the oldest.
function saveCurrentFilters() {
  const inputs = readInputs();
  if (validateInputs(inputs).length > 0) {
    showPresetStatus(t("presets.fixForm"));
    return;
  }
  const nameBox = document.getElementById("preset-name");
  const name =
    cleanPresetName(nameBox.value) || unusedPresetName(filterPresets, (number) => t("presets.defaultName", { number }));
  const result = saveFilterPreset(pageStorage, filterPresets, name, presetFilters(inputs));
  filterPresets = result.presets;
  nameBox.value = "";
  renderFilterPresets();
  if (result.updated) showPresetStatus(t("presets.updated", { name: result.name }));
  else if (result.replaced !== null) showPresetStatus(t("presets.replaced", { name: result.name, oldest: result.replaced }));
  else showPresetStatus(t("presets.saved", { name: result.name }));
}

function setUpFilterPresets() {
  document.getElementById("save-preset").addEventListener("click", saveCurrentFilters);
  document.getElementById("preset-name").addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveCurrentFilters();
  });
}

// The color the page is painted with: a spot on the color wheel (or Black or Gray), a finish, and a light or dark page.
let colorChoice = { ...DEFAULT_COLOR_CHOICE };

// Shows the color choice on the slider, the Black and Gray dots, and the finish and page buttons, in the chosen
// language. The slider names its color for screen readers, like "Blue". Light is unavailable while Neon or Black is
// on, since those always use a dark page, and its tooltip says so.
function showColorChoice() {
  const slider = document.getElementById("hue-slider");
  slider.value = String(colorChoice.hue);
  slider.setAttribute("aria-label", t("theme.hue"));
  slider.setAttribute("aria-valuetext", t(hueNameKey(colorChoice.hue)));
  for (const button of document.querySelectorAll(".theme-button")) {
    button.setAttribute("aria-pressed", String(button.dataset.base === colorChoice.base));
  }
  for (const button of document.querySelectorAll(".finish-button")) {
    button.setAttribute("aria-pressed", String(button.dataset.finish === colorChoice.finish));
  }
  const darkPage = isDarkPage(colorChoice);
  const alwaysDark = colorChoice.finish === "neon" || colorChoice.base === "black";
  for (const button of document.querySelectorAll(".mode-button")) {
    button.setAttribute("aria-pressed", String((button.dataset.mode === "dark") === darkPage));
    if (alwaysDark && button.dataset.mode === "light") {
      button.setAttribute("aria-disabled", "true");
      button.title = t("mode.lockedDark");
    } else {
      button.removeAttribute("aria-disabled");
      button.removeAttribute("title");
    }
  }
}

// Paints the page with a color choice, shows it on the controls, and remembers it.
function applyColors(choice) {
  colorChoice = choice;
  const palette = colorPalette(choice);
  const root = document.documentElement;
  for (const [name, value] of Object.entries(paletteCssVariables(palette))) {
    root.style.setProperty(name, value);
  }
  root.style.colorScheme = palette.dark ? "dark" : "light";
  root.dataset.finish = choice.finish;
  showColorChoice();
  try {
    localStorage.setItem(COLOR_STORAGE_KEY, JSON.stringify(choice));
    localStorage.removeItem(OLD_THEME_STORAGE_KEY);
  } catch {
    // Storage can be unavailable (private windows, file:// in some browsers); the colors still apply.
  }
}

function setUpColors() {
  const slider = document.getElementById("hue-slider");
  slider.addEventListener("input", () => applyColors({ ...colorChoice, hue: Number(slider.value), base: "color" }));
  for (const button of document.querySelectorAll(".theme-button")) {
    button.addEventListener("click", () => applyColors({ ...colorChoice, base: button.dataset.base }));
  }
  for (const button of document.querySelectorAll(".finish-button")) {
    button.addEventListener("click", () => applyColors({ ...colorChoice, finish: button.dataset.finish }));
  }
  for (const button of document.querySelectorAll(".mode-button")) {
    button.addEventListener("click", () => {
      if (button.getAttribute("aria-disabled") === "true") return;
      applyColors({ ...colorChoice, mode: button.dataset.mode });
    });
  }
  let saved = null;
  let oldTheme = null;
  try {
    saved = localStorage.getItem(COLOR_STORAGE_KEY);
    oldTheme = localStorage.getItem(OLD_THEME_STORAGE_KEY);
  } catch {
    // Fall back to the default colors below.
  }
  applyColors(readColorChoice(saved, oldTheme));
}

function labelThemeButtons() {
  for (const button of document.querySelectorAll(".theme-button")) {
    button.title = t(`theme.${button.dataset.base}`);
    button.setAttribute("aria-label", t("theme.label", { theme: button.title }));
  }
}

// Swaps every piece of text on the screen into the chosen language, keeping what the student typed.
function applyLanguage(language) {
  setLanguage(language);
  document.documentElement.lang = getLanguage();
  document.documentElement.dir = RIGHT_TO_LEFT_LANGUAGES.includes(getLanguage()) ? "rtl" : "ltr";
  document.getElementById("language").value = getLanguage();
  for (const element of document.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll("[data-i18n-placeholder]")) {
    element.placeholder = t(element.dataset.i18nPlaceholder);
  }
  document.getElementById("years-box").setAttribute("aria-label", t("form.yearsBox"));
  showTerm();
  labelThemeButtons();
  showColorChoice();
  renderFilterPresets();
  showPresetStatus("");
  update();
  refreshTour();
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, getLanguage());
  } catch {
    // The language still applies for this visit.
  }
}

function setUpLanguages() {
  const select = document.getElementById("language");
  for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
    select.append(new Option(name, code));
  }
  select.addEventListener("change", () => applyLanguage(select.value));
  let saved = null;
  try {
    saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // Fall back to English below.
  }
  applyLanguage(saved in LANGUAGE_NAMES ? saved : "en");
}

// Shows the guide on a first visit; once dismissed it stays hidden until "How it works" is clicked.
setUpColors();
prepareCheer();
setUpStates();
setUpCosigner();
setUpTerm();
setUpDebugPanel();
setUpTour();
setUpTabs();
setUpFilterPresets();
setUpLanguages();
document.getElementById("loan-form").addEventListener("input", update);
