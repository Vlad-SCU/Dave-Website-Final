const storeData = window.STREAMLINE_STORE_DATA || { groups: [], allItems: [], featured: [], storeCount: 0 };

const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

const state = {
  query: "",
  group: "all",
};

const money = (value) => `$${Number(value || 0).toLocaleString()}`;

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function hostLabel(url) {
  try {
    const path = new URL(url).pathname.replace(/^\/|\/shop\/home$/g, "");
    return path || "Open store";
  } catch {
    return "Open store";
  }
}

function showToast(message) {
  const toast = qs("[data-toast]");
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, 3600);
}

function renderFilter() {
  const filter = qs("[data-group-filter]");
  if (!filter) return;

  const buttons = [
    { id: "all", label: "All stores" },
    ...storeData.groups.map((group) => ({ id: group.group, label: group.group })),
  ];

  filter.innerHTML = buttons.map((button) => `
    <button class="filter-chip ${button.id === state.group ? "active" : ""}" type="button" data-group="${button.id}">
      ${button.label}
    </button>
  `).join("");

  qsa("[data-group]", filter).forEach((button) => {
    button.addEventListener("click", () => {
      state.group = button.dataset.group;
      renderStores();
      renderFilter();
    });
  });
}

function createStoreCard(item, groupName = "") {
  const card = document.createElement("a");
  card.className = "store-card";
  card.href = item.url;
  if (groupName) card.setAttribute("data-store-group", groupName);
  card.setAttribute("data-store-name", item.name);
  card.target = "_blank";
  card.rel = "noreferrer";
  card.innerHTML = `
    <span class="store-logo">
      <img src="${item.logo}" alt="" loading="lazy">
      <span class="store-initials">${initials(item.name)}</span>
    </span>
    <span>
      <span class="store-name">${item.name}</span>
      <span class="store-url">${hostLabel(item.url)}</span>
    </span>
  `;
  const image = qs("img", card);
  image.addEventListener("error", () => card.classList.add("logo-error"), { once: true });
  return card;
}

