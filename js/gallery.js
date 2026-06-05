/* Gallery, streaming-library interface.
   Each "show" is a category; each "episode" is a photo. A featured
   billboard sits up top, then horizontal rows of episode cards.
   Clicking a show opens a title modal with an episode list; clicking
   an episode opens a fullscreen viewer. Vanilla JS, no dependencies. */
(function () {
  "use strict";

  const rows = document.getElementById("rows");
  const bb = document.getElementById("billboard");
  if (!rows || !bb) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const photo = (seed, w, h) =>
    `https://picsum.photos/seed/${seed}/${w}/${h}`;
  const pad2 = (n) => (n < 10 ? "0" + n : "" + n);
  const fadeIn = (img) => {
    const mark = () => img.classList.add("is-loaded");
    if (img.complete && img.naturalWidth) mark();
    else img.addEventListener("load", mark, { once: true });
  };

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
  const FEATURED = 1;

  function esc(str) {
    return String(str).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
  }

  // ===========================================================
  //  Billboard
  // ===========================================================
  function setBillboard() {
    const s = SHOWS[FEATURED];
    const bbImg = document.getElementById("bbImg");
    bbImg.src = photo(s.backdropSeed, 1600, 900);
    bbImg.alt = s.title;
    fadeIn(bbImg);
    document.getElementById("bbTitle").textContent = s.title;
    document.getElementById("bbOverview").textContent = s.synopsis;
    document.getElementById("bbMeta").textContent = [
      s.metaYear,
      s.episodes.length + " episodes",
      "Lakhani Investment",
    ].join("  ·  ");
    document.getElementById("bbPlay").addEventListener("click", () =>
      openViewer(FEATURED, 0)
    );
    document.getElementById("bbInfo").addEventListener("click", () =>
      openModal(FEATURED)
    );
  }

  // ===========================================================
  //  Rows of shows
  // ===========================================================
  function renderRows() {
    const html = SHOWS.map((s, si) => {
      const cards = s.episodes
        .map((ep, ei) => {
          return `
            <button class="ep" data-show="${si}" data-ep="${ei}" type="button"
                    aria-label="Play: ${esc(ep.title)}">
              <span class="ep-thumb">
                <img class="ep-img" src="${photo(ep.seed, 640, 360)}" alt="" loading="lazy" decoding="async" />
                <span class="ep-grad" aria-hidden="true"></span>
                <span class="ep-badge">E${ei + 1}</span>
                <span class="ep-play" aria-hidden="true">${icoPlay}</span>
                <span class="ep-cap">
                  <span class="ep-title">${esc(ep.title)}</span>
                  ${ep.year ? `<span class="ep-sub">${esc(ep.year)}</span>` : ""}
                </span>
              </span>
            </button>`;
        })
        .join("");
      return `
        <section class="row reveal">
          <div class="row-head">
            <button class="row-title" data-show="${si}" type="button"
                    aria-label="More about ${esc(s.title)}">
              <span class="rt-kicker">${esc(s.kicker)}</span>
              <span class="rt-name">${esc(s.title)} <span class="rt-go" aria-hidden="true">Open ›</span></span>
            </button>
            <span class="row-count">${s.episodes.length} episodes</span>
          </div>
          <div class="row-rail">
            <button class="rail-arr rail-prev" type="button" aria-label="Scroll left" disabled>${icoPrev}</button>
            <div class="rail-track">${cards}</div>
            <button class="rail-arr rail-next" type="button" aria-label="Scroll right">${icoNext}</button>
          </div>
        </section>`;
    }).join("");
    rows.innerHTML = html;

    rows.querySelectorAll(".ep-img").forEach(fadeIn);
    rows.querySelectorAll(".row-rail").forEach(wireRail);
  }

  function wireRail(rail) {
    const track = rail.querySelector(".rail-track");
    const prev = rail.querySelector(".rail-prev");
    const next = rail.querySelector(".rail-next");
    const step = () => Math.max(track.clientWidth * 0.82, 240);
    prev.addEventListener("click", () =>
      track.scrollBy({ left: -step(), behavior: reduce ? "auto" : "smooth" })
    );
    next.addEventListener("click", () =>
      track.scrollBy({ left: step(), behavior: reduce ? "auto" : "smooth" })
    );
    const update = () => {
      const max = track.scrollWidth - track.clientWidth;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max - 2 || max <= 2;
    };
    track.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  // delegated clicks for cards + row titles
  rows.addEventListener("click", (e) => {
    const ep = e.target.closest(".ep");
    if (ep) {
      openViewer(+ep.dataset.show, +ep.dataset.ep);
      return;
    }
    const rt = e.target.closest(".row-title");
    if (rt) openModal(+rt.dataset.show);
  });

  // reveal rows on scroll (own observer; main.js does not see injected nodes)
  function revealRows() {
    const items = rows.querySelectorAll(".row");
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
  //  Title (show) modal
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
      .map((ep, ei) => {
        return `
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
          </li>`;
      })
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

  function stepEp(dir) {
    showEp(curShow, curEp + dir);
  }

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
  setBillboard();
  renderRows();
  revealRows();
})();
