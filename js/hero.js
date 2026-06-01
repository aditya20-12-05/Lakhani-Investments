/* Interactive intro — cursor-built logo constellation.
   Particles drift as dust; as the cursor nears the centre they assemble into
   the Lakhani mark (ascending bars + rising arrow), then dissolve when it
   leaves. Auto-assembles once on load, and breathes gently without a pointer. */
(function () {
  const canvas = document.getElementById("logo-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const C = {
    bar1: "141,181,160", // #8db5a0
    bar2: "46,158,91",   // #2e9e5b
    bar3: "0,128,64",    // #008040
    bar4: "0,102,58",    // #00663a
    blue: "0,88,168",    // #0058a8
  };

  let W = 0, H = 0, DPR = 1;
  let particles = [];
  let targets = [];
  let pairs = [];
  let scale = 1;
  const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false };
  let t = 0;
  let globalA = 0;
  let introUntil = performance.now() + 2600; // hold the logo briefly on load
  let running = true;

  const smooth = (x) => x * x * (3 - 2 * x);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ----- build target points from the logo geometry (normalised space) -----
  function buildModel() {
    const m = [];
    const baseY = 64, step = 4;
    function bar(x0, w, topY, color) {
      for (let yy = topY; yy <= baseY; yy += step)
        for (let xx = x0; xx <= x0 + w; xx += step) m.push({ nx: xx, ny: yy, color });
    }
    bar(6, 14, 40, C.bar1);
    bar(24, 14, 30, C.bar2);
    bar(42, 14, 20, C.bar3);
    bar(60, 14, 12, C.bar4);
    // rising arrow polyline + arrowhead
    const segs = [
      [[4, 38], [20, 20]], [[20, 20], [30, 28]], [[30, 28], [52, 6]],
      [[52, 6], [42, 8]], [[52, 6], [50, 19]],
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
    scale = box / 78;
    const cx = W / 2, cy = H * 0.43;
    targets = MODEL.map((p) => ({
      x: cx + (p.nx - 39) * scale,
      y: cy + (p.ny - 35) * scale,
      color: p.color,
    }));
    // line pairs between neighbouring target points (drawn when assembled).
    // Only join points of the same colour so the four bars and the arrow read
    // as distinct shapes instead of merging into one mesh.
    pairs = [];
    const TH = (scale * 5.2) ** 2;
    for (let i = 0; i < targets.length; i++) {
      let made = 0;
      for (let j = i + 1; j < targets.length && made < 3; j++) {
        if (targets[i].color !== targets[j].color) continue;
        const dx = targets[i].x - targets[j].x, dy = targets[i].y - targets[j].y;
        if (dx * dx + dy * dy < TH) { pairs.push([i, j, targets[i].color]); made++; }
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
        a: 0, ease: 0.03 + Math.random() * 0.05, r: Math.random() * 1.4 + 1.1,
      });
    }
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    W = rect.width; H = rect.height;
    canvas.width = W * DPR; canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    layout();
  }

  function move(e) {
    const rect = canvas.getBoundingClientRect();
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
  // lifts — otherwise the mark stays frozen at the last touch point and the
  // gentle idle breathing never resumes.
  window.addEventListener("touchend", leave, { passive: true });
  window.addEventListener("touchcancel", leave, { passive: true });
  window.addEventListener("mouseout", (e) => { if (!e.relatedTarget) leave(); });
  document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) loop(); });

  function draw() {
    t += 0.01;
    ctx.clearRect(0, 0, W, H);

    if (pointer.tx < -1000) { pointer.x = -9999; pointer.y = -9999; }
    else { pointer.x += (pointer.tx - pointer.x) * 0.14; pointer.y += (pointer.ty - pointer.y) * 0.14; }

    // assemble factor
    const cx = W / 2, cy = H * 0.43;
    let aTarget;
    if (performance.now() < introUntil) {
      aTarget = 1;
    } else if (pointer.active) {
      const d = Math.hypot(pointer.x - cx, pointer.y - cy);
      const maxR = Math.min(W, H) * 0.62;
      aTarget = clamp(1 - d / maxR, 0, 1);
      aTarget = Math.pow(aTarget, 0.75);
    } else {
      // Idle: mostly drifting dust with a faint, periodic bloom that hints at
      // the mark without fully forming it — keeps the cursor reveal special.
      const s = 0.5 + 0.5 * Math.sin(t * 0.9 - 1.2);
      aTarget = 0.08 + 0.34 * (s * s);
    }
    globalA += (aTarget - globalA) * 0.06;

    // connecting lines (logo wireframe) — fade in with assembly
    if (globalA > 0.05) {
      ctx.lineWidth = 1;
      for (const [i, j, col] of pairs) {
        const a = particles[i], b = particles[j];
        const ax = a.px, ay = a.py, bx = b.px, by = b.py;
        if (ax === undefined) continue;
        // Only wire points once they are genuinely near their targets, so the
        // mesh appears as the clean logo forms — never as a tangle of long
        // lines while the particles are still scattered in transit.
        const m = Math.min(a.a, b.a);
        if (m < 0.6) continue;
        const o = globalA * 0.5 * ((m - 0.6) / 0.4);
        if (o < 0.02) continue;
        ctx.strokeStyle = `rgba(${col}, ${o})`;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
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
      const rg = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 90);
      rg.addColorStop(0, `rgba(${C.bar2}, 0.16)`);
      rg.addColorStop(1, `rgba(${C.bar2}, 0)`);
      ctx.fillStyle = rg;
      ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 90, 0, Math.PI * 2); ctx.fill();
    }
  }

  function loop() { if (!running) return; draw(); requestAnimationFrame(loop); }

  let rt;
  window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(resize, 150); });

  resize();
  if (reduce) { globalA = 1; particles.forEach((p) => (p.a = 1)); draw(); }
  else loop();
})();
