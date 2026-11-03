// Wires the form, color picker, language picker, and results list for Loan Poacher.

const THEMES = ["green", "blue", "red", "black", "pink", "gray", "neon", "silver", "gold"];
const THEME_STORAGE_KEY = "loan-poacher-theme";
const GUIDE_DISMISSED_KEY = "loan-poacher-guide-dismissed";
const LANGUAGE_STORAGE_KEY = "loan-poacher-language";

// Reaches localStorage only when used, so a blocked storage throws inside saved.js's try blocks.
const pageStorage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
};
let savedLoanIds = readSavedLoanIds(pageStorage);
let loanComments = readLoanComments(pageStorage);
let receivedLoanIds = readReceivedLoanIds(pageStorage);

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
    years: Number(document.getElementById("years").value),
    creditScore: readNumber("credit-score"),
    residency: document.getElementById("residency").value,
    state: document.getElementById("state").value || null,
    hasCosigner: document.getElementById("has-cosigner").checked,
  };
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
  });
  showOutcome();

  area.append(button, shareArea);
  return area;
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

  const summary = document.createElement("p");
  summary.className = "summary";
  summary.textContent = result.summary;

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
    return;
  }

  const ranked = rankLenders(inputs);
  const cards = ranked.map((result, index) => renderCard(result, index === 0 && result.eligible));
  if (!ranked.some((result) => result.eligible)) {
    cards.unshift(emptyMessage(t("results.noneFit")));
  }
  results.replaceChildren(...cards);
}

function setUpTabs() {
  const tabs = [
    [document.getElementById("recommendations-tab"), document.getElementById("recommendations-panel")],
    [document.getElementById("saved-tab"), document.getElementById("saved-panel")],
  ];
  for (const [tab] of tabs) {
    tab.addEventListener("click", () => {
      for (const [otherTab, otherPanel] of tabs) {
        otherTab.setAttribute("aria-selected", String(otherTab === tab));
        otherPanel.hidden = otherTab !== tab;
      }
    });
  }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  for (const button of document.querySelectorAll(".theme-button")) {
    button.setAttribute("aria-pressed", String(button.dataset.theme === theme));
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Storage can be unavailable (private windows, file:// in some browsers); the theme still applies.
  }
}

function setUpThemes() {
  const container = document.getElementById("theme-buttons");
  for (const theme of THEMES) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "theme-button";
    button.dataset.theme = theme;
    button.addEventListener("click", () => applyTheme(theme));
    container.append(button);
  }
  let saved = null;
  try {
    saved = localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // Fall back to the default theme below.
  }
  applyTheme(THEMES.includes(saved) ? saved : "green");
}

function labelThemeButtons() {
  for (const button of document.querySelectorAll(".theme-button")) {
    button.title = t(`theme.${button.dataset.theme}`);
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
  for (const option of document.getElementById("years").options) {
    option.textContent = t("form.yearsOption", { years: option.value });
  }
  labelThemeButtons();
  update();
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
function setUpGuide() {
  const guide = document.getElementById("guide");
  const toggle = document.getElementById("show-guide");
  const setVisible = (visible) => {
    guide.hidden = !visible;
    toggle.setAttribute("aria-expanded", String(visible));
  };

  let dismissed = false;
  try {
    dismissed = localStorage.getItem(GUIDE_DISMISSED_KEY) === "true";
  } catch {
    // Without storage the guide simply shows on every visit.
  }
  setVisible(!dismissed);

  toggle.addEventListener("click", () => {
    setVisible(true);
    guide.scrollIntoView({ behavior: "smooth", block: "nearest" });
  });
  document.getElementById("hide-guide").addEventListener("click", () => {
    setVisible(false);
    try {
      localStorage.setItem(GUIDE_DISMISSED_KEY, "true");
    } catch {
      // The guide still hides for this visit.
    }
  });
}

setUpThemes();
setUpStates();
setUpGuide();
setUpTabs();
setUpLanguages();
document.getElementById("loan-form").addEventListener("input", update);
