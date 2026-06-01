/* Power-of-compounding calculator.
   Drives the three sliders, the live output figures, and the SVG chart
   (portfolio value vs. contributions) in the #compounding section. */
(function () {
  const root = document.getElementById("compounding");
  if (!root) return;

  const elMonthly = document.getElementById("cMonthly");
  const elRate = document.getElementById("cRate");
  const elYears = document.getElementById("cYears");
  const oMonthly = document.getElementById("oMonthly");
  const oRate = document.getElementById("oRate");
  const oYears = document.getElementById("oYears");
  const oInvested = document.getElementById("oInvested");
  const oValue = document.getElementById("oValue");
  const oGain = document.getElementById("oGain");
  const ccSub = document.getElementById("ccSub");

  const valArea = document.getElementById("cValArea");
  const conArea = document.getElementById("cConArea");
  const valLine = document.getElementById("cValLine");
  const endDot = document.getElementById("cEnd");
  const yMaxLbl = document.getElementById("cYMax");

  // chart plot geometry (viewBox 360 x 200)
  const PADL = 44, PADR = 344, TOP = 30, BASE = 172;

  function fmtINR(n) {
    if (n >= 1e7) return "₹" + (n / 1e7).toFixed(2) + " Cr";
    if (n >= 1e5) return "₹" + (n / 1e5).toFixed(1) + " L";
    return "₹" + Math.round(n).toLocaleString("en-IN");
  }
  function fmtRupee(n) {
    return "₹" + Math.round(n).toLocaleString("en-IN");
  }

  function compute(P, rate, years) {
    const i = rate / 100 / 12;
    const n = Math.round(years * 12);
    // sample no more than ~64 points along the timeline for a clean path
    const step = Math.max(1, Math.ceil(n / 64));
    const pts = []; // {t, val, con}
    let val = 0;
    pts.push({ t: 0, val: 0, con: 0 });
    for (let m = 1; m <= n; m++) {
      val = (val + P) * (1 + i);
      if (m % step === 0 || m === n) pts.push({ t: m, val: val, con: P * m });
    }
    return { pts: pts, n: n, finalVal: val, invested: P * n };
  }

  function buildPaths(data) {
    const { pts, n, finalVal } = data;
    const yMax = finalVal > 0 ? finalVal * 1.04 : 1;
    const x = (t) => PADL + (t / (n || 1)) * (PADR - PADL);
    const y = (v) => BASE - (v / yMax) * (BASE - TOP);

    let line = "", conTop = "";
    pts.forEach((p, k) => {
      line += (k === 0 ? "M" : "L") + x(p.t).toFixed(1) + "," + y(p.val).toFixed(1) + " ";
      conTop += (k === 0 ? "M" : "L") + x(p.t).toFixed(1) + "," + y(p.con).toFixed(1) + " ";
    });
    const valAreaD = line + "L" + x(n).toFixed(1) + "," + BASE + " L" + PADL + "," + BASE + " Z";
    const conAreaD = conTop + "L" + x(n).toFixed(1) + "," + BASE + " L" + PADL + "," + BASE + " Z";
    return {
      line: line.trim(),
      valArea: valAreaD,
      conArea: conAreaD,
      endX: x(n),
      endY: y(finalVal),
    };
  }

  function trackFill(el) {
    const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
    el.style.setProperty("--p", pct + "%");
  }

  function render() {
    const P = +elMonthly.value;
    const rate = +elRate.value;
    const years = +elYears.value;

    [elMonthly, elRate, elYears].forEach(trackFill);

    oMonthly.textContent = fmtRupee(P);
    oRate.textContent = (Number.isInteger(rate) ? rate : rate.toFixed(1)) + "%";
    oYears.textContent = years + (years === 1 ? " year" : " years");
    ccSub.textContent = fmtRupee(P) + " / month · " +
      (Number.isInteger(rate) ? rate : rate.toFixed(1)) + "% · " +
      years + (years === 1 ? " year" : " years");

    const data = compute(P, rate, years);
    oInvested.textContent = fmtINR(data.invested);
    oValue.textContent = fmtINR(data.finalVal);
    oGain.textContent = fmtINR(Math.max(0, data.finalVal - data.invested));
    yMaxLbl.textContent = fmtINR(data.finalVal);

    const paths = buildPaths(data);
    valArea.setAttribute("d", paths.valArea);
    conArea.setAttribute("d", paths.conArea);
    valLine.setAttribute("d", paths.line);
    endDot.setAttribute("cx", paths.endX.toFixed(1));
    endDot.setAttribute("cy", paths.endY.toFixed(1));
  }

  [elMonthly, elRate, elYears].forEach((el) => {
    el.addEventListener("input", render);
  });
  render();
})();
