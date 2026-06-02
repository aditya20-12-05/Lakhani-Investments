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
     Hero constellation sky (interactive)
     A living star-map behind sub-page headers. Stars drift and twinkle;
     near pairs wire up into a faint web. The cursor becomes a bright node
     that links to nearby stars and gently draws them in, so moving the
     mouse weaves new constellations. A click sends a ripple that nudges
     the field, and a shooting star streaks past now and then. Reduced
     motion falls back to one calm static frame.
  ---------------------------------------------------------------- */
  function initHeroSky(host) {
    const canvas = document.createElement("canvas");
    canvas.className = "fx-net-canvas";
    canvas.setAttribute("aria-hidden", "true");
    host.insertBefore(canvas, host.firstChild);
    const ctx = canvas.getContext("2d");

    const blue = "0,88,168";
    const green = "0,128,64";
    const ink = "70,110,150";
    let W = 0, H = 0, DPR = 1, nodes = [], raf = 0, vis = false;
    const t0 = performance.now();
    const pointer = { x: -9999, y: -9999, active: false };
    const ripples = [];
    let shoot = null, nextShoot = t0 + 4000 + Math.random() * 5000;
    const LINK = 128, LINK2 = LINK * LINK;   // star-to-star reach
    const PR = 175, PR2 = PR * PR;           // cursor reach

    function build() {
      const target = Math.max(20, Math.min(66, Math.round((W * H) / 13500)));
      nodes = [];
      for (let i = 0; i < target; i++) {
        const roll = Math.random();
        nodes.push({
          x: Math.random() * W, y: Math.random() * H,
          vx: (Math.random() - 0.5) * 0.32, vy: (Math.random() - 0.5) * 0.32,
          px: 0, py: 0, // decaying "push" velocity from cursor pull + ripples
          r: Math.random() * 1.5 + 1,
          c: roll < 0.2 ? blue : roll < 0.36 ? green : ink,
          ph: Math.random() * Math.PI * 2, sp: 0.6 + Math.random() * 0.9,
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
    function frame(now) {
      if (!vis) { raf = 0; return; }
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);

      // ---- move ----
      for (const n of nodes) {
        // gentle pull toward an active cursor (added to the decaying push)
        if (pointer.active) {
          const dx = pointer.x - n.x, dy = pointer.y - n.y, d2 = dx * dx + dy * dy;
          if (d2 < PR2 * 2.4) { n.px += dx * 0.00018; n.py += dy * 0.00018; }
        }
        // ripple shells push nearby stars outward
        for (const rp of ripples) {
          const dx = n.x - rp.x, dy = n.y - rp.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
          if (Math.abs(d - rp.r) < 46) {
            const f = (1 - Math.abs(d - rp.r) / 46) * rp.strength;
            n.px += (dx / d) * f; n.py += (dy / d) * f;
          }
        }
        n.x += n.vx + n.px; n.y += n.vy + n.py;
        n.px *= 0.9; n.py *= 0.9; // push decays; base drift remains
        if (n.x < 0 || n.x > W) n.vx *= -1;
        if (n.y < 0 || n.y > H) n.vy *= -1;
        n.x = Math.max(0, Math.min(W, n.x));
        n.y = Math.max(0, Math.min(H, n.y));
      }

      // ---- star-to-star web (subtle) ----
      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const dx = a.x - b.x, dy = a.y - b.y, d = dx * dx + dy * dy;
          if (d < LINK2) {
            const o = (1 - d / LINK2) * 0.16;
            ctx.strokeStyle = "rgba(" + blue + "," + o.toFixed(3) + ")";
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }

      // ---- cursor links (the interactive bit) ----
      if (pointer.active) {
        for (const n of nodes) {
          const dx = pointer.x - n.x, dy = pointer.y - n.y, d2 = dx * dx + dy * dy;
          if (d2 < PR2) {
            const o = (1 - d2 / PR2) * 0.55;
            const grad = ctx.createLinearGradient(pointer.x, pointer.y, n.x, n.y);
            grad.addColorStop(0, "rgba(" + blue + "," + o.toFixed(3) + ")");
            grad.addColorStop(1, "rgba(" + green + "," + (o * 0.55).toFixed(3) + ")");
            ctx.strokeStyle = grad; ctx.lineWidth = 1.1;
            ctx.beginPath(); ctx.moveTo(pointer.x, pointer.y); ctx.lineTo(n.x, n.y); ctx.stroke();
          }
        }
        ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + blue + ",0.85)"; ctx.fill();
      }

      // ---- stars ----
      for (const n of nodes) {
        const dx = pointer.x - n.x, dy = pointer.y - n.y;
        const near = pointer.active && dx * dx + dy * dy < PR2;
        const tw = 0.6 + 0.4 * Math.sin(t * n.sp + n.ph);
        const a = Math.min(0.95, (0.32 + 0.4 * tw) * (near ? 1.6 : 1));
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + n.c + "," + a.toFixed(3) + ")";
        ctx.fill();
      }

      // ---- click ripples ----
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.r += 9; rp.strength *= 0.95;
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = "rgba(" + blue + "," + (0.2 * Math.max(0, 1 - rp.r / rp.max)).toFixed(3) + ")";
        ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2); ctx.stroke();
        if (rp.r > rp.max) ripples.splice(i, 1);
      }

      // ---- shooting star ----
      if (!shoot && now > nextShoot) {
        const fromLeft = Math.random() < 0.5;
        shoot = {
          x: fromLeft ? -30 : W + 30, y: Math.random() * H * 0.55,
          vx: (fromLeft ? 1 : -1) * (7 + Math.random() * 3), vy: 1.6 + Math.random() * 1.4,
        };
      }
      if (shoot) {
        const tailX = shoot.x - shoot.vx * 6, tailY = shoot.y - shoot.vy * 6;
        const grad = ctx.createLinearGradient(tailX, tailY, shoot.x, shoot.y);
        grad.addColorStop(0, "rgba(" + green + ",0)");
        grad.addColorStop(1, "rgba(" + blue + ",0.7)");
        ctx.strokeStyle = grad; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(shoot.x, shoot.y); ctx.stroke();
        ctx.beginPath(); ctx.arc(shoot.x, shoot.y, 1.6, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + blue + ",0.9)"; ctx.fill();
        shoot.x += shoot.vx; shoot.y += shoot.vy;
        if (shoot.x < -60 || shoot.x > W + 60 || shoot.y > H + 60) {
          shoot = null; nextShoot = now + 7000 + Math.random() * 9000;
        }
      }

      raf = requestAnimationFrame(frame);
    }
    function start() { if (!raf) raf = requestAnimationFrame(frame); }

    host.addEventListener("pointermove", function (e) {
      const r = host.getBoundingClientRect();
      pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.active = true;
    });
    host.addEventListener("pointerleave", function () { pointer.active = false; pointer.x = -9999; pointer.y = -9999; });
    host.addEventListener("pointerdown", function (e) {
      const r = host.getBoundingClientRect();
      ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, r: 6, max: Math.max(W, H) * 0.7, strength: 1.6 });
    });

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
