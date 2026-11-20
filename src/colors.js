// Turns the student's color choice (a spot on the color wheel or Black or Gray, a finish, and a light or dark page)
// into the page's colors. Every color is checked against what it sits on, so text stays readable for every choice.

const COLOR_BASES = ["color", "black", "gray"];
const FINISHES = ["plain", "metallic", "neon"];
const PAGE_MODES = ["light", "dark"];
const DEFAULT_COLOR_CHOICE = { hue: 145, base: "color", finish: "plain", mode: "light" };

// The nine fixed themes from before the slider, as the closest color, finish, and page.
const OLD_THEME_CHOICES = {
  green: { hue: 145, base: "color", finish: "plain", mode: "light" },
  blue: { hue: 215, base: "color", finish: "plain", mode: "light" },
  red: { hue: 358, base: "color", finish: "plain", mode: "light" },
  pink: { hue: 331, base: "color", finish: "plain", mode: "light" },
  black: { hue: 145, base: "black", finish: "plain", mode: "dark" },
  gray: { hue: 145, base: "gray", finish: "plain", mode: "light" },
  neon: { hue: 145, base: "color", finish: "neon", mode: "dark" },
  silver: { hue: 145, base: "gray", finish: "metallic", mode: "light" },
  gold: { hue: 44, base: "color", finish: "metallic", mode: "dark" },
};

// Where each color name starts on the wheel, in degrees; the last one runs back around to 0.
const HUE_NAMES = [
  [0, "red"],
  [15, "orange"],
  [40, "yellow"],
  [70, "green"],
  [165, "teal"],
  [195, "blue"],
  [255, "purple"],
  [290, "pink"],
  [345, "red"],
];

// Readability targets from the web accessibility guidelines (WCAG): 4.5:1 for text, 7:1 for the main body text,
// and 3:1 for shapes like rating bars.
const TEXT_CONTRAST = 4.5;
const STRONG_TEXT_CONTRAST = 7;
const SHAPE_CONTRAST = 3;

// How far the metallic shine and shade may move from the button color, in points of lightness.
const SHINE_RANGE = 18;

// Orange, yellow, and lime only look like themselves when bright, so on a light page their buttons use the bright
// color with dark words, while colored text uses a deeper shade. Other hues keep deep buttons with white words.
// Between `from` and `fullFrom` (and `fullTo` and `to`) the two blend, so sliding past the edges is gradual.
const BRIGHT_HUES = { from: 15, fullFrom: 35, fullTo: 95, to: 125 };
const BRIGHT_LIGHTNESS = 50;
const BRIGHT_SATURATION = { plain: 90, metallic: 80 };

const WHITE = "#ffffff";
const NEAR_BLACK = "#111111";

