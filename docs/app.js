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

  function loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

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
    filters: {
      search: "",
      priceMin: "",
      priceMax: "",
      stockMin: "",
      stockMax: "",
      categories: [],
      sort: "latest",
      page: 1,
    },
    detailProductId: null,
    detailQty: 1,
    detailSize: "",
    lastInvoice: null,
  };

  function persist() {
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
        <h1>${esc(active.name)}</h1>
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

    const shelves = [
      { title: "Top Selling Products", items: state.products.slice().sort((a, b) => b.sales - a.sales).slice(0, 3), pfx: "ts" },
      { title: "Top Stock Products", items: state.products.slice().sort((a, b) => b.stock - a.stock).slice(0, 3), pfx: "st" },
      { title: "Top Priced Products", items: state.products.slice().sort((a, b) => b.price - a.price).slice(0, 3), pfx: "tp" },
      { title: "Cheapest Products", items: state.products.slice().sort((a, b) => a.price - b.price).slice(0, 3), pfx: "ch" },
    ];

    document.getElementById("home-shelves").innerHTML = shelves
      .map(
        (sh) => `
          <section class="shelf-block">
            <h2 class="section-heading"><span>${esc(sh.title)}</span></h2>
            <div class="product-grid">
              ${sh.items.map((p) => buildProductCardHtml(p, sh.pfx)).join("")}
            </div>
          </section>
        `
      )
      .join("");
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
      `Showing ${pageItems.length} of ${filtered.length} synthetic products (Page ${f.page} of ${totalPages})`;

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
        <p class="muted-note">Non-payment browser simulation &middot; Demo inventory decremented &amp; synced to Admin &amp; Security tab.</p>
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
          <tr>
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
        (m) => `
          <tr>
            <td>${esc(m.name)}</td>
            <td>${esc(m.subject)}</td>
            <td>${esc(m.message)}</td>
          </tr>
        `
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
        <p style="margin:0 0 8px;"><strong>Available Simulated Stock:</strong> ${prod.stock}</p>
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
      showToast(`Simulated order preview ${order.orderNumber} recorded.`);
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
      showToast("Simulated inquiry added to Admin & Security inbox.");
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
        closeDetailModal();
        closeAccountModal();
      }
    });
  }

  updateHeader();
  initEvents();
  renderHome();
})();
