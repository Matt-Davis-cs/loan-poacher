// Encouraging messages for a student who has left the page alone: after 30 minutes without activity while the page
// is visible, a small card in a corner shows an original message. A click, tap, key press, or scroll removes it (and
// still does what it was meant to); moving the mouse only restarts the wait, so the card's own button stays
// reachable. "Don't show these" turns the messages off in this browser. Adding ?idle=10 to the address shortens the
// wait to 10 seconds for trying it.

const DEFAULT_IDLE_DELAY_MS = 30 * 60 * 1000;
const IDLE_MESSAGES_OFF_KEY = "loan-poacher-idle-messages-off";
const IDLE_MESSAGE_KEYS = [
  "encourage.smartStep",
  "encourage.freshEyes",
  "encourage.worthIt",
  "encourage.normalToWonder",
  "encourage.courage",
  "encourage.smallSteps",
  "encourage.takeBreak",
  "encourage.askForHelp",
];
// How long "You won't see these messages again" stays before the card closes.
const TURNED_OFF_NOTICE_MS = 3000;
// Keys that move around the page without doing anything, so a keyboard user can reach the card's button.
const MOVING_KEYS = ["Tab", "Shift"];

let idleDelay = DEFAULT_IDLE_DELAY_MS;
let idleRemaining = DEFAULT_IDLE_DELAY_MS;
let idleStartedAt = 0;
let idleTimer = null;
let idleMessageIndex = -1;
let idleTurnedOff = false;

// The wait before a message: 30 minutes, or the ?idle= shortcut's whole number of seconds (1 to 3600).
function idleDelayMs(search) {
  const seconds = Number(new URLSearchParams(search).get("idle"));
  return Number.isInteger(seconds) && seconds >= 1 && seconds <= 3600 ? seconds * 1000 : DEFAULT_IDLE_DELAY_MS;
}

function idleMessagesOff() {
  if (idleTurnedOff) return true;
  try {
    return localStorage.getItem(IDLE_MESSAGES_OFF_KEY) === "true";
  } catch {
    return false;
  }
}

// Starts the wait over with `ms` to go; it only runs while the page is visible.
function startIdleClock(ms) {
  clearTimeout(idleTimer);
  idleTimer = null;
  idleRemaining = ms;
  if (document.hidden || idleMessagesOff()) return;
  idleStartedAt = Date.now();
  idleTimer = setTimeout(showIdleMessage, ms);
}

// Stops the wait while the page is hidden, keeping how much was left.
function pauseIdleClock() {
  if (idleTimer === null) return;
  clearTimeout(idleTimer);
  idleTimer = null;
  idleRemaining = Math.max(0, idleRemaining - (Date.now() - idleStartedAt));
}

function showIdleText() {
  if (idleMessageIndex >= 0) {
    document.getElementById("idle-message").textContent = t(IDLE_MESSAGE_KEYS[idleMessageIndex]);
  }
}

// Shows the next message, unless the tour is open, and starts the wait for the one after it.
function showIdleMessage() {
  idleTimer = null;
  if (document.getElementById("guide").hidden) {
    idleMessageIndex = (idleMessageIndex + 1) % IDLE_MESSAGE_KEYS.length;
    showIdleText();
    document.getElementById("idle-card").hidden = false;
  }
  startIdleClock(idleDelay);
}

function onIdleActivity(event) {
  if (event.target instanceof Element && event.target.closest("#idle-card")) return;
  const onlyMoving = event.type === "pointermove" || (event.type === "keydown" && MOVING_KEYS.includes(event.key));
  if (!onlyMoving) document.getElementById("idle-card").hidden = true;
  startIdleClock(idleDelay);
}

// Shows the current message again in the chosen language, while the card is open.
function refreshIdleMessage() {
  if (!idleTurnedOff) showIdleText();
}

function setUpIdleMessages() {
  idleDelay = idleDelayMs(location.search);
  for (const type of ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"]) {
    document.addEventListener(type, onIdleActivity, { capture: true, passive: true });
  }
  window.addEventListener("scroll", onIdleActivity, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pauseIdleClock();
    else startIdleClock(idleRemaining);
  });

  const off = document.getElementById("idle-off");
  off.addEventListener("click", () => {
    idleTurnedOff = true;
    clearTimeout(idleTimer);
    idleTimer = null;
    try {
      localStorage.setItem(IDLE_MESSAGES_OFF_KEY, "true");
    } catch {
      // The messages stay off for this visit.
    }
    document.getElementById("idle-message").textContent = t("encourage.turnedOff");
    off.hidden = true;
    setTimeout(() => {
      document.getElementById("idle-card").hidden = true;
    }, TURNED_OFF_NOTICE_MS);
  });

  startIdleClock(idleDelay);
}

if (typeof module !== "undefined") {
  module.exports = { DEFAULT_IDLE_DELAY_MS, IDLE_MESSAGE_KEYS, idleDelayMs };
}
