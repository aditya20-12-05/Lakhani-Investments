/* Interactive intro: cursor-built logo constellation.
   Particles drift as dust; as the cursor nears the centre they assemble into
   the Lakhani mark (ascending bars + rising arrow), then dissolve when it
   leaves. Auto-assembles once on load, and breathes gently without a pointer. */
(function () {
  const canvas = document.getElementById("logo-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Touch devices have no hover, so the "move the cursor to reveal it" gesture
  // cannot happen. On those devices keep the mark gently formed and drop the
  // cursor hint, so mobile visitors see the brand at once, not scattered dust.
  const coarse = matchMedia("(hover: none)").matches;
  if (coarse) {
    const hint = document.querySelector(".intro-hint");
    if (hint) hint.remove();
  }

  // Colours sampled from assets/logo.png so the constellation matches the mark.
  const C = {
    bar1: "108,159,118", // #6c9f76 (sage)
    bar2: "7,133,69",    // #078545
    bar3: "8,113,64",    // #087140
    bar4: "2,103,57",    // #026739
    blue: "0,88,168",    // #0058a8
  };
  // Colours in a flat list + reusable buckets so the connecting lines can be
  // batched by (colour, opacity level) and drawn in a few stroke() calls.
  const COLORS = [C.bar1, C.bar2, C.bar3, C.bar4, C.blue];
  const LINE_LEVELS = 4;
  const lineBatch = [];
  for (let i = 0; i < COLORS.length * LINE_LEVELS; i++) lineBatch.push([]);

  let W = 0, H = 0, DPR = 1, rect = null;
  let particles = [];
  let targets = [];
  let pairs = [];
  let scale = 1;
  const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false };
  let t = 0;
  let globalA = 0;
  let introUntil = performance.now() + 2600; // hold the logo briefly on load
  let running = true;
  // Performance guards: pause when the hero is off-screen, and automatically
  // shed the heaviest work (the connecting-line pass) on devices that can't
  // sustain a smooth frame rate, so the interaction never feels laggy.
  let rafId = 0, onScreen = true, lite = false;
  let lastTs = 0, frameEMA = 16, slowRun = 0;

  const smooth = (x) => x * x * (3 - 2 * x);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ----- build target points from the logo geometry (normalised space) -----
  function buildModel() {
    const m = [];
    // Coordinates traced from the real logo (viewBox-style space, baseline 116).
    const baseY = 115.9, step = 5.2;
    function rect(x0, x1, y0, y1, color) {
      for (let yy = y0; yy <= y1; yy += step)
        for (let xx = x0; xx <= x1; xx += step) m.push({ nx: xx, ny: yy, color });
    }
    rect(5.6, 21.3, 73.3, baseY, C.bar1);          // bar 1 (short, sage)
    rect(31.6, 47.7, 46.5, baseY, C.bar2);         // bar 2 (tall)
    rect(57.9, 74.0, 56.4, 72.1, C.bar3);          // bar 3 top cap
    rect(57.9, 74.0, 81.8, baseY, C.bar3);         // bar 3 lower body (notch gap between)
    rect(84.1, 100.0, 28.1, baseY, C.bar4);        // bar 4 (tallest, darkest)
    // rising arrow: thin shaft along the true centreline (start low-left, peak,
    // dip to a valley, climb to the head), then the solid pentagon arrowhead
    // traced as its perimeter so it reads sharp like the original.
    const segs = [
      [[1.9, 58.9], [39.9, 20.7]], [[39.9, 20.7], [58.7, 39.5]], [[58.7, 39.5], [90.7, 7.4]],
      [[85.1, 0], [98.3, 0]], [[98.3, 0], [98.3, 13.2]], [[98.3, 13.2], [92.8, 9.4]],
      [[92.8, 9.4], [88.7, 5.6]], [[88.7, 5.6], [85.1, 0]],
    ];
    segs.forEach(([[ax, ay], [bx, by]]) => {
      const len = Math.hypot(bx - ax, by - ay);
      const n = Math.max(2, Math.round(len / 3));
      for (let i = 0; i <= n; i++) {
        const k = i / n;
        m.push({ nx: ax + (bx - ax) * k, ny: ay + (by - ay) * k, color: C.blue });
      }
    });
    return m;
  }
  const MODEL = buildModel();

  function layout() {
    const box = Math.min(W * 0.5, H * 0.5);
    // Fit and centre the mark from its actual bounds, so the model can use the
    // real logo proportions without any hand-tuned offsets.
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const p of MODEL) {
      if (p.nx < minx) minx = p.nx; if (p.nx > maxx) maxx = p.nx;
      if (p.ny < miny) miny = p.ny; if (p.ny > maxy) maxy = p.ny;
    }
    const mcx = (minx + maxx) / 2, mcy = (miny + maxy) / 2;
    scale = (box * 0.86) / Math.max(maxx - minx, maxy - miny);
    const cx = W / 2, cy = H * 0.43;
    targets = MODEL.map((p) => ({
      x: cx + (p.nx - mcx) * scale,
      y: cy + (p.ny - mcy) * scale,
      color: p.color,
    }));
    // line pairs between neighbouring target points (drawn when assembled).
    // Only join points of the same colour so the four bars and the arrow read
    // as distinct shapes instead of merging into one mesh.
    pairs = [];
    const TH = (scale * 5.2) ** 2;
    for (let i = 0; i < targets.length; i++) {
      let made = 0;
      const ci = COLORS.indexOf(targets[i].color);
      for (let j = i + 1; j < targets.length && made < 3; j++) {
        if (targets[i].color !== targets[j].color) continue;
        const dx = targets[i].x - targets[j].x, dy = targets[i].y - targets[j].y;
        if (dx * dx + dy * dy < TH) { pairs.push([i, j, ci]); made++; }
      }
    }
    syncParticles();
  }

  function syncParticles() {
    const n = targets.length;
    if (particles.length > n) particles.length = n;
    while (particles.length < n) {
      particles.push({
        dx: Math.random() * W, dy: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
        a: 0, ease: 0.06 + Math.random() * 0.07, r: Math.random() * 1.4 + 1.1,
      });
    }
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    layout();
  }

  function move(e) {
    if (!rect) return;
    const p = e.touches ? e.touches[0] : e;
    pointer.tx = p.clientX - rect.left;
    pointer.ty = p.clientY - rect.top;
    pointer.active = true;
  }
  function leave() { pointer.active = false; pointer.tx = -9999; pointer.ty = -9999; }
  window.addEventListener("mousemove", move, { passive: true });
  window.addEventListener("touchmove", move, { passive: true });
  window.addEventListener("touchstart", move, { passive: true });
  // On touch devices there is no hover, so release the pointer when the finger
  // lifts, otherwise the mark stays frozen at the last touch point and the
  // gentle idle breathing never resumes.
  window.addEventListener("touchend", leave, { passive: true });
  window.addEventListener("touchcancel", leave, { passive: true });
  window.addEventListener("mouseout", (e) => { if (!e.relatedTarget) leave(); });
  document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) start(); });

  function draw() {
    t += 0.01;
    ctx.clearRect(0, 0, W, H);

    if (pointer.tx < -1000) { pointer.x = -9999; pointer.y = -9999; }
    else { pointer.x += (pointer.tx - pointer.x) * 0.32; pointer.y += (pointer.ty - pointer.y) * 0.32; }

    // assemble factor
    const cx = W / 2, cy = H * 0.43;
    let aTarget;
    if (performance.now() < introUntil) {
      aTarget = 1;
    } else if (coarse) {
      // touch devices: hold the mark formed (no hover to reveal it), breathing softly
      aTarget = 0.9 + 0.1 * (0.5 + 0.5 * Math.sin(t * 0.9));
    } else if (pointer.active) {
      const d = Math.hypot(pointer.x - cx, pointer.y - cy);
      const maxR = Math.min(W, H) * 0.62;
      aTarget = clamp(1 - d / maxR, 0, 1);
      aTarget = Math.pow(aTarget, 0.75);
    } else {
      // Idle: mostly drifting dust with a faint, periodic bloom that hints at
      // the mark without fully forming it, keeps the cursor reveal special.
      const s = 0.5 + 0.5 * Math.sin(t * 0.9 - 1.2);
      aTarget = 0.08 + 0.34 * (s * s);
    }
    globalA += (aTarget - globalA) * 0.13;

    // connecting lines (logo wireframe): fade in with assembly.
    // Skipped entirely in lite mode — this is the most expensive pass.
    if (!lite && globalA > 0.05) {
      // Bucket segments by colour and a few opacity levels, then stroke each
      // bucket once. This turns hundreds of individual stroke() calls into a
      // handful, which is what keeps the wireframe from feeling laggy.
      for (let b = 0; b < lineBatch.length; b++) lineBatch[b].length = 0;
      const maxO = globalA * 0.5;
      for (let k = 0; k < pairs.length; k++) {
        const pr = pairs[k];
        const a = particles[pr[0]], b = particles[pr[1]];
        if (a.px === undefined) continue;
        // Only wire points once they are genuinely near their targets, so the
        // mesh appears as the clean logo forms, never as a tangle of long
        // lines while the particles are still scattered in transit.
        const m = a.a < b.a ? a.a : b.a;
        if (m < 0.6) continue;
        const o = maxO * ((m - 0.6) / 0.4);
        if (o < 0.02) continue;
        let lvl = Math.round((o / maxO) * LINE_LEVELS);
        if (lvl < 1) lvl = 1; else if (lvl > LINE_LEVELS) lvl = LINE_LEVELS;
        const arr = lineBatch[pr[2] * LINE_LEVELS + (lvl - 1)];
        arr.push(a.px, a.py, b.px, b.py);
      }
      ctx.lineWidth = 1;
      for (let ci = 0; ci < COLORS.length; ci++) {
        for (let lvl = 1; lvl <= LINE_LEVELS; lvl++) {
          const arr = lineBatch[ci * LINE_LEVELS + (lvl - 1)];
          if (!arr.length) continue;
          ctx.strokeStyle = `rgba(${COLORS[ci]}, ${(maxO * lvl / LINE_LEVELS).toFixed(3)})`;
          ctx.beginPath();
          for (let s = 0; s < arr.length; s += 4) {
            ctx.moveTo(arr[s], arr[s + 1]); ctx.lineTo(arr[s + 2], arr[s + 3]);
          }
          ctx.stroke();
        }
      }
    }

    // particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i], tgt = targets[i];
      // free drift
      p.dx += p.vx; p.dy += p.vy;
      if (p.dx < 0 || p.dx > W) p.vx *= -1;
      if (p.dy < 0 || p.dy > H) p.vy *= -1;
      // per-particle assembly easing
      p.a += (globalA - p.a) * p.ease;
      const e = smooth(clamp(p.a, 0, 1));
      const px = p.dx + (tgt.x - p.dx) * e;
      const py = p.dy + (tgt.y - p.dy) * e;
      p.px = px; p.py = py;

      const op = 0.3 + 0.62 * e;
      const r = p.r * (1 + 0.55 * e);
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${tgt.color}, ${op})`;
      ctx.fill();
    }

    // cursor glow
    if (pointer.x > -1000) {
      const gr = lite ? 60 : 90;
      const rg = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, gr);
      rg.addColorStop(0, `rgba(${C.bar2}, 0.16)`);
      rg.addColorStop(1, `rgba(${C.bar2}, 0)`);
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(pointer.x, pointer.y, gr, 0, Math.PI * 2); ctx.fill();
    }
  }

  function loop(ts) {
    if (!running || !onScreen) { rafId = 0; return; }
    if (lastTs) {
      const dt = ts - lastTs;
      // Ignore one-off stalls (tab switch, GC, scroll jank). A single spike must
      // never skew the average and permanently strip the wireframe, which was
      // the cause of the lines showing up only on some page loads.
      if (dt < 120) {
        frameEMA += (dt - frameEMA) * 0.1;
        // Only judge performance once the intro has settled and load-time work
        // has cleared, and require sustained slowness (not one bad frame) before
        // shedding the lines, so the mesh renders consistently on capable devices.
        if (!lite && performance.now() > introUntil + 800) {
          if (frameEMA > 32) { if (++slowRun > 45) lite = true; }
          else slowRun = 0;
        }
      }
    }
    lastTs = ts;
    draw();
    rafId = requestAnimationFrame(loop);
  }
  function start() {
    if (!rafId && running && onScreen && !reduce) { lastTs = 0; rafId = requestAnimationFrame(loop); }
  }

  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
  // Keep the cached canvas rect correct as the hero scrolls, so the pointer
  // mapping stays accurate without forcing a reflow on every mousemove.
  window.addEventListener("scroll", () => { rect = canvas.getBoundingClientRect(); }, { passive: true });

  // Stop animating when the hero is scrolled out of view; resume on return.
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((ents) => {
      onScreen = ents[0].isIntersecting;
      if (onScreen) start(); // the loop self-stops once onScreen is false
    }, { threshold: 0 }).observe(canvas);
  }

  resize();
  if (reduce) { globalA = 1; particles.forEach((p) => (p.a = 1)); draw(); }
  else start();
})();
