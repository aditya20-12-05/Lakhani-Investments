/* Shared header + footer, injected on every page. Single source of truth. */
(function () {
  const path = location.pathname.split("/").pop() || "index.html";

  // Geometry traced from assets/logo.png: four bars (short, tall, medium,
  // tallest) with bar 3 split by a notch, under a rising arrow that peaks,
  // dips, then climbs to the top-right. The notch is a real gap (two rects)
  // rather than a white fill, so it stays correct on dark backgrounds too.
  // The arrow is a thin stroked shaft (true 5.6 width, butt caps, miter
  // joins) feeding a solid pentagon arrowhead, so it reads sharp like the
  // original rather than soft and rounded.
  const logoIcon = `
    <svg class="logo-icon" viewBox="-6 -6 112 128" aria-hidden="true">
      <rect x="5.6"  y="73.3" width="15.7" height="42.6" fill="#6c9f76"/>
      <rect x="31.6" y="46.5" width="16.1" height="69.4" fill="#078545"/>
      <rect x="57.9" y="56.4" width="16.1" height="15.7" fill="#087140"/>
      <rect x="57.9" y="81.8" width="16.1" height="34.1" fill="#087140"/>
      <rect x="84.1" y="28.1" width="15.9" height="87.8" fill="#026739"/>
      <path d="M1.9 58.9 L39.9 20.7 L58.7 39.5 L90.7 7.4" fill="none" stroke="#0058a8"
            stroke-width="5.6" stroke-linecap="butt" stroke-linejoin="miter"/>
      <path d="M85.1 0 L98.3 0 L98.3 13.2 L92.8 9.4 L88.7 5.6 Z" fill="#0058a8"/>
    </svg>`;

  const brand = (href) => `
    <a class="brand" href="${href}" aria-label="Lakhani Investment home">
      ${logoIcon}
      <span class="wordmark"><b>LAKHANI</b><span>Investment</span></span>
    </a>`;

  const links = [
    ["Home", "index.html"],
    ["About", "about.html"],
    ["Services", "services.html"],
    ["Calculators", "calculators.html"],
    ["Gallery", "gallery.html"],
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
        href === "services.html"
          ? path === "services.html" || servicePages.includes(path)
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
    ? `<a class="back-fab" href="services.html" aria-label="Back to all services"><span class="bf-arr" aria-hidden="true">&larr;</span> All services</a>`
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
          <a href="about.html#team">Our team</a>
          <a href="about.html#approach">Our approach</a>
          <a href="calculators.html">Calculators</a>
          <a href="gallery.html">Gallery</a>
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
