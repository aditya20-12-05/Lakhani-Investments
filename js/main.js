/* Scroll behaviours: sticky header, progress bar, reveals, counters. */
(function () {
  const header = document.getElementById("siteHeader");
  const progress = document.getElementById("progress");

  function onScroll() {
    const y = window.scrollY;
    if (header) header.classList.toggle("scrolled", y > 30);
    if (progress) {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      progress.style.width = (max > 0 ? (y / max) * 100 : 0) + "%";
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // reveal on scroll
  const reveals = document.querySelectorAll(".reveal, .reveal-x");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    reveals.forEach((el) => io.observe(el));
  } else {
    reveals.forEach((el) => el.classList.add("in"));
  }

  // animated counters
  const counters = document.querySelectorAll("[data-count]");
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  function runCounter(el) {
    const target = parseFloat(el.dataset.count);
    const decimals = (el.dataset.count.split(".")[1] || "").length;
    const useGrouping = el.dataset.group !== "false";
    const fmt = { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping };
    const dur = 1700;
    const start = performance.now();
    function frame(now) {
      const p = Math.min((now - start) / dur, 1);
      const val = target * easeOut(p);
      el.textContent = val.toLocaleString("en-IN", fmt);
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = target.toLocaleString("en-IN", fmt);
    }
    requestAnimationFrame(frame);
  }
  if ("IntersectionObserver" in window && counters.length) {
    const cio = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            runCounter(e.target);
            cio.unobserve(e.target);
          }
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((c) => cio.observe(c));
  } else {
    counters.forEach((c) => (c.textContent = c.dataset.count));
  }

  // subtle parallax for elements with data-parallax
  const px = document.querySelectorAll("[data-parallax]");
  if (px.length && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    window.addEventListener(
      "scroll",
      () => {
        const vh = window.innerHeight;
        px.forEach((el) => {
          const r = el.getBoundingClientRect();
          const mid = r.top + r.height / 2 - vh / 2;
          const speed = parseFloat(el.dataset.parallax) || 0.08;
          el.style.transform = `translateY(${(-mid * speed).toFixed(1)}px)`;
        });
      },
      { passive: true }
    );
  }
})();
