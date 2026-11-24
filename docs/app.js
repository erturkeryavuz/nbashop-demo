(function () {
  "use strict";

  const SEED = window.NBASHOP_DATA;
  const ART = window.NBASHOP_ART;
  if (!SEED || !ART) return;

  const STORAGE_KEY = "nbashop_demo_state_v1";
  const SHIPPING_FEE = SEED.meta.shippingFee;
  const DAYS_PER_UNIT = SEED.meta.deliveryDaysPerUnit;
  const ITEMS_PER_PAGE = 6;

  function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  function safeReadRawStorage() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (_) {
      return null;
    }
  }

  function loadPersisted() {
    try {
      const raw = safeReadRawStorage();
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function defaultFilters() {
    return {
      search: "",
      priceMin: "",
      priceMax: "",
      stockMin: "",
      stockMax: "",
      categories: [],
      sort: "latest",
      page: 1,
    };
  }

  let tutorialPersistenceSuspended = false;

  const saved = loadPersisted();
  const state = {
    view: "home",
    heroIdx: 0,
    jerseysOpen: true,
    products: (saved && Array.isArray(saved.products) && saved.products.length === SEED.products.length)
      ? saved.products
      : clone(SEED.products),
    cart: (saved && saved.cart && typeof saved.cart === "object") ? saved.cart : {},
    orders: (saved && Array.isArray(saved.orders)) ? saved.orders : clone(SEED.initialOrders),
    messages: (saved && Array.isArray(saved.messages)) ? saved.messages : clone(SEED.initialMessages),
    demoUser: (saved && saved.demoUser) ? saved.demoUser : null,
    filters: defaultFilters(),
    detailProductId: null,
    detailQty: 1,
    detailSize: "",
    lastInvoice: null,
  };

  function persist() {
    // Hard tutorial persistence isolation boundary: Watch Tutorial never writes to localStorage.
    if (tutorialPersistenceSuspended) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          products: state.products,
          cart: state.cart,
          orders: state.orders,
          messages: state.messages,
          demoUser: state.demoUser,
        })
      );
    } catch (_) {}
  }

  function esc(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function fmtUsd(v) {
    return "$" + Number(v || 0).toFixed(2);
  }

  function getCategoryName(cid) {
    const c = SEED.categories.find((x) => x.id === cid);
    return c ? c.name : "Merchandise";
  }

  function getProduct(id) {
    return state.products.find((p) => p.id === id) || null;
  }

  function cartUnitCount() {
    return Object.values(state.cart).reduce((sum, q) => sum + Math.max(0, Number(q) || 0), 0);
  }

  function showToast(msg) {
    const region = document.getElementById("toast-region");
    if (!region) return;
    const div = document.createElement("div");
    div.className = "toast";
    div.textContent = msg;
    region.appendChild(div);
    setTimeout(() => {
      if (div.parentNode) div.parentNode.removeChild(div);
    }, 2600);
  }

  // ---------- Cart Operations (Stock-Bounded) ----------
  function addToCart(productId, delta) {
    const prod = getProduct(productId);
    if (!prod || prod.stock <= 0) {
      showToast("Item is currently out of stock.");
      return;
    }
    const current = Number(state.cart[productId] || 0);
    const next = Math.min(prod.stock, current + Math.max(1, Number(delta) || 1));
    state.cart[productId] = next;
    persist();
    updateHeader();
    if (current + delta > prod.stock) {
      showToast(`Quantity capped at available stock (${prod.stock}) for ${prod.name}.`);
    } else {
      showToast(`Added ${prod.name} to cart.`);
    }
    if (state.view === "cart") renderCart();
    if (state.view === "checkout") renderCheckout();
  }

  function updateCartQty(productId, delta) {
    const prod = getProduct(productId);
    if (!prod) return;
    const current = Number(state.cart[productId] || 0);
    const next = current + delta;
    if (next <= 0) {
      delete state.cart[productId];
    } else {
      state.cart[productId] = Math.min(prod.stock, next);
    }
    persist();
    updateHeader();
    renderCart();
  }

  function removeFromCart(productId) {
    delete state.cart[productId];
    persist();
    updateHeader();
    renderCart();
  }

  function getCartLines() {
    const lines = [];
    let subtotal = 0;
    let units = 0;
    Object.keys(state.cart).forEach((k) => {
      const pid = Number(k);
      const prod = getProduct(pid);
      if (!prod || prod.stock <= 0) {
        delete state.cart[k];
        return;
      }
      const qty = Math.min(prod.stock, Math.max(0, Number(state.cart[k]) || 0));
      if (qty <= 0) {
        delete state.cart[k];
        return;
      }
      state.cart[k] = qty;
      const lineTotal = prod.price * qty;
      lines.push({ product: prod, qty, lineTotal });
      subtotal += lineTotal;
      units += qty;
    });
    const shipping = lines.length > 0 ? SHIPPING_FEE : 0;
    return { lines, subtotal, shipping, total: subtotal + shipping, units };
  }

  // ---------- Header & Navigation ----------
  function updateHeader() {
    document.getElementById("header-cart-badge").textContent = String(cartUnitCount());
    document.getElementById("account-trigger-label").textContent = state.demoUser
      ? `@${state.demoUser.username}`
      : "Demo Account";
  }

  function switchView(viewName) {
    state.view = viewName;
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      const active = btn.dataset.view === viewName;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", active ? "true" : "false");
      btn.setAttribute("tabindex", active ? "0" : "-1");
    });
    document.querySelectorAll(".view-panel").forEach((panel) => {
      const active = panel.id === "view-" + viewName;
      panel.hidden = !active;
      panel.classList.toggle("active", active);
    });

    if (viewName === "home") renderHome();
    else if (viewName === "shop") renderShop();
    else if (viewName === "cart") renderCart();
    else if (viewName === "checkout") renderCheckout();
    else if (viewName === "admin") renderAdmin();
  }

  // ---------- Product Card HTML ----------
  function buildProductCardHtml(p, prefix) {
    const lowStock = p.stock <= 10;
    const stockText = p.stock > 0 ? `${p.stock} in stock` : "Out of stock";
    return `
      <article class="product-card">
        <div class="product-media">
          ${ART.renderProductSvg(p.art, prefix + "_" + p.id)}
          <span class="stock-chip ${lowStock ? "low" : ""}">${esc(stockText)}</span>
        </div>
        <div class="product-body">
          <div class="product-cat">${esc(getCategoryName(p.categoryId))}</div>
          <h3 class="product-name">${esc(p.name)}</h3>
          <div class="product-price">${fmtUsd(p.price)}</div>
        </div>
        <div class="product-footer">
          <button type="button" class="btn btn-outline btn-sm" data-open-detail="${p.id}">View Detail</button>
          <button type="button" class="btn btn-primary btn-sm" data-add-cart="${p.id}" ${p.stock <= 0 ? "disabled" : ""}>Add To Cart</button>
        </div>
      </article>
    `;
  }

  // ---------- View 1: Home ----------
  function renderCategoryRail() {
    const rail = document.getElementById("home-category-rail");
    const jerseys = SEED.categories.filter((c) => c.group === "jerseys");
    const others = SEED.categories.filter((c) => c.group !== "jerseys");

    let html = `
      <button type="button" class="rail-item" id="toggle-jerseys-rail" aria-expanded="${state.jerseysOpen ? "true" : "false"}">
        <span>Jerseys (${jerseys.length})</span>
        <span>${state.jerseysOpen ? "−" : "+"}</span>
      </button>
    `;
    if (state.jerseysOpen) {
      html += `<div class="rail-sub-group">`;
      jerseys.forEach((c) => {
        html += `<button type="button" class="rail-sub-item" data-jump-cat="${c.id}">${esc(c.name)}</button>`;
      });
      html += `</div>`;
    }
    others.forEach((c) => {
      html += `<button type="button" class="rail-item" data-jump-cat="${c.id}"><span>${esc(c.name)}</span><span>&rsaquo;</span></button>`;
    });
    rail.innerHTML = html;

    const toggleBtn = document.getElementById("toggle-jerseys-rail");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        state.jerseysOpen = !state.jerseysOpen;
        renderCategoryRail();
      });
    }
    rail.querySelectorAll("[data-jump-cat]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cid = Number(btn.dataset.jumpCat);
        state.filters.categories = [cid];
        state.filters.page = 1;
        syncFilterInputs();
        switchView("shop");
      });
    });
  }

  function renderHero() {
    const featured = state.products.slice().sort((a, b) => b.sales - a.sales).slice(0, 3);
    const active = featured[state.heroIdx % featured.length];
    document.getElementById("hero-slide").innerHTML = `
      <div class="hero-copy">
        <span class="hero-eyebrow">Top Selling &middot; ${esc(getCategoryName(active.categoryId))}</span>
        <h2 class="hero-slide-title">${esc(active.name)}</h2>
        <p>${esc(active.description)}</p>
        <div class="hero-price">${fmtUsd(active.price)}</div>
        <div class="hero-actions">
          <button type="button" class="btn btn-primary" data-open-detail="${active.id}">View Detail</button>
          <button type="button" class="btn btn-outline" data-add-cart="${active.id}" ${active.stock <= 0 ? "disabled" : ""}>Add To Cart</button>
        </div>
      </div>
      <div class="hero-art">
        ${ART.renderProductSvg(active.art, "hero_" + active.id)}
      </div>
    `;

    const dots = document.getElementById("hero-dots");
    dots.innerHTML = featured
      .map(
        (_, i) =>
          `<button type="button" class="hero-dot ${i === state.heroIdx % featured.length ? "active" : ""}" data-hero-dot="${i}" aria-label="Slide ${i + 1}"></button>`
      )
      .join("");
    dots.querySelectorAll("[data-hero-dot]").forEach((d) => {
      d.addEventListener("click", () => {
        state.heroIdx = Number(d.dataset.heroDot);
        renderHero();
      });
    });
  }

  function renderHome() {
    renderCategoryRail();
    renderHero();
  }

  // ---------- View 2: Shop Catalog ----------
  function renderCategoryFilterCheckboxes() {
    const wrap = document.getElementById("filter-categories");
    wrap.innerHTML = SEED.categories
      .map(
        (c) => `
          <label class="cat-check">
            <input type="checkbox" value="${c.id}" ${state.filters.categories.includes(c.id) ? "checked" : ""} />
            <span>${esc(c.name)}</span>
          </label>
        `
      )
      .join("");
    wrap.querySelectorAll("input[type='checkbox']").forEach((cb) => {
      cb.addEventListener("change", () => {
        const selected = Array.from(wrap.querySelectorAll("input:checked")).map((el) => Number(el.value));
        state.filters.categories = selected;
        state.filters.page = 1;
        renderShop();
      });
    });
  }

  function syncFilterInputs() {
    document.getElementById("filter-search").value = state.filters.search;
    document.getElementById("topbar-search-input").value = state.filters.search;
    document.getElementById("filter-price-min").value = state.filters.priceMin;
    document.getElementById("filter-price-max").value = state.filters.priceMax;
    document.getElementById("filter-stock-min").value = state.filters.stockMin;
    document.getElementById("filter-stock-max").value = state.filters.stockMax;
    document.getElementById("shop-sort").value = state.filters.sort;
    renderCategoryFilterCheckboxes();
  }

  function renderShop() {
    renderCategoryFilterCheckboxes();
    const f = state.filters;
    const q = f.search.trim().toLowerCase();
    const pMin = f.priceMin !== "" ? Number(f.priceMin) : 0;
    const pMax = f.priceMax !== "" ? Number(f.priceMax) : Infinity;
    const sMin = f.stockMin !== "" ? Number(f.stockMin) : 0;
    const sMax = f.stockMax !== "" ? Number(f.stockMax) : Infinity;

    let filtered = state.products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
      if (p.price < pMin || p.price > pMax) return false;
      if (p.stock < sMin || p.stock > sMax) return false;
      if (f.categories.length > 0 && !f.categories.includes(p.categoryId)) return false;
      return true;
    });

    if (f.sort === "price_asc") filtered.sort((a, b) => a.price - b.price);
    else if (f.sort === "price_desc") filtered.sort((a, b) => b.price - a.price);
    else if (f.sort === "stock_desc") filtered.sort((a, b) => b.stock - a.stock);
    else filtered.sort((a, b) => b.id - a.id);

    const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
    if (f.page > totalPages) f.page = totalPages;
    const start = (f.page - 1) * ITEMS_PER_PAGE;
    const pageItems = filtered.slice(start, start + ITEMS_PER_PAGE);

    document.getElementById("shop-count").textContent =
      `Showing ${pageItems.length} of ${filtered.length} products (Page ${f.page} of ${totalPages})`;

    const grid = document.getElementById("shop-grid");
    grid.innerHTML = pageItems.length
      ? pageItems.map((p) => buildProductCardHtml(p, "shop")).join("")
      : `<div class="card-panel" style="grid-column:1/-1;text-align:center;">No products match the active filters.</div>`;

    const pag = document.getElementById("shop-pagination");
    let pagHtml = `<button type="button" class="page-btn" data-page="${f.page - 1}" ${f.page <= 1 ? "disabled" : ""}>Previous</button>`;
    for (let i = 1; i <= totalPages; i++) {
      pagHtml += `<button type="button" class="page-btn ${i === f.page ? "active" : ""}" data-page="${i}">${i}</button>`;
    }
    pagHtml += `<button type="button" class="page-btn" data-page="${f.page + 1}" ${f.page >= totalPages ? "disabled" : ""}>Next</button>`;
    pag.innerHTML = pagHtml;
    pag.querySelectorAll("[data-page]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const nextP = Number(btn.dataset.page);
        if (nextP >= 1 && nextP <= totalPages) {
          state.filters.page = nextP;
          renderShop();
        }
      });
    });
  }

  // ---------- View 3: Shopping Cart ----------
  function renderCart() {
    const summary = getCartLines();
    const body = document.getElementById("cart-table-body");

    if (!summary.lines.length) {
      body.innerHTML = `<tr><td colspan="5" class="center" style="padding:26px;">Your cart is empty. <button type="button" class="btn-link" id="empty-browse-btn">Browse the catalog</button></td></tr>`;
      const browseBtn = document.getElementById("empty-browse-btn");
      if (browseBtn) browseBtn.addEventListener("click", () => switchView("shop"));
    } else {
      body.innerHTML = summary.lines
        .map(
          ({ product, qty, lineTotal }) => `
            <tr>
              <td>
                <div class="cart-thumb-cell">
                  ${ART.renderProductSvg(product.art, "cart_" + product.id)}
                  <div>
                    <strong>${esc(product.name)}</strong><br/>
                    <span class="muted-note">Available stock: ${product.stock}</span>
                  </div>
                </div>
              </td>
              <td class="num">${fmtUsd(product.price)}</td>
              <td class="center">
                <div class="qty-control">
                  <button type="button" data-cart-dec="${product.id}" aria-label="Decrease quantity">&minus;</button>
                  <span>${qty}</span>
                  <button type="button" data-cart-inc="${product.id}" aria-label="Increase quantity" ${qty >= product.stock ? "disabled" : ""}>+</button>
                </div>
              </td>
              <td class="num"><strong>${fmtUsd(lineTotal)}</strong></td>
              <td class="center">
                <button type="button" class="btn-danger-outline" data-cart-del="${product.id}">Remove</button>
              </td>
            </tr>
          `
        )
        .join("");

      body.querySelectorAll("[data-cart-dec]").forEach((b) =>
        b.addEventListener("click", () => updateCartQty(Number(b.dataset.cartDec), -1))
      );
      body.querySelectorAll("[data-cart-inc]").forEach((b) =>
        b.addEventListener("click", () => updateCartQty(Number(b.dataset.cartInc), 1))
      );
      body.querySelectorAll("[data-cart-del]").forEach((b) =>
        b.addEventListener("click", () => removeFromCart(Number(b.dataset.cartDel)))
      );
    }

    document.getElementById("cart-subtotal").textContent = fmtUsd(summary.subtotal);
    document.getElementById("cart-shipping").textContent = fmtUsd(summary.shipping);
    document.getElementById("cart-total").textContent = fmtUsd(summary.total);
    document.getElementById("proceed-checkout-btn").disabled = summary.lines.length === 0;
  }

  // ---------- View 4: Checkout Preview & Invoice ----------
  function renderCheckout() {
    const formSec = document.getElementById("checkout-form-section");
    const invSec = document.getElementById("invoice-section");

    if (state.lastInvoice) {
      formSec.hidden = true;
      invSec.hidden = false;
      const inv = state.lastInvoice;
      document.getElementById("invoice-body").innerHTML = `
        <p><strong>Order Number:</strong> <code>${esc(inv.orderNumber)}</code> &middot; <strong>Date:</strong> ${esc(inv.date)} &middot; <strong>Estimated Delivery:</strong> ${esc(inv.estimatedDelivery)}</p>
        <p><strong>Demo Recipient:</strong> ${esc(inv.customer)} (${esc(inv.email)}) &middot; ${esc(inv.location)}</p>
        <div class="table-scroll" style="margin:14px 0;">
          <table class="clean-table">
            <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit</th><th class="num">Subtotal</th></tr></thead>
            <tbody>
              ${inv.items
                .map(
                  (it) =>
                    `<tr><td>${esc(it.name)}</td><td class="num">${it.qty}</td><td class="num">${fmtUsd(it.price)}</td><td class="num">${fmtUsd(it.price * it.qty)}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
        <p style="font-size:17px;"><strong>Total (incl. $10.00 shipping): ${fmtUsd(inv.total)}</strong></p>
        <p class="muted-note">Order preview only (no payment charged) &middot; Sample inventory updated and synced to Admin &amp; Security.</p>
      `;
      return;
    }

    formSec.hidden = false;
    invSec.hidden = true;
    const summary = getCartLines();
    const listEl = document.getElementById("checkout-summary-items");
    listEl.innerHTML = summary.lines.length
      ? summary.lines
          .map(
            ({ product, qty, lineTotal }) =>
              `<div class="summary-row"><span>${esc(product.name)} &times; ${qty}</span><span>${fmtUsd(lineTotal)}</span></div>`
          )
          .join("")
      : `<p class="muted-note">Your cart is empty. Add items before placing a demo order preview.</p>`;

    document.getElementById("co-subtotal").textContent = fmtUsd(summary.subtotal);
    document.getElementById("co-shipping").textContent = fmtUsd(summary.shipping);
    document.getElementById("co-total").textContent = fmtUsd(summary.total);
    document.getElementById("place-order-btn").disabled = summary.lines.length === 0;
  }

  // ---------- View 6: Admin Preview & Security Matrix ----------
  function renderAdmin() {
    const totalSales = state.orders.reduce((s, o) => s + Number(o.total || 0), 0);
    const totalStock = state.products.reduce((s, p) => s + Number(p.stock || 0), 0);

    document.getElementById("adm-sales").textContent = fmtUsd(totalSales);
    document.getElementById("adm-orders").textContent = String(state.orders.length);
    document.getElementById("adm-stock").textContent = String(totalStock);
    document.getElementById("adm-msgs").textContent = String(state.messages.length);

    // Category stock bars
    const byCat = SEED.categories.map((c) => ({
      name: c.name,
      stock: state.products.filter((p) => p.categoryId === c.id).reduce((s, p) => s + p.stock, 0),
    }));
    const maxStock = Math.max(1, ...byCat.map((x) => x.stock));
    document.getElementById("adm-category-bars").innerHTML = byCat
      .map(
        (c) => `
          <div class="bar-row">
            <span>${esc(c.name)}</span>
            <div class="bar-track"><div class="bar-fill" style="width:${((c.stock / maxStock) * 100).toFixed(1)}%"></div></div>
            <strong style="text-align:right;">${c.stock}</strong>
          </div>
        `
      )
      .join("");

    // Orders table
    document.getElementById("adm-orders-body").innerHTML = state.orders
      .slice()
      .reverse()
      .map(
        (o) => `
          <tr class="${tutorial && tutorial.active && tutorial.orderPlacedNumber === o.orderNumber ? "tutorial-row-highlight" : ""}">
            <td><code>${esc(o.orderNumber)}</code></td>
            <td>${esc(o.customer)}</td>
            <td class="num">${fmtUsd(o.total)}</td>
            <td>${esc(o.estimatedDelivery)}</td>
          </tr>
        `
      )
      .join("");

    // Messages table
    document.getElementById("adm-messages-body").innerHTML = state.messages
      .slice()
      .reverse()
      .map(
        (m) => {
          const isTutInquiry =
            Boolean(tutorial && tutorial.active && tutorial.inquirySubmitted) &&
            m.name === "Taylor Example" &&
            m.subject === "Jersey Sizing Check (Demo)";
          return `
            <tr class="${isTutInquiry ? "tutorial-row-highlight" : ""}"${isTutInquiry ? ' data-tutorial-inquiry="true"' : ""}>
              <td>${esc(m.name)}</td>
              <td>${esc(m.subject)}</td>
              <td>${esc(m.message)}</td>
            </tr>
          `;
        }
      )
      .join("");

    // Security remediation matrix
    document.getElementById("adm-security-body").innerHTML = SEED.securityRemediation
      .map((row) => {
        const isUnrun = row.status.startsWith("UNRUN");
        return `
          <tr>
            <td><strong>${esc(row.area)}</strong></td>
            <td><code>${esc(row.file)}</code></td>
            <td><span class="tag-pill ${isUnrun ? "tag-warn" : "tag-ok"}">${esc(row.status)}</span></td>
            <td>${esc(row.detail)}</td>
          </tr>
        `;
      })
      .join("");
  }

  // ---------- Product Detail Modal ----------
  function openDetailModal(productId) {
    const prod = getProduct(productId);
    if (!prod) return;
    state.detailProductId = prod.id;
    state.detailQty = 1;
    state.detailSize = prod.sizes[0] || "Standard";

    const content = document.getElementById("detail-content");
    content.innerHTML = `
      <div class="detail-art">${ART.renderProductSvg(prod.art, "det_" + prod.id)}</div>
      <div>
        <div class="product-cat">${esc(getCategoryName(prod.categoryId))}</div>
        <h2 id="detail-title" style="margin:4px 0 8px;">${esc(prod.name)}</h2>
        <div class="product-price" style="font-size:22px;margin-bottom:10px;">${fmtUsd(prod.price)}</div>
        <p style="color:var(--body);margin:0 0 12px;">${esc(prod.description)}</p>
        <p style="margin:0 0 8px;"><strong>Available Stock:</strong> ${prod.stock}</p>
        <div class="size-row" role="group" aria-label="Select size">
          ${prod.sizes
            .map(
              (sz) =>
                `<button type="button" class="size-btn ${sz === state.detailSize ? "active" : ""}" data-size="${esc(sz)}">${esc(sz)}</button>`
            )
            .join("")}
        </div>
        <div class="detail-buy-row">
          <div class="qty-control">
            <button type="button" id="det-dec" aria-label="Decrease quantity">&minus;</button>
            <span id="det-qty">1</span>
            <button type="button" id="det-inc" aria-label="Increase quantity">+</button>
          </div>
          <button type="button" class="btn btn-primary" id="det-add-btn" ${prod.stock <= 0 ? "disabled" : ""}>
            Add To Cart
          </button>
        </div>
      </div>
    `;

    content.querySelectorAll("[data-size]").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.detailSize = btn.dataset.size;
        content.querySelectorAll("[data-size]").forEach((b) => b.classList.toggle("active", b === btn));
      });
    });

    document.getElementById("det-dec").addEventListener("click", () => {
      state.detailQty = Math.max(1, state.detailQty - 1);
      document.getElementById("det-qty").textContent = String(state.detailQty);
    });
    document.getElementById("det-inc").addEventListener("click", () => {
      state.detailQty = Math.min(Math.max(1, prod.stock), state.detailQty + 1);
      document.getElementById("det-qty").textContent = String(state.detailQty);
    });
    document.getElementById("det-add-btn").addEventListener("click", () => {
      addToCart(prod.id, state.detailQty);
      closeDetailModal();
    });

    const related = state.products
      .filter((p) => p.id !== prod.id)
      .sort((a, b) => (a.categoryId === prod.categoryId ? -1 : 1) - (b.categoryId === prod.categoryId ? -1 : 1))
      .slice(0, 3);
    document.getElementById("detail-related").innerHTML = related
      .map(
        (r) => `
          <button type="button" class="related-card" data-open-detail="${r.id}">
            ${ART.renderProductSvg(r.art, "rel_" + r.id)}
            <div style="font-size:12.5px;font-weight:600;">${esc(r.name)}</div>
            <div style="font-size:12.5px;color:var(--primary);font-weight:700;">${fmtUsd(r.price)}</div>
          </button>
        `
      )
      .join("");

    document.getElementById("detail-modal").hidden = false;
  }

  function closeDetailModal() {
    document.getElementById("detail-modal").hidden = true;
  }

  // ---------- Demo Account Modal ----------
  function openAccountModal() {
    const body = document.getElementById("account-modal-body");
    if (state.demoUser) {
      body.innerHTML = `
        <div class="notice-banner notice-info" style="margin-top:12px;">
          Signed in as <strong>${esc(state.demoUser.name)}</strong> (<code>@${esc(state.demoUser.username)}</code>)<br/>
          <span class="muted-note">${esc(state.demoUser.email)}</span>
        </div>
        <button type="button" class="btn btn-outline btn-block" id="demo-logout-btn">Logout Demo Account</button>
      `;
      document.getElementById("demo-logout-btn").addEventListener("click", () => {
        state.demoUser = null;
        persist();
        updateHeader();
        showToast("Signed out of demo account.");
        closeAccountModal();
      });
    } else {
      body.innerHTML = `
        <form id="demo-login-form" style="margin-top:12px;">
          <div class="field-group">
            <label for="acc-user">Demo Username</label>
            <input id="acc-user" type="text" value="demo_shopper" required />
          </div>
          <div class="field-group">
            <label for="acc-name">Display Name</label>
            <input id="acc-name" type="text" value="Alex Morgan-Demo" required />
          </div>
          <div class="field-group">
            <label for="acc-email">Fictional Email</label>
            <input id="acc-email" type="email" value="demo.shopper@example.invalid" required />
          </div>
          <button type="submit" class="btn btn-primary btn-block">Sign In (Local Simulation)</button>
        </form>
      `;
      document.getElementById("demo-login-form").addEventListener("submit", (e) => {
        e.preventDefault();
        state.demoUser = {
          username: document.getElementById("acc-user").value.trim() || "demo_shopper",
          name: document.getElementById("acc-name").value.trim() || "Alex Morgan-Demo",
          email: document.getElementById("acc-email").value.trim() || "demo.shopper@example.invalid",
        };
        persist();
        updateHeader();
        showToast(`Signed in as @${state.demoUser.username} (demo).`);
        closeAccountModal();
      });
    }
    document.getElementById("account-modal").hidden = false;
  }

  function closeAccountModal() {
    document.getElementById("account-modal").hidden = true;
  }

  // ---------- Event Wiring ----------
  function initEvents() {
    // Tablist navigation + keyboard arrows
    const tabs = Array.from(document.querySelectorAll(".nav-tab"));
    tabs.forEach((btn, idx) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.view === "checkout") state.lastInvoice = null;
        switchView(btn.dataset.view);
      });
      btn.addEventListener("keydown", (ev) => {
        let next = null;
        if (ev.key === "ArrowRight") next = (idx + 1) % tabs.length;
        else if (ev.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
        else if (ev.key === "Home") next = 0;
        else if (ev.key === "End") next = tabs.length - 1;
        if (next !== null) {
          ev.preventDefault();
          tabs[next].focus();
          switchView(tabs[next].dataset.view);
        }
      });
    });

    document.querySelectorAll("[data-nav]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        switchView(el.dataset.nav);
      });
    });

    // Global delegated clicks for View Detail & Add To Cart
    document.addEventListener("click", (ev) => {
      const detBtn = ev.target.closest("[data-open-detail]");
      if (detBtn) {
        openDetailModal(Number(detBtn.dataset.openDetail));
        return;
      }
      const addBtn = ev.target.closest("[data-add-cart]");
      if (addBtn) {
        addToCart(Number(addBtn.dataset.addCart), 1);
      }
    });

    // Hero prev/next
    document.getElementById("hero-prev").addEventListener("click", () => {
      state.heroIdx = (state.heroIdx + 2) % 3;
      renderHero();
    });
    document.getElementById("hero-next").addEventListener("click", () => {
      state.heroIdx = (state.heroIdx + 1) % 3;
      renderHero();
    });

    // Topbar search
    document.getElementById("topbar-search-form").addEventListener("submit", (e) => {
      e.preventDefault();
      state.filters.search = document.getElementById("topbar-search-input").value;
      state.filters.page = 1;
      syncFilterInputs();
      switchView("shop");
    });

    // Catalog filter inputs
    ["filter-search", "filter-price-min", "filter-price-max", "filter-stock-min", "filter-stock-max"].forEach((id) => {
      document.getElementById(id).addEventListener("input", () => {
        state.filters.search = document.getElementById("filter-search").value;
        state.filters.priceMin = document.getElementById("filter-price-min").value;
        state.filters.priceMax = document.getElementById("filter-price-max").value;
        state.filters.stockMin = document.getElementById("filter-stock-min").value;
        state.filters.stockMax = document.getElementById("filter-stock-max").value;
        state.filters.page = 1;
        renderShop();
      });
    });
    document.getElementById("shop-sort").addEventListener("change", (e) => {
      state.filters.sort = e.target.value;
      state.filters.page = 1;
      renderShop();
    });
    document.getElementById("reset-filters-btn").addEventListener("click", () => {
      state.filters = { search: "", priceMin: "", priceMax: "", stockMin: "", stockMax: "", categories: [], sort: "latest", page: 1 };
      syncFilterInputs();
      renderShop();
    });

    // Cart -> Checkout
    document.getElementById("proceed-checkout-btn").addEventListener("click", () => {
      state.lastInvoice = null;
      switchView("checkout");
    });

    // Fill synthetic checkout info
    document.getElementById("fill-demo-checkout").addEventListener("click", () => {
      document.getElementById("co-first").value = "Alex";
      document.getElementById("co-last").value = "Morgan-Demo";
      document.getElementById("co-email").value = "demo.shopper@example.invalid";
      document.getElementById("co-mobile").value = "+1 555-0100";
      document.getElementById("co-addr1").value = "100 Courtway Blvd";
      document.getElementById("co-addr2").value = "Apt 4B";
      document.getElementById("co-country").value = "United States";
      document.getElementById("co-city").value = "Sample City";
      document.getElementById("co-state").value = "CA";
      document.getElementById("co-zip").value = "90001";
    });

    // Simulated Checkout Submission (atomic stock decrement + invoice generation)
    document.getElementById("checkout-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const summary = getCartLines();
      if (!summary.lines.length) {
        showToast("Your cart is empty.");
        return;
      }

      // Decrement simulated stock
      summary.lines.forEach(({ product, qty }) => {
        product.stock = Math.max(0, product.stock - qty);
        product.sales += qty;
      });

      const today = new Date();
      const est = new Date(today.getTime() + summary.units * DAYS_PER_UNIT * 86400000);
      const iso = (d) => d.toISOString().slice(0, 10);
      const randHex = Math.floor(Math.random() * 0xffffffff)
        .toString(16)
        .padStart(8, "0")
        .toUpperCase();

      const order = {
        orderNumber: "NBA-" + randHex,
        customer: `${document.getElementById("co-first").value.trim()} ${document.getElementById("co-last").value.trim()}`,
        email: document.getElementById("co-email").value.trim(),
        location: `${document.getElementById("co-city").value.trim()}, ${document.getElementById("co-state").value.trim()} (${document.getElementById("co-country").value})`,
        date: iso(today),
        estimatedDelivery: iso(est),
        total: summary.total,
        items: summary.lines.map(({ product, qty }) => ({
          name: product.name,
          qty,
          price: product.price,
        })),
      };

      state.orders.push(order);
      state.cart = {};
      state.lastInvoice = order;
      persist();
      updateHeader();
      renderCheckout();
      showToast(`Order preview ${order.orderNumber} recorded locally.`);
    });

    document.getElementById("invoice-back-shop").addEventListener("click", () => {
      state.lastInvoice = null;
      switchView("shop");
    });

    // Contact form -> Admin Messages inbox
    document.getElementById("contact-form").addEventListener("submit", (e) => {
      e.preventDefault();
      state.messages.push({
        id: state.messages.length + 1,
        name: document.getElementById("ct-name").value.trim(),
        email: document.getElementById("ct-email").value.trim(),
        subject: document.getElementById("ct-subject").value.trim(),
        message: document.getElementById("ct-message").value.trim(),
        date: new Date().toISOString().slice(0, 10),
      });
      persist();
      e.target.reset();
      showToast("Demo inquiry added to the Admin inbox.");
    });

    // Modals & Escape key
    document.getElementById("detail-close").addEventListener("click", closeDetailModal);
    document.getElementById("detail-modal").addEventListener("click", (e) => {
      if (e.target.id === "detail-modal") closeDetailModal();
    });
    document.getElementById("account-trigger").addEventListener("click", openAccountModal);
    document.getElementById("account-close").addEventListener("click", closeAccountModal);
    document.getElementById("account-modal").addEventListener("click", (e) => {
      if (e.target.id === "account-modal") closeAccountModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const detModal = document.getElementById("detail-modal");
        const accModal = document.getElementById("account-modal");
        const modalWasOpen = Boolean((detModal && !detModal.hidden) || (accModal && !accModal.hidden));
        if (modalWasOpen) {
          closeDetailModal();
          closeAccountModal();
          if (tutorial.active && tutorial.playing) {
            pauseTutorial();
          }
          return;
        }
        if (tutorial.active) {
          e.preventDefault();
          exitTutorial({ restoreFocus: true });
        }
      }
      if (tutorial.active) {
        const tag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : "";
        if (tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") {
          if (e.key === "PageDown" || e.key === "PageUp" || e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End" || e.key === " ") {
            tutorial.programmaticScrollUntil = 0;
            tutorial.modalProgrammaticScrollUntil = 0;
            tutorial.userScrollIntentUntil = Date.now() + 900;
            tutorial.modalUserScrollIntentUntil = Date.now() + 900;
          }
        }
      }
    });
  }

  // ---------- Interactive Watch Tutorial, Persistence Isolation & Adaptive Viewport Fitting ----------
  const TUTORIAL_CSS_VARS = ["--tut-dock-offset", "--tut-avail-h"];

  const tutorial = {
    active: false,
    playing: false,
    completed: false,
    stageIndex: 0,
    preSubActionDone: false,
    subActionDone: false,
    preSecondSubActionDone: false,
    secondSubActionDone: false,
    stageToken: 0,
    subTimers: [],
    advanceTimer: null,
    resizeSettleTimer: null,
    driving: false,
    userScrolledAway: false,
    modalUserScrolledAway: false,
    lastGuidedScrollY: 0,
    modalLastGuidedScrollTop: 0,
    programmaticScrollUntil: 0,
    modalProgrammaticScrollUntil: 0,
    resizeIgnoreScrollUntil: 0,
    userScrollIntentUntil: 0,
    modalUserScrollIntentUntil: 0,
    lastViewportW: window.innerWidth || 0,
    lastViewportH: window.innerHeight || 0,
    activeTargetSelector: null,
    subFocusSelector: null,
    resolvedFocusSelector: null,
    modalFocusSelectors: null,
    modalPhase: 0,
    actionStatusText: "",
    manualSnapshot: null,
    orderPlacedNumber: null,
    inquirySubmitted: false,
    adaptiveLayout: {
      density: "standard",
      dockOffset: 96,
      availH: 600,
    },
  };

  function prefersReducedMotion() {
    return (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function clearTutorialTimers() {
    while (tutorial.subTimers.length > 0) {
      clearTimeout(tutorial.subTimers.pop());
    }
    if (tutorial.advanceTimer !== null) {
      clearTimeout(tutorial.advanceTimer);
      tutorial.advanceTimer = null;
    }
  }

  function clearSpotlight() {
    document.querySelectorAll(".tutorial-spotlight").forEach((el) => {
      el.classList.remove("tutorial-spotlight");
    });
    document.querySelectorAll(".tutorial-control-focus").forEach((el) => {
      el.classList.remove("tutorial-control-focus");
    });
  }

  function setTutorialControlFocus(selectors) {
    document.querySelectorAll(".tutorial-control-focus").forEach((el) => {
      el.classList.remove("tutorial-control-focus");
    });
    if (!selectors) return;
    const list = Array.isArray(selectors) ? selectors : [selectors];
    list.forEach((sel) => {
      const el = document.querySelector(sel);
      if (el) el.classList.add("tutorial-control-focus");
    });
  }

  function clearTutorialToasts() {
    const tr = document.getElementById("toast-region");
    if (tr) tr.innerHTML = "";
  }

  function setTutorialActionStatus(text) {
    tutorial.actionStatusText = text || "";
    const statusEl = document.getElementById("tutorialActionStatus");
    if (!statusEl) return;
    if (tutorial.actionStatusText && tutorial.active) {
      statusEl.textContent = tutorial.actionStatusText;
      statusEl.hidden = false;
    } else {
      statusEl.textContent = "";
      statusEl.hidden = true;
    }
  }

  function closeTutorialModals() {
    closeDetailModal();
    closeAccountModal();
  }

  function captureManualSnapshot() {
    tutorial.manualSnapshot = {
      rawStorage: safeReadRawStorage(),
      view: state.view,
      heroIdx: state.heroIdx,
      jerseysOpen: state.jerseysOpen,
      products: clone(state.products),
      cart: clone(state.cart),
      orders: clone(state.orders),
      messages: clone(state.messages),
      demoUser: clone(state.demoUser),
      filters: clone(state.filters),
      lastInvoice: clone(state.lastInvoice),
    };
  }

  function clearCheckoutAndContactForms() {
    const coForm = document.getElementById("checkout-form");
    if (coForm && typeof coForm.reset === "function") coForm.reset();
    const ctForm = document.getElementById("contact-form");
    if (ctForm && typeof ctForm.reset === "function") ctForm.reset();
  }

  function resetIsolatedTutorialSession() {
    closeTutorialModals();
    state.products = clone(SEED.products);
    state.cart = {};
    state.orders = clone(SEED.initialOrders);
    state.messages = clone(SEED.initialMessages);
    state.demoUser = null;
    state.filters = defaultFilters();
    state.lastInvoice = null;
    state.heroIdx = 0;
    state.jerseysOpen = true;
    tutorial.orderPlacedNumber = null;
    tutorial.inquirySubmitted = false;
    clearCheckoutAndContactForms();
    syncFilterInputs();
    updateHeader();
  }

  function restoreManualSessionOnExit() {
    const snap = tutorial.manualSnapshot;
    tutorial.manualSnapshot = null;
    tutorial.orderPlacedNumber = null;
    tutorial.inquirySubmitted = false;
    clearCheckoutAndContactForms();

    if (!snap) {
      updateHeader();
      return;
    }

    const currentRaw = safeReadRawStorage();
    // Never overwrite newer persisted state from another browser context with a stale in-memory snapshot.
    if (currentRaw && currentRaw !== snap.rawStorage) {
      try {
        const fresh = JSON.parse(currentRaw);
        state.products = (fresh && Array.isArray(fresh.products) && fresh.products.length === SEED.products.length)
          ? fresh.products
          : clone(SEED.products);
        state.cart = (fresh && fresh.cart && typeof fresh.cart === "object") ? fresh.cart : {};
        state.orders = (fresh && Array.isArray(fresh.orders)) ? fresh.orders : clone(SEED.initialOrders);
        state.messages = (fresh && Array.isArray(fresh.messages)) ? fresh.messages : clone(SEED.initialMessages);
        state.demoUser = (fresh && fresh.demoUser) ? fresh.demoUser : null;
      } catch (_) {
        state.products = clone(snap.products);
        state.cart = clone(snap.cart);
        state.orders = clone(snap.orders);
        state.messages = clone(snap.messages);
        state.demoUser = clone(snap.demoUser);
      }
    } else {
      state.products = clone(snap.products);
      state.cart = clone(snap.cart);
      state.orders = clone(snap.orders);
      state.messages = clone(snap.messages);
      state.demoUser = clone(snap.demoUser);
    }

    state.heroIdx = snap.heroIdx;
    state.jerseysOpen = snap.jerseysOpen;
    state.filters = clone(snap.filters);
    state.lastInvoice = clone(snap.lastInvoice);

    syncFilterInputs();
    updateHeader();
    switchView(snap.view || "home");
  }

  function ensureTutorialCartItem(productId, minQty) {
    const prod = getProduct(productId);
    if (!prod || prod.stock <= 0) return;
    const current = Number(state.cart[productId] || 0);
    if (current < minQty) {
      state.cart[productId] = Math.min(prod.stock, minQty);
      updateHeader();
    }
  }

  function dispatchFormSubmit(formEl) {
    if (!formEl) return;
    if (typeof Event === "function") {
      formEl.dispatchEvent(new Event("submit", { cancelable: true }));
    } else {
      formEl.dispatchEvent({ type: "submit", cancelable: true, preventDefault() {} });
    }
  }

  function ensureTutorialOrderPlaced() {
    if (tutorial.orderPlacedNumber) {
      const existing = state.orders.find((o) => o.orderNumber === tutorial.orderPlacedNumber);
      if (existing) {
        state.lastInvoice = existing;
        return existing;
      }
    }

    if (cartUnitCount() === 0) {
      ensureTutorialCartItem(1, 3);
    }
    const fillBtn = document.getElementById("fill-demo-checkout");
    if (fillBtn) fillBtn.click();

    dispatchFormSubmit(document.getElementById("checkout-form"));
    if (state.lastInvoice) {
      tutorial.orderPlacedNumber = state.lastInvoice.orderNumber;
    }
    return state.lastInvoice;
  }

  function ensureTutorialInquirySubmitted() {
    if (tutorial.inquirySubmitted) return;
    const nameEl = document.getElementById("ct-name");
    const emailEl = document.getElementById("ct-email");
    const subjEl = document.getElementById("ct-subject");
    const msgEl = document.getElementById("ct-message");
    if (nameEl) nameEl.value = "Taylor Example";
    if (emailEl) emailEl.value = "taylor@example.invalid";
    if (subjEl) subjEl.value = "Jersey Sizing Check (Demo)";
    if (msgEl) msgEl.value = "Synthetic tutorial inquiry demonstrating local Admin inbox synchronization. Zero external transmission.";
    dispatchFormSubmit(document.getElementById("contact-form"));
    tutorial.inquirySubmitted = true;
    state.demoUser = {
      username: "demo_shopper",
      name: "Alex Morgan-Demo",
      email: "demo.shopper@example.invalid",
    };
    updateHeader();
  }

  const TUTORIAL_STAGES = [
    {
      id: "home-intro",
      view: "home",
      targetSelector: "#home-hero-layout",
      compactTargetSelector: "#hero-carousel",
      requiredSelectors: ["#home-hero-layout"],
      title: "Storefront Overview & Featured Merchandise",
      narration:
        "NBASHOP organizes basketball gear across 12 browsable categories alongside an interactive featured-product carousel. Watch the hero carousel advance.",
      durationMs: 4000,
      subDelayMs: 1400,
      enter() {
        closeTutorialModals();
        state.heroIdx = 0;
        switchView("home");
      },
      subAction() {
        const nextBtn = document.getElementById("hero-next");
        if (nextBtn) nextBtn.click();
        focusSubTargetIfNeeded("#hero-carousel", "#hero-carousel");
      },
    },
    {
      id: "catalog-filter",
      view: "shop",
      targetSelector: "#shop-layout",
      compactTargetSelector: "#shop-toolbar",
      requiredSelectors: ["#shop-filter-sidebar", "#shop-toolbar", "#shop-grid"],
      title: "Product Catalog & Price Sorting",
      narration:
        "Filter products by name, price range, stock level, or category. Next, the catalog filters to Men's Jersey and sorts by Price: Low to High ($119 to $129).",
      durationMs: 4400,
      subDelayMs: 1400,
      enter() {
        closeTutorialModals();
        state.filters = defaultFilters();
        syncFilterInputs();
        switchView("shop");
      },
      subAction() {
        state.filters.categories = [1];
        state.filters.sort = "price_asc";
        state.filters.page = 1;
        syncFilterInputs();
        renderShop();
        focusSubTargetIfNeeded("#shop-toolbar", "#shop-layout");
      },
    },
    {
      id: "product-detail",
      view: "shop",
      targetSelector: "#detail-modal .modal-dialog",
      compactTargetSelector: "#detail-modal .modal-dialog",
      requiredSelectors: ["#detail-content", "#det-add-btn"],
      isModalStage: true,
      title: "Product Details, Size & Add to Cart",
      narration:
        "Inspect product details, available stock, and sizing options. Next, select size L, raise quantity to 2, and add Apex Crimson Court Jersey #23 to the cart.",
      durationMs: 5000,
      preSubDelayMs: 850,
      subDelayMs: 1500,
      preSecondSubDelayMs: 2450,
      secondSubDelayMs: 3050,
      enter() {
        closeTutorialModals();
        switchView("shop");
        openDetailModal(1);
        tutorial.modalPhase = 0;
        tutorial.modalFocusSelectors = null;
        tutorial.modalUserScrolledAway = false;
        tutorial.modalLastGuidedScrollTop = 0;
        setTutorialActionStatus("");
        const dlg = getDetailModalDialog();
        if (dlg) {
          tutorial.modalProgrammaticScrollUntil = Date.now() + 200;
          dlg.scrollTop = 0;
        }
      },
      preSubAction() {
        tutorial.modalPhase = 1;
        tutorial.modalFocusSelectors = [".size-row", ".detail-buy-row"];
        scrollModalElementIntoView([".size-row", ".detail-buy-row"], { instant: prefersReducedMotion() });
        setTutorialControlFocus([".size-row", ".qty-control"]);
      },
      subAction() {
        tutorial.modalPhase = 2;
        tutorial.modalFocusSelectors = [".size-row", ".detail-buy-row"];
        scrollModalElementIntoView([".size-row", ".detail-buy-row"], { instant: true });
        const sizeL = document.querySelector('#detail-content [data-size="L"]');
        if (sizeL) sizeL.click();
        const incBtn = document.getElementById("det-inc");
        if (incBtn) incBtn.click();
        setTutorialControlFocus(['#detail-content [data-size="L"]', ".qty-control"]);
      },
      preSecondSubAction() {
        tutorial.modalPhase = 3;
        tutorial.modalFocusSelectors = ["#det-add-btn"];
        scrollModalElementIntoView(["#det-add-btn"], { instant: prefersReducedMotion() });
        setTutorialControlFocus(["#det-add-btn"]);
      },
      secondSubAction() {
        tutorial.modalPhase = 4;
        tutorial.modalFocusSelectors = ["#det-add-btn"];
        scrollModalElementIntoView(["#det-add-btn"], { instant: true });
        const addBtn = document.getElementById("det-add-btn");
        if (addBtn) addBtn.click();
        setTutorialControlFocus(null);
        const qty = cartUnitCount();
        setTutorialActionStatus(
          `Added ${state.detailQty} \u00d7 Apex Crimson Court Jersey #23 (Size ${state.detailSize}) \u00b7 Cart: ${qty} items`
        );
        updateTutorialAdaptiveLayout();
      },
    },
    {
      id: "shopping-cart",
      view: "cart",
      targetSelector: "#cart-layout",
      compactTargetSelector: "#cart-items-card",
      requiredSelectors: ["#cart-items-card", "#cart-summary-card"],
      title: "Shopping Cart & Order Totals",
      narration:
        "Quantity controls respect available sample inventory and automatically add the $10.00 flat shipping fee. Watch quantity increase from 2 to 3 ($367.00 total).",
      durationMs: 4400,
      subDelayMs: 1400,
      enter() {
        closeTutorialModals();
        if (!tutorial.orderPlacedNumber) {
          ensureTutorialCartItem(1, 2);
        } else {
          state.cart = { 1: Math.min(getProduct(1).stock, 2) };
          updateHeader();
        }
        switchView("cart");
      },
      subAction() {
        const incBtn = document.querySelector('[data-cart-inc="1"]');
        if (incBtn) incBtn.click();
        focusSubTargetIfNeeded("#cart-summary-card", "#cart-layout");
      },
    },
    {
      id: "checkout-preview",
      view: "checkout",
      targetSelector: "#checkout-form-section",
      compactTargetSelector: "#checkout-form",
      requiredSelectors: ["#checkout-form", "#checkout-summary-card"],
      title: "Checkout Preview (No Payment Collected)",
      narration:
        "Payment card and IBAN inputs are omitted in this browser preview. Next, sample shipping details populate alongside the order summary.",
      durationMs: 4400,
      subDelayMs: 1400,
      enter() {
        closeTutorialModals();
        state.lastInvoice = null;
        if (cartUnitCount() === 0) {
          ensureTutorialCartItem(1, 3);
        }
        clearCheckoutAndContactForms();
        switchView("checkout");
      },
      subAction() {
        const fillBtn = document.getElementById("fill-demo-checkout");
        if (fillBtn) fillBtn.click();
        focusSubTargetIfNeeded("#checkout-summary-card", "#checkout-form-section");
      },
    },
    {
      id: "order-receipt",
      view: "checkout",
      targetSelector: "#invoice-section",
      compactTargetSelector: "#invoice-section",
      requiredSelectors: ["#invoice-section", "#invoice-body"],
      title: "Order Receipt & Inventory Update",
      narration:
        "Submitting generates a local NBA-XXXXXXXX receipt, updates sample inventory (34 to 31 units), and records the order in Administration with no payment charged.",
      durationMs: 4400,
      enter() {
        closeTutorialModals();
        switchView("checkout");
        ensureTutorialOrderPlaced();
        renderCheckout();
      },
    },
    {
      id: "contact-inquiry",
      view: "contact",
      targetSelector: "#contact-layout",
      compactTargetSelector: "#contact-form",
      requiredSelectors: ["#contact-form"],
      title: "Customer Inquiries & Demo Account",
      narration:
        "Storefront inquiries route locally to the Admin inbox with zero external transmission. Next, a sample inquiry is submitted and the header switches to @demo_shopper.",
      durationMs: 4400,
      subDelayMs: 1400,
      enter() {
        closeTutorialModals();
        switchView("contact");
      },
      subAction() {
        ensureTutorialInquirySubmitted();
      },
    },
    {
      id: "admin-dashboard",
      view: "admin",
      targetSelector: "#admin-overview-zone",
      compactTargetSelector: "#admin-kpi-strip",
      requiredSelectors: ["#admin-kpi-strip", "#admin-stock-card", "#admin-orders-card"],
      title: "Administration, Orders & Inquiries",
      narration:
        "The Admin dashboard updates with the demo order volume, category inventory counts, the newly recorded NBA-XXXXXXXX order, and the synced customer inquiry.",
      durationMs: 5800,
      subDelayMs: 1800,
      secondSubDelayMs: 3600,
      enter() {
        closeTutorialModals();
        ensureTutorialOrderPlaced();
        ensureTutorialInquirySubmitted();
        clearTutorialToasts();
        switchView("admin");
        const ordersWrap = document.getElementById("adm-orders-wrap");
        if (ordersWrap) ordersWrap.scrollTop = 0;
        const msgWrap = document.getElementById("adm-messages-wrap");
        if (msgWrap) msgWrap.scrollTop = 0;
      },
      subAction() {
        const ordersWrap = document.getElementById("adm-orders-wrap");
        if (ordersWrap) ordersWrap.scrollTop = 0;
        focusSubTargetIfNeeded("#admin-orders-card", "#admin-orders-card");
      },
      secondSubAction() {
        const dock = document.getElementById("tutorialDock");
        const msgWrap = document.getElementById("adm-messages-wrap");
        if (msgWrap) msgWrap.scrollTop = 0;
        const inboxHeading = document.getElementById("admin-inbox-heading");
        const inquiryRow = document.querySelector('#adm-messages-body [data-tutorial-inquiry="true"]');
        const headingVis = inboxHeading && dock ? getElementClippedVisibility(inboxHeading, dock) : null;
        const rowVis = inquiryRow && dock ? getElementClippedVisibility(inquiryRow, dock) : null;
        if (headingVis && headingVis.full && rowVis && rowVis.full) {
          return;
        }
        focusSubTargetIfNeeded("#admin-inbox-section", "#admin-inbox-section");
      },
    },
    {
      id: "security-matrix",
      view: "admin",
      targetSelector: "#admin-security-card",
      compactTargetSelector: "#admin-security-card",
      requiredSelectors: ["#admin-security-card"],
      title: "Backend Security Summary",
      narration:
        "This table documents security remediations historically verified on the separate private PHP/MySQL codebase (14/14 static and 17/17 CI runtime tests; not executed in this browser preview).",
      durationMs: 4600,
      enter() {
        closeTutorialModals();
        switchView("admin");
      },
    },
    {
      id: "finish",
      view: "home",
      targetSelector: "#home-hero-layout",
      compactTargetSelector: "#home-hero-layout",
      requiredSelectors: ["#home-hero-layout"],
      title: "Walkthrough Complete",
      narration:
        "You have toured NBASHOP's catalog, product details, shopping cart, checkout preview, administration dashboard, and backend security summary. Click Replay or Exit to explore freely.",
      durationMs: 0,
      enter() {
        closeTutorialModals();
        state.heroIdx = 0;
        switchView("home");
      },
    },
  ];

  function computeTutorialDensity(vw, vh) {
    if (vh <= 620 || vw <= 360) return "tight";
    if (vh <= 780 || vw <= 680) return "compact";
    return "standard";
  }

  function setRootCssVar(name, value) {
    const rootStyle = document.documentElement && document.documentElement.style;
    if (rootStyle && typeof rootStyle.setProperty === "function") {
      rootStyle.setProperty(name, value);
    }
  }

  function clearTutorialAdaptiveLayout() {
    if (document.body && document.body.dataset) {
      delete document.body.dataset.tutorialStage;
      delete document.body.dataset.tutorialDensity;
    }
    const rootStyle = document.documentElement && document.documentElement.style;
    if (rootStyle && typeof rootStyle.removeProperty === "function") {
      TUTORIAL_CSS_VARS.forEach((v) => rootStyle.removeProperty(v));
    }
    tutorial.adaptiveLayout = {
      density: "standard",
      dockOffset: 96,
      availH: 600,
    };
  }

  function getDockClearanceMetrics(dock) {
    const vh = window.innerHeight || 768;
    const vw = window.innerWidth || 1280;
    const density = computeTutorialDensity(vw, vh);
    const stickyTop = density === "tight" || vw <= 680 ? 4 : 6;
    const gap = density === "tight" ? 6 : density === "compact" ? 8 : 10;
    const dockH = dock ? dock.getBoundingClientRect().height || 0 : 0;
    const topEdge = stickyTop + dockH + gap;
    const availH = Math.max(80, vh - topEdge - 6);
    return { vh, vw, density, stickyTop, gap, dockH, topEdge, availH };
  }

  function updateTutorialAdaptiveLayout() {
    if (!tutorial.active) {
      clearTutorialAdaptiveLayout();
      return;
    }
    const stage = TUTORIAL_STAGES[tutorial.stageIndex];
    const dock = document.getElementById("tutorialDock");
    if (!stage || !dock) return;

    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 768;
    const density = computeTutorialDensity(vw, vh);
    if (document.body && document.body.dataset) {
      document.body.dataset.tutorialStage = stage.id;
      document.body.dataset.tutorialDensity = density;
    }

    const { topEdge, availH } = getDockClearanceMetrics(dock);
    const dockOffset = Math.round(topEdge);
    tutorial.adaptiveLayout = {
      density,
      dockOffset,
      availH: Math.round(availH),
    };
    setRootCssVar("--tut-dock-offset", `${dockOffset}px`);
    setRootCssVar("--tut-avail-h", `${Math.round(availH)}px`);
  }

  function getDetailModalDialog() {
    const backdrop = document.getElementById("detail-modal");
    if (!backdrop || backdrop.hidden) return null;
    return backdrop.querySelector(".modal-dialog");
  }

  function getElementClippedVisibility(el, dock) {
    if (!el) return null;
    const vh = window.innerHeight || 768;
    const vw = window.innerWidth || 1280;
    const er = el.getBoundingClientRect();
    if (!er || er.height <= 0 || er.width <= 0) return null;

    let clipTop = 0;
    let clipBottom = vh;
    let clipLeft = 0;
    let clipRight = vw;

    const dockIsAncestor = Boolean(dock && typeof dock.contains === "function" && dock.contains(el));
    if (dock && !dock.hidden && !dockIsAncestor) {
      const dr = dock.getBoundingClientRect();
      if (dr && dr.height > 0) {
        if (dr.top < -1 || dr.bottom > vh + 1) {
          return {
            top: Math.round(er.top),
            bottom: Math.round(er.bottom),
            height: Math.round(er.height),
            visibleTop: 0,
            visibleBottom: 0,
            visibleHeight: 0,
            visibleRatio: 0,
            full: false,
            clippedByAncestor: false,
          };
        }
        clipTop = Math.max(clipTop, dr.bottom + 1);
      }
    }

    let clippedByAncestor = false;
    let anc = el.parentElement || null;
    while (anc && anc !== document.body && anc !== document.documentElement) {
      let isClip = Boolean(anc.classList && anc.classList.contains("modal-dialog"));
      if (!isClip && typeof window.getComputedStyle === "function") {
        const cs = window.getComputedStyle(anc);
        if (cs) {
          const oy = cs.overflowY || cs.overflow || "";
          if (oy === "auto" || oy === "scroll" || oy === "hidden" || oy === "clip") {
            isClip = true;
          }
        }
      }
      if (isClip) {
        const ar = anc.getBoundingClientRect();
        if (ar && ar.height > 0 && ar.width > 0) {
          if (er.top < ar.top - 1 || er.bottom > ar.bottom + 1) {
            clippedByAncestor = true;
          }
          clipTop = Math.max(clipTop, ar.top);
          clipBottom = Math.min(clipBottom, ar.bottom);
          clipLeft = Math.max(clipLeft, ar.left);
          clipRight = Math.min(clipRight, ar.right);
        }
      }
      anc = anc.parentElement || null;
    }

    const visTop = Math.max(er.top, clipTop);
    const visBottom = Math.min(er.bottom, clipBottom);
    const visLeft = Math.max(er.left, clipLeft);
    const visRight = Math.min(er.right, clipRight);
    const visibleHeight = visRight > visLeft ? Math.max(0, visBottom - visTop) : 0;
    const visibleRatio = er.height > 0 ? Math.min(1, visibleHeight / er.height) : 0;
    const full = visibleHeight >= er.height - 2 && visibleRatio >= 0.98 && er.top >= clipTop - 1 && er.bottom <= clipBottom + 1;

    return {
      top: Math.round(er.top),
      bottom: Math.round(er.bottom),
      height: Math.round(er.height),
      visibleTop: Math.round(visTop),
      visibleBottom: Math.round(visBottom),
      visibleHeight: Math.round(visibleHeight),
      visibleRatio: Math.round(visibleRatio * 100) / 100,
      full,
      clippedByAncestor,
    };
  }

  function isElementFullyInSafeViewport(dock, el) {
    if (!el || !dock) return false;
    const vis = getElementClippedVisibility(el, dock);
    return Boolean(vis && vis.full);
  }

  function scrollModalElementIntoView(selectors, options) {
    const opts = options || {};
    if (!tutorial.active) return false;
    if ((tutorial.userScrolledAway || tutorial.modalUserScrolledAway) && !opts.force) return false;
    const dlg = getDetailModalDialog();
    const dock = document.getElementById("tutorialDock");
    if (!dlg || !dock) return false;

    const list = Array.isArray(selectors) ? selectors : [selectors];
    const els = list.map((s) => (typeof s === "string" ? document.querySelector(s) : s)).filter(Boolean);
    if (els.length === 0) return false;

    // If every requested control is already fully visible inside the modal's clipped safe bounds, skip scrolling.
    const allAlreadyVisible = els.every((el) => {
      const v = getElementClippedVisibility(el, dock);
      return Boolean(v && v.full);
    });
    if (allAlreadyVisible && !opts.force) {
      tutorial.modalLastGuidedScrollTop = Math.round(dlg.scrollTop || 0);
      return false;
    }

    const maxScrollTop = Math.max(0, (dlg.scrollHeight || 0) - (dlg.clientHeight || 0));
    if (maxScrollTop <= 1) {
      tutorial.modalLastGuidedScrollTop = Math.round(dlg.scrollTop || 0);
      return false;
    }

    const dlgRect = dlg.getBoundingClientRect();
    let minRelTop = Infinity;
    let maxRelBottom = -Infinity;
    els.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (!r || r.height <= 0) return;
      const relTop = r.top - dlgRect.top + (dlg.scrollTop || 0);
      const relBot = r.bottom - dlgRect.top + (dlg.scrollTop || 0);
      if (relTop < minRelTop) minRelTop = relTop;
      if (relBot > maxRelBottom) maxRelBottom = relBot;
    });
    if (!Number.isFinite(minRelTop) || !Number.isFinite(maxRelBottom)) return false;

    const pad = 12;
    const groupH = maxRelBottom - minRelTop;
    const availModalH = Math.max(60, (dlg.clientHeight || dlgRect.height || 240) - pad * 2);
    let desiredTop;
    if (groupH <= availModalH) {
      // Frame the whole control group comfortably inside the modal viewport
      desiredTop = maxRelBottom - (dlg.clientHeight || dlgRect.height) + pad;
      if (desiredTop > minRelTop - pad) {
        desiredTop = minRelTop - pad;
      }
    } else {
      // Align primary control cleanly near the top of the modal container
      desiredTop = minRelTop - pad;
    }

    const targetTop = Math.max(0, Math.min(maxScrollTop, Math.round(desiredTop)));
    const curTop = Math.round(dlg.scrollTop || 0);
    if (Math.abs(targetTop - curTop) <= 2) {
      tutorial.modalLastGuidedScrollTop = curTop;
      return false;
    }

    const useInstant = Boolean(opts.instant || prefersReducedMotion());
    tutorial.modalLastGuidedScrollTop = targetTop;
    tutorial.modalProgrammaticScrollUntil = Date.now() + (useInstant ? 200 : 520);
    if (typeof dlg.scrollTo === "function") {
      dlg.scrollTo({ top: targetTop, behavior: useInstant ? "auto" : "smooth" });
    } else {
      dlg.scrollTop = targetTop;
    }
    return true;
  }

  function getModalVisibilitySnapshot(dock) {
    const dlg = getDetailModalDialog();
    const dlgRect = dlg ? dlg.getBoundingClientRect() : null;
    const statusEl = document.getElementById("tutorialActionStatus");
    const toastEl = document.querySelector("#toast-region .toast");
    return {
      open: Boolean(dlg),
      dialog: dlgRect
        ? {
            top: Math.round(dlgRect.top),
            bottom: Math.round(dlgRect.bottom),
            scrollTop: Math.round(dlg.scrollTop || 0),
            scrollHeight: dlg.scrollHeight || 0,
            clientHeight: dlg.clientHeight || 0,
          }
        : null,
      title: dlg ? getElementClippedVisibility(document.getElementById("detail-title"), dock) : null,
      artwork: dlg ? getElementClippedVisibility(dlg.querySelector(".detail-art"), dock) : null,
      sizeRow: dlg ? getElementClippedVisibility(dlg.querySelector(".size-row"), dock) : null,
      qtyControl: dlg ? getElementClippedVisibility(dlg.querySelector(".qty-control"), dock) : null,
      addBtn: dlg ? getElementClippedVisibility(document.getElementById("det-add-btn"), dock) : null,
      actionStatus:
        statusEl && !statusEl.hidden ? getElementClippedVisibility(statusEl, dock) : null,
      toast: toastEl ? getElementClippedVisibility(toastEl, dock) : null,
    };
  }

  function getAdminVisibilitySnapshot(dock) {
    if (state.view !== "admin") return null;
    return {
      kpiStrip: getElementClippedVisibility(document.getElementById("admin-kpi-strip"), dock),
      ordersCard: getElementClippedVisibility(document.getElementById("admin-orders-card"), dock),
      highlightedOrderRow: getElementClippedVisibility(
        document.querySelector("#adm-orders-body .tutorial-row-highlight"),
        dock
      ),
      inboxSection: getElementClippedVisibility(document.getElementById("admin-inbox-section"), dock),
      inboxHeading: getElementClippedVisibility(document.getElementById("admin-inbox-heading"), dock),
      highlightedInquiryRow: getElementClippedVisibility(
        document.querySelector('#adm-messages-body [data-tutorial-inquiry="true"]'),
        dock
      ),
    };
  }

  function getStageRequiredVisibility(dock, stage) {
    if (!dock || !stage) {
      return { selectors: [], allFullyVisible: true, combinedHeight: 0, minTop: 0, maxBottom: 0 };
    }
    const sels = stage.requiredSelectors || (stage.targetSelector ? [stage.targetSelector] : []);
    let minTop = Infinity;
    let maxBottom = -Infinity;
    let foundAny = false;
    let allFullyVisible = true;
    const details = [];

    sels.forEach((sel) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (r.height <= 0 || r.width <= 0) return;
      foundAny = true;
      if (r.top < minTop) minTop = r.top;
      if (r.bottom > maxBottom) maxBottom = r.bottom;
      const full = isElementFullyInSafeViewport(dock, el);
      if (!full) allFullyVisible = false;
      details.push({ selector: sel, top: Math.round(r.top), bottom: Math.round(r.bottom), full });
    });

    return {
      selectors: details,
      allFullyVisible: foundAny ? allFullyVisible : true,
      combinedHeight: foundAny ? Math.max(0, maxBottom - minTop) : 0,
      minTop: foundAny ? minTop : 0,
      maxBottom: foundAny ? maxBottom : 0,
    };
  }

  function applyStageSpotlight(selector) {
    clearSpotlight();
    if (!selector) return;
    const el = document.querySelector(selector);
    if (el) el.classList.add("tutorial-spotlight");
  }

  function focusSubTargetIfNeeded(focusSelector, spotlightSelector) {
    if (spotlightSelector) applyStageSpotlight(spotlightSelector);
    const dock = document.getElementById("tutorialDock");
    const targetEl = document.querySelector(focusSelector);
    if (!dock || !targetEl) return;

    const stage = TUTORIAL_STAGES[tutorial.stageIndex];
    const primaryEl = stage && stage.targetSelector ? document.querySelector(stage.targetSelector) : null;
    if (primaryEl && isElementFullyInSafeViewport(dock, primaryEl) && isElementFullyInSafeViewport(dock, targetEl)) {
      return;
    }

    tutorial.subFocusSelector = focusSelector;
    tutorial.resolvedFocusSelector = focusSelector;
    if (tutorial.userScrolledAway) return;
    if (!isElementFullyInSafeViewport(dock, targetEl)) {
      positionTutorialWorkspace(focusSelector, { instant: prefersReducedMotion(), force: true });
    }
  }

  function resolveGuidedFocusSelector(dock) {
    const stage = TUTORIAL_STAGES[tutorial.stageIndex];
    if (!stage) return tutorial.activeTargetSelector;
    const primarySel = tutorial.activeTargetSelector || stage.targetSelector;
    const primaryEl = primarySel ? document.querySelector(primarySel) : null;

    if (tutorial.subFocusSelector) {
      const subEl = document.querySelector(tutorial.subFocusSelector);
      if (subEl) {
        if (primaryEl && typeof primaryEl.contains === "function" && primaryEl.contains(subEl)) {
          const { availH } = getDockClearanceMetrics(dock);
          const pRect = primaryEl.getBoundingClientRect();
          if (pRect && pRect.height > 0 && pRect.height <= availH + 2) {
            return primarySel;
          }
        }
        return tutorial.subFocusSelector;
      }
    }

    const compactSel = stage.compactTargetSelector || null;
    if (!primarySel || !compactSel || compactSel === primarySel) return primarySel;

    const compactEl = document.querySelector(compactSel);
    if (!primaryEl || !compactEl) return primarySel;

    const { availH } = getDockClearanceMetrics(dock);
    const pRect = primaryEl.getBoundingClientRect();
    const reqVis = getStageRequiredVisibility(dock, stage);
    const requiredSpanFromPrimaryTop =
      reqVis.selectors.length > 0 ? Math.max(0, reqVis.maxBottom - pRect.top) : pRect.height;

    if (pRect.height <= availH + 2 || requiredSpanFromPrimaryTop <= availH + 2) {
      return primarySel;
    }
    return compactSel;
  }

  function computeGuidedScrollY(dock, target) {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const { vh, stickyTop, topEdge } = getDockClearanceMetrics(dock);
    const maxScrollY = Math.max(0, (document.documentElement.scrollHeight || 0) - vh);
    const dockRect = dock.getBoundingClientRect();

    const stage = TUTORIAL_STAGES[tutorial.stageIndex];
    if (!target || (stage && stage.isModalStage)) {
      const dockDocTop = dockRect.top + scrollY;
      return Math.max(0, Math.min(maxScrollY, Math.round(dockDocTop - stickyTop)));
    }

    const targetRect = target.getBoundingClientRect();
    const targetDocTop = targetRect.top + scrollY;
    const desired = targetDocTop - topEdge;
    return Math.max(0, Math.min(maxScrollY, Math.round(desired)));
  }

  function isTargetWellFramed(dock, target) {
    const vh = window.innerHeight || 768;
    const dockRect = dock.getBoundingClientRect();
    const dockVisible = dockRect.top >= -1 && dockRect.bottom <= vh + 1;
    if (!dockVisible) return false;
    const stage = TUTORIAL_STAGES[tutorial.stageIndex];
    if (!target || (stage && stage.isModalStage)) {
      return dockRect.top <= 10;
    }
    const targetRect = target.getBoundingClientRect();
    const safeH = Math.max(40, vh - dockRect.bottom - 6);
    const reqVis = stage ? getStageRequiredVisibility(dock, stage) : null;
    const topAlignedNearDock = targetRect.top >= dockRect.bottom + 1 && targetRect.top <= dockRect.bottom + 24;

    if (reqVis && reqVis.selectors.length > 0 && reqVis.combinedHeight <= safeH + 2) {
      return reqVis.allFullyVisible && topAlignedNearDock;
    }
    if (targetRect.height <= safeH) {
      return topAlignedNearDock && targetRect.bottom <= vh - 1;
    }
    return topAlignedNearDock;
  }

  function positionTutorialWorkspace(explicitSelector, options) {
    const opts = options || {};
    if (!tutorial.active) return;
    if (tutorial.userScrolledAway && !opts.force) return;
    const dock = document.getElementById("tutorialDock");
    if (!dock || dock.hidden) return;

    const selector = explicitSelector || resolveGuidedFocusSelector(dock);
    tutorial.resolvedFocusSelector = selector;
    const target = selector ? document.querySelector(selector) : null;

    if (!opts.force && isTargetWellFramed(dock, target)) {
      tutorial.lastGuidedScrollY = Math.round(window.scrollY || 0);
      return;
    }

    const targetY = computeGuidedScrollY(dock, target);
    const currentY = Math.round(window.scrollY || 0);
    if (Math.abs(targetY - currentY) <= 2) {
      tutorial.lastGuidedScrollY = currentY;
      return;
    }

    const useInstant = Boolean(opts.instant || prefersReducedMotion());
    const now = Date.now();
    tutorial.lastGuidedScrollY = targetY;
    tutorial.programmaticScrollUntil = now + (useInstant ? 180 : 650);
    window.scrollTo({
      top: targetY,
      behavior: useInstant ? "auto" : "smooth",
    });
  }

  function renderTutorialDockUI() {
    const stage = TUTORIAL_STAGES[tutorial.stageIndex];
    const total = TUTORIAL_STAGES.length;
    const dock = document.getElementById("tutorialDock");
    const watchBtn = document.getElementById("btnWatchTutorial");
    const stepBadge = document.getElementById("tutorialStepBadge");
    const stateBadge = document.getElementById("tutorialStateBadge");
    const titleEl = document.getElementById("tutorialStageTitle");
    const narrEl = document.getElementById("tutorialNarration");
    const progEl = document.getElementById("tutorialProgress");
    const fillEl = document.getElementById("tutorialProgressFill");
    const prevBtn = document.getElementById("btnTutPrev");
    const playBtn = document.getElementById("btnTutPlayPause");
    const nextBtn = document.getElementById("btnTutNext");
    const srEl = document.getElementById("srAnnouncer");

    if (dock) dock.hidden = !tutorial.active;
    if (watchBtn) watchBtn.setAttribute("aria-expanded", tutorial.active ? "true" : "false");
    document.body.classList.toggle("tutorial-active", tutorial.active);

    if (!tutorial.active || !stage) return;

    const stepNum = tutorial.stageIndex + 1;
    const pct = Math.round((stepNum / total) * 100);
    if (stepBadge) stepBadge.textContent = `Stage ${stepNum} / ${total}`;
    if (titleEl) titleEl.textContent = stage.title;
    if (narrEl) narrEl.textContent = stage.narration;
    if (progEl) {
      progEl.setAttribute("aria-valuemax", String(total));
      progEl.setAttribute("aria-valuenow", String(stepNum));
    }
    if (fillEl) fillEl.style.width = `${pct}%`;

    if (stateBadge) {
      stateBadge.classList.remove("is-paused", "is-complete");
      if (tutorial.completed) {
        stateBadge.textContent = "Complete";
        stateBadge.classList.add("is-complete");
      } else if (tutorial.playing) {
        stateBadge.textContent = "Playing";
      } else {
        stateBadge.textContent = "Paused";
        stateBadge.classList.add("is-paused");
      }
    }

    if (prevBtn) prevBtn.disabled = tutorial.stageIndex === 0;
    if (nextBtn) nextBtn.disabled = tutorial.stageIndex >= total - 1;
    if (playBtn) {
      if (tutorial.completed) {
        playBtn.textContent = "Replay";
        playBtn.setAttribute("aria-pressed", "false");
      } else if (tutorial.playing) {
        playBtn.textContent = "Pause";
        playBtn.setAttribute("aria-pressed", "true");
      } else {
        playBtn.textContent = "Play";
        playBtn.setAttribute("aria-pressed", "false");
      }
    }

    if (srEl) {
      srEl.textContent = `Stage ${stepNum} of ${total}: ${stage.title}`;
    }
  }

  function scheduleCurrentStageTimers() {
    clearTutorialTimers();
    if (!tutorial.active || !tutorial.playing || tutorial.completed) return;
    const stage = TUTORIAL_STAGES[tutorial.stageIndex];
    if (!stage || stage.durationMs <= 0) return;

    const token = tutorial.stageToken;
    const reduced = prefersReducedMotion();
    const totalDuration = reduced ? Math.min(stage.durationMs, 1800) : stage.durationMs;

    function queueStep(flagName, fn, delayMs, reducedCapMs) {
      if (typeof fn !== "function" || tutorial[flagName]) return;
      const delay = reduced ? Math.min(delayMs || 0, reducedCapMs) : delayMs || 0;
      const tid = setTimeout(() => {
        tutorial.subTimers = tutorial.subTimers.filter((id) => id !== tid);
        if (!tutorial.active || !tutorial.playing || tutorial.stageToken !== token) return;
        tutorial[flagName] = true;
        tutorial.driving = true;
        try {
          fn();
        } finally {
          tutorial.driving = false;
        }
      }, delay);
      tutorial.subTimers.push(tid);
    }

    queueStep("preSubActionDone", stage.preSubAction, stage.preSubDelayMs || 850, 200);
    queueStep("subActionDone", stage.subAction, stage.subDelayMs || 1400, 450);
    queueStep("preSecondSubActionDone", stage.preSecondSubAction, stage.preSecondSubDelayMs || 2400, 680);
    queueStep("secondSubActionDone", stage.secondSubAction, stage.secondSubDelayMs || 2950, 950);

    tutorial.advanceTimer = setTimeout(() => {
      tutorial.advanceTimer = null;
      if (!tutorial.active || !tutorial.playing || tutorial.stageToken !== token) return;
      if (tutorial.stageIndex + 1 < TUTORIAL_STAGES.length) {
        goToTutorialStage(tutorial.stageIndex + 1, { autoplay: true });
      }
    }, totalDuration);
  }

  function goToTutorialStage(index, options) {
    const opts = options || {};
    const clamped = Math.max(0, Math.min(TUTORIAL_STAGES.length - 1, index));
    clearTutorialTimers();
    tutorial.stageToken += 1;
    const token = tutorial.stageToken;
    tutorial.stageIndex = clamped;
    tutorial.preSubActionDone = false;
    tutorial.subActionDone = false;
    tutorial.preSecondSubActionDone = false;
    tutorial.secondSubActionDone = false;
    tutorial.subFocusSelector = null;
    tutorial.modalFocusSelectors = null;
    tutorial.modalUserScrolledAway = false;
    tutorial.modalPhase = 0;
    setTutorialActionStatus("");
    clearTutorialToasts();

    const stage = TUTORIAL_STAGES[clamped];
    const isFinal = clamped === TUTORIAL_STAGES.length - 1;
    tutorial.completed = isFinal;
    tutorial.playing = isFinal ? false : Boolean(opts.autoplay);
    tutorial.activeTargetSelector = stage.targetSelector || null;

    tutorial.driving = true;
    try {
      if (typeof stage.enter === "function") stage.enter();
    } finally {
      tutorial.driving = false;
    }

    applyStageSpotlight(tutorial.activeTargetSelector);
    renderTutorialDockUI();
    updateTutorialAdaptiveLayout();

    requestAnimationFrame(() => {
      if (!tutorial.active || tutorial.stageToken !== token) return;
      updateTutorialAdaptiveLayout();
      positionTutorialWorkspace(null, {
        instant: Boolean(opts.instant || stage.isModalStage),
        force: Boolean(opts.forceScroll || stage.isModalStage),
      });
    });

    if (tutorial.playing) {
      scheduleCurrentStageTimers();
    }
  }

  function startTutorial() {
    if (!tutorial.active) {
      captureManualSnapshot();
    }
    tutorialPersistenceSuspended = true;
    tutorial.active = true;
    tutorial.userScrolledAway = false;
    tutorial.lastViewportW = window.innerWidth || 0;
    tutorial.lastViewportH = window.innerHeight || 0;
    resetIsolatedTutorialSession();
    goToTutorialStage(0, { autoplay: true, forceScroll: true });
    const playBtn = document.getElementById("btnTutPlayPause");
    if (playBtn && typeof playBtn.focus === "function") {
      try {
        playBtn.focus({ preventScroll: true });
      } catch (_) {
        playBtn.focus();
      }
    }
  }

  function pauseTutorial() {
    if (!tutorial.active || !tutorial.playing) return;
    tutorial.playing = false;
    clearTutorialTimers();
    renderTutorialDockUI();
  }

  function resumeTutorial() {
    if (!tutorial.active) return;
    if (tutorial.completed) {
      restartTutorial();
      return;
    }
    tutorial.playing = true;
    renderTutorialDockUI();
    scheduleCurrentStageTimers();
  }

  function restartTutorial() {
    if (!tutorial.active) {
      startTutorial();
      return;
    }
    tutorial.userScrolledAway = false;
    tutorial.modalUserScrolledAway = false;
    resetIsolatedTutorialSession();
    goToTutorialStage(0, { autoplay: true, forceScroll: true });
  }

  function exitTutorial(options) {
    const opts = options || {};
    clearTutorialTimers();
    if (tutorial.resizeSettleTimer !== null) {
      clearTimeout(tutorial.resizeSettleTimer);
      tutorial.resizeSettleTimer = null;
    }
    closeTutorialModals();
    tutorial.active = false;
    tutorial.playing = false;
    tutorial.completed = false;
    tutorial.preSubActionDone = false;
    tutorial.subActionDone = false;
    tutorial.preSecondSubActionDone = false;
    tutorial.secondSubActionDone = false;
    tutorial.userScrolledAway = false;
    tutorial.modalUserScrolledAway = false;
    tutorial.activeTargetSelector = null;
    tutorial.subFocusSelector = null;
    tutorial.resolvedFocusSelector = null;
    tutorial.modalFocusSelectors = null;
    tutorial.modalPhase = 0;
    tutorial.stageToken += 1;
    setTutorialActionStatus("");
    clearTutorialToasts();
    clearSpotlight();
    clearTutorialAdaptiveLayout();
    renderTutorialDockUI();
    restoreManualSessionOnExit();
    tutorialPersistenceSuspended = false;

    if (opts.restoreFocus !== false) {
      const watchBtn = document.getElementById("btnWatchTutorial");
      if (watchBtn && typeof watchBtn.focus === "function") {
        try {
          watchBtn.focus({ preventScroll: true });
        } catch (_) {
          watchBtn.focus();
        }
      }
    }
  }

  function handleTutorialViewportChange() {
    const now = Date.now();
    const curW = window.innerWidth || 0;
    const curH = window.innerHeight || 0;
    tutorial.lastViewportW = curW;
    tutorial.lastViewportH = curH;
    tutorial.resizeIgnoreScrollUntil = now + 450;

    if (!tutorial.active) return;
    const token = tutorial.stageToken;

    const reposition = () => {
      if (!tutorial.active || tutorial.stageToken !== token) return;
      updateTutorialAdaptiveLayout();
      if (!tutorial.userScrolledAway) {
        positionTutorialWorkspace(null, { instant: true, force: true });
      }
      if (!tutorial.userScrolledAway && !tutorial.modalUserScrolledAway && tutorial.modalFocusSelectors) {
        scrollModalElementIntoView(tutorial.modalFocusSelectors, { instant: true });
      }
    };

    requestAnimationFrame(reposition);
    if (tutorial.resizeSettleTimer !== null) {
      clearTimeout(tutorial.resizeSettleTimer);
    }
    tutorial.resizeSettleTimer = setTimeout(() => {
      tutorial.resizeSettleTimer = null;
      reposition();
    }, 120);
  }

  function initTutorialEvents() {
    const watchBtn = document.getElementById("btnWatchTutorial");
    const prevBtn = document.getElementById("btnTutPrev");
    const playBtn = document.getElementById("btnTutPlayPause");
    const nextBtn = document.getElementById("btnTutNext");
    const restartBtn = document.getElementById("btnTutRestart");
    const exitBtn = document.getElementById("btnTutExit");

    if (watchBtn) {
      watchBtn.addEventListener("click", () => {
        if (tutorial.active) restartTutorial();
        else startTutorial();
      });
    }
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (!tutorial.active || tutorial.stageIndex <= 0) return;
        goToTutorialStage(tutorial.stageIndex - 1, { autoplay: false });
      });
    }
    if (playBtn) {
      playBtn.addEventListener("click", () => {
        if (!tutorial.active) return;
        if (tutorial.completed) restartTutorial();
        else if (tutorial.playing) pauseTutorial();
        else resumeTutorial();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (!tutorial.active || tutorial.stageIndex >= TUTORIAL_STAGES.length - 1) return;
        goToTutorialStage(tutorial.stageIndex + 1, { autoplay: false });
      });
    }
    if (restartBtn) {
      restartBtn.addEventListener("click", () => restartTutorial());
    }
    if (exitBtn) {
      exitBtn.addEventListener("click", () => exitTutorial({ restoreFocus: true }));
    }

    window.addEventListener("resize", handleTutorialViewportChange);
    if (window.visualViewport && typeof window.visualViewport.addEventListener === "function") {
      window.visualViewport.addEventListener("resize", handleTutorialViewportChange);
    }

    // Genuine user scroll intent tracking
    window.addEventListener(
      "wheel",
      () => {
        if (tutorial.active) {
          tutorial.programmaticScrollUntil = 0;
          tutorial.userScrollIntentUntil = Date.now() + 900;
        }
      },
      { passive: true }
    );
    window.addEventListener(
      "touchmove",
      () => {
        if (tutorial.active) {
          tutorial.programmaticScrollUntil = 0;
          tutorial.userScrollIntentUntil = Date.now() + 900;
        }
      },
      { passive: true }
    );

    // Pre/post-resize scroll discrimination
    window.addEventListener(
      "scroll",
      () => {
        if (!tutorial.active) return;
        const now = Date.now();
        const curW = window.innerWidth || 0;
        const curH = window.innerHeight || 0;
        if (curW !== tutorial.lastViewportW || curH !== tutorial.lastViewportH) {
          tutorial.lastViewportW = curW;
          tutorial.lastViewportH = curH;
          tutorial.resizeIgnoreScrollUntil = now + 450;
          return;
        }
        if (now < tutorial.resizeIgnoreScrollUntil || now < tutorial.programmaticScrollUntil) {
          return;
        }
        if (now <= tutorial.userScrollIntentUntil) {
          const curY = Math.round(window.scrollY || 0);
          if (Math.abs(curY - tutorial.lastGuidedScrollY) > 20) {
            tutorial.userScrolledAway = true;
          }
        }
      },
      { passive: true }
    );

    // Genuine user scroll intent tracking inside product-detail modal scroll container
    const detailDlg = document.querySelector("#detail-modal .modal-dialog");
    if (detailDlg) {
      const markModalUserScrollIntent = () => {
        if (!tutorial.active) return;
        tutorial.modalProgrammaticScrollUntil = 0;
        tutorial.modalUserScrollIntentUntil = Date.now() + 900;
      };
      detailDlg.addEventListener("wheel", markModalUserScrollIntent, { passive: true });
      detailDlg.addEventListener("touchmove", markModalUserScrollIntent, { passive: true });
      detailDlg.addEventListener("pointerdown", markModalUserScrollIntent, { passive: true });
      detailDlg.addEventListener(
        "scroll",
        () => {
          if (!tutorial.active) return;
          const now = Date.now();
          if (now < tutorial.resizeIgnoreScrollUntil || now < tutorial.modalProgrammaticScrollUntil) {
            return;
          }
          if (now <= tutorial.modalUserScrollIntentUntil) {
            const curTop = Math.round(detailDlg.scrollTop || 0);
            if (Math.abs(curTop - tutorial.modalLastGuidedScrollTop) > 12) {
              tutorial.modalUserScrolledAway = true;
              tutorial.userScrolledAway = true;
            }
          }
        },
        { passive: true }
      );
    }

    // Manual dashboard interactions safely pause autoplay without leaving isolated tutorial session
    const mainEl = document.getElementById("main-content");
    if (mainEl) {
      mainEl.addEventListener("pointerdown", (ev) => {
        if (!tutorial.active || !tutorial.playing || tutorial.driving) return;
        const dock = document.getElementById("tutorialDock");
        if (dock && dock.contains(ev.target)) return;
        pauseTutorial();
      });
    }
    document.querySelectorAll(".nav-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (tutorial.active && tutorial.playing && !tutorial.driving) {
          pauseTutorial();
        }
      });
    });
  }

  // Read-only verification & inspection API
  window.__NBASHOP_TUTORIAL__ = {
    getState() {
      const stage = TUTORIAL_STAGES[tutorial.stageIndex];
      const dock = document.getElementById("tutorialDock");
      return {
        active: tutorial.active,
        playing: tutorial.playing,
        completed: tutorial.completed,
        stageIndex: tutorial.stageIndex,
        stageId: stage ? stage.id : null,
        totalStages: TUTORIAL_STAGES.length,
        preSubActionDone: tutorial.preSubActionDone,
        subActionDone: tutorial.subActionDone,
        preSecondSubActionDone: tutorial.preSecondSubActionDone,
        secondSubActionDone: tutorial.secondSubActionDone,
        modalPhase: tutorial.modalPhase,
        actionStatusText: tutorial.actionStatusText,
        hasPendingTimers: tutorial.subTimers.length > 0 || tutorial.advanceTimer !== null,
        userScrolledAway: tutorial.userScrolledAway,
        modalUserScrolledAway: tutorial.modalUserScrolledAway,
        lastGuidedScrollY: tutorial.lastGuidedScrollY,
        modalLastGuidedScrollTop: tutorial.modalLastGuidedScrollTop,
        activeTargetSelector: tutorial.activeTargetSelector,
        resolvedFocusSelector: tutorial.resolvedFocusSelector,
        persistenceSuspended: tutorialPersistenceSuspended,
        orderPlacedNumber: tutorial.orderPlacedNumber,
        activeView: state.view,
        cartUnits: cartUnitCount(),
        ordersCount: state.orders.length,
        messagesCount: state.messages.length,
        demoUser: state.demoUser ? state.demoUser.username : null,
        product1Stock: getProduct(1) ? getProduct(1).stock : null,
        adaptiveLayout: Object.assign({}, tutorial.adaptiveLayout),
        requiredVisibility:
          tutorial.active && dock && stage ? getStageRequiredVisibility(dock, stage) : null,
        modalVisibility: tutorial.active && dock ? getModalVisibilitySnapshot(dock) : null,
        adminVisibility: tutorial.active && dock ? getAdminVisibilitySnapshot(dock) : null,
      };
    },
    stages: TUTORIAL_STAGES.map((s) => ({
      id: s.id,
      view: s.view,
      targetSelector: s.targetSelector,
      requiredSelectors: (s.requiredSelectors || []).slice(),
      title: s.title,
      hasSubAction: typeof s.subAction === "function",
    })),
  };

  updateHeader();
  initEvents();
  initTutorialEvents();
  renderHome();
})();
