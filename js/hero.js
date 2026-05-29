/* Interactive hero canvas — particle field + growth curve + reactive bars.
   Reacts to cursor; degrades to a calm auto-animation without a pointer. */
(function () {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const BLUE = "0, 88, 168";
  const GREEN = "0, 128, 64";
  const GREEN_SOFT = "46, 158, 91";

  let W = 0, H = 0, DPR = 1;
  let particles = [];
  let bars = [];
  const pointer = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false };
  let t = 0;
  let running = true;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    W = rect.width;
    H = rect.height;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    initParticles();
    initBars();
  }

  function initParticles() {
    const count = Math.round(Math.min(110, Math.max(40, (W * H) / 16000)));
    particles = [];
    for (let i = 0; i < count; i++) {
      const green = Math.random() > 0.5;
      particles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 2 + 1,
        c: green ? GREEN_SOFT : BLUE,
      });
    }
  }

  function initBars() {
    const n = Math.max(10, Math.round(W / 70));
    bars = [];
    for (let i = 0; i < n; i++) bars.push({ h: 0, base: 0.15 + Math.random() * 0.25 });
  }

  function pointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    pointer.tx = p.clientX - rect.left;
    pointer.ty = p.clientY - rect.top;
    pointer.active = true;
  }
  function pointerLeave() {
    pointer.active = false;
    pointer.tx = -9999;
    pointer.ty = -9999;
  }
  window.addEventListener("mousemove", pointerMove, { passive: true });
  window.addEventListener("touchmove", pointerMove, { passive: true });
  window.addEventListener("mouseout", (e) => { if (!e.relatedTarget) pointerLeave(); });
  document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) loop(); });

  function draw() {
    t += 0.01;
    ctx.clearRect(0, 0, W, H);

    // smooth pointer
    if (pointer.tx < -1000) { pointer.x = -9999; pointer.y = -9999; }
    else {
      pointer.x += (pointer.tx - pointer.x) * 0.12;
      pointer.y += (pointer.ty - pointer.y) * 0.12;
    }
    // idle drift point when no pointer (gentle life)
    const idleX = W * (0.5 + 0.32 * Math.sin(t * 0.5));
    const idleY = H * (0.45 + 0.18 * Math.cos(t * 0.4));
    const fx = pointer.active ? pointer.x : idleX;
    const fy = pointer.active ? pointer.y : idleY;

    // ---- reactive equalizer bars along the bottom ----
    const bw = W / bars.length;
    for (let i = 0; i < bars.length; i++) {
      const cx = i * bw + bw / 2;
      const wave = 0.16 * (0.5 + 0.5 * Math.sin(t * 1.6 + i * 0.5));
      const dist = Math.abs(cx - fx);
      const boost = Math.max(0, 1 - dist / (W * 0.22));
      const target = bars[i].base + wave + boost * 0.55;
      bars[i].h += (target - bars[i].h) * 0.12;
      const bh = bars[i].h * H * 0.6;
      const g = ctx.createLinearGradient(0, H, 0, H - bh);
      const mix = boost;
      g.addColorStop(0, `rgba(${GREEN}, ${0.10 + mix * 0.18})`);
      g.addColorStop(1, `rgba(${mix > 0.4 ? BLUE : GREEN_SOFT}, ${0.22 + mix * 0.4})`);
      ctx.fillStyle = g;
      const w = bw * 0.5;
      roundRect(ctx, cx - w / 2, H - bh, w, bh, w / 2);
      ctx.fill();
    }

    // ---- growth trend line influenced by pointer ----
    drawTrend(fx, fy);

    // ---- particles + links ----
    for (const p of particles) {
      // drift
      p.x += p.vx;
      p.y += p.vy;
      // wrap
      if (p.x < -20) p.x = W + 20; if (p.x > W + 20) p.x = -20;
      if (p.y < -20) p.y = H + 20; if (p.y > H + 20) p.y = -20;
      // pointer gravity
      const dx = fx - p.x, dy = fy - p.y;
      const d = Math.hypot(dx, dy);
      if (d < 170 && d > 0.1) {
        const pull = ((170 - d) / 170) * (pointer.active ? 0.06 : 0.02);
        p.x += (dx / d) * pull * 6;
        p.y += (dy / d) * pull * 6;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.c}, 0.55)`;
      ctx.fill();
    }

    // links between near particles
    for (let i = 0; i < particles.length; i++) {
      const a = particles[i];
      for (let j = i + 1; j < particles.length; j++) {
        const b = particles[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 14000) {
          const o = (1 - d2 / 14000) * 0.4;
          ctx.strokeStyle = `rgba(${BLUE}, ${o})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      // link to pointer
      const dxp = a.x - fx, dyp = a.y - fy;
      const dp2 = dxp * dxp + dyp * dyp;
      if (dp2 < 30000) {
        const o = (1 - dp2 / 30000) * 0.6;
        ctx.strokeStyle = `rgba(${GREEN}, ${o})`;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(fx, fy);
        ctx.stroke();
      }
    }

    // glowing cursor node
    if (fx > -1000) {
      const rg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 26);
      rg.addColorStop(0, `rgba(${GREEN_SOFT}, 0.5)`);
      rg.addColorStop(1, `rgba(${GREEN_SOFT}, 0)`);
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(fx, fy, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(${BLUE}, 0.9)`;
      ctx.beginPath();
      ctx.arc(fx, fy, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTrend(fx, fy) {
    const baseY = H * 0.62;
    const amp = H * 0.12;
    const steps = 60;
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const x = (i / steps) * W;
      let y = baseY - Math.sin(i * 0.18 + t * 1.1) * amp * 0.4 - (i / steps) * H * 0.18;
      // bend toward pointer
      const infl = Math.max(0, 1 - Math.abs(x - fx) / (W * 0.3));
      y -= infl * (baseY - fy) * 0.45;
      pts.push([x, y]);
    }
    // area fill
    ctx.beginPath();
    ctx.moveTo(0, H);
    pts.forEach((p) => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(W, H);
    ctx.closePath();
    const fg = ctx.createLinearGradient(0, H * 0.2, 0, H);
    fg.addColorStop(0, `rgba(${BLUE}, 0.10)`);
    fg.addColorStop(1, `rgba(${BLUE}, 0)`);
    ctx.fillStyle = fg;
    ctx.fill();
    // stroke
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    const sg = ctx.createLinearGradient(0, 0, W, 0);
    sg.addColorStop(0, `rgba(${BLUE}, 0.7)`);
    sg.addColorStop(1, `rgba(${GREEN}, 0.85)`);
    ctx.strokeStyle = sg;
    ctx.lineWidth = 2.4;
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function roundRect(c, x, y, w, h, r) {
    if (h < 0) { h = 0; }
    r = Math.min(r, w / 2, h / 2 || r);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function loop() {
    if (!running) return;
    draw();
    requestAnimationFrame(loop);
  }

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  resize();
  if (reduce) { draw(); } else { loop(); }
})();
