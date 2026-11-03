// Keeps saved and received loans, and comments, in browser storage so they survive closing the page.

// The browser loads loans.js before this file; tests running in Node load it here.
const lenderData = typeof module !== "undefined" ? require("./loans.js") : { LENDERS };

const SAVED_LOANS_KEY = "loan-poacher-saved-loans";
const LOAN_COMMENTS_KEY = "loan-poacher-loan-comments";
const RECEIVED_LOANS_KEY = "loan-poacher-received-loans";
const MAX_COMMENT_LENGTH = 500;

function isKnownLenderId(id) {
  return lenderData.LENDERS.some((lender) => lender.id === id);
}

// Parsed JSON from storage, or null when it is missing, damaged, or storage is blocked.
function readStoredJson(storage, key) {
  try {
    return JSON.parse(storage.getItem(key));
  } catch {
    return null;
  }
}

function writeStoredJson(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private windows); the change still shows for this visit.
  }
}

// A stored list of lender ids in the order they were added, skipping anything damaged or no longer offered.
function readLenderIds(storage, key) {
  const ids = readStoredJson(storage, key);
  if (!Array.isArray(ids)) return [];
  return [...new Set(ids)].filter(isKnownLenderId);
}

// Adds the lender to a stored list, or removes it if it was already there, and returns the new list.
function toggleLenderId(storage, key, lenderIds, lenderId) {
  const updated = lenderIds.includes(lenderId) ? lenderIds.filter((id) => id !== lenderId) : [...lenderIds, lenderId];
  writeStoredJson(storage, key, updated);
  return updated;
}

function readSavedLoanIds(storage) {
  return readLenderIds(storage, SAVED_LOANS_KEY);
}

function toggleSavedLoan(storage, savedIds, lenderId) {
  return toggleLenderId(storage, SAVED_LOANS_KEY, savedIds, lenderId);
}

function readReceivedLoanIds(storage) {
  return readLenderIds(storage, RECEIVED_LOANS_KEY);
}

function toggleReceivedLoan(storage, receivedIds, lenderId) {
  return toggleLenderId(storage, RECEIVED_LOANS_KEY, receivedIds, lenderId);
}

// The student's comment on each loan, keyed by lender id, skipping anything damaged or no longer offered.
function readLoanComments(storage) {
  const stored = readStoredJson(storage, LOAN_COMMENTS_KEY);
  if (stored === null || typeof stored !== "object" || Array.isArray(stored)) return {};
  return Object.fromEntries(
    Object.entries(stored).filter(([id, text]) => isKnownLenderId(id) && typeof text === "string" && text !== ""),
  );
}

// Stores the comment for one loan (an empty one removes it) and returns the new set of comments.
function setLoanComment(storage, comments, lenderId, text) {
  const updated = { ...comments };
  const trimmed = text.slice(0, MAX_COMMENT_LENGTH);
  if (trimmed.trim() === "") {
    delete updated[lenderId];
  } else {
    updated[lenderId] = trimmed;
  }
  writeStoredJson(storage, LOAN_COMMENTS_KEY, updated);
  return updated;
}

if (typeof module !== "undefined") {
  module.exports = {
    MAX_COMMENT_LENGTH,
    readSavedLoanIds,
    toggleSavedLoan,
    readReceivedLoanIds,
    toggleReceivedLoan,
    readLoanComments,
    setLoanComment,
  };
}
