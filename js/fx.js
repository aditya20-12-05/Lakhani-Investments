/* Decorative + interactive flourishes, applied site-wide:
   1. A drifting particle-network canvas behind any [data-fx-net] container
      (subpage headers, dark CTA bands) that echo the home-page constellation.
   2. A soft cursor-following spotlight on cards, for a tactile, alive feel.
   Everything degrades gracefully on touch devices and reduced-motion. */
(function () {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ----------------------------------------------------------------
     Cursor spotlight on cards
  ---------------------------------------------------------------- */
  if (fine && !reduce) {
    const sel =
      ".pillar, .svc, .office, .value, .leader-card, .feature-card, .form, .crow";
    document.querySelectorAll(sel).forEach((card) => {
      if (getComputedStyle(card).position === "static") card.style.position = "relative";
      card.classList.add("fx-spot");
      const glow = document.createElement("span");
      glow.className = "fx-glow";
      card.insertBefore(glow, card.firstChild);
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", ((e.clientX - r.left) / r.width) * 100 + "%");
        card.style.setProperty("--my", ((e.clientY - r.top) / r.height) * 100 + "%");
      });
    });
  }

  /* ----------------------------------------------------------------
     Pointer-tilt cards
     Cards marked [data-tilt] lean gently toward the cursor in 3D and
     keep a small lift, composing with their CSS hover styling for a
     tactile, alive feel. On leave they settle back via the CSS easing.
  ---------------------------------------------------------------- */
  if (fine && !reduce) {
    const MAX = 7; // degrees of lean at the card's edge
    document.querySelectorAll("[data-tilt]").forEach((card) => {
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transition = "transform 0.12s ease-out";
        card.style.transform =
          "perspective(900px) rotateX(" + (-py * MAX).toFixed(2) + "deg) " +
          "rotateY(" + (px * MAX).toFixed(2) + "deg) translateY(-6px)";
      });
      card.addEventListener("pointerleave", () => {
        card.style.transition = ""; // restore CSS easing for the settle
        card.style.transform = "";
      });
    });
  }

  /* ----------------------------------------------------------------
     Particle-network backgrounds
  ---------------------------------------------------------------- */
  function initNet(host) {
    const dark = host.hasAttribute("data-fx-dark");
    const canvas = document.createElement("canvas");
    canvas.className = "fx-net-canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.insertBefore(canvas, host.firstChild);
    const ctx = canvas.getContext("2d");

    const blue = dark ? "120,170,225" : "0,88,168";
    const green = dark ? "127,195,160" : "0,128,64";
    let W = 0, H = 0, DPR = 1, nodes = [], raf = 0, vis = false;
    const LINK = 132, LINK2 = LINK * LINK;
    const pointer = { x: -9999, y: -9999 };

    function build() {
      const target = Math.max(14, Math.min(70, Math.round((W * H) / 15000)));
      nodes = [];
      for (let i = 0; i < target; i++) {
        nodes.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 1.6 + 1, c: Math.random() < 0.5 ? blue : green,
        });
      }
    }
    function size() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      const r = host.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      build();
    }
    function frame() {
      if (!vis) { raf = 0; return; }
      ctx.clearRect(0, 0, W, H);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
        // gentle drift toward the cursor for a subtle interactive pull
        const dx = pointer.x - n.x, dy = pointer.y - n.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 26000) { n.x += dx * 0.0009; n.y += dy * 0.0009; }
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
          if (d < LINK2) {
            const o = (1 - d / LINK2) * (dark ? 0.22 : 0.16);
            ctx.strokeStyle = `rgba(${blue}, ${o})`;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${n.c}, ${dark ? 0.55 : 0.42})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf) raf = requestAnimationFrame(frame); }

    host.addEventListener("pointermove", (e) => {
      const r = host.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
    });
    host.addEventListener("pointerleave", () => { pointer.x = -9999; pointer.y = -9999; });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        vis = entries[0].isIntersecting;
        if (vis && !reduce) start();
      }, { threshold: 0 }).observe(host);
    } else { vis = true; }

    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(size, 160); }, { passive: true });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && vis && !reduce) start(); });

    size();
    if (reduce) { vis = true; frame(); raf = 0; vis = false; } // one static frame
  }

  /* ----------------------------------------------------------------
     Hero constellation sky
     A calmer take on the network for sub-page headers: a sparse field
     of softly twinkling stars, with a few brighter "anchor" stars wired
     into one rising line that echoes the brand's growth arrow. The field
     drifts slowly, brightens near the cursor, and settles to a single
     static frame when reduced motion is requested.
  ---------------------------------------------------------------- */
  function initHeroSky(host) {
    const canvas = document.createElement("canvas");
    canvas.className = "fx-net-canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.insertBefore(canvas, host.firstChild);
    const ctx = canvas.getContext("2d");

    const blue = "0,88,168";
    const green = "0,128,64";
    const ink = "92,120,150";
    // normalised rising path (bottom-left to top-right), a constellation
    // drawn in the shape of a climbing chart line.
    const PATH = [
      [0.07, 0.80], [0.21, 0.63], [0.35, 0.71],
      [0.50, 0.49], [0.64, 0.57], [0.78, 0.35], [0.92, 0.25],
    ];
    let W = 0, H = 0, DPR = 1, stars = [], anchors = [], raf = 0, vis = false;
    const t0 = performance.now();
    const pointer = { x: -9999, y: -9999 };

    function build() {
      const target = Math.max(10, Math.min(46, Math.round((W * H) / 24000)));
      stars = [];
      for (let i = 0; i < target; i++) {
        const roll = Math.random();
        stars.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.16, vy: (Math.random() - 0.5) * 0.16,
          r: Math.random() * 1.2 + 0.6,
          c: roll < 0.16 ? blue : roll < 0.30 ? green : ink,
          ph: Math.random() * Math.PI * 2, sp: 0.6 + Math.random() * 0.9,
        });
      }
      anchors = PATH.map(function (p, i) {
        return {
          x: p[0] * W, y: p[1] * H,
          r: 2.2 + (i % 2 ? 0.3 : 1.0),
          c: i / (PATH.length - 1) < 0.5 ? blue : green,
          ph: Math.random() * Math.PI * 2,
        };
      });
    }
    function size() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      const r = host.getBoundingClientRect();
      W = r.width; H = r.height;
      canvas.width = W * DPR; canvas.height = H * DPR;
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      build();
    }
    function frame(now) {
      if (!vis) { raf = 0; return; }
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);

      // rising constellation line (behind the stars)
      ctx.lineWidth = 1;
      for (let i = 0; i < anchors.length - 1; i++) {
        const a = anchors[i], b = anchors[i + 1];
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, "rgba(" + a.c + ",0.30)");
        grad.addColorStop(1, "rgba(" + b.c + ",0.30)");
        ctx.strokeStyle = grad;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }

      // ambient stars: gentle drift, soft twinkle, brighten near cursor
      for (const s of stars) {
        s.x += s.vx; s.y += s.vy;
        if (s.x < 0 || s.x > W) s.vx *= -1;
        if (s.y < 0 || s.y > H) s.vy *= -1;
        const dx = pointer.x - s.x, dy = pointer.y - s.y;
        const near = dx * dx + dy * dy < 16000;
        const tw = 0.5 + 0.5 * Math.sin(t * s.sp + s.ph);
        const a = (0.20 + 0.42 * tw) * (near ? 1.7 : 1);
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + s.c + "," + Math.min(0.9, a).toFixed(3) + ")";
        ctx.fill();
      }

      // anchor stars: brighter core with a soft pulsing halo
      for (const an of anchors) {
        const pulse = 0.6 + 0.4 * Math.sin(t * 0.9 + an.ph);
        ctx.beginPath(); ctx.arc(an.x, an.y, an.r + 2.6 * pulse, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + an.c + ",0.10)";
        ctx.fill();
        ctx.beginPath(); ctx.arc(an.x, an.y, an.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + an.c + ",0.85)";
        ctx.fill();
      }

      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf) raf = requestAnimationFrame(frame); }

    host.addEventListener("pointermove", function (e) {
      const r = host.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
    });
    host.addEventListener("pointerleave", function () { pointer.x = -9999; pointer.y = -9999; });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (entries) {
        vis = entries[0].isIntersecting;
        if (vis && !reduce) start();
      }, { threshold: 0 }).observe(host);
    } else { vis = true; }

    let rt;
    window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(size, 160); }, { passive: true });
    document.addEventListener("visibilitychange", function () { if (!document.hidden && vis && !reduce) start(); });

    size();
    if (reduce) { vis = true; frame(performance.now()); raf = 0; vis = false; } // one static frame
  }

  // Sub-page headers get the calmer constellation sky; dark CTA bands keep
  // the original drifting network.
  document.querySelectorAll(".page-hero[data-fx-net]").forEach(initHeroSky);
  document.querySelectorAll("[data-fx-net]:not(.page-hero)").forEach(initNet);

  /* ----------------------------------------------------------------
     Scroll-filled timeline (About page)
     A colour line grows from the top as the section scrolls past the
     viewport's middle; each milestone dot lights up as the front
     reaches it.
  ---------------------------------------------------------------- */
  document.querySelectorAll(".timeline").forEach((tl) => {
    const fill = document.createElement("span");
    fill.className = "tl-fill";
    fill.setAttribute("aria-hidden", "true");
    tl.insertBefore(fill, tl.firstChild);
    const items = Array.prototype.slice.call(tl.querySelectorAll(".tl-item"));

    if (reduce) {
      // show the finished state without animating
      fill.style.setProperty("--tl-fill", tl.offsetHeight + "px");
      items.forEach((it) => it.classList.add("lit"));
      return;
    }

    let ticking = false;
    function update() {
      ticking = false;
      const r = tl.getBoundingClientRect();
      const mid = window.innerHeight * 0.55; // fill front tracks ~middle of screen
      const h = Math.max(0, Math.min(tl.offsetHeight, mid - r.top));
      fill.style.setProperty("--tl-fill", h + "px");
      items.forEach((it) => {
        const dotY = it.offsetTop + 12; // ~centre of the 16px dot
        it.classList.toggle("lit", dotY <= h);
      });
    }
    function onScroll() {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    update();
  });
})();
