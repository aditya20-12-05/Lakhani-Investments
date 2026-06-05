/* Gallery, streaming-library interface.
   A welcoming billboard carousel rotates through collections at the
   top, then the page shows every collection as a poster ("show").
   Episodes live inside a show: opening a collection reveals its
   description and episode list; playing an episode opens a fullscreen
   viewer. Vanilla JS, no dependencies. */
(function () {
  "use strict";

  const bb = document.getElementById("billboard");
  const shelfGrid = document.getElementById("shelfGrid");
  if (!bb || !shelfGrid) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const photo = (seed, w, h) =>
    `https://picsum.photos/seed/${seed}/${w}/${h}`;
  const pad2 = (n) => (n < 10 ? "0" + n : "" + n);
  const fadeIn = (img) => {
    const mark = () => img.classList.add("is-loaded");
    if (img.complete && img.naturalWidth) mark();
    else img.addEventListener("load", mark, { once: true });
  };
  const esc = (str) =>
    String(str).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );

  // icons
  const icoPlay = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
  const icoPrev = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  const icoNext = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
  const icoClose = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  // ---- data: 5 shows / 16 episodes, all 16:9 ----
  const SHOWS = [
    {
      title: "Our team",
      kicker: "The people",
      metaYear: "2024",
      backdropSeed: "lk-team-desk",
      synopsis:
        "The people you meet across the desk. Advisers who have guided families in Rajula since 1987, and who you keep seeing year after year.",
      episodes: [
        { seed: "lk-team-desk", w: 1280, h: 720, title: "The advisory team", year: "Rajula, 2024", note: "The people you meet across the desk." },
        { seed: "lk-team-morn", w: 1280, h: 720, title: "A morning at the office", year: "2024", note: "Before the doors open." },
        { seed: "lk-portfolio", w: 1280, h: 720, title: "Working through a book", year: "2024", note: "Reviewing investments together." },
      ],
    },
    {
      title: "The offices",
      kicker: "Since 1987",
      metaYear: "Est. 1987",
      backdropSeed: "lk-office-raj",
      synopsis:
        "Where the work happens. Rajula since 1987, and a second home in Ahmedabad since 2019, both built for families to feel at ease.",
      episodes: [
        { seed: "lk-office-raj", w: 1280, h: 720, title: "The Rajula office", year: "Est. 1987", note: "Where the firm has worked from the start." },
        { seed: "lk-amd-branch", w: 1280, h: 720, title: "The Ahmedabad branch", year: "2019", note: "A second home, closer to more families." },
        { seed: "lk-nameplate", w: 1280, h: 720, title: "The nameplate", year: "Est. 1987", note: "Lakhani Investment, Rajula." },
      ],
    },
    {
      title: "Across the desk",
      kicker: "Planning together",
      metaYear: "2024",
      backdropSeed: "lk-meeting-1",
      synopsis:
        "Planning conversations with the families we serve. From a first meeting, with no minimum to begin, to mapping the years ahead.",
      episodes: [
        { seed: "lk-meeting-1", w: 1280, h: 720, title: "A planning conversation", year: "2024", note: "Mapping the year ahead with a family." },
        { seed: "lk-firstmeet", w: 1280, h: 720, title: "A first meeting", year: "2024", note: "No minimum to begin." },
        { seed: "lk-family-3g", w: 1280, h: 720, title: "Three generations", year: "2024", note: "Creation, preservation and transfer of wealth." },
      ],
    },
    {
      title: "The work",
      kicker: "What we do",
      metaYear: "2024",
      backdropSeed: "lk-ledger",
      synopsis:
        "Investments, insurance, taxation and succession, handled start to finish and checked line by line.",
      episodes: [
        { seed: "lk-ledger", w: 1280, h: 720, title: "The books, by hand", year: "2023", note: "Statements and filings, checked line by line." },
        { seed: "lk-insurance", w: 1280, h: 720, title: "Cover for what matters", year: "2023", note: "Protecting families against the unexpected." },
        { seed: "lk-taxation", w: 1280, h: 720, title: "Filing season", year: "2024", note: "Taxation handled, start to finish." },
        { seed: "lk-succession", w: 1280, h: 720, title: "Planning the handover", year: "2023", note: "Passing wealth cleanly to the next generation." },
      ],
    },
    {
      title: "Rooted in Rajula",
      kicker: "Where we belong",
      metaYear: "Since 1987",
      backdropSeed: "lk-rajula",
      synopsis:
        "The town we call home, the community around us, and the milestones that mark four decades of trust.",
      episodes: [
        { seed: "lk-rajula", w: 1280, h: 720, title: "Rajula, Gujarat", year: "", note: "The town the firm calls home." },
        { seed: "lk-community", w: 1280, h: 720, title: "In the community", year: "2023", note: "On the ground in Rajula." },
        { seed: "lk-milestone", w: 1280, h: 720, title: "Thirty-five years", year: "2022", note: "Decades of work with the families we serve." },
      ],
    },
  ];

  // ===========================================================
  //  Billboard carousel
  // ===========================================================
  const imgA = document.getElementById("bbImgA");
  const imgB = document.getElementById("bbImgB");
  const bbKicker = document.getElementById("bbKicker");
  const bbTitle = document.getElementById("bbTitle");
  const bbOverview = document.getElementById("bbOverview");
  const bbMeta = document.getElementById("bbMeta");
  const bbCopy = document.getElementById("bbCopy");
  const bbDots = document.getElementById("bbDots");
  const bbPrev = document.getElementById("bbPrev");
  const bbNext = document.getElementById("bbNext");
  const bbPlay = document.getElementById("bbPlay");
  const bbInfo = document.getElementById("bbInfo");

  let current = 0;
  let frontImg = imgB; // first setSlide loads into imgA and shows it
  let timer = null;
  let hovering = false;

  function buildDots() {
    bbDots.innerHTML = "";
    SHOWS.forEach((s, i) => {
      const d = document.createElement("button");
      d.type = "button";
      d.className = "bb-dot";
      d.setAttribute("role", "tab");
      d.setAttribute("aria-label", s.title);
      d.addEventListener("click", () => goTo(i));
      bbDots.appendChild(d);
    });
  }

  function setSlide(i) {
    current = (i + SHOWS.length) % SHOWS.length;
    const s = SHOWS[current];
    bbKicker.textContent = s.kicker;
    bbTitle.textContent = s.title;
    bbOverview.textContent = s.synopsis;
    bbMeta.textContent = [
      s.metaYear,
      s.episodes.length + " episodes",
      "Lakhani Investment",
    ].join("  ·  ");

    [...bbDots.children].forEach((d, idx) => {
      const on = idx === current;
      d.classList.toggle("is-active", on);
      d.setAttribute("aria-selected", on ? "true" : "false");
    });

    // crossfade backdrop
    const back = frontImg === imgA ? imgB : imgA;
    back.src = photo(s.backdropSeed, 1600, 900);
    back.alt = s.title;
    const reveal = () => {
      back.classList.add("is-active");
      frontImg.classList.remove("is-active");
      frontImg = back;
    };
    if (back.complete && back.naturalWidth) reveal();
    else back.addEventListener("load", reveal, { once: true });

    // re-trigger copy animation
    bbCopy.classList.remove("is-in");
    void bbCopy.offsetWidth;
    bbCopy.classList.add("is-in");
  }

  function go(dir) { goTo(current + dir); }
  function goTo(i) { setSlide(i); restart(); }

  function autoOk() {
    return !reduce && !hovering && !document.hidden &&
      !document.body.classList.contains("modal-open");
  }
  function start() {
    if (reduce) return;
    stop();
    timer = setInterval(() => { if (autoOk()) setSlide(current + 1); }, 6500);
  }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function restart() { stop(); start(); }

  function initCarousel() {
    buildDots();
    setSlide(0);
    bbPrev.addEventListener("click", () => go(-1));
    bbNext.addEventListener("click", () => go(1));
    bbPlay.addEventListener("click", () => openViewer(current, 0));
    bbInfo.addEventListener("click", () => openModal(current));

    bb.addEventListener("mouseenter", () => { hovering = true; });
    bb.addEventListener("mouseleave", () => { hovering = false; });
    bb.addEventListener("focusin", () => { hovering = true; });
    bb.addEventListener("focusout", () => { hovering = false; });

    // swipe (touch)
    let x0 = null;
    bb.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    bb.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      x0 = null;
    }, { passive: true });

    start();
  }

  // ===========================================================
  //  Shelf: collections as posters
  // ===========================================================
  function renderShelf() {
    const count = document.getElementById("shelfCount");
    if (count) count.textContent = SHOWS.length + " collections";
    shelfGrid.innerHTML = SHOWS.map((s, i) => `
      <button class="show-card reveal" data-show="${i}" type="button"
              aria-label="Open collection: ${esc(s.title)}">
        <span class="sc-thumb">
          <img class="sc-img" src="${photo(s.backdropSeed, 800, 450)}" alt="" loading="lazy" decoding="async" />
          <span class="sc-grad" aria-hidden="true"></span>
          <span class="sc-cta" aria-hidden="true">View collection ›</span>
          <span class="sc-body">
            <span class="sc-kicker">${esc(s.kicker)}</span>
            <span class="sc-name">${esc(s.title)}</span>
            <span class="sc-meta">${s.episodes.length} episodes</span>
          </span>
        </span>
      </button>`).join("");

    shelfGrid.querySelectorAll(".sc-img").forEach(fadeIn);
    shelfGrid.addEventListener("click", (e) => {
      const card = e.target.closest(".show-card");
      if (card) openModal(+card.dataset.show);
    });
    revealCards();
  }

  function revealCards() {
    const items = shelfGrid.querySelectorAll(".show-card");
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add("in");
            io.unobserve(en.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    items.forEach((el) => io.observe(el));
  }

  // ===========================================================
  //  Title (show) modal: description + episode list
  // ===========================================================
  let smodal, smBack, smKicker, smTitle, smPlay, smMeta, smSynopsis, smList,
    smEpsShow, lastFocus;

  function buildModal() {
    smodal = document.createElement("div");
    smodal.className = "smodal";
    smodal.setAttribute("role", "dialog");
    smodal.setAttribute("aria-modal", "true");
    smodal.setAttribute("aria-label", "Collection details");
    smodal.innerHTML = `
      <div class="smodal-scrim" data-close></div>
      <div class="smodal-card">
        <button class="smodal-x" type="button" aria-label="Close">${icoClose}</button>
        <div class="smodal-hero">
          <img class="smodal-back" alt="" decoding="async" />
          <div class="smodal-fade" aria-hidden="true"></div>
          <div class="smodal-head">
            <span class="sm-kicker"></span>
            <h2 class="sm-title"></h2>
            <div class="sm-actions">
              <button class="sm-play" type="button">${icoPlay} Play</button>
            </div>
          </div>
        </div>
        <div class="smodal-body">
          <p class="sm-meta"></p>
          <p class="sm-synopsis"></p>
          <div class="sm-eps-head">
            <h3>Episodes</h3>
            <span class="sm-eps-show"></span>
          </div>
          <ul class="sm-list"></ul>
        </div>
      </div>`;
    document.body.appendChild(smodal);

    smBack = smodal.querySelector(".smodal-back");
    smKicker = smodal.querySelector(".sm-kicker");
    smTitle = smodal.querySelector(".sm-title");
    smPlay = smodal.querySelector(".sm-play");
    smMeta = smodal.querySelector(".sm-meta");
    smSynopsis = smodal.querySelector(".sm-synopsis");
    smList = smodal.querySelector(".sm-list");
    smEpsShow = smodal.querySelector(".sm-eps-show");

    smodal.querySelector(".smodal-x").addEventListener("click", closeModal);
    smodal.querySelector("[data-close]").addEventListener("click", closeModal);
    smList.addEventListener("click", (e) => {
      const it = e.target.closest(".eitem");
      if (it) openViewer(+it.dataset.show, +it.dataset.ep);
    });
    smList.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const it = e.target.closest(".eitem");
      if (it) {
        e.preventDefault();
        openViewer(+it.dataset.show, +it.dataset.ep);
      }
    });
  }

  function openModal(si) {
    if (!smodal) buildModal();
    const s = SHOWS[si];
    smBack.classList.remove("is-loaded");
    smBack.src = photo(s.backdropSeed, 1280, 640);
    smBack.alt = s.title;
    fadeIn(smBack);
    smKicker.textContent = s.kicker;
    smTitle.textContent = s.title;
    smMeta.textContent = [s.metaYear, s.episodes.length + " episodes"].join(
      "  ·  "
    );
    smSynopsis.textContent = s.synopsis;
    smEpsShow.textContent = s.title;
    smPlay.onclick = () => openViewer(si, 0);

    smList.innerHTML = s.episodes
      .map((ep, ei) => `
          <li class="eitem" data-show="${si}" data-ep="${ei}" tabindex="0" role="button"
              aria-label="Play episode ${ei + 1}: ${esc(ep.title)}">
            <span class="ei-no">${pad2(ei + 1)}</span>
            <span class="ei-thumb">
              <img src="${photo(ep.seed, 320, 180)}" alt="" loading="lazy" decoding="async" />
              <span class="ei-play" aria-hidden="true">${icoPlay}</span>
            </span>
            <span class="ei-body">
              <span class="ei-top">
                <span class="ei-title">${esc(ep.title)}</span>
                ${ep.year ? `<span class="ei-year">${esc(ep.year)}</span>` : ""}
              </span>
              <span class="ei-note">${esc(ep.note)}</span>
            </span>
          </li>`)
      .join("");

    lastFocus = document.activeElement;
    smodal.classList.add("open");
    document.body.classList.add("modal-open");
    requestAnimationFrame(() => smodal.querySelector(".smodal-x").focus());
  }

  function closeModal() {
    if (!smodal) return;
    smodal.classList.remove("open");
    if (!lb || !lb.classList.contains("open"))
      document.body.classList.remove("modal-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // ===========================================================
  //  Fullscreen episode viewer (lightbox)
  // ===========================================================
  let lb, lbImg, lbTag, lbTitle, lbNote, lbCount, curShow = 0, curEp = 0,
    viewerReturnFocus;

  function buildViewer() {
    lb = document.createElement("div");
    lb.className = "lightbox";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Photo viewer");
    lb.innerHTML = `
      <button class="lb-btn lb-close" type="button" aria-label="Close">${icoClose}</button>
      <button class="lb-btn lb-prev" type="button" aria-label="Previous">${icoPrev}</button>
      <button class="lb-btn lb-next" type="button" aria-label="Next">${icoNext}</button>
      <div class="lb-stage">
        <figure class="lb-figure">
          <img class="lb-img" alt="" decoding="async" />
        </figure>
        <figcaption class="lb-cap">
          <span class="lb-tag"></span>
          <h2 class="lb-title"></h2>
          <p class="lb-note"></p>
          <span class="lb-count"></span>
        </figcaption>
      </div>`;
    document.body.appendChild(lb);

    lbImg = lb.querySelector(".lb-img");
    lbTag = lb.querySelector(".lb-tag");
    lbTitle = lb.querySelector(".lb-title");
    lbNote = lb.querySelector(".lb-note");
    lbCount = lb.querySelector(".lb-count");

    lb.querySelector(".lb-close").addEventListener("click", closeViewer);
    lb.querySelector(".lb-prev").addEventListener("click", () => stepEp(-1));
    lb.querySelector(".lb-next").addEventListener("click", () => stepEp(1));
    lb.addEventListener("click", (e) => {
      if (e.target === lb) closeViewer();
    });

    // swipe
    let x0 = null;
    lb.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener("touchend", (e) => {
      if (x0 === null) return;
      const dx = e.changedTouches[0].clientX - x0;
      if (Math.abs(dx) > 50) stepEp(dx < 0 ? 1 : -1);
      x0 = null;
    }, { passive: true });
  }

  function showEp(si, ei) {
    const s = SHOWS[si];
    const total = s.episodes.length;
    ei = (ei + total) % total;
    curShow = si;
    curEp = ei;
    const ep = s.episodes[ei];
    lbImg.classList.remove("is-loaded");
    lbImg.src = photo(ep.seed, ep.w, ep.h);
    lbImg.alt = ep.title;
    fadeIn(lbImg);
    lbTag.textContent = s.title;
    lbTitle.textContent = ep.title;
    lbNote.textContent = ep.year ? ep.note + "  ·  " + ep.year : ep.note;
    lbCount.textContent = "Episode " + (ei + 1) + " of " + total;
  }

  function stepEp(dir) { showEp(curShow, curEp + dir); }

  function openViewer(si, ei) {
    if (!lb) buildViewer();
    viewerReturnFocus = document.activeElement;
    showEp(si, ei);
    lb.classList.add("open");
    document.body.classList.add("modal-open");
    requestAnimationFrame(() => lb.querySelector(".lb-close").focus());
  }

  function closeViewer() {
    if (!lb) return;
    lb.classList.remove("open");
    if (!smodal || !smodal.classList.contains("open"))
      document.body.classList.remove("modal-open");
    if (viewerReturnFocus && viewerReturnFocus.focus) viewerReturnFocus.focus();
  }

  // ---- global keys ----
  document.addEventListener("keydown", (e) => {
    if (lb && lb.classList.contains("open")) {
      if (e.key === "Escape") closeViewer();
      else if (e.key === "ArrowRight") stepEp(1);
      else if (e.key === "ArrowLeft") stepEp(-1);
    } else if (smodal && smodal.classList.contains("open")) {
      if (e.key === "Escape") closeModal();
    }
  });

  // ===========================================================
  //  Boot
  // ===========================================================
  initCarousel();
  renderShelf();
})();