function hslToHex(hue, saturation, lightness) {
  const s = saturation / 100;
  const l = lightness / 100;
  const channel = (n) => {
    const k = (n + hue / 30) % 12;
    const value = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

function relativeLuminance(hex) {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// How readable one color is on another, from 1 (the same) to 21 (black on white).
function contrastRatio(first, second) {
  const [lighter, darker] = [relativeLuminance(first), relativeLuminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

// [background, minimum contrast] pairs for readableShade.
function readableOn(backgrounds, minimum) {
  return backgrounds.map((background) => [background, minimum]);
}

function meetsAll(color, requirements) {
  return requirements.every(([background, minimum]) => contrastRatio(color, background) >= minimum);
}

// Starting at `lightness`, steps darker (direction -1) or lighter (+1) until the color meets every
// [background, minimum contrast] requirement. Returns the lightness and the color.
function readableShade(hue, saturation, lightness, direction, requirements) {
  for (let l = lightness; l >= 0 && l <= 100; l += direction) {
    const color = hslToHex(hue, saturation, l);
    if (meetsAll(color, requirements)) return { lightness: l, color };
  }
  const fallback = direction < 0 ? 0 : 100;
  return { lightness: fallback, color: hslToHex(hue, saturation, fallback) };
}

// The farthest the button color can move lighter or darker (up to SHINE_RANGE) while its words stay readable.
function metalStop(hue, saturation, fillLightness, direction, words) {
  let stop = hslToHex(hue, saturation, fillLightness);
  for (let step = 1; step <= SHINE_RANGE; step += 1) {
    const lightness = fillLightness + direction * step;
    if (lightness < 0 || lightness > 100) break;
    const color = hslToHex(hue, saturation, lightness);
    if (contrastRatio(words, color) < TEXT_CONTRAST) break;
    stop = color;
  }
  return stop;
}

// How much a hue's buttons use its bright color on a light page: 1 for orange, yellow, and lime, 0 for the rest.
function brightWeight(hue) {
  const { from, fullFrom, fullTo, to } = BRIGHT_HUES;
  if (hue <= from || hue >= to) return 0;
  if (hue < fullFrom) return (hue - from) / (fullFrom - from);
  if (hue <= fullTo) return 1;
  return (to - hue) / (to - fullTo);
}

// Neon and Black always use a dark page, since a glow only shows on dark; otherwise the Light/Dark switch decides.
function isDarkPage({ base, finish, mode }) {
  return finish === "neon" || base === "black" || mode === "dark";
}

// The hue and saturations for each part of the page, before lightness is worked out.
function tones({ hue, base, finish }) {
  if (base === "color") {
    const accentSaturation = { plain: 70, metallic: 60, neon: 100 }[finish];
    return { hue, tint: 40, textTint: 35, mutedTint: 18, borderTint: 32, accentSaturation, neutral: false };
  }
  // Black and Gray have no color, but a hint of cool blue keeps them from looking flat, as before the slider.
  const neutralHue = base === "black" ? 240 : 220;
  return { hue: neutralHue, tint: 6, textTint: 6, mutedTint: 5, borderTint: 7, accentSaturation: 9, neutral: true };
}

function lightPage(tone, metallic) {
  const { hue, tint, neutral } = tone;
  const bg = hslToHex(hue, tint, 96);
  const bgEnd = metallic ? hslToHex(hue, tint * 0.6, 86) : bg;
  const surface = neutral ? hslToHex(hue, 8, 98) : WHITE;
  const behind = [bg, bgEnd, surface];
  return {
    bg,
    bgEnd,
    surface,
    text: readableShade(hue, tone.textTint, 14, -1, readableOn(behind, STRONG_TEXT_CONTRAST)).color,
    muted: readableShade(hue, tone.mutedTint, 42, -1, readableOn(behind, TEXT_CONTRAST)).color,
    border: hslToHex(hue, tone.borderTint, metallic ? 81 : 85),
    error: readableShade(0, 75, 45, -1, readableOn(behind, TEXT_CONTRAST)).color,
  };
}

function darkPage(tone, metallic, base) {
  const { hue, tint, neutral } = tone;
  // Gray's dark page is a charcoal a step lighter than Black's.
  const lift = base === "gray" ? 8 : 0;
  const bg = hslToHex(hue, tint, (neutral ? 6 : 4) + lift);
  const bgEnd = metallic ? hslToHex(hue, tint, 17 + lift) : bg;
  const surface = hslToHex(hue, tint, 10 + lift);
  const behind = [bg, bgEnd, surface];
  return {
    bg,
    bgEnd,
    surface,
    text: readableShade(hue, neutral ? tone.textTint : 100, 94, 1, readableOn(behind, STRONG_TEXT_CONTRAST)).color,
    muted: readableShade(hue, neutral ? tone.mutedTint : 25, 62, 1, readableOn(behind, TEXT_CONTRAST)).color,
    border: hslToHex(hue, tone.borderTint, 22 + lift),
    error: readableShade(0, 90, 62, 1, readableOn(behind, TEXT_CONTRAST)).color,
  };
}

// What colored text and shapes must stand out from: the page, the cards, and (for bars) the bar's track.
function accentRequirements(page) {
  return [...readableOn([page.bg, page.bgEnd, page.surface], TEXT_CONTRAST), [page.border, SHAPE_CONTRAST]];
}

// On a light page: a deep button color dark enough for colored text, brightened toward the hue's own color for
// orange, yellow, and lime, whose colored text then uses a deeper shade (the ink).
function lightAccent(choice, tone, page) {
  const requirements = accentRequirements(page);
  const deep = readableShade(tone.hue, tone.accentSaturation, tone.neutral ? 34 : 45, -1, requirements);
  const weight = tone.neutral ? 0 : brightWeight(tone.hue);
  if (weight === 0) return { hue: tone.hue, saturation: tone.accentSaturation, fill: deep, ink: deep.color };

  const saturation = tone.accentSaturation + weight * (BRIGHT_SATURATION[choice.finish] - tone.accentSaturation);
  const lightness = Math.round(deep.lightness + weight * (BRIGHT_LIGHTNESS - deep.lightness));
  const fill = { lightness, color: hslToHex(tone.hue, saturation, lightness) };
  const ink = readableShade(tone.hue, saturation, lightness, -1, requirements).color;
  return { hue: tone.hue, saturation, fill, ink };
}

// On a dark page the button color is light enough to be the colored text too. Black's plain accent is near-white
// as before the slider, its metallic one is silver with room to shine, and Neon on Black or Gray glows icy white.
function darkAccent(choice, tone, page) {
  const iceNeon = tone.neutral && choice.finish === "neon";
  const hue = iceNeon ? 195 : tone.hue;
  const saturation = iceNeon ? 30 : tone.accentSaturation;
  const start = tone.neutral ? { plain: 94, metallic: 78, neon: 88 }[choice.finish] : 55;
  const fill = readableShade(hue, saturation, start, 1, accentRequirements(page));
  return { hue, saturation, fill, ink: fill.color };
}

// Words on a filled button: whichever of white or near-black reads better. If neither quite reaches TEXT_CONTRAST,
// the button color moves away from the words until they do.
function wordsOnFill(hue, saturation, fill) {
  const words = contrastRatio(WHITE, fill.color) >= contrastRatio(NEAR_BLACK, fill.color) ? WHITE : NEAR_BLACK;
  const direction = words === WHITE ? -1 : 1;
  return { words, fill: readableShade(hue, saturation, fill.lightness, direction, [[words, TEXT_CONTRAST]]) };
}

// All the colors the page needs for one choice. `accent` fills buttons, the logo, tags, and rating bars;
// `accentInk` is for colored text and lines; `accentEdge` outlines a rating bar whose fill alone would fade into
// its track. `dark` says whether the page is dark, for the browser's own controls.
function colorPalette(choice) {
  const tone = tones(choice);
  const dark = isDarkPage(choice);
  const metallic = choice.finish === "metallic";
  const page = dark ? darkPage(tone, metallic, choice.base) : lightPage(tone, metallic);
  const accent = dark ? darkAccent(choice, tone, page) : lightAccent(choice, tone, page);
  const { words, fill } = wordsOnFill(accent.hue, accent.saturation, accent.fill);
  const ink = accent.ink === accent.fill.color ? fill.color : accent.ink;
  const fillStandsOut = [page.border, page.surface].every((color) => contrastRatio(fill.color, color) >= SHAPE_CONTRAST);
  const stop = (direction) =>
    metallic ? metalStop(accent.hue, accent.saturation, fill.lightness, direction, words) : fill.color;

  return {
    bg: page.bg,
    bgEnd: page.bgEnd,
    surface: page.surface,
    text: page.text,
    muted: page.muted,
    border: page.border,
    accent: fill.color,
    accentInk: ink,
    accentEdge: fillStandsOut ? fill.color : ink,
    accentText: words,
    accentShine: stop(1),
    accentShade: stop(-1),
    error: page.error,
    dark,
  };
}

// The palette as the CSS variables styles.css uses.
function paletteCssVariables(palette) {
  return {
    "--bg": palette.bg,
    "--bg-end": palette.bgEnd,
    "--surface": palette.surface,
    "--text": palette.text,
    "--muted": palette.muted,
    "--border": palette.border,
    "--accent": palette.accent,
    "--accent-ink": palette.accentInk,
    "--accent-edge": palette.accentEdge,
    "--accent-text": palette.accentText,
    "--accent-shine": palette.accentShine,
    "--accent-shade": palette.accentShade,
    "--error": palette.error,
  };
}

// The translation key for the color name at a spot on the wheel, like "theme.blue" for 220.
function hueNameKey(hue) {
  let name = HUE_NAMES[0][1];
  for (const [start, startName] of HUE_NAMES) {
    if (hue >= start) name = startName;
  }
  return `theme.${name}`;
}

function isWholeHue(hue) {
  return Number.isInteger(hue) && hue >= 0 && hue < 360;
}

// Reads the saved choice back, fixing any damaged or missing part with its default (so a choice saved before the
// Light/Dark switch existed gets a light page). Without a saved choice, a theme picked before the slider existed
// (`oldTheme`) becomes its closest color, finish, and page.
function readColorChoice(savedJson, oldTheme) {
  let saved = null;
  try {
    saved = JSON.parse(savedJson);
  } catch {
    // Damaged or missing; fall through to the old theme or the default.
  }
  if (saved === null || typeof saved !== "object" || Array.isArray(saved)) {
    return { ...(OLD_THEME_CHOICES[oldTheme] ?? DEFAULT_COLOR_CHOICE) };
  }
  return {
    hue: isWholeHue(saved.hue) ? saved.hue : DEFAULT_COLOR_CHOICE.hue,
    base: COLOR_BASES.includes(saved.base) ? saved.base : DEFAULT_COLOR_CHOICE.base,
    finish: FINISHES.includes(saved.finish) ? saved.finish : DEFAULT_COLOR_CHOICE.finish,
    mode: PAGE_MODES.includes(saved.mode) ? saved.mode : DEFAULT_COLOR_CHOICE.mode,
  };
}

if (typeof module !== "undefined") {
  module.exports = {
    FINISHES,
    PAGE_MODES,
    DEFAULT_COLOR_CHOICE,
    colorPalette,
    contrastRatio,
    hueNameKey,
    isDarkPage,
    paletteCssVariables,
    readColorChoice,
  };
}
