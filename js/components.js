/* Shared header + footer, injected on every page. Single source of truth. */
(function () {
  const path = location.pathname.split("/").pop() || "index.html";

  const logoIcon = `
    <svg class="logo-icon" viewBox="0 0 100 100" aria-hidden="true">
      <rect x="6"  y="58" width="15" height="34" rx="2" fill="#8db5a0"/>
      <rect x="27" y="44" width="15" height="48" rx="2" fill="#2e9e5b"/>
      <rect x="48" y="32" width="15" height="60" rx="2" fill="#008040"/>
      <rect x="51" y="55" width="9"  height="7"  fill="#ffffff"/>
      <rect x="69" y="22" width="15" height="70" rx="2" fill="#00663a"/>
      <path d="M4 54 L29 29 L45 41 L82 9" fill="none" stroke="#0058a8"
            stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M82 9 L66 11 M82 9 L80 26" fill="none" stroke="#0058a8"
            stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

  const brand = (href) => `
    <a class="brand" href="${href}" aria-label="Lakhani Investment home">
      ${logoIcon}
      <span class="wordmark"><b>LAKHANI</b><span>Investment</span></span>
    </a>`;

  const links = [
    ["Home", "index.html"],
    ["About", "about.html"],
    ["Services", "index.html#services"],
    ["Calculators", "calculators.html"],
    ["Contact", "contact.html"],
  ];

  const servicePages = [
    "investments.html",
    "insurance.html",
    "taxation.html",
    "succession.html",
  ];

  const navLinks = links
    .map(([label, href]) => {
      const target = href.split("#")[0];
      const isActive =
        href === "index.html#services"
          ? servicePages.includes(path)
          : target === path;
      const active = isActive ? " active" : "";
      return `<a class="${active.trim()}" href="${href}">${label}</a>`;
    })
    .join("");

  const header = `
    <header class="site-header" id="siteHeader">
      <nav class="nav wrap">
        ${brand("index.html")}
        <div class="nav-links" id="navLinks">
          ${navLinks}
        </div>
        <button class="nav-toggle" id="navToggle" aria-label="Menu" aria-expanded="false"><span></span></button>
      </nav>
    </header>`;

  // Floating "back" pill: from a service page it returns to all services,
  // from the About page it returns to the homepage. Omitted elsewhere.
  const backFab = servicePages.includes(path)
    ? `<a class="back-fab" href="index.html#services" aria-label="Back to all services"><span class="bf-arr" aria-hidden="true">&larr;</span> All services</a>`
    : path === "about.html"
    ? `<a class="back-fab" href="index.html" aria-label="Back to home"><span class="bf-arr" aria-hidden="true">&larr;</span> Home</a>`
    : "";

  const footer = `
    <footer class="site-footer">
      <div class="wrap footer-top">
        <div class="footer-brand">
          ${brand("index.html")}
          <p>A wealth management firm rooted in Rajula since 1987, guiding families through creation, preservation and transfer of wealth, with no minimum to begin.</p>
        </div>
        <div>
          <h5>Services</h5>
          <a href="investments.html">Investments</a>
          <a href="insurance.html">Insurance</a>
          <a href="taxation.html">Taxation</a>
          <a href="succession.html">Succession Planning</a>
        </div>
        <div>
          <h5>Company</h5>
          <a href="about.html">About us</a>
          <a href="about.html#leadership">Leadership</a>
          <a href="about.html#approach">Our approach</a>
          <a href="calculators.html">Calculators</a>
          <a href="contact.html">Contact</a>
        </div>
        <div>
          <h5>Reach us</h5>
          <a href="tel:+919426669596">+91 94266 69596</a>
          <a href="mailto:ishit@lakhaniinvestment.in">ishit@lakhaniinvestment.in</a>
          <a href="contact.html#offices">Rajula &amp; Ahmedabad offices</a>
        </div>
      </div>
      <div class="wrap footer-bottom">
        <span>© ${new Date().getFullYear()} Lakhani Investment. All rights reserved.</span>
        <span class="tag">It's Tomorrow, That Matters!</span>
      </div>
    </footer>`;

  document.getElementById("nav-root").innerHTML = `<div class="progress" id="progress"></div>` + header + backFab;
  document.getElementById("footer-root").innerHTML = footer;

  // mobile menu
  const toggle = document.getElementById("navToggle");
  toggle.addEventListener("click", () => {
    const open = document.body.classList.toggle("menu-open");
    toggle.setAttribute("aria-expanded", open);
  });
  document.querySelectorAll("#navLinks a").forEach((a) =>
    a.addEventListener("click", () => document.body.classList.remove("menu-open"))
  );
})();
