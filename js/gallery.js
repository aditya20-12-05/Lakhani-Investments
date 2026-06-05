/* ============================================================
   GALLERY ENGINE  ·  "Step inside the gallery"
   ------------------------------------------------------------
   One master collection drives three views:
     1. a pinned, spotlit horizontal corridor (Gallery I)
     2. a justified masonry of everything (Gallery II)
     3. a viewing-room lightbox shared by both
   Self-contained: its own reveal observer, image fade-in,
   floating cursor and lightbox. Degrades to plain swipe
   scrolling on touch / reduced motion (handled in CSS).
   ============================================================ */
(function () {
  "use strict";

  const track  = document.getElementById("exhibitTrack");
  const mosaic = document.getElementById("mosaic");
  if (!track || !mosaic) return; // not the gallery page

  const exhibit = document.getElementById("exhibit");
  const bar     = document.getElementById("exhibitBar");
  const viewport = exhibit ? exhibit.querySelector(".exhibit-viewport") : null;

  const fine   = window.matchMedia("(hover:hover) and (pointer:fine)").matches;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const photo = (seed, w, h) => `https://picsum.photos/seed/${seed}/${w}/${h}`;

  /* ---- the collection -------------------------------------
     Placard text stays factual: it describes the picture and
     stays grounded in the firm's own facts (Rajula since 1987,
     Ahmedabad branch, no minimum to begin, the three pillars,
     the four services). No invented marketing copy.            */
  const DATA = [
    { seed: "lk-team-desk",  w: 825,  h: 1100, tag: "Our team",            title: "The advisory team",       year: "Rajula, 2024", note: "The people you meet across the desk.",                 wall: true  },
    { seed: "lk-office-raj", w: 1100, h: 733,  tag: "The office",          title: "The Rajula office",       year: "Est. 1987",    note: "Where the firm has worked from the start.",            wall: true  },
    { seed: "lk-meeting-1",  w: 1100, h: 733,  tag: "Across the desk",     title: "A planning conversation", year: "2024",         note: "Mapping the year ahead with a family.",                wall: true  },
    { seed: "lk-amd-branch", w: 825,  h: 1100, tag: "The office",          title: "The Ahmedabad branch",    year: "2019",         note: "A second home, closer to more families.",              wall: true  },
    { seed: "lk-milestone",  w: 1000, h: 1000, tag: "Milestone",           title: "Thirty-five years",       year: "2022",         note: "Decades of work with the families we serve.",          wall: true  },
    { seed: "lk-ledger",     w: 760,  h: 1140, tag: "The work",            title: "The books, by hand",      year: "2023",         note: "Statements and filings, checked line by line.",        wall: true  },
    { seed: "lk-team-morn",  w: 1100, h: 620,  tag: "Our team",            title: "A morning at the office", year: "2024",         note: "Before the doors open.",                               wall: false },
    { seed: "lk-community",  w: 1100, h: 733,  tag: "Community",           title: "In the community",        year: "2023",         note: "On the ground in Rajula.",                             wall: true  },
    { seed: "lk-firstmeet",  w: 1000, h: 1000, tag: "Across the desk",     title: "A first meeting",         year: "2024",         note: "No minimum to begin.",                                 wall: false },
    { seed: "lk-succession", w: 825,  h: 1100, tag: "The work",            title: "Planning the handover",   year: "2023",         note: "Passing wealth cleanly to the next generation.",       wall: true  },
    { seed: "lk-nameplate",  w: 1100, h: 733,  tag: "The office",          title: "The nameplate",           year: "Est. 1987",    note: "Lakhani Investment, Rajula.",                          wall: false },
    { seed: "lk-portfolio",  w: 1100, h: 733,  tag: "Our team",            title: "Working through a book",   year: "2024",         note: "Reviewing investments together.",                      wall: false },
    { seed: "lk-rajula",     w: 1100, h: 620,  tag: "Rooted here",         title: "Rajula, Gujarat",         year: "",             note: "The town the firm calls home.",                        wall: true  },
    { seed: "lk-family-3g",  w: 825,  h: 1100, tag: "The families we serve", title: "Three generations",     year: "2024",         note: "Creation, preservation and transfer of wealth.",       wall: false },
    { seed: "lk-insurance",  w: 1000, h: 1000, tag: "The work",            title: "Cover for what matters",  year: "2023",         note: "Protecting families against the unexpected.",          wall: false },
    { seed: "lk-taxation",   w: 1100, h: 733,  tag: "The work",            title: "Filing season",          year: "2024",         note: "Taxation handled, start to finish.",                   wall: false }
  ];

  const cornerArr = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';

  /* ---- image fade-in --------------------------------------- */
  function fadeIn(img) {
    if (img.complete && img.naturalWidth) { img.classList.add("is-loaded"); return; }
    img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
    img.addEventListener("error", () => img.classList.add("is-loaded"), { once: true });
  }

  /* ---- render Gallery I: the long wall --------------------- */
  const hangs = ["0px", "28px", "-24px", "14px", "-32px", "20px", "-12px"];
  const heights = ["60vh", "66vh", "54vh", "62vh", "56vh", "64vh"];

  DATA.forEach((d, i) => {
    if (!d.wall) return;
    const aspect = (d.w / d.h).toFixed(4);
    const frame = document.createElement("button");
    frame.type = "button";
    frame.className = "frame";
    frame.dataset.i = i;
    frame.style.setProperty("--oy", hangs[i % hangs.length]);
    frame.style.setProperty("--fh", heights[i % heights.length]);
    frame.setAttribute("aria-label", `View: ${d.title}`);
    frame.innerHTML =
      '<span class="frame-glow" aria-hidden="true"></span>' +
      '<span class="frame-mat">' +
        `<img class="frame-img" alt="${d.title}, ${d.tag}" loading="lazy" decoding="async" ` +
        `style="width:calc(var(--fh) * ${aspect})" src="${photo(d.seed, d.w, d.h)}">` +
      '</span>' +
      '<span class="frame-plate">' +
        `<span class="fp-tag">${d.tag}</span>` +
        `<span class="fp-title">${d.title}</span>` +
        `<span class="fp-meta">${d.year || "Lakhani Investment"}</span>` +
      '</span>';
    track.appendChild(frame);
    fadeIn(frame.querySelector("img"));
  });

  /* ---- render Gallery II: the collection (all of it) ------- */
  DATA.forEach((d, i) => {
    const piece = document.createElement("button");
    piece.type = "button";
    piece.className = "piece";
    piece.dataset.i = i;
    piece.style.transitionDelay = (i % 4) * 60 + "ms";
    piece.setAttribute("aria-label", `View: ${d.title}`);
    piece.innerHTML =
      `<img class="piece-img" alt="${d.title}, ${d.tag}" loading="lazy" decoding="async" ` +
      `src="${photo(d.seed, d.w, d.h)}" width="${d.w}" height="${d.h}">` +
      '<span class="piece-veil" aria-hidden="true"></span>' +
      `<span class="piece-corner" aria-hidden="true">${cornerArr}</span>` +
      '<span class="piece-cap">' +
        `<span class="pc-tag">${d.tag}</span>` +
        `<span class="pc-title">${d.title}</span>` +
        (d.year ? `<span class="pc-year">${d.year}</span>` : "") +
      '</span>';
    mosaic.appendChild(piece);
    fadeIn(piece.querySelector("img"));
  });

  /* ---- self-contained reveal for the mosaic ---------------- */
  const pieces = Array.from(mosaic.querySelectorAll(".piece"));
  if (reduce || !("IntersectionObserver" in window)) {
    pieces.forEach((p) => p.classList.add("in"));
  } else {
    const io = new IntersectionObserver((entries, obs) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); obs.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 });
    pieces.forEach((p) => io.observe(p));
  }

  /* ---- pinned horizontal corridor -------------------------- */
  let pinned = fine && !reduce && exhibit && viewport;
  let extra = 0;

  function recalc() {
    if (!pinned) return;
    extra = Math.max(0, track.scrollWidth - viewport.clientWidth);
    exhibit.style.height = (window.innerHeight + extra) + "px";
    paint();
  }

  function paint() {
    if (!pinned) return;
    const total = exhibit.offsetHeight - window.innerHeight;
    if (total <= 0 || extra <= 0) {
      track.style.transform = "translateX(0)";
      if (bar) bar.style.width = "0%";
      return;
    }
    const p = clamp(-exhibit.getBoundingClientRect().top / total, 0, 1);
    track.style.transform = "translateX(" + (-(p * extra)).toFixed(2) + "px)";
    if (bar) bar.style.width = (p * 100).toFixed(2) + "%";
  }

  if (pinned) {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => { paint(); ticking = false; });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", recalc);
    window.addEventListener("load", recalc); // after all images settle
    // images grow the track as they load
    track.querySelectorAll("img").forEach((img) => {
      if (!img.complete) img.addEventListener("load", recalc, { once: true });
    });
    recalc();
    setTimeout(recalc, 400); // settle webfonts / late layout
  }

  /* ---- floating "View" cursor ------------------------------ */
  if (fine && !reduce) {
    const cur = document.createElement("div");
    cur.className = "gal-cursor";
    cur.textContent = "View";
    document.body.appendChild(cur);
    let raf = 0, x = 0, y = 0;
    document.addEventListener("mousemove", (e) => {
      const hit = e.target.closest(".piece, .frame");
      if (hit && !document.body.classList.contains("modal-open")) {
        x = e.clientX; y = e.clientY;
        cur.classList.add("show");
        if (!raf) raf = requestAnimationFrame(() => {
          cur.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) scale(1)`;
          raf = 0;
        });
      } else {
        cur.classList.remove("show");
      }
    }, { passive: true });
    document.addEventListener("mouseleave", () => cur.classList.remove("show"));
  }

  /* ---- viewing-room lightbox ------------------------------- */
  const svgPrev  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  const svgNext  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  const svgClose = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  const lb = document.createElement("div");
  lb.className = "lightbox";
  lb.setAttribute("role", "dialog");
  lb.setAttribute("aria-modal", "true");
  lb.setAttribute("aria-label", "Gallery viewer");
  lb.setAttribute("aria-hidden", "true");
  lb.innerHTML =
    `<button class="lb-btn lb-close" type="button" aria-label="Close viewer">${svgClose}</button>` +
    `<button class="lb-btn lb-prev" type="button" aria-label="Previous picture">${svgPrev}</button>` +
    `<button class="lb-btn lb-next" type="button" aria-label="Next picture">${svgNext}</button>` +
    '<div class="lb-stage">' +
      '<div class="lb-figure"><img class="lb-img" alt=""></div>' +
      '<div class="lb-cap">' +
        '<span class="lb-tag"></span>' +
        '<h3 class="lb-title"></h3>' +
        '<p class="lb-note"></p>' +
        '<span class="lb-count"></span>' +
      '</div>' +
    '</div>';
  document.body.appendChild(lb);

  const lbImg   = lb.querySelector(".lb-img");
  const lbTag   = lb.querySelector(".lb-tag");
  const lbTitle = lb.querySelector(".lb-title");
  const lbNote  = lb.querySelector(".lb-note");
  const lbCount = lb.querySelector(".lb-count");
  const btnPrev = lb.querySelector(".lb-prev");
  const btnNext = lb.querySelector(".lb-next");
  const btnClose = lb.querySelector(".lb-close");

  let current = 0;
  let lastFocus = null;

  function show(i) {
    current = (i + DATA.length) % DATA.length;
    const d = DATA[current];
    lbImg.classList.remove("is-loaded");
    lbImg.alt = `${d.title}, ${d.tag}`;
    lbImg.src = photo(d.seed, d.w, d.h);
    if (lbImg.complete && lbImg.naturalWidth) lbImg.classList.add("is-loaded");
    else lbImg.addEventListener("load", () => lbImg.classList.add("is-loaded"), { once: true });
    lbTag.textContent = d.tag;
    lbTitle.textContent = d.title;
    lbNote.textContent = d.note + (d.year ? "  ·  " + d.year : "");
    lbCount.textContent = (current + 1) + " / " + DATA.length;
  }

  function open(i, trigger) {
    lastFocus = trigger || null;
    show(i);
    lb.classList.add("open");
    lb.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    btnClose.focus();
  }

  function close() {
    lb.classList.remove("open");
    lb.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    if (lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
  }

  const next = () => show(current + 1);
  const prev = () => show(current - 1);

  btnNext.addEventListener("click", next);
  btnPrev.addEventListener("click", prev);
  btnClose.addEventListener("click", close);

  // backdrop / empty-stage click closes; image, caption and buttons do not
  lb.addEventListener("click", (e) => {
    if (!e.target.closest(".lb-img, .lb-cap, .lb-btn")) close();
  });

  document.addEventListener("keydown", (e) => {
    if (!lb.classList.contains("open")) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowRight") next();
    else if (e.key === "ArrowLeft") prev();
  });

  // touch swipe inside the stage
  let tx = 0, ty = 0;
  lb.addEventListener("touchstart", (e) => {
    tx = e.changedTouches[0].clientX; ty = e.changedTouches[0].clientY;
  }, { passive: true });
  lb.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? next : prev)();
  }, { passive: true });

  // open from any frame or piece (event delegation)
  function bindOpen(container) {
    container.addEventListener("click", (e) => {
      const el = e.target.closest("[data-i]");
      if (!el) return;
      open(parseInt(el.dataset.i, 10), el);
    });
  }
  bindOpen(track);
  bindOpen(mosaic);
})();
