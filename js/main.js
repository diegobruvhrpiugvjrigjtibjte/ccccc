const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const initScrollSpy = () => {
  const sections = Array.from(document.querySelectorAll("main section[id]"));
  const tocLinks = Array.from(document.querySelectorAll(".toc a"));
  const floatingIndex = document.querySelector("[data-floating-index]");
  const hero = document.getElementById("profilo");

  const activateLink = (id) => {
    tocLinks.forEach((link) => {
      link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
    });
  };

  const onScroll = () => {
    const scrollPosition = window.scrollY + 140;
    let currentId = sections[0]?.id;
    sections.forEach((section) => {
      if (section.offsetTop <= scrollPosition) {
        currentId = section.id;
      }
    });
    if (currentId) activateLink(currentId);

    if (floatingIndex && hero) {
      const heroBottom = hero.offsetTop + hero.offsetHeight;
      floatingIndex.classList.toggle("is-docked", window.scrollY > heroBottom - 120);
    }
  };

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();
};

const initReveal = () => {
  const revealTargets = Array.from(document.querySelectorAll("main section"));
  revealTargets.forEach((section) => section.classList.add("reveal"));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  revealTargets.forEach((section) => observer.observe(section));
};

const initCountUp = () => {
  const counters = Array.from(document.querySelectorAll("[data-count]"));
  if (!counters.length) return;

  const formatter = (value) => {
    if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}M`;
    return value.toLocaleString("it-IT");
  };

  const animate = (el) => {
    const target = Number(el.dataset.count || 0);
    const duration = 1400;
    const start = performance.now();

    const step = (now) => {
      const progress = clamp((now - start) / duration, 0, 1);
      const value = Math.round(target * progress);
      el.textContent = formatter(value);
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  };

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animate(entry.target);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach((counter) => observer.observe(counter));
};

const initBackToTop = () => {
  const button = document.querySelector("[data-back-to-top]");
  const ring = document.querySelector(".progress-ring");
  if (!button || !ring) return;

  const circumference = 2 * Math.PI * 20;
  ring.style.strokeDasharray = `${circumference}`;

  const update = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight ? scrollTop / docHeight : 0;
    const offset = circumference - progress * circumference;
    ring.style.strokeDashoffset = `${offset}`;
    button.classList.toggle("active", scrollTop > 400);
  };

  button.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  window.addEventListener("scroll", update, { passive: true });
  update();
};

const initSearchFilters = () => {
  const filters = Array.from(document.querySelectorAll("[data-filter-target]"));
  filters.forEach((input) => {
    const targetSelector = input.dataset.filterTarget;
    const emptySelector = input.dataset.filterEmpty;
    const list = document.querySelector(targetSelector);
    const emptyState = emptySelector ? document.querySelector(emptySelector) : null;

    if (!list) return;

    const items = Array.from(list.querySelectorAll("li"));
    const handleFilter = () => {
      const query = input.value.trim().toLowerCase();
      let matches = 0;
      items.forEach((item) => {
        const text = item.textContent.toLowerCase();
        const isVisible = text.includes(query);
        item.hidden = !isVisible;
        if (isVisible) matches += 1;
      });
      if (emptyState) emptyState.hidden = matches !== 0;
    };

    input.addEventListener("input", handleFilter);
  });
};

const initIndexDrawerMobile = () => {
  const toggle = document.querySelector("[data-index-toggle]");
  const drawer = document.querySelector("[data-index-drawer]");
  const closeBtn = document.querySelector("[data-index-close]");

  if (!toggle || !drawer || !closeBtn) return;

  const openDrawer = () => {
    drawer.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
    drawer.setAttribute("aria-hidden", "false");
  };

  const closeDrawer = () => {
    drawer.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    drawer.setAttribute("aria-hidden", "true");
  };

  toggle.addEventListener("click", openDrawer);
  closeBtn.addEventListener("click", closeDrawer);
  drawer.addEventListener("click", (event) => {
    if (event.target === drawer) closeDrawer();
  });
};

const initSiteSearch = () => {
  const searchForm = document.getElementById("site-search");
  const searchInput = document.getElementById("search-input");
  const searchResults = document.getElementById("search-results");
  const sections = Array.from(document.querySelectorAll("main section[id]"));

  if (!searchForm || !searchInput || !searchResults) return;

  const buildSnippet = (text, query) => {
    const lower = text.toLowerCase();
    const index = lower.indexOf(query);
    if (index === -1) return text.slice(0, 140) + "...";
    const start = Math.max(index - 40, 0);
    const end = Math.min(index + 80, text.length);
    const snippet = text.slice(start, end);
    return `${start > 0 ? "…" : ""}${snippet}${end < text.length ? "…" : ""}`;
  };

  const performSearch = () => {
    const query = searchInput.value.trim().toLowerCase();
    searchResults.innerHTML = "";

    if (!query) {
      searchResults.style.display = "none";
      return;
    }

    const matches = sections
      .map((section) => {
        const heading = section.querySelector("h2");
        const title = heading ? heading.textContent.trim() : section.id;
        const text = section.textContent.replace(/\s+/g, " ").trim();
        return { id: section.id, title, text };
      })
      .filter(({ text }) => text.toLowerCase().includes(query));

    if (matches.length === 0) {
      searchResults.style.display = "flex";
      const empty = document.createElement("li");
      empty.textContent = "Nessun risultato trovato.";
      searchResults.appendChild(empty);
      return;
    }

    matches.forEach(({ id, title, text }) => {
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${id}`;
      link.textContent = title;
      const snippet = document.createElement("p");
      snippet.textContent = buildSnippet(text, query);
      item.appendChild(link);
      item.appendChild(snippet);
      searchResults.appendChild(item);
    });

    searchResults.style.display = "flex";
  };

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    performSearch();
  });

  searchInput.addEventListener("input", performSearch);
};

const initCookieBanner = () => {
  const banner = document.getElementById("cookie-banner");
  const acceptButton = document.getElementById("cookie-accept");
  if (!banner || !acceptButton) return;

  if (localStorage.getItem("cookiesAccepted") === "true") {
    banner.style.display = "none";
  }

  acceptButton.addEventListener("click", () => {
    localStorage.setItem("cookiesAccepted", "true");
    banner.style.display = "none";
  });
};

document.addEventListener("DOMContentLoaded", () => {
  initScrollSpy();
  initReveal();
  initCountUp();
  initBackToTop();
  initSearchFilters();
  initIndexDrawerMobile();
  initSiteSearch();
  initCookieBanner();
});
