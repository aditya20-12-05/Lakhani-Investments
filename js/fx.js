/* Decorative + interactive flourishes, applied site-wide:
   1. A drifting particle-network canvas behind any [data-fx-net] container
      (subpage headers, dark CTA bands) — echoes the home-page constellation.
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
      ".pillar, .svc, .office, .value, .leader-card, .feature-card, .form, .crow, .chart-card";
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

  document.querySelectorAll("[data-fx-net]").forEach(initNet);
})();
