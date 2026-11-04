// Draws a loan's repayment graph: what is still owed at the start and after each year of payments.

const GRAPH_WIDTH = 360;
const GRAPH_HEIGHT = 200;
const GRAPH_LEFT = 44;
const GRAPH_RIGHT = 326;
const GRAPH_TOP = 22;
const GRAPH_BOTTOM = 152;

function svgElement(name, attributes, text = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  for (const [attribute, value] of Object.entries(attributes)) {
    element.setAttribute(attribute, value);
  }
  element.textContent = text;
  return element;
}

// Round values for the money axis, from $0 to at least the highest balance.
function moneyAxisValues(highest) {
  const roughStep = highest / 4;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const step = [1, 2, 5, 10].find((multiple) => multiple * magnitude >= roughStep) * magnitude;
  const values = [];
  for (let value = 0; value < highest + step; value += step) values.push(value);
  return values;
}

function formatAxisMoney(value) {
  return value >= 1000 ? `$${value / 1000}K` : `$${value}`;
}

function describeBalance(balances, year) {
  const balance = formatMoney(balances[year]);
  return year === 0 ? t("graph.start", { balance }) : t("graph.afterYear", { year, balance });
}

function renderRepaymentGraph(balances) {
  const years = balances.length - 1;
  const moneyValues = moneyAxisValues(balances[0]);
  const topValue = moneyValues[moneyValues.length - 1];
  const xFor = (year) => GRAPH_LEFT + (year / years) * (GRAPH_RIGHT - GRAPH_LEFT);
  const yFor = (value) => GRAPH_BOTTOM - (value / topValue) * (GRAPH_BOTTOM - GRAPH_TOP);

  const svg = svgElement("svg", {
    viewBox: `0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`,
    role: "img",
    tabindex: "0",
    "aria-label": balances.map((_, year) => describeBalance(balances, year)).join(". "),
  });

  for (const value of moneyValues) {
    svg.append(
      svgElement("line", { class: "graph-grid", x1: GRAPH_LEFT, x2: GRAPH_RIGHT, y1: yFor(value), y2: yFor(value) }),
      svgElement("text", { class: "graph-axis", x: GRAPH_LEFT - 6, y: yFor(value) + 4, "text-anchor": "end" }, formatAxisMoney(value)),
    );
  }

  const yearStep = years === 5 ? 1 : 5;
  for (let year = 0; year <= years; year += yearStep) {
    svg.append(svgElement("text", { class: "graph-axis", x: xFor(year), y: GRAPH_BOTTOM + 18, "text-anchor": "middle" }, String(year)));
  }
  svg.append(
    svgElement(
      "text",
      { class: "graph-axis", x: (GRAPH_LEFT + GRAPH_RIGHT) / 2, y: GRAPH_BOTTOM + 38, "text-anchor": "middle" },
      t("graph.axisYears"),
    ),
  );

  const linePoints = balances.map((balance, year) => `${xFor(year)},${yFor(balance)}`).join(" ");
  svg.append(
    svgElement("polygon", { class: "graph-area", points: `${linePoints} ${xFor(0)},${yFor(0)}` }),
    svgElement("polyline", { class: "graph-line", points: linePoints }),
    svgElement("text", { class: "graph-label", x: xFor(0) + 6, y: yFor(balances[0]) - 6 }, formatMoney(balances[0])),
    svgElement("text", { class: "graph-label", x: xFor(years) + 6, y: yFor(0) + 4 }, formatMoney(0)),
  );

  const crosshair = svgElement("line", { class: "graph-crosshair", y1: GRAPH_TOP, y2: GRAPH_BOTTOM, visibility: "hidden" });
  const marker = svgElement("circle", { class: "graph-marker", r: 4, visibility: "hidden" });
  svg.append(crosshair, marker);

  const tooltip = document.createElement("div");
  tooltip.className = "graph-tooltip";
  tooltip.hidden = true;
  tooltip.setAttribute("aria-hidden", "true");

  const plot = document.createElement("div");
  plot.className = "graph-plot";
  plot.append(svg, tooltip);

  let shownYear = null;
  const showYear = (year) => {
    shownYear = year;
    const x = xFor(year);
    const y = yFor(balances[year]);
    crosshair.setAttribute("x1", x);
    crosshair.setAttribute("x2", x);
    crosshair.setAttribute("visibility", "visible");
    marker.setAttribute("cx", x);
    marker.setAttribute("cy", y);
    marker.setAttribute("visibility", "visible");

    tooltip.textContent = describeBalance(balances, year);
    tooltip.hidden = false;
    const scale = svg.getBoundingClientRect().width / GRAPH_WIDTH;
    tooltip.style.left = `${Math.max(0, Math.min(x * scale + 8, plot.clientWidth - tooltip.offsetWidth))}px`;
    tooltip.style.top = `${Math.max(0, y * scale - tooltip.offsetHeight - 8)}px`;
  };
  const hideYear = () => {
    shownYear = null;
    crosshair.setAttribute("visibility", "hidden");
    marker.setAttribute("visibility", "hidden");
    tooltip.hidden = true;
  };
  const showYearAtPointer = (event) => {
    const box = svg.getBoundingClientRect();
    const svgX = ((event.clientX - box.left) / box.width) * GRAPH_WIDTH;
    const year = Math.round(((svgX - GRAPH_LEFT) / (GRAPH_RIGHT - GRAPH_LEFT)) * years);
    showYear(clamp(year, 0, years));
  };

  svg.addEventListener("pointerdown", showYearAtPointer);
  svg.addEventListener("pointermove", showYearAtPointer);
  // On a touchscreen the finger lifting counts as leaving, so a tapped year stays shown.
  svg.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") hideYear();
  });
  svg.addEventListener("focus", () => {
    if (svg.matches(":focus-visible")) showYear(0);
  });
  svg.addEventListener("blur", hideYear);
  svg.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    showYear(clamp((shownYear ?? 0) + (event.key === "ArrowRight" ? 1 : -1), 0, years));
  });

  const caption = document.createElement("figcaption");
  caption.textContent = t("graph.title");
  const figure = document.createElement("figure");
  figure.className = "repayment-graph";
  figure.append(caption, plot);
  return figure;
}
