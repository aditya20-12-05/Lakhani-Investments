/* Power-of-compounding calculator.
   Drives the three sliders and the live output figures in the
   #compounding section. */
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
    let val = 0;
    for (let m = 1; m <= n; m++) {
      val = (val + P) * (1 + i);
    }
    return { finalVal: val, invested: P * n };
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

    const data = compute(P, rate, years);
    oInvested.textContent = fmtINR(data.invested);
    oValue.textContent = fmtINR(data.finalVal);
    oGain.textContent = fmtINR(Math.max(0, data.finalVal - data.invested));
  }

  [elMonthly, elRate, elYears].forEach((el) => {
    el.addEventListener("input", render);
  });
  render();
})();
