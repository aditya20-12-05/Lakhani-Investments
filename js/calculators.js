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
    return fmtINR(v);
  }
  function fmtScale(f, v) {
    if (f.type === "percent") return fmtPct(v);
    if (f.type === "years") return v + (v === 1 ? "yr" : "yrs");
    if (f.type === "age") return v;
    return fmtINR(v);
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
    ssy: '<path d="M2 9l10-4 10 4-10 4z"/><path d="M6 11v4c0 1.5 2.7 3 6 3s6-1.5 6-3v-4"/><path d="M22 9v5"/>'
  };
  function icon(p) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + p + "</svg>";
  }

  const DISC = "Illustrative only. Actual returns vary and are not guaranteed.";

  /* ---------------- registry ---------------- */
  const CALCS = [
    {
      id: "sip", name: "SIP", accent: "blue", icon: icon(I.sip),
      about: "A Systematic Investment Plan invests a fixed amount in mutual funds every month. Because returns start earning returns of their own, small monthly steps can compound into a sizeable corpus over time.",
      how: ["Set how much you can invest each month.", "Choose an expected annual return.", "Pick how long you will stay invested.", "Read the projected value and the wealth your money could gain."],
      inputs: [
        { id: "monthly", label: "Monthly investment", type: "money", min: 500, max: 200000, step: 500, value: 10000 },
        { id: "rate", label: "Expected return (p.a.)", type: "percent", min: 1, max: 20, step: 0.5, value: 12 },
        { id: "years", label: "Time horizon", type: "years", min: 1, max: 40, step: 1, value: 15 }
      ],
      outputs: [
        { id: "invested", label: "You invest", kind: "plain" },
        { id: "value", label: "It could become", kind: "grow" },
        { id: "gain", label: "Wealth gained", kind: "gain" }
      ],
      compute: function (v) {
        const fv = sipFV(v.monthly, v.rate, v.years);
        const inv = v.monthly * Math.round(v.years * 12);
        return { invested: fmtINR(inv), value: fmtINR(fv), gain: fmtINR(fv - inv) };
      }
    },
    {
      id: "stepup", name: "Step-up SIP", accent: "green", icon: icon(I.stepup),
      about: "A step-up SIP raises your monthly contribution by a set percentage every year, usually in step with your income. The rising amount, compounded over time, can grow your corpus far beyond a flat SIP.",
      how: ["Set your starting monthly amount.", "Choose how much to step it up each year.", "Set an expected return and time horizon.", "Compare the corpus with a flat SIP of the same start."],
      inputs: [
        { id: "monthly", label: "Starting monthly amount", type: "money", min: 500, max: 200000, step: 500, value: 10000 },
        { id: "stepup", label: "Annual step-up", type: "percent", min: 0, max: 25, step: 1, value: 10 },
        { id: "rate", label: "Expected return (p.a.)", type: "percent", min: 1, max: 20, step: 0.5, value: 12 },
        { id: "years", label: "Time horizon", type: "years", min: 1, max: 40, step: 1, value: 15 }
      ],
      outputs: [
        { id: "invested", label: "You invest", kind: "plain" },
        { id: "value", label: "It could become", kind: "grow" },
        { id: "gain", label: "Wealth gained", kind: "gain" }
      ],
      compute: function (v) {
        const i = v.rate / 100 / 12; let val = 0, inv = 0;
        for (let y = 0; y < v.years; y++) {
          const P = v.monthly * Math.pow(1 + v.stepup / 100, y);
          for (let m = 0; m < 12; m++) { val = (val + P) * (1 + i); inv += P; }
        }
        return { invested: fmtINR(inv), value: fmtINR(val), gain: fmtINR(val - inv) };
      }
    },
    {
      id: "lumpsum", name: "Lumpsum", accent: "blue", icon: icon(I.lumpsum),
      about: "A lumpsum invests a single amount once and lets it grow. It shows the power of staying invested: even without adding more, compounding can multiply a one-time investment over the years.",
      how: ["Enter the amount you would invest today.", "Choose an expected annual return.", "Pick how long it stays invested.", "Read the projected maturity value."],
      inputs: [
        { id: "amount", label: "One-time investment", type: "money", min: 5000, max: 20000000, step: 5000, value: 500000 },
        { id: "rate", label: "Expected return (p.a.)", type: "percent", min: 1, max: 20, step: 0.5, value: 12 },
        { id: "years", label: "Time horizon", type: "years", min: 1, max: 40, step: 1, value: 15 }
      ],
      outputs: [
        { id: "invested", label: "You invest", kind: "plain" },
        { id: "value", label: "It could become", kind: "grow" },
        { id: "gain", label: "Wealth gained", kind: "gain" }
      ],
      compute: function (v) {
        const fv = v.amount * Math.pow(1 + v.rate / 100, v.years);
        return { invested: fmtINR(v.amount), value: fmtINR(fv), gain: fmtINR(fv - v.amount) };
      }
    },
    {
      id: "goal", name: "Goal SIP", accent: "green", icon: icon(I.goal),
      about: "Work backwards from a goal. Tell it the amount you want and when you want it, and it shows the monthly SIP needed to get there at your expected return.",
      how: ["Set your target amount.", "Choose an expected annual return.", "Set the number of years to the goal.", "Read the monthly SIP you would need to start."],
      inputs: [
        { id: "target", label: "Target amount", type: "money", min: 100000, max: 100000000, step: 100000, value: 5000000 },
        { id: "rate", label: "Expected return (p.a.)", type: "percent", min: 1, max: 20, step: 0.5, value: 12 },
        { id: "years", label: "Years to goal", type: "years", min: 1, max: 40, step: 1, value: 10 }
      ],
      outputs: [
        { id: "monthly", label: "Monthly SIP needed", kind: "grow" },
        { id: "invested", label: "You invest in total", kind: "plain" },
        { id: "gain", label: "Wealth gained", kind: "gain" }
      ],
      compute: function (v) {
        const P = sipFor(v.target, v.rate, v.years);
        const inv = P * Math.round(v.years * 12);
        return { monthly: fmtINR(P), invested: fmtINR(inv), gain: fmtINR(v.target - inv) };
      }
    },
    {
      id: "cagr", name: "CAGR", accent: "blue", icon: icon(I.cagr),
      about: "The Compound Annual Growth Rate is the smoothed yearly rate at which an investment grew from its start value to its end value. It lets you compare very different investments on equal terms.",
      how: ["Enter the initial value of the investment.", "Enter its final value.", "Set the holding period in years.", "Read the annualised growth rate."],
      inputs: [
        { id: "initial", label: "Initial value", type: "money", min: 1000, max: 10000000, step: 1000, value: 100000 },
        { id: "final", label: "Final value", type: "money", min: 1000, max: 50000000, step: 1000, value: 300000 },
        { id: "years", label: "Period", type: "years", min: 1, max: 40, step: 1, value: 5 }
      ],
      outputs: [
        { id: "cagr", label: "CAGR", kind: "grow" },
        { id: "abs", label: "Absolute return", kind: "plain" },
        { id: "mult", label: "Growth", kind: "gain" }
      ],
      compute: function (v) {
        const ratio = v.final / v.initial;
        return { cagr: fmtPct((Math.pow(ratio, 1 / v.years) - 1) * 100), abs: fmtPct((ratio - 1) * 100), mult: (Math.round(ratio * 100) / 100) + "×" };
      }
    },
    {
      id: "retirement", name: "Retirement", accent: "green", icon: icon(I.retire),
      about: "Estimates the nest egg you will need to maintain your lifestyle after you stop working, allowing for inflation, and the monthly SIP that could build it in time.",
      how: ["Set your current and retirement age.", "Enter your monthly expenses today.", "Set inflation and your expected returns before and after retirement.", "Read the corpus you need and the SIP to reach it."],
      inputs: [
        { id: "curAge", label: "Current age", type: "age", min: 18, max: 55, step: 1, value: 30 },
        { id: "retAge", label: "Retirement age", type: "age", min: 40, max: 70, step: 1, value: 60 },
        { id: "monthlyExpense", label: "Monthly expenses today", type: "money", min: 5000, max: 500000, step: 1000, value: 50000 },
        { id: "inflation", label: "Inflation", type: "percent", min: 2, max: 12, step: 0.5, value: 6 },
        { id: "preReturn", label: "Return till retirement", type: "percent", min: 6, max: 18, step: 0.5, value: 12 },
        { id: "postReturn", label: "Return after retirement", type: "percent", min: 4, max: 12, step: 0.5, value: 7 },
        { id: "retYears", label: "Years in retirement", type: "years", min: 10, max: 40, step: 1, value: 25 }
      ],
      outputs: [
        { id: "futMonthly", label: "Monthly need at retirement", kind: "plain" },
        { id: "corpus", label: "Corpus needed", kind: "grow" },
        { id: "sip", label: "Monthly SIP needed", kind: "gain" }
      ],
      compute: function (v) {
        const yToRet = Math.max(1, v.retAge - v.curAge);
        const futMonthly = v.monthlyExpense * Math.pow(1 + v.inflation / 100, yToRet);
        const annual = futMonthly * 12;
        const realRate = ((1 + v.postReturn / 100) / (1 + v.inflation / 100)) - 1;
        let corpus;
        if (Math.abs(realRate) < 1e-6) corpus = annual * v.retYears;
        else corpus = annual * (1 - Math.pow(1 + realRate, -v.retYears)) / realRate * (1 + realRate);
        const sip = sipFor(corpus, v.preReturn, yToRet);
        return { futMonthly: fmtINR(futMonthly), corpus: fmtINR(corpus), sip: fmtINR(sip) };
      }
    },
    {
      id: "nps", name: "NPS", accent: "blue", icon: icon(I.nps),
      about: "The National Pension System builds a retirement corpus through regular contributions until age 60. At retirement a part is taken as a lump sum and the rest buys an annuity that pays a monthly pension.",
      how: ["Set your monthly contribution and current age.", "Choose an expected return on the corpus.", "Set the share used to buy an annuity and its rate.", "Read the corpus, lump sum and monthly pension."],
      inputs: [
        { id: "monthly", label: "Monthly contribution", type: "money", min: 500, max: 200000, step: 500, value: 10000 },
        { id: "curAge", label: "Current age", type: "age", min: 18, max: 59, step: 1, value: 30 },
        { id: "rate", label: "Expected return (p.a.)", type: "percent", min: 6, max: 14, step: 0.5, value: 10 },
        { id: "annuityPct", label: "% used for annuity", type: "percent", min: 40, max: 100, step: 5, value: 40 },
        { id: "annuityRate", label: "Annuity return", type: "percent", min: 4, max: 9, step: 0.5, value: 6 }
      ],
      outputs: [
        { id: "corpus", label: "Corpus at 60", kind: "grow" },
        { id: "lump", label: "Lump sum withdrawal", kind: "plain" },
        { id: "pension", label: "Monthly pension", kind: "gain" }
      ],
      compute: function (v) {
        const yToRet = Math.max(1, 60 - v.curAge);
        const corpus = sipFV(v.monthly, v.rate, yToRet);
        const annuity = corpus * v.annuityPct / 100;
        return { corpus: fmtINR(corpus), lump: fmtINR(corpus - annuity), pension: fmtINR(annuity * v.annuityRate / 100 / 12) };
      }
    },
    {
      id: "swp", name: "SWP", accent: "green", icon: icon(I.swp),
      about: "A Systematic Withdrawal Plan draws a fixed amount from your corpus every month while the balance keeps earning returns. It shows how long the corpus can last and what is left after a chosen period.",
      how: ["Enter your invested corpus.", "Set the monthly amount you want to withdraw.", "Choose an expected return and a period.", "See how long it lasts and the balance at the end."],
      inputs: [
        { id: "corpus", label: "Invested corpus", type: "money", min: 100000, max: 100000000, step: 100000, value: 5000000 },
        { id: "withdraw", label: "Monthly withdrawal", type: "money", min: 1000, max: 500000, step: 1000, value: 25000 },
        { id: "rate", label: "Expected return (p.a.)", type: "percent", min: 1, max: 15, step: 0.5, value: 8 },
        { id: "years", label: "Period", type: "years", min: 1, max: 40, step: 1, value: 20 }
      ],
      outputs: [
        { id: "lasts", label: "Corpus lasts", kind: "grow" },
        { id: "withdrawn", label: "Total withdrawn", kind: "plain" },
        { id: "balance", label: "Balance at end", kind: "gain" }
      ],
      compute: function (v) {
        const i = v.rate / 100 / 12;
        let bal = v.corpus, life = null;
        for (let m = 1; m <= 1200; m++) { bal = bal * (1 + i) - v.withdraw; if (bal <= 0) { life = m; break; } }
        let b = v.corpus, withdrawn = 0; const n = Math.round(v.years * 12);
        for (let m = 1; m <= n; m++) {
          if (b <= 0) break;
          b = b * (1 + i) - v.withdraw; withdrawn += v.withdraw;
          if (b < 0) { withdrawn += b; b = 0; }
        }
        return { lasts: life === null ? "100+ years" : fmtDuration(life), withdrawn: fmtINR(Math.max(0, withdrawn)), balance: fmtINR(Math.max(0, b)) };
      }
    },
    {
      id: "fd", name: "Fixed Deposit", accent: "blue", icon: icon(I.fd),
      about: "A fixed deposit locks a lump sum with a bank for a fixed term at a fixed rate, compounded quarterly. The return is assured, which makes it a steady, low-risk parking place for money.",
      how: ["Enter the amount you would deposit.", "Set the interest rate offered.", "Choose the term in years.", "Read the maturity value and interest earned."],
      note: "Assumes quarterly compounding. Banks may differ. " + DISC,
      inputs: [
        { id: "principal", label: "Deposit amount", type: "money", min: 5000, max: 10000000, step: 5000, value: 500000 },
        { id: "rate", label: "Interest rate (p.a.)", type: "percent", min: 3, max: 10, step: 0.1, value: 7 },
        { id: "years", label: "Term", type: "years", min: 1, max: 10, step: 1, value: 5 }
      ],
      outputs: [
        { id: "value", label: "Maturity value", kind: "grow" },
        { id: "interest", label: "Interest earned", kind: "gain" },
        { id: "invested", label: "You invest", kind: "plain" }
      ],
      compute: function (v) {
        const fv = v.principal * Math.pow(1 + v.rate / 100 / 4, 4 * v.years);
        return { value: fmtINR(fv), interest: fmtINR(fv - v.principal), invested: fmtINR(v.principal) };
      }
    },
    {
      id: "rd", name: "Recurring Deposit", accent: "green", icon: icon(I.rd),
      about: "A recurring deposit puts a fixed amount into a bank every month for a fixed term at a fixed rate. It is a disciplined way to build a guaranteed corpus from small, regular savings.",
      how: ["Set your monthly deposit.", "Enter the interest rate offered.", "Choose the term in years.", "Read the maturity value and interest earned."],
      note: "Compounded monthly for simplicity. Banks may differ. " + DISC,
      inputs: [
        { id: "monthly", label: "Monthly deposit", type: "money", min: 500, max: 100000, step: 500, value: 5000 },
        { id: "rate", label: "Interest rate (p.a.)", type: "percent", min: 3, max: 9, step: 0.1, value: 6.5 },
        { id: "years", label: "Term", type: "years", min: 1, max: 10, step: 1, value: 5 }
      ],
      outputs: [
        { id: "value", label: "Maturity value", kind: "grow" },
        { id: "interest", label: "Interest earned", kind: "gain" },
        { id: "invested", label: "You deposit", kind: "plain" }
      ],
      compute: function (v) {
        const i = v.rate / 100 / 12, n = Math.round(v.years * 12); let val = 0;
        for (let m = 0; m < n; m++) val = (val + v.monthly) * (1 + i);
        const inv = v.monthly * n;
        return { value: fmtINR(val), interest: fmtINR(val - inv), invested: fmtINR(inv) };
      }
    },
    {
      id: "ppf", name: "PPF", accent: "blue", icon: icon(I.ppf),
      about: "The Public Provident Fund is a government savings scheme with a 15-year term, tax-free interest compounded yearly, and a deposit cap of ₹1.5 lakh a year. It rewards long, patient saving.",
      how: ["Set your yearly investment (up to ₹1.5 lakh).", "Enter the current PPF rate.", "Choose the duration (15 years or extended).", "Read the maturity value and interest earned."],
      note: "PPF rates are set by the government and revised periodically. " + DISC,
      inputs: [
        { id: "yearly", label: "Yearly investment", type: "money", min: 500, max: 150000, step: 500, value: 150000 },
        { id: "rate", label: "Interest rate (p.a.)", type: "percent", min: 6, max: 9, step: 0.1, value: 7.1 },
        { id: "years", label: "Duration", type: "years", min: 15, max: 50, step: 1, value: 15 }
      ],
      outputs: [
        { id: "value", label: "Maturity value", kind: "grow" },
        { id: "invested", label: "Total invested", kind: "plain" },
        { id: "interest", label: "Interest earned", kind: "gain" }
      ],
      compute: function (v) {
        let bal = 0; for (let y = 0; y < v.years; y++) bal = (bal + v.yearly) * (1 + v.rate / 100);
        const inv = v.yearly * v.years;
        return { value: fmtINR(bal), invested: fmtINR(inv), interest: fmtINR(bal - inv) };
      }
    },
    {
      id: "epf", name: "EPF", accent: "green", icon: icon(I.epf),
      about: "The Employees' Provident Fund builds a retirement corpus from monthly contributions out of your basic salary, matched in part by your employer, and compounded at a government-set rate.",
      how: ["Enter your monthly basic + DA.", "Set your expected annual increment.", "Enter the EPF interest rate and years of service.", "Read the corpus you could accumulate."],
      note: "Simplified: 12% employee + 3.67% employer of basic, ignoring the pension (EPS) split and wage ceiling. " + DISC,
      inputs: [
        { id: "basic", label: "Monthly basic + DA", type: "money", min: 5000, max: 500000, step: 1000, value: 30000 },
        { id: "growth", label: "Annual increment", type: "percent", min: 0, max: 15, step: 1, value: 6 },
        { id: "rate", label: "Interest rate (p.a.)", type: "percent", min: 7, max: 9, step: 0.05, value: 8.25 },
        { id: "years", label: "Years of service", type: "years", min: 1, max: 40, step: 1, value: 30 }
      ],
      outputs: [
        { id: "value", label: "EPF corpus", kind: "grow" },
        { id: "invested", label: "Total contributions", kind: "plain" },
        { id: "interest", label: "Interest earned", kind: "gain" }
      ],
      compute: function (v) {
        const i = v.rate / 100 / 12; let bal = 0, inv = 0, B = v.basic;
        for (let y = 0; y < v.years; y++) {
          const c = B * 0.1567;
          for (let m = 0; m < 12; m++) { bal = (bal + c) * (1 + i); inv += c; }
          B *= (1 + v.growth / 100);
        }
        return { value: fmtINR(bal), invested: fmtINR(inv), interest: fmtINR(bal - inv) };
      }
    },
    {
      id: "ssy", name: "Sukanya Samriddhi", accent: "blue", icon: icon(I.ssy),
      about: "Sukanya Samriddhi Yojana is a government scheme for a girl child. You deposit for 15 years and the account matures 21 years after opening, with tax-free interest compounded yearly.",
      how: ["Set the amount you would deposit each year.", "Enter the current scheme rate.", "Read the maturity value after 21 years.", "Deposits run for the first 15 years."],
      note: "SSY rates are set by the government and revised periodically. " + DISC,
      inputs: [
        { id: "yearly", label: "Yearly deposit", type: "money", min: 250, max: 150000, step: 250, value: 150000 },
        { id: "rate", label: "Interest rate (p.a.)", type: "percent", min: 7, max: 9, step: 0.1, value: 8.2 }
      ],
      outputs: [
        { id: "value", label: "Maturity (21 yrs)", kind: "grow" },
        { id: "invested", label: "Total deposited", kind: "plain" },
        { id: "interest", label: "Interest earned", kind: "gain" }
      ],
      compute: function (v) {
        let bal = 0; for (let y = 1; y <= 21; y++) { if (y <= 15) bal += v.yearly; bal *= (1 + v.rate / 100); }
        const inv = v.yearly * 15;
        return { value: fmtINR(bal), invested: fmtINR(inv), interest: fmtINR(bal - inv) };
      }
    },
    {
      id: "emi", name: "Loan EMI", accent: "green", icon: icon(I.emi),
      about: "An Equated Monthly Instalment is the fixed payment you make on a loan each month. It shows what a loan will cost you monthly and the total interest you pay over its life.",
      how: ["Enter the loan amount.", "Set the interest rate.", "Choose the tenure in years.", "Read the monthly EMI and total interest."],
      inputs: [
        { id: "principal", label: "Loan amount", type: "money", min: 50000, max: 50000000, step: 50000, value: 2500000 },
        { id: "rate", label: "Interest rate (p.a.)", type: "percent", min: 5, max: 20, step: 0.1, value: 9 },
        { id: "tenure", label: "Tenure", type: "years", min: 1, max: 30, step: 1, value: 20 }
      ],
      outputs: [
        { id: "emi", label: "Monthly EMI", kind: "grow" },
        { id: "interest", label: "Total interest", kind: "plain" },
        { id: "total", label: "Total payment", kind: "gain" }
      ],
      compute: function (v) {
        const i = v.rate / 100 / 12, n = Math.round(v.tenure * 12);
        const emi = i === 0 ? v.principal / n : v.principal * i * Math.pow(1 + i, n) / (Math.pow(1 + i, n) - 1);
        const total = emi * n;
        return { emi: fmtINR(emi), interest: fmtINR(total - v.principal), total: fmtINR(total) };
      }
    },
    {
      id: "inflation", name: "Inflation", accent: "blue", icon: icon(I.inflation),
      about: "Inflation quietly raises the cost of living over time. This shows what something that costs a set amount today might cost in future, and how much the same money will be worth then.",
      how: ["Enter today's cost of the thing you have in mind.", "Set an expected inflation rate.", "Choose how many years ahead.", "See the future cost and the eroded value of money."],
      inputs: [
        { id: "amount", label: "Cost today", type: "money", min: 1000, max: 10000000, step: 1000, value: 100000 },
        { id: "rate", label: "Inflation rate", type: "percent", min: 2, max: 12, step: 0.5, value: 6 },
        { id: "years", label: "Years ahead", type: "years", min: 1, max: 40, step: 1, value: 10 }
      ],
      outputs: [
        { id: "future", label: "Future cost", kind: "grow" },
        { id: "worth", label: "Today's money worth then", kind: "plain" },
        { id: "extra", label: "Extra needed", kind: "gain" }
      ],
      compute: function (v) {
        const fut = v.amount * Math.pow(1 + v.rate / 100, v.years);
        const worth = v.amount / Math.pow(1 + v.rate / 100, v.years);
        return { future: fmtINR(fut), worth: fmtINR(worth), extra: fmtINR(fut - v.amount) };
      }
    },
    {
      id: "gratuity", name: "Gratuity", accent: "green", icon: icon(I.gratuity),
      about: "Gratuity is a lump sum an employer pays for long service, payable after five years. It is calculated as fifteen days of your last drawn salary for every completed year of service.",
      how: ["Enter your last drawn monthly basic + DA.", "Set your years of service.", "Read the gratuity payable.", "Note: you are eligible only after five years."],
      note: "Formula: (15/26) × last salary × years, capped at ₹20 L. Eligible after 5 years of service.",
      inputs: [
        { id: "salary", label: "Last monthly basic + DA", type: "money", min: 10000, max: 1000000, step: 1000, value: 50000 },
        { id: "years", label: "Years of service", type: "years", min: 5, max: 40, step: 1, value: 10 }
      ],
      outputs: [
        { id: "gratuity", label: "Gratuity payable", kind: "grow" },
        { id: "perYear", label: "Per year of service", kind: "plain" }
      ],
      compute: function (v) {
        const g = Math.min((15 / 26) * v.salary * v.years, 2000000);
        return { gratuity: fmtINR(g), perYear: fmtINR((15 / 26) * v.salary) };
      }
    }
  ];

  const GROUPS = [
    { title: "Invest & grow", ids: ["sip", "stepup", "lumpsum", "goal", "cagr"] },
    { title: "Retire & withdraw", ids: ["retirement", "nps", "swp"] },
    { title: "Save & deposit", ids: ["fd", "rd", "ppf", "epf", "ssy"] },
    { title: "Borrow & protect", ids: ["emi", "inflation", "gratuity"] }
  ];

  const byId = {};
  CALCS.forEach(function (c) { byId[c.id] = c; });

  /* ---------------- build the app deck ---------------- */
  GROUPS.forEach(function (g) {
    const section = document.createElement("div");
    section.className = "app-group";
    const heading = document.createElement("h2");
    heading.className = "app-group-title";
    heading.textContent = g.title;
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
      btn.innerHTML = '<span class="app-icon">' + c.icon + '</span><span class="app-name">' + c.name + "</span>";
      btn.addEventListener("click", function () { openCalc(id); });
      grid.appendChild(btn);
    });
    section.appendChild(grid);
    deck.appendChild(section);
  });

  /* ---------------- window (modal) ---------------- */
  const modal = document.getElementById("calcModal");
  const win = document.getElementById("calcWindow");
  let lastFocus = null;

  function renderWindow(c) {
    const inputs = c.inputs.map(function (f) {
      return '<div class="ctrl">' +
        '<div class="ctrl-top"><label for="cw_' + f.id + '">' + f.label + '</label><output id="out_' + f.id + '"></output></div>' +
        '<input id="cw_' + f.id + '" type="range" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + f.value + '" />' +
        '<div class="ctrl-scale"><span>' + fmtScale(f, f.min) + '</span><span>' + fmtScale(f, f.max) + '</span></div>' +
        '</div>';
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
          '<p class="calc-note">' + (c.note || DISC) + '</p>' +
        '</div>' +
        '<div class="cw-pane cw-info">' +
          "<h4>What it is</h4><p>" + c.about + "</p>" +
          '<h4>How to use it</h4><ol class="cw-how">' + how + "</ol>" +
        '</div>' +
      '</div>';
  }

  function bindInputs(c) {
    const fields = c.inputs.map(function (f) {
      return { f: f, el: win.querySelector("#cw_" + f.id), out: win.querySelector("#out_" + f.id) };
    });
    function trackFill(el) {
      const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
      el.style.setProperty("--p", pct + "%");
    }
    function update() {
      const vals = {};
      fields.forEach(function (x) {
        const v = parseFloat(x.el.value);
        vals[x.f.id] = v;
        x.out.textContent = fmtVal(x.f, v);
        trackFill(x.el);
      });
      const res = c.compute(vals);
      c.outputs.forEach(function (o) {
        const el = win.querySelector("#res_" + o.id);
        if (el) el.textContent = res[o.id] !== undefined ? res[o.id] : "–";
      });
    }
    fields.forEach(function (x) { x.el.addEventListener("input", update); });
    update();
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
