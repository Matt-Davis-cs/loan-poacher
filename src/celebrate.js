// The celebration when a student marks "I got this loan": confetti falls over the page while a crowd cheers.

const CONFETTI_PIECE_COUNT = 140;
// The theme's own color joins the party colors.
const CONFETTI_COLORS = ["#ff595e", "#ffca3a", "#8ac926", "#1982c4", "#6a4c93", "#ff924c", "var(--accent)"];
const CONFETTI_LONGEST_DELAY_MS = 600;
const CONFETTI_SHORTEST_FALL_MS = 2200;
const CONFETTI_LONGEST_FALL_MS = 3000;
// When the last piece has landed; the confetti is cleared away after this.
const CONFETTI_MAX_FALL_MS = CONFETTI_LONGEST_DELAY_MS + CONFETTI_LONGEST_FALL_MS;

// The crowd cheer: a 4-second public-domain (CC0) recording of people cheering and clapping at a hackathon, "Well
// Done" by qubodup on OpenGameArt. AAC plays in Safari, Chrome, and Edge; the Ogg copy covers browsers without AAC.
const CHEER_SOURCES = [
  { file: "sounds/cheer.m4a", type: 'audio/mp4; codecs="mp4a.40.2"' },
  { file: "sounds/cheer.ogg", type: 'audio/ogg; codecs="vorbis"' },
];
const CHEER_VOLUME = 0.8;

// Where each piece starts, how it falls, and its color. `random` gives numbers from 0 up to 1, like Math.random.
// `top` places a piece when the device asks for reduced motion and the confetti fades in place instead of falling.
function confettiPieces(count, random) {
  return Array.from({ length: count }, (_, index) => ({
    left: random() * 100,
    top: random() * 100,
    drift: (random() - 0.5) * 30,
    spin: 360 + random() * 720,
    delay: Math.round(random() * CONFETTI_LONGEST_DELAY_MS),
    duration: Math.round(CONFETTI_SHORTEST_FALL_MS + random() * (CONFETTI_LONGEST_FALL_MS - CONFETTI_SHORTEST_FALL_MS)),
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    wide: random() < 0.5,
  }));
}

// Covers the page with falling confetti that clicks pass straight through, then clears it away.
function launchConfetti() {
  document.querySelector(".confetti")?.remove();
  const layer = document.createElement("div");
  layer.className = "confetti";
  layer.setAttribute("aria-hidden", "true");
  for (const piece of confettiPieces(CONFETTI_PIECE_COUNT, Math.random)) {
    const element = document.createElement("span");
    element.className = piece.wide ? "confetti-piece wide" : "confetti-piece";
    element.style.left = `${piece.left}%`;
    element.style.setProperty("--top", `${piece.top}%`);
    element.style.setProperty("--drift", `${piece.drift}vw`);
    element.style.setProperty("--spin", `${piece.spin}deg`);
    element.style.background = piece.color;
    element.style.animationDelay = `${piece.delay}ms`;
    element.style.animationDuration = `${piece.duration}ms`;
    layer.append(element);
  }
  document.body.append(layer);
  setTimeout(() => layer.remove(), CONFETTI_MAX_FALL_MS + 100);
}

// The cheer file this browser can play, or null if it can play neither. `canPlayType` answers "", "maybe", or
// "probably", like an audio element's.
function playableCheer(canPlayType) {
  return CHEER_SOURCES.find((source) => canPlayType(source.type) !== "")?.file ?? null;
}

// The one audio element the cheer plays from, loaded when the page opens so the first cheer starts right away.
let cheerAudio = null;

function prepareCheer() {
  const audio = new Audio();
  const file = playableCheer((type) => audio.canPlayType(type));
  if (file === null) return;
  audio.preload = "auto";
  audio.volume = CHEER_VOLUME;
  audio.src = file;
  cheerAudio = audio;
}

// Plays the cheer from the start, even if the last one is still going. A browser that blocks sound (or can't play
// either file) stays quiet; the confetti still shows.
function playCheer() {
  if (cheerAudio === null) return;
  cheerAudio.currentTime = 0;
  cheerAudio.play().catch(() => {});
}

function celebrate() {
  launchConfetti();
  playCheer();
}

if (typeof module !== "undefined") {
  module.exports = { CHEER_SOURCES, CONFETTI_MAX_FALL_MS, confettiPieces, playableCheer };
}
