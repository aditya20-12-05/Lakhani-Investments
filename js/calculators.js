/* Calculators workspace.
   A registry of financial calculators rendered as desktop "apps". Each app
   opens a window with the live calculator (sliders + figures) and a short
   explanation of what it is and how to use it. Adding a calculator is just a
   matter of adding one entry to CALCS below. */
(function () {
  const deck = document.getElementById("appDeck");
  if (!deck) return;

  /* ---------------- formatting helpers ---------------- */
  function trim(x) {
    return (Math.round(x * 100) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });
  }
  function fmtINR(n) {
    n = Math.round(n);
    const a = Math.abs(n);
    if (a >= 1e7) return "₹" + trim(n / 1e7) + " Cr";
    if (a >= 1e5) return "₹" + trim(n / 1e5) + " L";
    return "₹" + n.toLocaleString("en-IN");
  }
  function fmtPct(v) {
    return (Math.round(v * 100) / 100) + "%";
  }
  function fmtDuration(m) {
    const y = Math.floor(m / 12), mo = m % 12;
    let s = "";
    if (y) s += y + (y === 1 ? " yr" : " yrs");
    if (mo) s += (s ? " " : "") + mo + (mo === 1 ? " mo" : " mos");
    return s || "0 mo";
  }
  function fmtVal(f, v) {
    if (f.type === "percent") return fmtPct(v);
    if (f.type === "years") return v + (v === 1 ? " year" : " years");
    if (f.type === "age") return v + " yrs";
    if (f.type === "months") return v + (v === 1 ? " month" : " months");
    return fmtINR(v);
  }
  function fmtScale(f, v) {
    if (f.type === "percent") return fmtPct(v);
    if (f.type === "years") return v + (v === 1 ? "yr" : "yrs");
    if (f.type === "age") return v;
    if (f.type === "months") return v + "mo";
    return fmtINR(v);
  }
  /* unit adornments + the plain (unit-less) value shown in the editable field */
  function unitPre(f) { return f.type === "money" ? "₹" : ""; }
  function unitSuf(f) {
    if (f.type === "percent") return "%";
    if (f.type === "years" || f.type === "age") return "yrs";
    if (f.type === "months") return "mo";
    return "";
  }
  function fieldFmt(f, v) {
    if (f.type === "money") return Math.round(v).toLocaleString("en-IN");
    return String(Math.round(v * 100) / 100);
  }

  /* ---------------- maths helpers ---------------- */
  function sipFV(P, r, Y) {
    const i = r / 100 / 12, n = Math.round(Y * 12);
    if (i === 0) return P * n;
    return P * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
  }
  function sipFor(target, r, Y) {
    const i = r / 100 / 12, n = Math.round(Y * 12);
    return i === 0 ? target / n : target * i / ((Math.pow(1 + i, n) - 1) * (1 + i));
  }
  function realVal(fv, infl, years) { return fv / Math.pow(1 + infl / 100, years); }
  function yrsToDouble(rate) { return rate <= 0 ? Infinity : Math.log(2) / Math.log(1 + rate / 100); }
  function pctOf(part, whole) { return whole > 0 ? Math.round((part / whole) * 100) : 0; }
  function yrsText(y) {
    if (!isFinite(y)) return "never";
    return (Math.round(y * 10) / 10) + " years";
  }
  function emiOf(P, rate, years) {
    const i = rate / 100 / 12, n = Math.round(years * 12);
    return i === 0 ? P / n : P * i * Math.pow(1 + i, n) / (Math.pow(1 + i, n) - 1);
  }
  /* months a SIP of P at rate r takes to reach a target future value */
  function monthsToTarget(P, rate, target) {
    const i = rate / 100 / 12;
    if (P <= 0) return Infinity;
    if (i === 0) return target / P;
    const n = Math.log(1 + (target * i) / (P * (1 + i))) / Math.log(1 + i);
    return isFinite(n) && n > 0 ? n : Infinity;
  }
  /* a tidy ladder of durations spanning a field's range, on round numbers,
     with the currently chosen value slotted in so it can be highlighted */
  function durationLadder(f, selected) {
    const span = f.max - f.min;
    const raw = Math.max(f.step || 1, span / 6);
    const NICE = [1, 2, 3, 5, 10, 15, 20, 25, 50];
    let stride = NICE.reduce(function (p, c) { return Math.abs(c - raw) <= Math.abs(p - raw) ? c : p; });
    stride = Math.max(stride, f.step || 1);
    let start = Math.ceil(f.min / stride) * stride;
    if (start < f.min) start += stride;
    const out = [];
    for (let d = start; d <= f.max + 1e-9; d += stride) out.push(Math.round(d));
    const sel = Math.round(selected);
    if (sel >= f.min && sel <= f.max && out.indexOf(sel) === -1) {
      out.push(sel); out.sort(function (a, b) { return a - b; });
    }
    return out;
  }

  /* ---------------- composition chart ----------------
     Takes [{label, amount, tone}] and draws a donut (pie) with a centre
     total and a small legend. tone is one of: in, grow, warn, alt.
     Typically the first slice is what you put in and the second is what
     your money made on top. */
  function buildChart(parts) {
    const segs = parts.filter(function (p) { return p.amount > 0; });
    const total = segs.reduce(function (s, p) { return s + p.amount; }, 0);
    if (total <= 0) return "";
    // r chosen so the circumference is 100, letting dasharray read as a percent
    let acc = 0;
    const ring = segs.map(function (p) {
      const len = (p.amount / total) * 100;
      const off = 25 - acc; // start the first slice at 12 o'clock, stack clockwise
      acc += len;
      return '<circle class="cd-seg cc-' + (p.tone || "in") + '" cx="21" cy="21" r="15.915" ' +
        'fill="none" stroke-width="5.5" stroke-linecap="butt" ' +
        'stroke-dasharray="' + len.toFixed(3) + " " + (100 - len).toFixed(3) + '" ' +
        'stroke-dashoffset="' + off.toFixed(3) + '"><title>' + p.label + "</title></circle>";
    }).join("");
    const donut = '<div class="cd-wrap">' +
      '<svg class="cd-svg" viewBox="0 0 42 42" role="img" aria-label="Money breakdown">' +
        '<circle class="cd-track" cx="21" cy="21" r="15.915" fill="none" stroke-width="5.5"></circle>' +
        ring +
        '<text class="cd-c1" x="21" y="20.6" text-anchor="middle">' + fmtINR(total) + "</text>" +
        '<text class="cd-c2" x="21" y="24.4" text-anchor="middle">total</text>' +
      "</svg></div>";
    const legend = segs.map(function (p) {
      const w = Math.round((p.amount / total) * 100);
      return '<li class="cc-key"><span class="cc-dot cc-' + (p.tone || "in") + '"></span>' +
        '<span class="cc-lbl">' + p.label + '</span>' +
        '<span class="cc-amt">' + fmtINR(p.amount) + '</span>' +
        '<span class="cc-pct">' + w + '%</span></li>';
    }).join("");
    return donut + '<ul class="cc-legend">' + legend + "</ul>";
  }

  /* ---------------- duration projection ----------------
     For every tool, a small table showing the same plan held for fewer or
     more years (or ages, or months), with the current choice highlighted.
     The maths for each row lives in the calculator's `project` definition,
     which can drive the ladder from an input field (`field`) or from a
     synthetic range (`range` + optional `currentN` to mark a row). */
  function projUnit(p, f) {
    if (p.unit) return p.unit;
    if (f) return f.type;
    return "years";
  }
  function rowLabel(n, unit) {
    if (unit === "months") return n + (n === 1 ? " mo" : " mos");
    if (unit === "age") return String(n);
    if (unit === "years") return n + (n === 1 ? " yr" : " yrs");
    return String(n);
  }
  function buildProjection(c, vals) {
    const p = c.project;
    if (!p) return "";
    let f = null, range = null, sel = null;
    if (p.field) {
      for (let k = 0; k < c.inputs.length; k++) { if (c.inputs[k].id === p.field) { f = c.inputs[k]; break; } }
      if (!f) return "";
      range = f;
      sel = Math.round(vals[p.field]);
    } else if (p.range) {
      range = p.range;
      if (p.currentN) { const cn = p.currentN(vals); sel = (cn == null || !isFinite(cn)) ? null : Math.round(cn); }
    } else {
      return "";
    }
    const unit = projUnit(p, f);
    const ladder = durationLadder(range, sel == null ? range.min : sel);
    const head = '<th scope="col">' + (p.durLabel || "Duration") + "</th>" +
      p.cols.map(function (h) { return '<th scope="col">' + h + "</th>"; }).join("");
    const rows = ladder.map(function (n) {
      const cells = p.row(vals, n).map(function (cell) { return "<td>" + cell + "</td>"; }).join("");
      const cur = (sel != null && n === sel) ? ' class="is-current"' : "";
      return "<tr" + cur + '><th scope="row">' + rowLabel(n, unit) + "</th>" + cells + "</tr>";
    }).join("");
    return '<div class="cw-proj-head">' +
        "<h4>" + (p.title || "How it grows over time") + "</h4>" +
        '<p class="cw-proj-sub">' + (p.sub || "The same plan held for fewer or more years. Your current choice is highlighted.") + "</p>" +
      "</div>" +
      '<div class="proj-scroll"><table class="proj-table">' +
        "<thead><tr>" + head + "</tr></thead><tbody>" + rows + "</tbody></table></div>";
  }

  /* ---------------- icons ---------------- */
  const I = {
    sip: '<path d="M3 17l6-6 4 4 8-8"/><path d="M16 7h5v5"/>',
    stepup: '<path d="M3 21h4v-5h5v-5h5v-5h4"/>',
    lumpsum: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/>',
    goal: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    cagr: '<path d="M4 19V5"/><path d="M4 19h16"/><path d="M7 16l4-5 3 3 5-7"/>',
    retire: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4"/>',
    nps: '<path d="M12 3a9 9 0 00-9 9h18a9 9 0 00-9-9z"/><path d="M12 12v7a2 2 0 01-4 0"/>',
    swp: '<circle cx="12" cy="7" r="4"/><path d="M8 13l4 4 4-4"/><path d="M12 17V9"/>',
    emi: '<path d="M3 11l9-7 9 7"/><path d="M5 10v9h14v-9"/><path d="M10 19v-5h4v5"/>',
    fd: '<rect x="4" y="5" width="16" height="14" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M12 14.5V17"/>',
    rd: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/><circle cx="12" cy="15" r="2.3"/>',
    ppf: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M12 8.5v5M9.5 11h5"/>',
    epf: '<rect x="3" y="7" width="18" height="12" rx="2"/><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M3 12h18"/>',
    gratuity: '<rect x="3" y="8" width="18" height="13" rx="1"/><path d="M3 12h18M12 8v13"/><path d="M12 8c-1.5 0-4-.5-4-2.2S10.5 4 12 8zM12 8c1.5 0 4-.5 4-2.2S13.5 4 12 8z"/>',
    inflation: '<path d="M12 13c3.3 0 6-2.7 6-6s-2.7-6-6-6-6 2.7-6 6 2.7 6 6 6z"/><path d="M12 13v6M9.5 19h5"/>',
    ssy: '<path d="M2 9l10-4 10 4-10 4z"/><path d="M6 11v4c0 1.5 2.7 3 6 3s6-1.5 6-3v-4"/><path d="M22 9v5"/>',
    education: '<path d="M3 5.5h6a3 3 0 013 3V20a2.5 2.5 0 00-2.5-2.5H3z"/><path d="M21 5.5h-6a3 3 0 00-3 3V20a2.5 2.5 0 012.5-2.5H21z"/>',
    wedding: '<path d="M12 21s-7-4.4-9.3-8.8C1.3 9.3 2.8 5.6 6.2 5.6c2 0 3.2 1.2 4 2.4.8-1.2 2-2.4 4-2.4 3.4 0 4.9 3.7 3.5 6.6C19 16.6 12 21 12 21z"/>',
    home: '<path d="M4 11l8-6 8 6"/><path d="M6 10v9h12v-9"/><path d="M12 18s-2.3-1.5-2.3-3.1A1.5 1.5 0 0112 13.6a1.5 1.5 0 012.3 1.3C14.3 16.5 12 18 12 18z"/>',
    purchase: '<path d="M6 8h12l-1.1 11.2a1 1 0 01-1 .8H8.1a1 1 0 01-1-.8z"/><path d="M9 8V6.2a3 3 0 016 0V8"/>',
    emergency: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.4"/><path d="M12 3v5.6M12 15.4V21M3 12h5.6M15.4 12H21"/>',
    crore: '<path d="M8 4h8v3.5a4 4 0 01-8 0z"/><path d="M8 5.5H5.2a1.8 1.8 0 002.3 3M16 5.5h2.8a1.8 1.8 0 01-2.3 3"/><path d="M12 11.5V16M9.5 20h5M10.2 16h3.6l.8 4H9.4z"/>'
  };
  function icon(p) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + "</svg>";
  }

  const DISC = "Illustrative only. Actual returns vary and are not guaranteed.";

  /* ---------------- registry ---------------- */
  const CALCS = [
    {
      id: "sip", name: "SIP", accent: "blue", icon: icon(I.sip),
      tag: "Invest monthly, compound for years",
      about: "A Systematic Investment Plan invests a fixed amount in mutual funds every month. Because returns start earning returns of their own, small monthly steps can compound into a sizeable corpus over time.",
      how: ["Set how much you can invest each month.", "Choose an expected annual return.", "Pick how long you will stay invested.", "Set expected inflation to see the corpus in today's money."],
      inputs: [
        { id: "monthly", label: "Monthly investment", type: "money", min: 500, max: 200000, step: 500, value: 10000 },
        { id: "rate", label: "Expected return (p.a.)", type: "percent", min: 1, max: 20, step: 0.5, value: 12 },
        { id: "years", label: "Time horizon", type: "years", min: 1, max: 40, step: 1, value: 15 },
        { id: "inflation", label: "Expected inflation", type: "percent", min: 0, max: 12, step: 0.5, value: 6 }
      ],
      outputs: [
        { id: "invested", label: "You invest", kind: "plain" },
        { id: "value", label: "It could become", kind: "grow" },
        { id: "gain", label: "Wealth gained", kind: "gain" },
        { id: "real", label: "Worth in today's money", kind: "plain" }
      ],
      compute: function (v) {
        const fv = sipFV(v.monthly, v.rate, v.years);
        const inv = v.monthly * Math.round(v.years * 12);
        const real = realVal(fv, v.inflation, v.years);
        return {
          invested: fmtINR(inv), value: fmtINR(fv), gain: fmtINR(fv - inv), real: fmtINR(real),
          _chart: [{ label: "You invest", amount: inv, tone: "in" }, { label: "Returns", amount: fv - inv, tone: "grow" }],
          _insight: "Compounding alone adds <b>" + fmtINR(fv - inv) + "</b>, about " + pctOf(fv - inv, fv) + "% of the final corpus. After " + fmtPct(v.inflation) + " inflation it would buy what <b>" + fmtINR(real) + "</b> buys today."
        };
      }
    },
    {
      id: "stepup", name: "Step-up SIP", accent: "green", icon: icon(I.stepup),
      tag: "Raise your SIP every year",
      about: "A step-up SIP raises your monthly contribution by a set percentage every year, usually in step with your income. The rising amount, compounded over time, can grow your corpus far beyond a flat SIP.",
      how: ["Set your starting monthly amount.", "Choose how much to step it up each year.", "Set an expected return and time horizon.", "Compare the corpus with a flat SIP of the same start."],
      inputs: [
        { id: "monthly", label: "Starting monthly amount", type: "money", min: 500, max: 200000, step: 500, value: 10000 },
        { id: "stepup", label: "Annual step-up", type: "percent", min: 0, max: 25, step: 1, value: 10 },
        { id: "rate", label: "Expected return (p.a.)", type: "percent", min: 1, max: 20, step: 0.5, value: 12 },
        { id: "years", label: "Time horizon", type: "years", min: 1, max: 40, step: 1, value: 15 }
      ],
      outputs: [
        { id: "value", label: "It could become", kind: "grow" },
        { id: "flat", label: "A flat SIP would give", kind: "plain" },
        { id: "advantage", label: "Step-up advantage", kind: "gain" },
        { id: "invested", label: "You invest", kind: "plain" }
      ],
      compute: function (v) {
        const i = v.rate / 100 / 12; let val = 0, inv = 0;
        for (let y = 0; y < v.years; y++) {
          const P = v.monthly * Math.pow(1 + v.stepup / 100, y);
          for (let m = 0; m < 12; m++) { val = (val + P) * (1 + i); inv += P; }
        }
        const flat = sipFV(v.monthly, v.rate, v.years);
        const adv = val - flat;
        return {
          value: fmtINR(val), flat: fmtINR(flat), advantage: fmtINR(adv), invested: fmtINR(inv),
          _chart: [{ label: "You invest", amount: inv, tone: "in" }, { label: "Returns", amount: val - inv, tone: "grow" }],
          _insight: "Raising your SIP " + fmtPct(v.stepup) + " a year earns <b>" + fmtINR(adv) + "</b> more than holding it flat at " + fmtINR(v.monthly) + " a month, for the same " + v.years + " years."
        };
      }
    },
    {
      id: "lumpsum", name: "Lumpsum", accent: "blue", icon: icon(I.lumpsum),
      tag: "Put one amount to work",
      about: "A lumpsum invests a single amount once and lets it grow. It shows the power of staying invested: even without adding more, compounding can multiply a one-time investment over the years.",
      how: ["Enter the amount you would invest today.", "Choose an expected annual return.", "Pick how long it stays invested.", "Set inflation to see the maturity in today's money."],
      inputs: [
        { id: "amount", label: "One-time investment", type: "money", min: 5000, max: 20000000, step: 5000, value: 500000 },
        { id: "rate", label: "Expected return (p.a.)", type: "percent", min: 1, max: 20, step: 0.5, value: 12 },
        { id: "years", label: "Time horizon", type: "years", min: 1, max: 40, step: 1, value: 15 },
        { id: "inflation", label: "Expected inflation", type: "percent", min: 0, max: 12, step: 0.5, value: 6 }
      ],
      outputs: [
        { id: "value", label: "It could become", kind: "grow" },
        { id: "gain", label: "Wealth gained", kind: "gain" },
        { id: "real", label: "Worth in today's money", kind: "plain" },
        { id: "multiple", label: "Growth multiple", kind: "plain" }
      ],
      compute: function (v) {
        const fv = v.amount * Math.pow(1 + v.rate / 100, v.years);
        const real = realVal(fv, v.inflation, v.years);
        const dbl = yrsToDouble(v.rate);
        return {
          value: fmtINR(fv), gain: fmtINR(fv - v.amount), real: fmtINR(real),
          multiple: (Math.round(fv / v.amount * 100) / 100) + "×",
          _chart: [{ label: "You invest", amount: v.amount, tone: "in" }, { label: "Returns", amount: fv - v.amount, tone: "grow" }],
          _insight: "At " + fmtPct(v.rate) + ", money roughly doubles every <b>" + yrsText(dbl) + "</b>. Left untouched for " + v.years + " years, yours grows " + (Math.round(fv / v.amount * 10) / 10) + "×."
        };
      }
    },
    {
      id: "goal", name: "Goal SIP", accent: "green", icon: icon(I.goal),
      tag: "Work backwards from a target",
      about: "Work backwards from a goal. Tell it the amount you want, when you want it and the cost of living rise, and it shows the monthly SIP, or the lumpsum today, needed to get there.",
      how: ["Set your goal in today's money.", "Choose an expected annual return.", "Set the years to the goal.", "Add inflation so the goal grows to its real future cost."],
      inputs: [
        { id: "target", label: "Goal (in today's money)", type: "money", min: 100000, max: 100000000, step: 100000, value: 5000000 },
        { id: "rate", label: "Expected return (p.a.)", type: "percent", min: 1, max: 20, step: 0.5, value: 12 },
        { id: "years", label: "Years to goal", type: "years", min: 1, max: 40, step: 1, value: 10 },
        { id: "inflation", label: "Inflation on the goal", type: "percent", min: 0, max: 12, step: 0.5, value: 6 }
      ],
      outputs: [
        { id: "monthly", label: "Monthly SIP needed", kind: "grow" },
        { id: "lump", label: "Or invest today", kind: "gain" },
        { id: "futureCost", label: "Goal in future rupees", kind: "plain" },
        { id: "invested", label: "You invest in total", kind: "plain" }
      ],
      compute: function (v) {
        const futureCost = v.target * Math.pow(1 + v.inflation / 100, v.years);
        const P = sipFor(futureCost, v.rate, v.years);
        const lump = futureCost / Math.pow(1 + v.rate / 100, v.years);
        const inv = P * Math.round(v.years * 12);
        return {
          monthly: fmtINR(P), lump: fmtINR(lump), futureCost: fmtINR(futureCost), invested: fmtINR(inv),
          _chart: [{ label: "You invest", amount: inv, tone: "in" }, { label: "Returns", amount: Math.max(0, futureCost - inv), tone: "grow" }],
          _insight: "With " + fmtPct(v.inflation) + " inflation, a " + fmtINR(v.target) + " goal will cost <b>" + fmtINR(futureCost) + "</b> in " + v.years + " years. Start <b>" + fmtINR(P) + "</b> a month, or invest " + fmtINR(lump) + " today."
        };
      }
    },
    {
      id: "cagr", name: "CAGR", accent: "blue", icon: icon(I.cagr),
      tag: "The smoothed yearly growth rate",
      about: "The Compound Annual Growth Rate is the smoothed yearly rate at which an investment grew from its start value to its end value. It lets you compare very different investments on equal terms.",
      how: ["Enter the initial value of the investment.", "Enter its final value.", "Set the holding period in years.", "Add inflation to see the real, after-inflation growth rate."],
      inputs: [
        { id: "initial", label: "Initial value", type: "money", min: 1000, max: 10000000, step: 1000, value: 100000 },
        { id: "final", label: "Final value", type: "money", min: 1000, max: 50000000, step: 1000, value: 300000 },
        { id: "years", label: "Period", type: "years", min: 1, max: 40, step: 1, value: 5 },
        { id: "inflation", label: "Inflation over period", type: "percent", min: 0, max: 12, step: 0.5, value: 6 }
      ],
      outputs: [
        { id: "cagr", label: "CAGR", kind: "grow" },
        { id: "real", label: "Real CAGR (after inflation)", kind: "gain" },
        { id: "abs", label: "Absolute return", kind: "plain" },
        { id: "mult", label: "Growth", kind: "plain" }
      ],
      compute: function (v) {
        const ratio = v.final / v.initial;
        const cagr = Math.pow(ratio, 1 / v.years) - 1;
        const real = (1 + cagr) / (1 + v.inflation / 100) - 1;
        return {
          cagr: fmtPct(cagr * 100), real: fmtPct(real * 100), abs: fmtPct((ratio - 1) * 100),
          mult: (Math.round(ratio * 100) / 100) + "×",
          _chart: [{ label: "Initial value", amount: v.initial, tone: "in" }, { label: "Gain", amount: Math.max(0, v.final - v.initial), tone: "grow" }],
          _insight: "It grew <b>" + fmtPct(cagr * 100) + "</b> a year. After " + fmtPct(v.inflation) + " inflation, real buying power grew <b>" + fmtPct(real * 100) + "</b> a year."
        };
      }
    },
    {
      id: "retirement", name: "Retirement", accent: "green", icon: icon(I.retire),
      tag: "Build the nest egg you'll need",
      about: "Estimates the nest egg you will need to maintain your lifestyle after you stop working, allowing for inflation, and the monthly SIP that could build it in time.",
      how: ["Set your current and retirement age.", "Enter your monthly expenses today.", "Set inflation and your expected returns before and after retirement.", "Add any savings you already have to lower the SIP you need."],
      inputs: [
        { id: "curAge", label: "Current age", type: "age", min: 18, max: 55, step: 1, value: 30 },
        { id: "retAge", label: "Retirement age", type: "age", min: 40, max: 70, step: 1, value: 60 },
        { id: "monthlyExpense", label: "Monthly expenses today", type: "money", min: 5000, max: 500000, step: 1000, value: 50000 },
        { id: "current", label: "Savings so far", type: "money", min: 0, max: 50000000, step: 50000, value: 500000 },
        { id: "inflation", label: "Inflation", type: "percent", min: 2, max: 12, step: 0.5, value: 6 },
        { id: "preReturn", label: "Return till retirement", type: "percent", min: 6, max: 18, step: 0.5, value: 12 },
        { id: "postReturn", label: "Return after retirement", type: "percent", min: 4, max: 12, step: 0.5, value: 7 },
        { id: "retYears", label: "Years in retirement", type: "years", min: 10, max: 40, step: 1, value: 25 }
      ],
      outputs: [
        { id: "corpus", label: "Corpus needed", kind: "grow" },
        { id: "savingsGrow", label: "Savings will become", kind: "plain" },
        { id: "sip", label: "Monthly SIP needed", kind: "gain" },
        { id: "futMonthly", label: "Monthly need at 60", kind: "plain" }
      ],
      compute: function (v) {
        const yToRet = Math.max(1, v.retAge - v.curAge);
        const futMonthly = v.monthlyExpense * Math.pow(1 + v.inflation / 100, yToRet);
        const annual = futMonthly * 12;
        const realRate = ((1 + v.postReturn / 100) / (1 + v.inflation / 100)) - 1;
        let corpus;
        if (Math.abs(realRate) < 1e-6) corpus = annual * v.retYears;
        else corpus = annual * (1 - Math.pow(1 + realRate, -v.retYears)) / realRate * (1 + realRate);
        const fvCurrent = v.current * Math.pow(1 + v.preReturn / 100, yToRet);
        const shortfall = Math.max(0, corpus - fvCurrent);
        const sip = sipFor(shortfall, v.preReturn, yToRet);
        const covered = pctOf(Math.min(fvCurrent, corpus), corpus);
        return {
          corpus: fmtINR(corpus), savingsGrow: fmtINR(fvCurrent), sip: fmtINR(sip), futMonthly: fmtINR(futMonthly),
          _chart: [{ label: "From your savings", amount: Math.min(fvCurrent, corpus), tone: "in" }, { label: "From the new SIP", amount: shortfall, tone: "grow" }],
          _insight: "Your savings grow to <b>" + fmtINR(fvCurrent) + "</b>, covering " + covered + "% of the corpus. Invest <b>" + fmtINR(sip) + "</b> a month for the rest, over " + yToRet + " years."
        };
      }
    },
    {
      id: "nps", name: "NPS", accent: "blue", icon: icon(I.nps),
      tag: "A pension plus a lump sum",
      about: "The National Pension System builds a retirement corpus through regular contributions until age 60. At retirement a part is taken as a lump sum and the rest buys an annuity that pays a monthly pension.",
      how: ["Set your monthly contribution and current age.", "Choose an expected return on the corpus.", "Set the share used to buy an annuity and its rate.", "Add inflation to see the pension in today's money."],
      note: "At least 40% of the corpus must buy an annuity; the other 60% is tax-free at exit. NPS also allows an extra ₹50,000 deduction under 80CCD(1B). " + DISC,
      inputs: [
        { id: "monthly", label: "Monthly contribution", type: "money", min: 500, max: 200000, step: 500, value: 10000 },
        { id: "curAge", label: "Current age", type: "age", min: 18, max: 59, step: 1, value: 30 },
        { id: "rate", label: "Expected return (p.a.)", type: "percent", min: 6, max: 14, step: 0.5, value: 10 },
        { id: "annuityPct", label: "% used for annuity", type: "percent", min: 40, max: 100, step: 5, value: 40 },
        { id: "annuityRate", label: "Annuity return", type: "percent", min: 4, max: 9, step: 0.5, value: 6 },
        { id: "inflation", label: "Expected inflation", type: "percent", min: 0, max: 12, step: 0.5, value: 6 }
      ],
      outputs: [
        { id: "corpus", label: "Corpus at 60", kind: "grow" },
        { id: "pension", label: "Monthly pension", kind: "gain" },
        { id: "realPension", label: "Pension in today's money", kind: "plain" },
        { id: "lump", label: "Lump sum withdrawal", kind: "plain" }
      ],
      compute: function (v) {
        const yToRet = Math.max(1, 60 - v.curAge);
        const corpus = sipFV(v.monthly, v.rate, yToRet);
        const annuity = corpus * v.annuityPct / 100;
        const pension = annuity * v.annuityRate / 100 / 12;
        const realPension = realVal(pension, v.inflation, yToRet);
        return {
          corpus: fmtINR(corpus), pension: fmtINR(pension), realPension: fmtINR(realPension), lump: fmtINR(corpus - annuity),
          _chart: [{ label: "Buys your pension", amount: annuity, tone: "in" }, { label: "Tax-free lump sum", amount: corpus - annuity, tone: "grow" }],
          _insight: "At 60 you would draw <b>" + fmtINR(pension) + "</b> a month, worth about <b>" + fmtINR(realPension) + "</b> in today's money, plus a " + fmtINR(corpus - annuity) + " tax-free lump sum."
        };
      }
    },
    {
      id: "swp", name: "SWP", accent: "green", icon: icon(I.swp),
      tag: "Draw a regular income",
      about: "A Systematic Withdrawal Plan draws a regular income from your corpus while the balance keeps earning returns. Index the withdrawal to inflation to see how long real, lifestyle-preserving income can last.",
      how: ["Enter your invested corpus.", "Set the monthly amount you want to withdraw.", "Choose an expected return and a period.", "Set inflation so withdrawals rise to keep their buying power."],
      inputs: [
        { id: "corpus", label: "Invested corpus", type: "money", min: 100000, max: 100000000, step: 100000, value: 5000000 },
        { id: "withdraw", label: "Monthly withdrawal", type: "money", min: 1000, max: 500000, step: 1000, value: 25000 },
        { id: "rate", label: "Expected return (p.a.)", type: "percent", min: 1, max: 15, step: 0.5, value: 8 },
        { id: "inflation", label: "Raise withdrawals by", type: "percent", min: 0, max: 12, step: 0.5, value: 6 },
        { id: "years", label: "Period", type: "years", min: 1, max: 40, step: 1, value: 20 }
      ],
      outputs: [
        { id: "lasts", label: "Corpus lasts", kind: "grow" },
        { id: "balance", label: "Balance at end of period", kind: "gain" },
        { id: "withdrawn", label: "Total withdrawn", kind: "plain" },
        { id: "finalWd", label: "Final monthly withdrawal", kind: "plain" }
      ],
      compute: function (v) {
        const i = v.rate / 100 / 12, g = v.inflation / 100;
        let bal = v.corpus, life = null, w = v.withdraw;
        for (let m = 1; m <= 1200; m++) {
          if (m > 1 && (m - 1) % 12 === 0) w *= (1 + g);
          bal = bal * (1 + i) - w;
          if (bal <= 0) { life = m; break; }
        }
        let b = v.corpus, withdrawn = 0, w2 = v.withdraw, lastW = v.withdraw; const n = Math.round(v.years * 12);
        for (let m = 1; m <= n; m++) {
          if (b <= 0) break;
          if (m > 1 && (m - 1) % 12 === 0) w2 *= (1 + g);
          const grown = b * (1 + i), draw = Math.min(w2, grown);
          lastW = draw; b = grown - draw; withdrawn += draw;
        }
        const lastsTxt = life === null ? "100+ years" : fmtDuration(life);
        return {
          lasts: lastsTxt, balance: fmtINR(Math.max(0, b)), withdrawn: fmtINR(Math.max(0, withdrawn)), finalWd: fmtINR(lastW),
          _chart: [{ label: "Withdrawn over the period", amount: Math.max(0, withdrawn), tone: "grow" }, { label: "Balance still invested", amount: Math.max(0, b), tone: "in" }],
          _insight: "Starting at " + fmtINR(v.withdraw) + " a month and rising " + fmtPct(v.inflation) + " a year, the corpus lasts <b>" + lastsTxt + "</b>."
        };
      }
    },
    {
      id: "fd", name: "Fixed Deposit", accent: "blue", icon: icon(I.fd),
      tag: "Assured return, taxed at slab",
      about: "A fixed deposit locks a lump sum with a bank for a fixed term at a fixed rate, compounded quarterly. The return is assured, but the interest is taxed at your slab and can struggle to outpace inflation.",
      how: ["Enter the amount you would deposit.", "Set the interest rate offered.", "Choose the term in years.", "Set your tax slab and inflation to see what the maturity is really worth."],
      note: "Interest is taxed at your income-tax slab; assumes quarterly compounding. Banks may differ. " + DISC,
      inputs: [
        { id: "principal", label: "Deposit amount", type: "money", min: 5000, max: 10000000, step: 5000, value: 500000 },
        { id: "rate", label: "Interest rate (p.a.)", type: "percent", min: 3, max: 10, step: 0.1, value: 7 },
        { id: "years", label: "Term", type: "years", min: 1, max: 10, step: 1, value: 5 },
        { id: "taxSlab", label: "Your tax slab", type: "percent", min: 0, max: 30, step: 5, value: 30 },
        { id: "inflation", label: "Expected inflation", type: "percent", min: 0, max: 12, step: 0.5, value: 6 }
      ],
      outputs: [
        { id: "value", label: "Maturity value", kind: "grow" },
        { id: "postTax", label: "After-tax value", kind: "gain" },
        { id: "real", label: "Worth in today's money", kind: "plain" },
        { id: "interest", label: "Interest earned", kind: "plain" }
      ],
      compute: function (v) {
        const fv = v.principal * Math.pow(1 + v.rate / 100 / 4, 4 * v.years);
        const interest = fv - v.principal;
        const tax = interest * v.taxSlab / 100;
        const postTax = fv - tax;
        const real = realVal(postTax, v.inflation, v.years);
        const postTaxRate = v.rate * (1 - v.taxSlab / 100);
        const beatsInflation = postTaxRate >= v.inflation;
        return {
          value: fmtINR(fv), postTax: fmtINR(postTax), real: fmtINR(real), interest: fmtINR(interest),
          _chart: [{ label: "Your deposit", amount: v.principal, tone: "in" }, { label: "Interest kept", amount: interest - tax, tone: "grow" }, { label: "Lost to tax", amount: tax, tone: "warn" }],
          _insight: "In the " + fmtPct(v.taxSlab) + " slab, " + fmtPct(v.rate) + " becomes <b>" + fmtPct(Math.round(postTaxRate * 100) / 100) + "</b> after tax. " +
            (beatsInflation
              ? "That still clears " + fmtPct(v.inflation) + " inflation, so your money keeps its worth."
              : "That trails " + fmtPct(v.inflation) + " inflation, so <b>" + fmtINR(postTax) + "</b> later buys only what <b>" + fmtINR(real) + "</b> does today.")
        };
      }
    },
    {
      id: "rd", name: "Recurring Deposit", accent: "green", icon: icon(I.rd),
      tag: "Save a fixed sum each month",
      about: "A recurring deposit puts a fixed amount into a bank every month for a fixed term at a fixed rate. Compounded monthly, the quoted rate works out to a slightly higher effective yield over the year.",
      how: ["Set your monthly deposit.", "Enter the interest rate offered.", "Choose the term in years.", "See the effective annual yield and the interest you earn."],
      note: "Compounded monthly for simplicity. Banks may differ. " + DISC,
      inputs: [
        { id: "monthly", label: "Monthly deposit", type: "money", min: 500, max: 100000, step: 500, value: 5000 },
        { id: "rate", label: "Interest rate (p.a.)", type: "percent", min: 3, max: 9, step: 0.1, value: 6.5 },
        { id: "years", label: "Term", type: "years", min: 1, max: 10, step: 1, value: 5 }
      ],
      outputs: [
        { id: "value", label: "Maturity value", kind: "grow" },
        { id: "interest", label: "Interest earned", kind: "gain" },
        { id: "effYield", label: "Effective annual yield", kind: "plain" },
        { id: "invested", label: "You deposit", kind: "plain" }
      ],
      compute: function (v) {
        const i = v.rate / 100 / 12, n = Math.round(v.years * 12); let val = 0;
        for (let m = 0; m < n; m++) val = (val + v.monthly) * (1 + i);
        const inv = v.monthly * n;
        // effective annual yield: monthly compounding lifts the quoted rate slightly
        const eff = (Math.pow(1 + i, 12) - 1) * 100;
        return {
          value: fmtINR(val), interest: fmtINR(val - inv), effYield: fmtPct(Math.round(eff * 100) / 100), invested: fmtINR(inv),
          _chart: [{ label: "You deposit", amount: inv, tone: "in" }, { label: "Interest", amount: val - inv, tone: "grow" }],
          _insight: "Compounded monthly, the " + fmtPct(v.rate) + " rate works out to an effective yield of <b>" + fmtPct(Math.round(eff * 100) / 100) + "</b> a year. Saving " + fmtINR(v.monthly) + " a month for " + v.years + " years builds <b>" + fmtINR(val) + "</b>, of which <b>" + fmtINR(val - inv) + "</b> is interest."
        };
      }
    },
    {
      id: "ppf", name: "PPF", accent: "blue", icon: icon(I.ppf),
      tag: "Tax-free, government-backed",
      about: "The Public Provident Fund is a government savings scheme with a 15-year term, tax-free interest compounded yearly, and a deposit cap of ₹1.5 lakh a year. Because the interest is fully tax-free, its real value beats a bank FD paying the same rate.",
      how: ["Set your yearly investment (up to ₹1.5 lakh).", "Enter the current PPF rate.", "Choose the duration (15 years or extended).", "Set your tax slab to see the taxable FD rate it really matches."],
      note: "PPF interest is fully tax-free (EEE). Rates are set by the government and revised periodically. " + DISC,
      inputs: [
        { id: "yearly", label: "Yearly investment", type: "money", min: 500, max: 150000, step: 500, value: 150000 },
        { id: "rate", label: "Interest rate (p.a.)", type: "percent", min: 6, max: 9, step: 0.1, value: 7.1 },
        { id: "years", label: "Duration", type: "years", min: 15, max: 50, step: 1, value: 15 },
        { id: "taxSlab", label: "Your tax slab", type: "percent", min: 0, max: 30, step: 5, value: 30 }
      ],
      outputs: [
        { id: "value", label: "Maturity value", kind: "grow" },
        { id: "interest", label: "Interest earned", kind: "gain" },
        { id: "equivFD", label: "Equals a taxable FD at", kind: "plain" },
        { id: "invested", label: "Total invested", kind: "plain" }
      ],
      compute: function (v) {
        let bal = 0; for (let y = 0; y < v.years; y++) bal = (bal + v.yearly) * (1 + v.rate / 100);
        const inv = v.yearly * v.years;
        const equiv = v.taxSlab >= 100 ? Infinity : v.rate / (1 - v.taxSlab / 100);
        return {
          value: fmtINR(bal), interest: fmtINR(bal - inv), equivFD: fmtPct(Math.round(equiv * 100) / 100), invested: fmtINR(inv),
          _chart: [{ label: "You invest", amount: inv, tone: "in" }, { label: "Tax-free interest", amount: bal - inv, tone: "grow" }],
          _insight: "PPF interest is tax-free. To match its " + fmtPct(v.rate) + " after tax in the " + fmtPct(v.taxSlab) + " slab, a taxable bank FD would have to pay <b>" + fmtPct(Math.round(equiv * 100) / 100) + "</b>."
        };
      }
    },
    {
      id: "epf", name: "EPF", accent: "green", icon: icon(I.epf),
      tag: "Your salary's retirement share",
      about: "The Employees' Provident Fund builds a retirement corpus from monthly contributions out of your basic salary, matched in part by your employer, and compounded at a government-set rate. The employer's share is effectively free money on top of your own saving.",
      how: ["Enter your monthly basic + DA.", "Set your expected annual increment.", "Enter the EPF interest rate and years of service.", "See how your share and your employer's each grow."],
      note: "Simplified: 12% employee + 3.67% employer of basic, ignoring the pension (EPS) split and wage ceiling. " + DISC,
      inputs: [
        { id: "basic", label: "Monthly basic + DA", type: "money", min: 5000, max: 500000, step: 1000, value: 30000 },
        { id: "growth", label: "Annual increment", type: "percent", min: 0, max: 15, step: 1, value: 6 },
        { id: "rate", label: "Interest rate (p.a.)", type: "percent", min: 7, max: 9, step: 0.05, value: 8.25 },
        { id: "years", label: "Years of service", type: "years", min: 1, max: 40, step: 1, value: 30 }
      ],
      outputs: [
        { id: "value", label: "EPF corpus", kind: "grow" },
        { id: "yours", label: "Your share grows to", kind: "plain" },
        { id: "employer", label: "Employer's share adds", kind: "gain" },
        { id: "interest", label: "Interest earned", kind: "plain" }
      ],
      compute: function (v) {
        const i = v.rate / 100 / 12; let balE = 0, balR = 0, inv = 0, B = v.basic;
        for (let y = 0; y < v.years; y++) {
          const ce = B * 0.12, cr = B * 0.0367;
          for (let m = 0; m < 12; m++) {
            balE = (balE + ce) * (1 + i);
            balR = (balR + cr) * (1 + i);
            inv += ce + cr;
          }
          B *= (1 + v.growth / 100);
        }
        const bal = balE + balR;
        return {
          value: fmtINR(bal), yours: fmtINR(balE), employer: fmtINR(balR), interest: fmtINR(bal - inv),
          _chart: [{ label: "Your share", amount: balE, tone: "in" }, { label: "Employer's share", amount: balR, tone: "grow" }],
          _insight: "Your 12% grows to <b>" + fmtINR(balE) + "</b>, and your employer's 3.67% adds another <b>" + fmtINR(balR) + "</b> you never paid in, about " + pctOf(balR, bal) + "% of the corpus."
        };
      }
    },
    {
      id: "ssy", name: "Sukanya Samriddhi", accent: "blue", icon: icon(I.ssy),
      tag: "For your daughter's future",
      about: "Sukanya Samriddhi Yojana is a government scheme for a girl child. You deposit for 15 years and the account matures 21 years after opening, with tax-free interest compounded yearly. The long horizon means inflation matters as much as the rate.",
      how: ["Set the amount you would deposit each year.", "Enter the current scheme rate.", "Add expected inflation to see the real maturity value.", "Deposits run for the first 15 years; the account matures at 21."],
      note: "SSY interest is tax-free; rates are set by the government and revised periodically. " + DISC,
      inputs: [
        { id: "yearly", label: "Yearly deposit", type: "money", min: 250, max: 150000, step: 250, value: 150000 },
        { id: "rate", label: "Interest rate (p.a.)", type: "percent", min: 7, max: 9, step: 0.1, value: 8.2 },
        { id: "inflation", label: "Expected inflation", type: "percent", min: 0, max: 12, step: 0.5, value: 6 }
      ],
      outputs: [
        { id: "value", label: "Maturity (21 yrs)", kind: "grow" },
        { id: "real", label: "Worth in today's money", kind: "gain" },
        { id: "invested", label: "Total deposited", kind: "plain" },
        { id: "interest", label: "Interest earned", kind: "plain" }
      ],
      compute: function (v) {
        let bal = 0; for (let y = 1; y <= 21; y++) { if (y <= 15) bal += v.yearly; bal *= (1 + v.rate / 100); }
        const inv = v.yearly * 15;
        const real = realVal(bal, v.inflation, 21);
        return {
          value: fmtINR(bal), real: fmtINR(real), invested: fmtINR(inv), interest: fmtINR(bal - inv),
          _chart: [{ label: "You deposit", amount: inv, tone: "in" }, { label: "Tax-free interest", amount: bal - inv, tone: "grow" }],
          _insight: "Over 21 years, " + fmtINR(inv) + " deposited grows tax-free to <b>" + fmtINR(bal) + "</b>, about " + (Math.round(bal / inv * 10) / 10) + "× your money. After " + fmtPct(v.inflation) + " inflation that maturity buys what <b>" + fmtINR(real) + "</b> does today."
        };
      }
    },
    {
      id: "emi", name: "Loan EMI", accent: "green", icon: icon(I.emi),
      tag: "What the loan really costs",
      about: "An Equated Monthly Instalment is the fixed payment you make on a loan each month. Over a long tenure the interest can rival or exceed the amount you borrowed, so it pays to see the true cost before you sign.",
      how: ["Enter the loan amount.", "Set the interest rate.", "Choose the tenure in years.", "See the EMI and how much extra the interest adds over the loan."],
      inputs: [
        { id: "principal", label: "Loan amount", type: "money", min: 50000, max: 50000000, step: 50000, value: 2500000 },
        { id: "rate", label: "Interest rate (p.a.)", type: "percent", min: 5, max: 20, step: 0.1, value: 9 },
        { id: "tenure", label: "Tenure", type: "years", min: 1, max: 30, step: 1, value: 20 }
      ],
      outputs: [
        { id: "emi", label: "Monthly EMI", kind: "grow" },
        { id: "total", label: "Total payment", kind: "gain" },
        { id: "interest", label: "Total interest", kind: "plain" },
        { id: "interestPct", label: "Interest as % of loan", kind: "plain" }
      ],
      compute: function (v) {
        const i = v.rate / 100 / 12, n = Math.round(v.tenure * 12);
        const emi = i === 0 ? v.principal / n : v.principal * i * Math.pow(1 + i, n) / (Math.pow(1 + i, n) - 1);
        const total = emi * n;
        const interest = total - v.principal;
        const pct = pctOf(interest, v.principal);
        return {
          emi: fmtINR(emi), total: fmtINR(total), interest: fmtINR(interest), interestPct: pct + "%",
          _chart: [{ label: "Loan amount", amount: v.principal, tone: "in" }, { label: "Interest", amount: interest, tone: "warn" }],
          _insight: "Over " + v.tenure + " years you repay <b>" + fmtINR(total) + "</b> on a " + fmtINR(v.principal) + " loan, of which <b>" + fmtINR(interest) + "</b> is interest, an extra " + pct + "% on top of what you borrowed."
        };
      }
    },
    {
      id: "inflation", name: "Inflation", accent: "blue", icon: icon(I.inflation),
      tag: "What money will be worth",
      about: "Inflation quietly raises the cost of living over time. This shows what something that costs a set amount today might cost in future, how much the same money will be worth then, and how fast prices double at the rate you set.",
      how: ["Enter today's cost of the thing you have in mind.", "Set an expected inflation rate.", "Choose how many years ahead.", "See the future cost, eroded value, and how soon prices double."],
      inputs: [
        { id: "amount", label: "Cost today", type: "money", min: 1000, max: 10000000, step: 1000, value: 100000 },
        { id: "rate", label: "Inflation rate", type: "percent", min: 2, max: 12, step: 0.5, value: 6 },
        { id: "years", label: "Years ahead", type: "years", min: 1, max: 40, step: 1, value: 10 }
      ],
      outputs: [
        { id: "future", label: "Future cost", kind: "grow" },
        { id: "worth", label: "Today's money worth then", kind: "gain" },
        { id: "extra", label: "Extra needed", kind: "plain" },
        { id: "doubles", label: "Prices double in", kind: "plain" }
      ],
      compute: function (v) {
        const fut = v.amount * Math.pow(1 + v.rate / 100, v.years);
        const worth = v.amount / Math.pow(1 + v.rate / 100, v.years);
        const dbl = yrsToDouble(v.rate);
        const erosion = pctOf(v.amount - worth, v.amount);
        return {
          future: fmtINR(fut), worth: fmtINR(worth), extra: fmtINR(fut - v.amount), doubles: yrsText(dbl),
          _chart: [{ label: "Cost today", amount: v.amount, tone: "in" }, { label: "Added by inflation", amount: fut - v.amount, tone: "warn" }],
          _insight: "At " + fmtPct(v.rate) + ", prices double every <b>" + yrsText(dbl) + "</b>. In " + v.years + " years your " + fmtINR(v.amount) + " loses " + erosion + "% of its buying power, worth just <b>" + fmtINR(worth) + "</b> in today's terms."
        };
      }
    },
    {
      id: "gratuity", name: "Gratuity", accent: "green", icon: icon(I.gratuity),
      tag: "Your reward for long service",
      about: "Gratuity is a lump sum an employer pays for long service, payable after five years. It is calculated as fifteen days of your last drawn salary for every completed year of service, and is tax-free up to twenty lakh.",
      how: ["Enter your last drawn monthly basic + DA.", "Set your years of service.", "Read the gratuity payable and the part that is tax-free.", "Note: you are eligible only after five years."],
      note: "Formula: (15/26) × last salary × years, capped at ₹20 L. Eligible after 5 years of service.",
      inputs: [
        { id: "salary", label: "Last monthly basic + DA", type: "money", min: 10000, max: 1000000, step: 1000, value: 50000 },
        { id: "years", label: "Years of service", type: "years", min: 5, max: 40, step: 1, value: 10 }
      ],
      outputs: [
        { id: "gratuity", label: "Gratuity payable", kind: "grow" },
        { id: "uncapped", label: "Before the cap", kind: "gain" },
        { id: "perYear", label: "Per year of service", kind: "plain" }
      ],
      compute: function (v) {
        const raw = (15 / 26) * v.salary * v.years;
        const CAP = 2000000;
        const g = Math.min(raw, CAP);
        const capped = raw > CAP;
        return {
          gratuity: fmtINR(g), uncapped: fmtINR(raw), perYear: fmtINR((15 / 26) * v.salary),
          _chart: [
            { label: "You receive (tax-free)", amount: g, tone: "grow" },
            { label: "Trimmed by the cap", amount: Math.max(0, raw - CAP), tone: "warn" }
          ],
          _insight: capped
            ? "The formula gives " + fmtINR(raw) + ", but gratuity is capped at <b>" + fmtINR(CAP) + "</b>, so that is what you receive, all of it tax-free."
            : "You earn 15 days' pay for each of " + v.years + " years, a tax-free <b>" + fmtINR(g) + "</b>, well within the " + fmtINR(CAP) + " cap."
        };
      }
    },
    {
      id: "education", name: "Child's Education", accent: "blue", icon: icon(I.education),
      tag: "Beat education inflation",
      about: "College costs rise faster than almost anything else, often near 10% a year. Work out what a course costing a set amount today will cost when your child enrols, and the monthly investment to be ready in time.",
      how: ["Set your child's age now and the age the course begins.", "Enter the course cost in today's money.", "Set education inflation and an expected return.", "Add anything saved already to lower the monthly figure."],
      note: "Education inflation usually runs higher than general inflation. " + DISC,
      inputs: [
        { id: "childAge", label: "Child's age now", type: "age", min: 0, max: 17, step: 1, value: 3 },
        { id: "startAge", label: "Age course begins", type: "age", min: 15, max: 30, step: 1, value: 18 },
        { id: "costToday", label: "Course cost today", type: "money", min: 100000, max: 50000000, step: 100000, value: 2000000 },
        { id: "eduInflation", label: "Education inflation", type: "percent", min: 5, max: 15, step: 0.5, value: 10 },
        { id: "rate", label: "Expected return", type: "percent", min: 1, max: 20, step: 0.5, value: 12 },
        { id: "current", label: "Saved so far", type: "money", min: 0, max: 20000000, step: 50000, value: 0 }
      ],
      outputs: [
        { id: "futureCost", label: "Cost when they enrol", kind: "grow" },
        { id: "monthly", label: "Monthly SIP needed", kind: "gain" },
        { id: "lump", label: "Or invest today", kind: "plain" },
        { id: "multiple", label: "Costlier than today", kind: "plain" }
      ],
      compute: function (v) {
        const years = Math.max(1, v.startAge - v.childAge);
        const futureCost = v.costToday * Math.pow(1 + v.eduInflation / 100, years);
        const fvCurrent = v.current * Math.pow(1 + v.rate / 100, years);
        const shortfall = Math.max(0, futureCost - fvCurrent);
        const monthly = sipFor(shortfall, v.rate, years);
        const lump = shortfall / Math.pow(1 + v.rate / 100, years);
        const mult = Math.round(futureCost / v.costToday * 10) / 10;
        return {
          futureCost: fmtINR(futureCost), monthly: fmtINR(monthly), lump: fmtINR(lump), multiple: mult + "×",
          _chart: [{ label: "Your savings cover", amount: Math.min(fvCurrent, futureCost), tone: "in" }, { label: "New SIP must fund", amount: shortfall, tone: "grow" }],
          _insight: "At " + fmtPct(v.eduInflation) + " education inflation, a " + fmtINR(v.costToday) + " course will cost <b>" + fmtINR(futureCost) + "</b> in " + years + " years, " + mult + "× today. Starting now needs <b>" + fmtINR(monthly) + "</b> a month."
        };
      }
    },
    {
      id: "wedding", name: "Wedding", accent: "green", icon: icon(I.wedding),
      tag: "Fund the big day, debt-free",
      about: "Plan for a wedding without dipping into other goals or taking on debt. Inflate today's budget to the wedding year, find the monthly investment that funds it, and see what delay would cost you.",
      how: ["Set how many years away the wedding is.", "Enter the budget in today's money.", "Set inflation and an expected return.", "Add anything saved already to lower the monthly figure."],
      inputs: [
        { id: "years", label: "Years to the wedding", type: "years", min: 1, max: 25, step: 1, value: 7 },
        { id: "costToday", label: "Budget today", type: "money", min: 100000, max: 50000000, step: 100000, value: 1500000 },
        { id: "inflation", label: "Inflation", type: "percent", min: 4, max: 12, step: 0.5, value: 7 },
        { id: "rate", label: "Expected return", type: "percent", min: 1, max: 20, step: 0.5, value: 12 },
        { id: "current", label: "Saved so far", type: "money", min: 0, max: 20000000, step: 50000, value: 0 }
      ],
      outputs: [
        { id: "futureCost", label: "Budget on the day", kind: "grow" },
        { id: "monthly", label: "Monthly SIP needed", kind: "gain" },
        { id: "lump", label: "Or invest today", kind: "plain" },
        { id: "delayCost", label: "If you start 2 yrs late", kind: "plain" }
      ],
      compute: function (v) {
        const futureCost = v.costToday * Math.pow(1 + v.inflation / 100, v.years);
        const fvCurrent = v.current * Math.pow(1 + v.rate / 100, v.years);
        const shortfall = Math.max(0, futureCost - fvCurrent);
        const monthly = sipFor(shortfall, v.rate, v.years);
        const lump = shortfall / Math.pow(1 + v.rate / 100, v.years);
        const lateYears = Math.max(1, v.years - 2);
        const lateShort = Math.max(0, futureCost - v.current * Math.pow(1 + v.rate / 100, lateYears));
        const lateMonthly = sipFor(lateShort, v.rate, lateYears);
        return {
          futureCost: fmtINR(futureCost), monthly: fmtINR(monthly), lump: fmtINR(lump), delayCost: fmtINR(lateMonthly),
          _chart: [{ label: "Your savings cover", amount: Math.min(fvCurrent, futureCost), tone: "in" }, { label: "New SIP must fund", amount: shortfall, tone: "grow" }],
          _insight: "A " + fmtINR(v.costToday) + " wedding in " + v.years + " years will cost <b>" + fmtINR(futureCost) + "</b>. Starting now needs <b>" + fmtINR(monthly) + "</b> a month; waiting two years pushes it to " + fmtINR(lateMonthly) + "."
        };
      }
    },
    {
      id: "home", name: "Dream Home", accent: "blue", icon: icon(I.home),
      tag: "Down payment plus the loan",
      about: "A home is usually a down payment you save plus a loan you repay. See what the place will cost when you buy, the monthly SIP to build the down payment, and the EMI on the balance.",
      how: ["Enter the home's price today and when you plan to buy.", "Set how fast property prices rise.", "Choose your down payment share.", "Set the return on savings, the loan rate and tenure."],
      note: "Down payments are typically 10 to 25% of the price. " + DISC,
      inputs: [
        { id: "priceToday", label: "Home price today", type: "money", min: 1000000, max: 200000000, step: 500000, value: 8000000 },
        { id: "years", label: "Years to buy", type: "years", min: 1, max: 20, step: 1, value: 5 },
        { id: "propInflation", label: "Property price rise", type: "percent", min: 2, max: 12, step: 0.5, value: 7 },
        { id: "downPct", label: "Down payment", type: "percent", min: 10, max: 100, step: 5, value: 20 },
        { id: "rate", label: "Return on savings", type: "percent", min: 1, max: 20, step: 0.5, value: 12 },
        { id: "loanRate", label: "Home loan rate", type: "percent", min: 5, max: 12, step: 0.1, value: 9 },
        { id: "loanYears", label: "Loan tenure", type: "years", min: 5, max: 30, step: 1, value: 20 }
      ],
      outputs: [
        { id: "futurePrice", label: "Price when you buy", kind: "grow" },
        { id: "downPayment", label: "Down payment to save", kind: "gain" },
        { id: "sip", label: "Monthly SIP for it", kind: "plain" },
        { id: "emi", label: "EMI on the rest", kind: "plain" }
      ],
      compute: function (v) {
        const futurePrice = v.priceToday * Math.pow(1 + v.propInflation / 100, v.years);
        const downPayment = futurePrice * v.downPct / 100;
        const loanAmt = futurePrice - downPayment;
        const sip = sipFor(downPayment, v.rate, v.years);
        const emi = emiOf(loanAmt, v.loanRate, v.loanYears);
        return {
          futurePrice: fmtINR(futurePrice), downPayment: fmtINR(downPayment), sip: fmtINR(sip), emi: fmtINR(emi),
          _chart: [{ label: "Down payment (you save)", amount: downPayment, tone: "in" }, { label: "Home loan", amount: loanAmt, tone: "alt" }],
          _insight: "At " + fmtPct(v.propInflation) + " a year the home will cost <b>" + fmtINR(futurePrice) + "</b>. Save <b>" + fmtINR(sip) + "</b> a month for the " + fmtINR(downPayment) + " down payment, then repay the rest at <b>" + fmtINR(emi) + "</b> a month."
        };
      }
    },
    {
      id: "purchase", name: "Dream Purchase", accent: "green", icon: icon(I.purchase),
      tag: "Save up, or buy on a loan?",
      about: "A car, a bike, a big trip or a gadget. Should you buy it now on a loan, or save up and buy with cash? This compares the true cost of each so you can choose with your eyes open.",
      how: ["Enter what it costs today.", "Set how long you would save before buying.", "Set how fast the price rises and the return while saving.", "Set the loan rate to compare buying it right now."],
      inputs: [
        { id: "costToday", label: "Cost today", type: "money", min: 50000, max: 20000000, step: 50000, value: 1200000 },
        { id: "years", label: "Years if you save", type: "years", min: 1, max: 10, step: 1, value: 3 },
        { id: "inflation", label: "Price rise", type: "percent", min: 2, max: 12, step: 0.5, value: 6 },
        { id: "rate", label: "Return while saving", type: "percent", min: 1, max: 15, step: 0.5, value: 9 },
        { id: "loanRate", label: "Loan rate to buy now", type: "percent", min: 6, max: 20, step: 0.5, value: 11 }
      ],
      outputs: [
        { id: "futureCost", label: "Cost if you wait", kind: "grow" },
        { id: "sip", label: "Save this monthly", kind: "gain" },
        { id: "loanEmi", label: "Or EMI to buy now", kind: "plain" },
        { id: "gap", label: "Cheaper route saves", kind: "plain" }
      ],
      compute: function (v) {
        const futureCost = v.costToday * Math.pow(1 + v.inflation / 100, v.years);
        const sip = sipFor(futureCost, v.rate, v.years);
        const n = Math.round(v.years * 12);
        const loanEmi = emiOf(v.costToday, v.loanRate, v.years);
        const loanTotal = loanEmi * n;
        const saveTotal = sip * n;
        const diff = loanTotal - saveTotal;
        return {
          futureCost: fmtINR(futureCost), sip: fmtINR(sip), loanEmi: fmtINR(loanEmi), gap: fmtINR(Math.abs(diff)),
          _chart: [{ label: "Item price (loan)", amount: v.costToday, tone: "in" }, { label: "Loan interest", amount: Math.max(0, loanTotal - v.costToday), tone: "warn" }],
          _insight: "Buy now at " + fmtPct(v.loanRate) + " and the loan costs <b>" + fmtINR(loanTotal) + "</b> over " + v.years + " years. Saving " + fmtINR(sip) + " a month costs " + fmtINR(saveTotal) + ", so " +
            (diff >= 0 ? "<b>saving wins by " + fmtINR(diff) + "</b>." : "<b>buying now wins by " + fmtINR(-diff) + "</b>, locking today's price against inflation.")
        };
      }
    },
    {
      id: "emergency", name: "Emergency Fund", accent: "green", icon: icon(I.emergency),
      tag: "A safety net of months",
      about: "An emergency fund is cash you can reach instantly for a job loss, a medical bill or an urgent repair. The usual rule is three to six months of expenses, kept safe and liquid, not invested for growth.",
      how: ["Enter your monthly expenses.", "Choose how many months of cover you want.", "Add what you have set aside already.", "Set how much you can save each month to close the gap."],
      note: "Keep this money liquid (a savings account or sweep FD), not in market-linked funds. " + DISC,
      inputs: [
        { id: "monthlyExpense", label: "Monthly expenses", type: "money", min: 5000, max: 1000000, step: 1000, value: 50000 },
        { id: "months", label: "Months of cover", type: "months", min: 3, max: 12, step: 1, value: 6 },
        { id: "current", label: "Set aside already", type: "money", min: 0, max: 10000000, step: 10000, value: 100000 },
        { id: "monthlySaving", label: "You can save monthly", type: "money", min: 1000, max: 500000, step: 1000, value: 20000 }
      ],
      outputs: [
        { id: "target", label: "Fund you need", kind: "grow" },
        { id: "gap", label: "Still to save", kind: "gain" },
        { id: "timeToBuild", label: "Time to get there", kind: "plain" },
        { id: "coverNow", label: "Covered for now", kind: "plain" }
      ],
      compute: function (v) {
        const target = v.monthlyExpense * v.months;
        const gap = Math.max(0, target - v.current);
        const coverNow = v.monthlyExpense > 0 ? v.current / v.monthlyExpense : 0;
        const monthsNeeded = gap <= 0 ? 0 : Math.ceil(gap / v.monthlySaving);
        const timeTxt = gap <= 0 ? "Already there" : fmtDuration(monthsNeeded);
        return {
          target: fmtINR(target), gap: fmtINR(gap), timeToBuild: timeTxt, coverNow: (Math.round(coverNow * 10) / 10) + " mo",
          _chart: [{ label: "Set aside already", amount: Math.min(v.current, target), tone: "in" }, { label: "Still to save", amount: gap, tone: "grow" }],
          _insight: gap <= 0
            ? "You already hold <b>" + fmtINR(v.current) + "</b>, about " + (Math.round(coverNow * 10) / 10) + " months of expenses. Your " + v.months + "-month net is fully funded."
            : "You need <b>" + fmtINR(target) + "</b> for " + v.months + " months of cover. Saving " + fmtINR(v.monthlySaving) + " a month closes the " + fmtINR(gap) + " gap in <b>" + timeTxt + "</b>."
        };
      }
    },
    {
      id: "crore", name: "First Crore", accent: "blue", icon: icon(I.crore),
      tag: "How long to your milestone",
      about: "Reaching your first crore, or any target corpus, is a milestone worth planning. See how long a steady monthly SIP takes to get there, and how much of the result is your money versus pure growth.",
      how: ["Set the target corpus you are aiming for.", "Enter how much you can invest each month.", "Choose an expected annual return.", "Read how long it takes and what drives it."],
      inputs: [
        { id: "target", label: "Target corpus", type: "money", min: 1000000, max: 1000000000, step: 1000000, value: 10000000 },
        { id: "monthly", label: "Monthly investment", type: "money", min: 1000, max: 1000000, step: 1000, value: 25000 },
        { id: "rate", label: "Expected return", type: "percent", min: 1, max: 20, step: 0.5, value: 12 }
      ],
      outputs: [
        { id: "time", label: "Time to reach it", kind: "grow" },
        { id: "invested", label: "You will invest", kind: "plain" },
        { id: "gain", label: "From growth", kind: "gain" },
        { id: "monthlyFor10", label: "To reach it in 10 yrs", kind: "plain" }
      ],
      compute: function (v) {
        const n = monthsToTarget(v.monthly, v.rate, v.target);
        const reached = isFinite(n) && n <= 1200;
        const months = reached ? Math.ceil(n) : 0;
        const invested = reached ? v.monthly * months : 0;
        const gain = Math.max(0, v.target - invested);
        const monthlyFor10 = sipFor(v.target, v.rate, 10);
        return {
          time: reached ? fmtDuration(months) : "100+ years",
          invested: fmtINR(invested), gain: fmtINR(gain), monthlyFor10: fmtINR(monthlyFor10),
          _chart: reached ? [{ label: "You invest", amount: invested, tone: "in" }, { label: "Growth", amount: gain, tone: "grow" }] : null,
          _insight: reached
            ? "Investing " + fmtINR(v.monthly) + " a month at " + fmtPct(v.rate) + ", you cross <b>" + fmtINR(v.target) + "</b> in <b>" + fmtDuration(months) + "</b>. Of that, " + fmtINR(gain) + " is pure growth."
            : "At " + fmtINR(v.monthly) + " a month this target is very far off. To reach it in 10 years you would need about <b>" + fmtINR(monthlyFor10) + "</b> a month."
        };
      }
    }
  ];

  const GROUPS = [
    { title: "Invest & grow", ids: ["sip", "stepup", "lumpsum", "goal", "cagr"] },
    { title: "Plan a goal", ids: ["education", "wedding", "home", "purchase", "emergency", "crore"] },
    { title: "Retire & withdraw", ids: ["retirement", "nps", "swp"] },
    { title: "Save & deposit", ids: ["fd", "rd", "ppf", "epf", "ssy"] },
    { title: "Borrow & protect", ids: ["emi", "inflation", "gratuity"] }
  ];

  const byId = {};
  CALCS.forEach(function (c) { byId[c.id] = c; });

  /* Duration projections for the accumulation tools. Kept here so each row's
     maths sits in one place; attached to the calculators by id below. */
  const PROJECTORS = {
    sip: {
      field: "years", durLabel: "Years", cols: ["You invest", "It could become"],
      row: function (v, n) {
        return [fmtINR(v.monthly * Math.round(n * 12)), fmtINR(sipFV(v.monthly, v.rate, n))];
      }
    },
    stepup: {
      field: "years", durLabel: "Years", cols: ["You invest", "It could become"],
      row: function (v, n) {
        const i = v.rate / 100 / 12; let val = 0, inv = 0;
        for (let y = 0; y < n; y++) {
          const P = v.monthly * Math.pow(1 + v.stepup / 100, y);
          for (let m = 0; m < 12; m++) { val = (val + P) * (1 + i); inv += P; }
        }
        return [fmtINR(inv), fmtINR(val)];
      }
    },
    lumpsum: {
      field: "years", durLabel: "Years", cols: ["It could become", "Growth"],
      row: function (v, n) {
        const fv = v.amount * Math.pow(1 + v.rate / 100, n);
        return [fmtINR(fv), (Math.round(fv / v.amount * 10) / 10) + "×"];
      }
    },
    fd: {
      field: "years", durLabel: "Term", cols: ["Maturity", "After tax"],
      row: function (v, n) {
        const fv = v.principal * Math.pow(1 + v.rate / 100 / 4, 4 * n);
        const tax = (fv - v.principal) * v.taxSlab / 100;
        return [fmtINR(fv), fmtINR(fv - tax)];
      }
    },
    rd: {
      field: "years", durLabel: "Term", cols: ["You deposit", "Maturity"],
      row: function (v, n) {
        const i = v.rate / 100 / 12, N = Math.round(n * 12); let val = 0;
        for (let m = 0; m < N; m++) val = (val + v.monthly) * (1 + i);
        return [fmtINR(v.monthly * N), fmtINR(val)];
      }
    },
    ppf: {
      field: "years", durLabel: "Years", cols: ["You invest", "Maturity"],
      row: function (v, n) {
        let bal = 0; for (let y = 0; y < n; y++) bal = (bal + v.yearly) * (1 + v.rate / 100);
        return [fmtINR(v.yearly * n), fmtINR(bal)];
      }
    },
    epf: {
      field: "years", durLabel: "Service", cols: ["You invest", "Corpus"],
      row: function (v, n) {
        const i = v.rate / 100 / 12; let balE = 0, balR = 0, inv = 0, B = v.basic;
        for (let y = 0; y < n; y++) {
          const ce = B * 0.12, cr = B * 0.0367;
          for (let m = 0; m < 12; m++) { balE = (balE + ce) * (1 + i); balR = (balR + cr) * (1 + i); inv += ce + cr; }
          B *= (1 + v.growth / 100);
        }
        return [fmtINR(inv), fmtINR(balE + balR)];
      }
    },
    goal: {
      field: "years", durLabel: "Years to goal", cols: ["Monthly SIP", "Or lump today"],
      title: "Reaching it in fewer or more years",
      sub: "The same goal, given more or less time to fund it. Your current choice is highlighted.",
      row: function (v, n) {
        const fc = v.target * Math.pow(1 + v.inflation / 100, n);
        return [fmtINR(sipFor(fc, v.rate, n)), fmtINR(fc / Math.pow(1 + v.rate / 100, n))];
      }
    },
    cagr: {
      field: "years", durLabel: "Period", cols: ["CAGR", "Real CAGR"],
      title: "The same growth over different periods",
      sub: "If the same gain happened over fewer or more years, the yearly rate changes. Your current choice is highlighted.",
      row: function (v, n) {
        const ratio = v.final / v.initial;
        const cagr = Math.pow(ratio, 1 / n) - 1;
        const real = (1 + cagr) / (1 + v.inflation / 100) - 1;
        return [fmtPct(cagr * 100), fmtPct(real * 100)];
      }
    },
    retirement: {
      field: "retYears", durLabel: "Years in retirement", cols: ["Corpus needed", "Monthly SIP"],
      title: "How long the money must last",
      sub: "A longer retirement needs a bigger corpus, and a bigger SIP. Your current choice is highlighted.",
      row: function (v, n) {
        const yToRet = Math.max(1, v.retAge - v.curAge);
        const futMonthly = v.monthlyExpense * Math.pow(1 + v.inflation / 100, yToRet);
        const annual = futMonthly * 12;
        const realRate = ((1 + v.postReturn / 100) / (1 + v.inflation / 100)) - 1;
        let corpus;
        if (Math.abs(realRate) < 1e-6) corpus = annual * n;
        else corpus = annual * (1 - Math.pow(1 + realRate, -n)) / realRate * (1 + realRate);
        const fvCurrent = v.current * Math.pow(1 + v.preReturn / 100, yToRet);
        const sip = sipFor(Math.max(0, corpus - fvCurrent), v.preReturn, yToRet);
        return [fmtINR(corpus), fmtINR(sip)];
      }
    },
    nps: {
      field: "curAge", durLabel: "Start age", cols: ["Corpus at 60", "Monthly pension"],
      title: "The earlier you start",
      sub: "Starting younger leaves more years to compound to 60. Your current age is highlighted.",
      row: function (v, n) {
        const yToRet = Math.max(1, 60 - n);
        const corpus = sipFV(v.monthly, v.rate, yToRet);
        const pension = corpus * v.annuityPct / 100 * v.annuityRate / 100 / 12;
        return [fmtINR(corpus), fmtINR(pension)];
      }
    },
    swp: {
      field: "years", durLabel: "Period", cols: ["Total withdrawn", "Balance left"],
      title: "Drawing for fewer or more years",
      sub: "The same corpus and withdrawal, held over different periods. Your current choice is highlighted.",
      row: function (v, n) {
        const i = v.rate / 100 / 12, g = v.inflation / 100;
        let b = v.corpus, withdrawn = 0, w = v.withdraw; const N = Math.round(n * 12);
        for (let m = 1; m <= N; m++) {
          if (b <= 0) break;
          if (m > 1 && (m - 1) % 12 === 0) w *= (1 + g);
          const grown = b * (1 + i), draw = Math.min(w, grown);
          b = grown - draw; withdrawn += draw;
        }
        return [fmtINR(Math.max(0, withdrawn)), fmtINR(Math.max(0, b))];
      }
    },
    ssy: {
      range: { min: 1, max: 21, step: 1 }, unit: "years", durLabel: "Year", cols: ["You deposit", "Balance"],
      title: "How the balance builds to maturity",
      sub: "Deposits run for 15 years; the account matures at 21, which is highlighted.",
      currentN: function () { return 21; },
      row: function (v, n) {
        let bal = 0; for (let y = 1; y <= n; y++) { if (y <= 15) bal += v.yearly; bal *= (1 + v.rate / 100); }
        return [fmtINR(v.yearly * Math.min(n, 15)), fmtINR(bal)];
      }
    },
    emi: {
      field: "tenure", durLabel: "Tenure", cols: ["Monthly EMI", "Total interest"],
      title: "How the tenure changes the cost",
      sub: "The same loan over a shorter or longer tenure. Your current choice is highlighted.",
      row: function (v, n) {
        const e = emiOf(v.principal, v.rate, n);
        return [fmtINR(e), fmtINR(e * Math.round(n * 12) - v.principal)];
      }
    },
    inflation: {
      field: "years", durLabel: "Years ahead", cols: ["Future cost", "Worth then"],
      title: "How prices climb over time",
      sub: "Today's cost projected fewer or more years ahead. Your current choice is highlighted.",
      row: function (v, n) {
        return [fmtINR(v.amount * Math.pow(1 + v.rate / 100, n)), fmtINR(v.amount / Math.pow(1 + v.rate / 100, n))];
      }
    },
    gratuity: {
      field: "years", durLabel: "Service", cols: ["Gratuity", "Per year"],
      title: "How it builds with service",
      sub: "15 days' pay for each completed year, capped at ₹20 L. Your current service is highlighted.",
      row: function (v, n) {
        const raw = (15 / 26) * v.salary * n;
        return [fmtINR(Math.min(raw, 2000000)), fmtINR((15 / 26) * v.salary)];
      }
    },
    education: {
      field: "startAge", durLabel: "Starts at age", cols: ["Cost then", "Monthly SIP"],
      title: "The longer you have to save",
      sub: "If the course begins earlier or later, the saving window changes. Your current choice is highlighted.",
      row: function (v, n) {
        const years = Math.max(1, n - v.childAge);
        const fc = v.costToday * Math.pow(1 + v.eduInflation / 100, years);
        const fvCurrent = v.current * Math.pow(1 + v.rate / 100, years);
        return [fmtINR(fc), fmtINR(sipFor(Math.max(0, fc - fvCurrent), v.rate, years))];
      }
    },
    wedding: {
      field: "years", durLabel: "Years to go", cols: ["Budget then", "Monthly SIP"],
      title: "Sooner or later",
      sub: "The same budget for a wedding nearer or further away. Your current choice is highlighted.",
      row: function (v, n) {
        const fc = v.costToday * Math.pow(1 + v.inflation / 100, n);
        const fvCurrent = v.current * Math.pow(1 + v.rate / 100, n);
        return [fmtINR(fc), fmtINR(sipFor(Math.max(0, fc - fvCurrent), v.rate, n))];
      }
    },
    home: {
      field: "years", durLabel: "Years to buy", cols: ["Price then", "SIP for down pmt"],
      title: "Buying sooner or later",
      sub: "The same home bought nearer or further away. Your current choice is highlighted.",
      row: function (v, n) {
        const fp = v.priceToday * Math.pow(1 + v.propInflation / 100, n);
        return [fmtINR(fp), fmtINR(sipFor(fp * v.downPct / 100, v.rate, n))];
      }
    },
    purchase: {
      field: "years", durLabel: "Years to save", cols: ["Cost if you wait", "Save monthly"],
      title: "Waiting a little longer",
      sub: "The same item saved up for over fewer or more years. Your current choice is highlighted.",
      row: function (v, n) {
        const fc = v.costToday * Math.pow(1 + v.inflation / 100, n);
        return [fmtINR(fc), fmtINR(sipFor(fc, v.rate, n))];
      }
    },
    emergency: {
      field: "months", durLabel: "Cover", cols: ["Fund needed", "Time to build"],
      title: "More cover, more to save",
      sub: "A bigger safety net takes longer to build. Your current choice is highlighted.",
      row: function (v, n) {
        const target = v.monthlyExpense * n;
        const gap = Math.max(0, target - v.current);
        return [fmtINR(target), gap <= 0 ? "Funded" : fmtDuration(Math.ceil(gap / v.monthlySaving))];
      }
    },
    crore: {
      range: { min: 1, max: 40, step: 1 }, unit: "years", durLabel: "Years", cols: ["You invest", "Corpus"],
      title: "How your money grows year by year",
      sub: "A steady monthly SIP, held for fewer or more years. The year you cross the target is highlighted.",
      currentN: function (v) {
        const n = monthsToTarget(v.monthly, v.rate, v.target);
        return isFinite(n) ? Math.ceil(n / 12) : null;
      },
      row: function (v, n) {
        return [fmtINR(v.monthly * Math.round(n * 12)), fmtINR(sipFV(v.monthly, v.rate, n))];
      }
    }
  };
  Object.keys(PROJECTORS).forEach(function (id) { if (byId[id]) byId[id].project = PROJECTORS[id]; });

  /* ---------------- workspace toolbar: greeting, date, search ---------------- */
  const screen = deck.parentNode;
  const toolbar = document.createElement("div");
  toolbar.className = "ws-toolbar";
  const now = new Date();
  const hr = now.getHours();
  const hello = hr < 12 ? "Good morning" : hr < 17 ? "Good afternoon" : "Good evening";
  const dateStr = now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
  toolbar.innerHTML =
    '<div class="ws-greet">' +
      '<p class="ws-hello">' + hello + ".</p>" +
      '<p class="ws-sub">' + CALCS.length + " planning tools &middot; " + dateStr + "</p>" +
    "</div>" +
    '<div class="ws-search">' +
      '<svg class="ws-search-ico" viewBox="0 0 24 24" aria-hidden="true">' +
        '<circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/>' +
        '<line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      "</svg>" +
      '<input type="search" id="appSearch" placeholder="Search calculators" autocomplete="off" spellcheck="false" aria-label="Search calculators" />' +
    "</div>";
  screen.insertBefore(toolbar, deck);

  /* ---------------- build the app deck ---------------- */
  let tileIndex = 0;
  GROUPS.forEach(function (g) {
    const count = g.ids.filter(function (id) { return byId[id]; }).length;
    const section = document.createElement("div");
    section.className = "app-group";
    const heading = document.createElement("h2");
    heading.className = "app-group-title";
    heading.innerHTML = '<span class="agt-label">' + g.title + "</span>" +
      '<span class="agt-count">' + count + "</span>";
    section.appendChild(heading);
    const grid = document.createElement("div");
    grid.className = "app-grid";
    g.ids.forEach(function (id) {
      const c = byId[id];
      if (!c) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "app accent-" + (c.accent || "blue");
      btn.setAttribute("aria-label", "Open the " + c.name + " calculator");
      btn.setAttribute("data-name", c.name.toLowerCase());
      btn.setAttribute("data-tag", (c.tag || "").toLowerCase());
      btn.style.setProperty("--app-i", tileIndex++);
      btn.innerHTML =
        '<span class="app-icon">' + c.icon + "</span>" +
        '<span class="app-name">' + c.name + "</span>" +
        (c.tag ? '<span class="app-tag">' + c.tag + "</span>" : "");
      btn.addEventListener("click", function () { openCalc(id); });
      grid.appendChild(btn);
    });
    section.appendChild(grid);
    deck.appendChild(section);
  });

  /* no-results notice */
  const noHits = document.createElement("p");
  noHits.className = "app-empty";
  noHits.hidden = true;
  noHits.textContent = "No calculators match that search.";
  deck.appendChild(noHits);

  /* ---------------- live search filter ---------------- */
  const search = document.getElementById("appSearch");
  if (search) {
    search.addEventListener("input", function () {
      const q = search.value.trim().toLowerCase();
      let total = 0;
      deck.querySelectorAll(".app-group").forEach(function (sec) {
        let shown = 0;
        sec.querySelectorAll(".app").forEach(function (app) {
          const hit = !q ||
            app.getAttribute("data-name").indexOf(q) > -1 ||
            app.getAttribute("data-tag").indexOf(q) > -1;
          app.hidden = !hit;
          if (hit) shown++;
        });
        sec.hidden = shown === 0;
        total += shown;
      });
      noHits.hidden = total > 0;
    });
  }

  /* ---------------- window (modal) ---------------- */
  const modal = document.getElementById("calcModal");
  const win = document.getElementById("calcWindow");
  let lastFocus = null;

  function renderWindow(c) {
    const inputs = c.inputs.map(function (f) {
      const pre = unitPre(f) ? '<span class="cf-pre">' + unitPre(f) + "</span>" : "";
      const suf = unitSuf(f) ? '<span class="cf-suf">' + unitSuf(f) + "</span>" : "";
      const mode = f.type === "percent" ? "decimal" : "numeric";
      return '<div class="ctrl">' +
        '<div class="ctrl-top">' +
          '<label for="cw_' + f.id + '">' + f.label + "</label>" +
          '<span class="ctrl-field" data-type="' + f.type + '">' + pre +
            '<input class="ctrl-val" id="val_' + f.id + '" type="text" inputmode="' + mode + '" autocomplete="off" spellcheck="false" aria-label="' + f.label + '" />' +
          suf + "</span>" +
        "</div>" +
        '<input id="cw_' + f.id + '" class="ctrl-range" type="range" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + f.value + '" aria-label="' + f.label + '" />' +
        '<div class="ctrl-scale"><span>' + fmtScale(f, f.min) + "</span><span>" + fmtScale(f, f.max) + "</span></div>" +
        "</div>";
    }).join("");
    const outs = c.outputs.map(function (o) {
      const cls = o.kind === "grow" ? " is-grow" : o.kind === "gain" ? " is-gain" : "";
      return '<div class="co' + cls + '"><span class="co-lbl">' + o.label + '</span><span class="co-val" id="res_' + o.id + '">&ndash;</span></div>';
    }).join("");
    const how = c.how.map(function (s) { return "<li>" + s + "</li>"; }).join("");
    return '' +
      '<div class="cw-bar">' +
        '<span class="cw-ico">' + c.icon + '</span>' +
        '<h3 class="cw-title" id="cwTitle">' + c.name + " calculator</h3>" +
        '<button class="cw-close" type="button" aria-label="Close calculator" data-close>&times;</button>' +
      '</div>' +
      '<div class="cw-body">' +
        '<div class="cw-pane cw-tool">' +
          '<div class="calc-controls cw-controls">' + inputs + '</div>' +
          '<div class="cw-outputs">' + outs + '</div>' +
          '<p class="cw-insight" id="cwInsight" hidden></p>' +
          '<div class="cw-proj" id="cwProj" hidden></div>' +
          '<p class="calc-note">' + (c.note || DISC) + '</p>' +
        '</div>' +
        '<div class="cw-pane cw-info">' +
          "<h4>What it is</h4><p>" + c.about + "</p>" +
          '<h4>How to use it</h4><ol class="cw-how">' + how + "</ol>" +
          '<div class="cw-viz" id="cwChart" hidden>' +
            "<h4>Where the money comes from</h4>" +
            '<div class="cw-chart" id="cwChartBody"></div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function bindInputs(c) {
    const fields = c.inputs.map(function (f) {
      return {
        f: f,
        range: win.querySelector("#cw_" + f.id),
        val: win.querySelector("#val_" + f.id),
        last: parseFloat(f.value)
      };
    });
    function clampF(x) { return Math.min(x.f.max, Math.max(x.f.min, x.last)); }
    function trackFill(x) {
      const pct = ((clampF(x) - x.f.min) / (x.f.max - x.f.min)) * 100;
      x.range.style.setProperty("--p", Math.max(0, Math.min(100, pct)) + "%");
    }
    function sizeField(x, text) { x.val.style.width = Math.max(2, (text || "").length) + "ch"; }
    function writeField(x, v) { const t = fieldFmt(x.f, v); x.val.value = t; sizeField(x, t); }
    function recompute() {
      const vals = {};
      fields.forEach(function (x) { vals[x.f.id] = clampF(x); });
      const res = c.compute(vals);
      c.outputs.forEach(function (o) {
        const el = win.querySelector("#res_" + o.id);
        if (el) el.textContent = res[o.id] !== undefined ? res[o.id] : "–";
      });
      const chart = win.querySelector("#cwChart");
      const chartBody = win.querySelector("#cwChartBody");
      if (chart && chartBody) {
        if (res._chart && res._chart.length) { chartBody.innerHTML = buildChart(res._chart); chart.hidden = false; }
        else { chart.hidden = true; chartBody.innerHTML = ""; }
      }
      const ins = win.querySelector("#cwInsight");
      if (ins) {
        if (res._insight) { ins.innerHTML = res._insight; ins.hidden = false; }
        else { ins.hidden = true; }
      }
      const proj = win.querySelector("#cwProj");
      if (proj) {
        if (c.project) { proj.innerHTML = buildProjection(c, vals); proj.hidden = false; }
        else { proj.hidden = true; proj.innerHTML = ""; }
      }
    }
    fields.forEach(function (x) {
      // dragging the slider
      x.range.addEventListener("input", function () {
        x.last = parseFloat(x.range.value);
        writeField(x, x.last);
        trackFill(x);
        recompute();
      });
      // typing a number directly
      x.val.addEventListener("input", function () {
        sizeField(x, x.val.value);
        const num = parseFloat(x.val.value.replace(/[^0-9.\-]/g, ""));
        if (isNaN(num)) return; // wait for a valid number before reacting
        x.last = num;
        x.range.value = num; // the slider thumb clamps itself natively
        trackFill(x);
        recompute();
      });
      function commit() {
        let num = parseFloat(x.val.value.replace(/[^0-9.\-]/g, ""));
        if (isNaN(num)) num = x.last;
        num = Math.min(x.f.max, Math.max(x.f.min, num));
        x.last = num;
        x.range.value = num;
        trackFill(x);
        writeField(x, num);
        recompute();
      }
      x.val.addEventListener("blur", commit);
      x.val.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); x.val.blur(); }
      });
      // initialise
      x.range.value = x.f.value;
      x.last = parseFloat(x.f.value);
      writeField(x, x.last);
      trackFill(x);
    });
    recompute();
  }

  function openCalc(id) {
    const c = byId[id];
    if (!c) return;
    lastFocus = document.activeElement;
    win.className = "calc-window accent-" + (c.accent || "blue");
    win.innerHTML = renderWindow(c);
    modal.hidden = false;
    document.body.classList.add("modal-open");
    bindInputs(c);
    const closeBtn = win.querySelector(".cw-close");
    if (closeBtn) closeBtn.focus();
  }

  function closeCalc() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    win.innerHTML = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  modal.addEventListener("click", function (e) {
    if (e.target.hasAttribute && e.target.hasAttribute("data-close")) closeCalc();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeCalc();
  });

  /* ---------------- workspace clock ---------------- */
  const clock = document.getElementById("wsClock");
  if (clock) {
    const tick = function () {
      clock.textContent = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    };
    tick();
    setInterval(tick, 15000);
  }
})();
