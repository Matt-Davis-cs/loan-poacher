// Keeps up to five saved filter presets in browser storage, so a student can switch between the situations they are
// comparing without retyping the form. A preset leaves out the private numbers (the credit score and the cosigner's
// score and cash), so those are never kept in the browser.

const FILTER_PRESETS_KEY = "loan-poacher-filter-presets";
const MAX_FILTER_PRESETS = 5;
const MAX_PRESET_NAME_LENGTH = 40;

// What a preset keeps, with the form's starting values for any part an older or damaged preset is missing.
const PRESET_DEFAULTS = {
  amount: 10000,
  monthlyBudget: 150,
  years: 10,
  minApr: null,
  maxApr: null,
  residency: "citizen",
  state: null,
  hasCosigner: false,
};

// The kind of value each part holds; anything else in storage falls back to the starting value.
const PRESET_FIELD_KINDS = {
  amount: "number",
  monthlyBudget: "number",
  years: "number",
  minApr: "number or blank",
  maxApr: "number or blank",
  residency: "text",
  state: "text or blank",
  hasCosigner: "yes or no",
};

function isKind(value, kind) {
  switch (kind) {
    case "number":
      return Number.isFinite(value);
    case "number or blank":
      return value === null || Number.isFinite(value);
    case "text":
      return typeof value === "string" && value !== "";
    case "text or blank":
      return value === null || (typeof value === "string" && value !== "");
    default:
      return typeof value === "boolean";
  }
}

// The parts of the form's inputs a preset keeps.
function presetFilters(inputs) {
  return Object.fromEntries(Object.keys(PRESET_DEFAULTS).map((field) => [field, inputs[field]]));
}

function cleanFilters(stored) {
  const source = stored !== null && typeof stored === "object" ? stored : {};
  return Object.fromEntries(
    Object.entries(PRESET_DEFAULTS).map(([field, fallback]) => [
      field,
      isKind(source[field], PRESET_FIELD_KINDS[field]) ? source[field] : fallback,
    ]),
  );
}

// A name with its spaces tidied and cut to MAX_PRESET_NAME_LENGTH; "" when nothing is left.
function cleanPresetName(text) {
  return String(text).trim().replace(/\s+/g, " ").slice(0, MAX_PRESET_NAME_LENGTH).trim();
}

function sameName(first, second) {
  return first.toLocaleLowerCase() === second.toLocaleLowerCase();
}

// The first default name, like "Filters 2", that no preset uses yet. `nameFor` turns a number into a name.
function unusedPresetName(presets, nameFor) {
  for (let number = 1; ; number += 1) {
    const name = nameFor(number);
    if (!presets.some((preset) => sameName(preset.name, name))) return name;
  }
}

// The saved presets, oldest first, skipping anything damaged and keeping only the newest MAX_FILTER_PRESETS.
function readFilterPresets(storage) {
  let stored = null;
  try {
    stored = JSON.parse(storage.getItem(FILTER_PRESETS_KEY));
  } catch {
    return [];
  }
  if (!Array.isArray(stored)) return [];
  return stored
    .filter((entry) => entry !== null && typeof entry === "object" && typeof entry.name === "string")
    .map((entry) => ({ name: cleanPresetName(entry.name), filters: cleanFilters(entry.filters) }))
    .filter((preset) => preset.name !== "")
    .slice(-MAX_FILTER_PRESETS);
}

function writeFilterPresets(storage, presets) {
  try {
    storage.setItem(FILTER_PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // Storage can be unavailable (private windows); the presets still work for this visit.
  }
}

// Saves the filters under a name. A name already used (in any capitals) updates that preset in place; past
// MAX_FILTER_PRESETS, the oldest is replaced. Returns the new list, whether an existing preset was updated, and the
// name of any preset that was replaced.
function saveFilterPreset(storage, presets, name, filters) {
  const preset = { name: cleanPresetName(name), filters: cleanFilters(filters) };
  const existing = presets.findIndex((saved) => sameName(saved.name, preset.name));
  let next;
  let replaced = null;
  if (existing !== -1) {
    next = presets.map((saved, index) => (index === existing ? { ...preset, name: saved.name } : saved));
  } else if (presets.length >= MAX_FILTER_PRESETS) {
    replaced = presets[0].name;
    next = [...presets.slice(presets.length - MAX_FILTER_PRESETS + 1), preset];
  } else {
    next = [...presets, preset];
  }
  writeFilterPresets(storage, next);
  return { presets: next, name: next[existing === -1 ? next.length - 1 : existing].name, updated: existing !== -1, replaced };
}

function deleteFilterPreset(storage, presets, name) {
  const remaining = presets.filter((preset) => preset.name !== name);
  writeFilterPresets(storage, remaining);
  return remaining;
}

if (typeof module !== "undefined") {
  module.exports = {
    MAX_FILTER_PRESETS,
    MAX_PRESET_NAME_LENGTH,
    cleanPresetName,
    deleteFilterPreset,
    presetFilters,
    readFilterPresets,
    saveFilterPreset,
    unusedPresetName,
  };
}