function groupMatches(group) {
  if (state.group !== "all" && group.group !== state.group) return [];
  const tokens = state.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return group.items;
  return group.items.filter((item) => {
    const haystack = [item.name, group.group, item.url].join(" ").toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

function renderStores() {
  const directory = qs("[data-store-directory]");
  const empty = qs("[data-empty-stores]");
  if (!directory) return;

  directory.innerHTML = "";
  let visibleCount = 0;

  storeData.groups.forEach((group, index) => {
    const matches = groupMatches(group);
    if (!matches.length) return;
    visibleCount += matches.length;

    const details = document.createElement("details");
    details.className = "store-group";
    details.open = index === 0 || Boolean(state.query);

    const summary = document.createElement("summary");
    summary.innerHTML = `
      <span class="group-dot"></span>
      <span>
        <span class="store-group-name">${group.group}</span>
        <span class="store-group-count">${matches.length} linked ${matches.length === 1 ? "store" : "stores"}</span>
      </span>
    `;

    const grid = document.createElement("div");
    grid.className = "store-grid";
    matches.forEach((item) => grid.append(createStoreCard(item, group.group)));

    details.append(summary, grid);
    directory.append(details);
  });

  if (empty) empty.hidden = visibleCount > 0;
}

function renderFeaturedStores() {
  const strip = qs("[data-featured-stores]");
  if (!strip) return;

  const featured = storeData.featured.length ? storeData.featured : storeData.allItems.slice(0, 16);
  strip.innerHTML = "";
  featured.slice(0, 18).forEach((item) => {
    const link = document.createElement("a");
    link.className = "featured-store";
    link.href = item.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.title = item.name;
    link.innerHTML = `<img src="${item.logo}" alt="${item.name} logo" loading="lazy">`;
    strip.append(link);
  });
}

function setupStores() {
  qsa("[data-store-count]").forEach((el) => {
    el.textContent = storeData.storeCount || storeData.allItems.length;
  });
  renderFeaturedStores();
  renderFilter();
  renderStores();

  const search = qs("[data-store-search]");
  if (search) {
    search.addEventListener("input", () => {
      state.query = search.value;
      renderStores();
    });
  }
}

function setupNavigation() {
  const header = qs("[data-header]");
  const menu = qs("[data-menu]");
  const toggle = qs("[data-menu-toggle]");
  const links = qsa(".site-menu a");

  const setHeader = () => header?.classList.toggle("is-scrolled", window.scrollY > 16);
  setHeader();
  window.addEventListener("scroll", setHeader, { passive: true });

  toggle?.addEventListener("click", () => {
    const open = !menu.classList.contains("is-open");
    menu.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });

  links.forEach((link) => {
    link.addEventListener("click", () => {
      menu?.classList.remove("is-open");
      toggle?.setAttribute("aria-expanded", "false");
    });
  });

  const sections = links
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((link) => {
        link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`);
      });
    });
  }, { rootMargin: "-30% 0px -60% 0px", threshold: 0.01 });

  sections.forEach((section) => observer.observe(section));
}

function setupTicker() {
  const ticker = qs("[data-ticker]");
  const workTrack = qs("[data-work-track]");
  if (ticker) ticker.innerHTML += ticker.innerHTML;
  if (workTrack) workTrack.innerHTML += workTrack.innerHTML;
}

function setupReveal() {
  const revealTargets = qsa(".service-card, .service-detail, .equipment-card, .store-group, .form-card, .value-card, .contact-card, .map-card, .order-sidecard, .workflow-step, .instagram-callout, .work-feature, .team-header, .team-card");
  revealTargets.forEach((target) => target.classList.add("reveal"));
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) entry.target.classList.add("is-visible");
    });
  }, { threshold: 0.14 });
  revealTargets.forEach((target) => observer.observe(target));
}

function setupProofSlider() {
  qsa("[data-proof-slider]").forEach((input) => {
    const wrap = input.closest("[data-proof-slider-wrap]");
    const update = () => {
      if (wrap) wrap.style.setProperty("--split", `${input.value}%`);
    };
    input.addEventListener("input", update);
    update();
  });
}

function activateOrderTab(tab) {
  const buttons = qsa("[data-tab]");
  const panels = qsa("[data-panel]");
  const sidecards = qsa("[data-order-sidecard]");

  buttons.forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  panels.forEach((panel) => panel.classList.toggle("active", panel.dataset.panel === tab));
  sidecards.forEach((card) => {
    card.hidden = card.dataset.orderSidecard !== tab;
  });
}

function setupTabs() {
  const buttons = qsa("[data-tab]");

  buttons.forEach((button) => {
    button.addEventListener("click", () => activateOrderTab(button.dataset.tab));
  });

  qsa("[data-open-order]").forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      const tab = trigger.dataset.openOrder;
      if (!tab) return;
      event.preventDefault();
      activateOrderTab(tab);
      qs("#order")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  activateOrderTab("custom");
}

function selectedPrice(selector) {
  const input = qs(selector);
  const option = input?.selectedOptions?.[0];
  return Number(option?.dataset.price || 0);
}

function updateEstimate() {
  const qty = selectedPrice("[data-price-field='quantity']");
  const size = selectedPrice("[data-price-field='size']");
  const finish = selectedPrice("[data-price-field='finish']");
  const cut = selectedPrice("[data-price-field='cut']");
  const art = qs("[data-art-help]")?.checked ? 35 : 0;
  const total = qty + size + finish + cut + art;

  const set = (selector, value) => {
    const target = qs(selector);
    if (target) target.textContent = money(value);
  };

  set("[data-estimate-total]", total);
  set("[data-estimate-qty]", qty);
  set("[data-estimate-size]", size + cut);
  set("[data-estimate-finish]", finish);
  set("[data-estimate-art]", art);
}

function setupOrderForms() {
  qsa("[data-price-field], [data-art-help]").forEach((field) => {
    field.addEventListener("change", updateEstimate);
  });
  updateEstimate();

  qsa(".order-form").forEach((form) => {
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const label = form.dataset.panel === "stickers" ? "Sticker order" : "Custom order";
      showToast(`${label} received. Streamline will review the details and follow up with next steps.`);
      form.reset();
      qsa("[data-file-preview]", form).forEach((preview) => {
        preview.innerHTML = "";
        preview.hidden = true;
      });
      updateEstimate();
    });
  });
}

function setupFileUpload() {
  qsa("[data-dropzone]").forEach((dropzone) => {
    const input = qs("[data-file-input]", dropzone);
    const preview = dropzone.parentElement?.querySelector("[data-file-preview]");

    const showFile = (file) => {
      if (!file || !preview) return;
      preview.hidden = false;
      const imageMarkup = file.type.startsWith("image/")
        ? `<img src="${URL.createObjectURL(file)}" alt="">`
        : `<span class="file-chip">${file.name.split(".").pop().toUpperCase()}</span>`;
      preview.innerHTML = `
        ${imageMarkup}
        <div>
          <strong>${file.name}</strong>
          <p>${Math.ceil(file.size / 1024).toLocaleString()} KB uploaded for review</p>
        </div>
      `;
    };

    input?.addEventListener("change", () => showFile(input.files?.[0]));

    ["dragenter", "dragover"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.add("is-dragover");
      });
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.remove("is-dragover");
      });
    });

    dropzone.addEventListener("drop", (event) => {
      const file = event.dataTransfer?.files?.[0];
      if (file) showFile(file);
    });
  });
}

function setupContactForm() {
  qs("[data-contact-form]")?.addEventListener("submit", (event) => {
    event.preventDefault();
    showToast("Message received. Streamline will follow up shortly.");
    event.currentTarget.reset();
  });
}

function setupFooter() {
  const year = qs("[data-year]");
  if (year) year.textContent = new Date().getFullYear();
}

function setupServiceModal() {
  const backdrop = qs("#service-modal-backdrop");
  const content = qs("#service-modal-content");
  const closeBtn = qs("[data-service-modal-close]");
  if (!backdrop || !content) return;

  const close = () => {
    if (backdrop.hidden || backdrop.classList.contains("is-closing")) return;
    backdrop.classList.add("is-closing");
    document.body.style.overflow = "";
    setTimeout(() => {
      backdrop.hidden = true;
      backdrop.classList.remove("is-closing");
    }, 240);
  };

  closeBtn?.addEventListener("click", close);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !backdrop.hidden) close();
  });

  qsa(".service-grid .service-card").forEach((card) => {
    card.addEventListener("click", (event) => {
      const targetId = card.getAttribute("href");
      if (!targetId || !targetId.startsWith("#service-")) return;
      event.preventDefault();
      const template = qs(targetId);
      if (!template) return;

      const cloned = template.cloneNode(true);
      cloned.classList.remove("reveal");
      cloned.classList.add("is-visible");
      qsa(".reveal", cloned).forEach((el) => {
        el.classList.remove("reveal");
        el.classList.add("is-visible");
      });

      content.replaceChildren(cloned);
      backdrop.classList.remove("is-closing");
      backdrop.hidden = false;
      document.body.style.overflow = "hidden";
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupFooter();
  setupTicker();
  setupNavigation();
  setupStores();
  setupTabs();
  setupOrderForms();
  setupFileUpload();
  setupContactForm();
  setupProofSlider();
  setupReveal();
  setupServiceModal();

  window.addEventListener("streamlineStoresUpdated", () => {
    if (window.STREAMLINE_STORE_DATA) {
      storeData.groups = window.STREAMLINE_STORE_DATA.groups;
      storeData.allItems = storeData.groups.flatMap((g) => g.items);
      renderStores();
    }
  });
});
