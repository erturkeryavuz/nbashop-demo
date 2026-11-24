"""Behavioral regression tests for NBASHOP Watch Tutorial, persistence isolation, and adaptive viewport fitting."""

from __future__ import annotations

import json
import subprocess
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"


def _run_node_harness(script_body: str, initial_storage: dict | None = None) -> dict:
    init_store_json = json.dumps(initial_storage or {})
    harness = f"""
const fs = require("fs");
const vm = require("vm");

class FakeClassList {{
  constructor(initial = []) {{ this.set = new Set(initial); }}
  add(...xs) {{ xs.forEach((x) => this.set.add(x)); }}
  remove(...xs) {{ xs.forEach((x) => this.set.delete(x)); }}
  toggle(x, force) {{
    if (force === undefined) {{
      if (this.set.has(x)) {{ this.set.delete(x); return false; }}
      this.set.add(x); return true;
    }}
    if (force) this.set.add(x); else this.set.delete(x);
    return !!force;
  }}
  contains(x) {{ return this.set.has(x); }}
}}

const storageData = Object.assign({{}}, {init_store_json});
const localStorage = {{
  getItem(k) {{ return Object.prototype.hasOwnProperty.call(storageData, k) ? storageData[k] : null; }},
  setItem(k, v) {{ storageData[k] = String(v); }},
  removeItem(k) {{ delete storageData[k]; }},
  clear() {{ Object.keys(storageData).forEach((k) => delete storageData[k]); }},
}};

function bootInstance(sharedStorage) {{
  let nowMs = 10000;
  let nextTimerId = 1;
  const timers = new Map();
  const env = {{
    lastFocused: null,
    scrollCalls: [],
    reducedMotion: false,
  }};

  const byId = new Map();
  const allEls = [];

  function parseDynamicButtons(container, html) {{
    container.children = [];
    const btnRegex = /<button([^>]*)>([\\s\\S]*?)<\\/button>/gi;
    let m;
    while ((m = btnRegex.exec(html)) !== null) {{
      const attrsStr = m[1];
      const b = makeEl("button");
      const idM = attrsStr.match(/id="([^"]+)"/);
      if (idM) {{ b.id = idM[1]; byId.set(b.id, b); }}
      const dataRe = /data-([a-z0-9-]+)="([^"]*)"/gi;
      let dm;
      while ((dm = dataRe.exec(attrsStr)) !== null) {{
        const camel = dm[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        b.dataset[camel] = dm[2];
        b.attrs["data-" + dm[1]] = dm[2];
      }}
      container.appendChild(b);
    }}
    const inpRegex = /<input([^>]*)>/gi;
    while ((m = inpRegex.exec(html)) !== null) {{
      const attrsStr = m[1];
      const inp = makeEl("input");
      const idM = attrsStr.match(/id="([^"]+)"/);
      if (idM) {{ inp.id = idM[1]; byId.set(inp.id, inp); }}
      const valM = attrsStr.match(/value="([^"]*)"/);
      if (valM) inp.value = valM[1];
      if (/\\bchecked\\b/.test(attrsStr)) inp.checked = true;
      const typeM = attrsStr.match(/type="([^"]*)"/);
      if (typeM) inp.type = typeM[1];
      container.appendChild(inp);
    }}
    const spanRegex = /<span([^>]*)>([\\s\\S]*?)<\\/span>/gi;
    while ((m = spanRegex.exec(html)) !== null) {{
      const idM = m[1].match(/id="([^"]+)"/);
      if (idM) {{
        const sp = makeEl("span", idM[1]);
        sp.textContent = m[2];
        byId.set(sp.id, sp);
        container.appendChild(sp);
      }}
    }}
    const divClassRe = /<(div|h2)([^>]*)>/gi;
    while ((m = divClassRe.exec(html)) !== null) {{
      const tag = m[1];
      const attrsStr = m[2];
      const idM = attrsStr.match(/id="([^"]+)"/);
      const clsM = attrsStr.match(/class="([^"]+)"/);
      const clsList = clsM ? clsM[1].split(/\\s+/).filter(Boolean) : [];
      if (idM || clsList.some((c) => ["detail-art", "size-row", "qty-control", "detail-buy-row"].includes(c))) {{
        const el = makeEl(tag, idM ? idM[1] : "", clsList);
        if (el.id) byId.set(el.id, el);
        container.appendChild(el);
      }}
    }}
    const trRe = /<tr([^>]*)>/gi;
    while ((m = trRe.exec(html)) !== null) {{
      const attrsStr = m[1];
      const clsM = attrsStr.match(/class="([^"]*)"/);
      const clsList = clsM ? clsM[1].split(/\\s+/).filter(Boolean) : [];
      const attrs = {{}};
      const dataRe = /data-([a-z0-9-]+)="([^"]*)"/gi;
      let dm;
      while ((dm = dataRe.exec(attrsStr)) !== null) {{
        attrs["data-" + dm[1]] = dm[2];
      }}
      const tr = makeEl("tr", "", clsList, attrs);
      tr._docTop = container._docTop || 400;
      tr._height = 54;
      container.appendChild(tr);
    }}
    const formRegex = /<form([^>]*)>/gi;
    while ((m = formRegex.exec(html)) !== null) {{
      const idM = m[1].match(/id="([^"]+)"/);
      if (idM) {{
        const fm = makeEl("form", idM[1]);
        byId.set(fm.id, fm);
        container.appendChild(fm);
      }}
    }}
  }}

  function makeEl(tag, id = "", classes = [], attrs = {{}}) {{
    const listeners = {{}};
    const el = {{
      tagName: tag.toUpperCase(),
      id,
      className: classes.join(" "),
      classList: new FakeClassList(classes),
      dataset: {{}},
      attrs: Object.assign({{}}, attrs),
      style: {{}},
      children: [],
      hidden: false,
      disabled: false,
      checked: false,
      type: "",
      value: "",
      textContent: "",
      _innerHTML: "",
      parentElement: null,
      parentNode: null,
      _docTop: 220,
      _height: 360,
      _width: 960,
      get innerHTML() {{ return this._innerHTML; }},
      set innerHTML(v) {{
        this._innerHTML = String(v);
        parseDynamicButtons(this, this._innerHTML);
      }},
      appendChild(child) {{
        child.parentElement = el;
        child.parentNode = el;
        this.children.push(child);
        return child;
      }},
      removeChild(child) {{
        this.children = this.children.filter((c) => c !== child);
        child.parentElement = null;
        child.parentNode = null;
      }},
      contains(node) {{
        if (node === el) return true;
        return this.children.some((c) => c === node || (c.contains && c.contains(node)));
      }},
      closest(sel) {{
        const attrM = sel.match(/^\\[data-([a-z0-9-]+)\\]$/);
        if (attrM) {{
          const key = "data-" + attrM[1];
          if (key in this.attrs) return this;
        }}
        return null;
      }},
      reset() {{
        allEls.filter((x) => x.parentForm === el).forEach((inp) => {{ inp.value = ""; }});
      }},
      setAttribute(k, v) {{ this.attrs[k] = String(v); }},
      getAttribute(k) {{ return k in this.attrs ? this.attrs[k] : null; }},
      addEventListener(type, fn) {{ (listeners[type] = listeners[type] || []).push(fn); }},
      dispatchEvent(ev) {{
        ev.target = ev.target || el;
        ev.preventDefault = ev.preventDefault || (() => {{}});
        (listeners[ev.type] || []).forEach((fn) => fn(ev));
        if (ev.type === "click") {{
          document.dispatchEvent(ev);
        }}
      }},
      click() {{ this.dispatchEvent({{ type: "click", target: el }}); }},
      focus() {{ env.lastFocused = el.id || el.tagName; }},
      querySelector(sel) {{
        return this.querySelectorAll(sel)[0] || null;
      }},
      querySelectorAll(sel) {{
        const out = [];
        const walk = (node) => {{
          for (const c of node.children) {{
            if (sel === "input[type='checkbox']" && c.tagName === "INPUT" && c.type === "checkbox") out.push(c);
            else if (sel === "input:checked" && c.tagName === "INPUT" && c.checked) out.push(c);
            else if (sel.startsWith(".") && c.classList.contains(sel.slice(1))) out.push(c);
            else if (sel.startsWith("[data-")) {{
              const m = sel.match(/^\\[data-([a-z0-9-]+)(?:="([^"]*)")?\\]$/);
              if (m) {{
                const key = "data-" + m[1];
                if (key in c.attrs && (m[2] === undefined || c.attrs[key] === m[2])) out.push(c);
              }}
            }}
            walk(c);
          }}
        }};
        walk(this);
        return out;
      }},
      getBoundingClientRect() {{
        return {{
          top: this._docTop - env.window.scrollY,
          bottom: this._docTop + this._height - env.window.scrollY,
          left: 0,
          right: this._width,
          width: this._width,
          height: this._height,
        }};
      }},
    }};
    Object.keys(attrs).forEach((k) => {{
      if (k.startsWith("data-")) {{
        const camel = k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        el.dataset[camel] = attrs[k];
      }}
    }});
    return el;
  }}

  function reg(el) {{
    if (el.id) byId.set(el.id, el);
    allEls.push(el);
    return el;
  }}

  // Required DOM skeleton matching docs/index.html
  [
    "header-cart-badge", "account-trigger-label", "toast-region", "home-category-rail",
    "hero-slide", "hero-dots", "home-shelves", "filter-categories", "shop-count",
    "shop-grid", "shop-pagination", "cart-table-body", "cart-subtotal", "cart-shipping",
    "cart-total", "checkout-summary-items", "co-subtotal", "co-shipping", "co-total",
    "invoice-body", "adm-sales", "adm-orders", "adm-stock", "adm-msgs",
    "adm-category-bars", "adm-orders-body", "adm-messages-body", "adm-security-body",
    "detail-content", "detail-related", "account-modal-body",
    "tutorialStepBadge", "tutorialStateBadge", "tutorialStageTitle", "tutorialNarration",
    "tutorialProgress", "tutorialProgressFill", "srAnnouncer"
  ].forEach((id) => reg(makeEl("div", id)));

  const statusEl = reg(makeEl("div", "tutorialActionStatus", ["tutorial-action-status"]));
  statusEl.hidden = true;
  statusEl._height = 34;

  const btnWatch = reg(makeEl("button", "btnWatchTutorial", ["btn-tutorial"]));
  const dock = reg(makeEl("section", "tutorialDock", ["tutorial-dock"]));
  dock.hidden = true;
  dock._docTop = 200;
  dock._height = 84;
  dock.getBoundingClientRect = function () {{
    const top = Math.max(6, this._docTop - env.window.scrollY);
    return {{ top, bottom: top + this._height, left: 0, right: this._width, width: this._width, height: this._height }};
  }};
  const btnPrev = reg(makeEl("button", "btnTutPrev", ["tut-btn"]));
  const btnPlay = reg(makeEl("button", "btnTutPlayPause", ["tut-btn"]));
  const btnNext = reg(makeEl("button", "btnTutNext", ["tut-btn"]));
  const btnRestart = reg(makeEl("button", "btnTutRestart", ["tut-btn"]));
  const btnExit = reg(makeEl("button", "btnTutExit", ["tut-btn"]));
  [btnPrev, btnPlay, btnNext, btnRestart, btnExit, statusEl].forEach((b) => dock.appendChild(b));
  statusEl.getBoundingClientRect = function () {{
    const dr = dock.getBoundingClientRect();
    return {{ top: dr.bottom - 38, bottom: dr.bottom - 4, left: 10, right: 300, width: 290, height: 34 }};
  }};

  const mainEl = reg(makeEl("main", "main-content"));
  const viewNames = ["home", "shop", "cart", "checkout", "contact", "admin"];
  const navTabs = viewNames.map((v, i) => reg(makeEl("button", "tab-" + v, i === 0 ? ["nav-tab", "active"] : ["nav-tab"], {{ "data-view": v }})));
  const viewPanels = viewNames.map((v, i) => {{
    const p = reg(makeEl("section", "view-" + v, i === 0 ? ["view-panel", "active"] : ["view-panel"]));
    p.hidden = i !== 0;
    return p;
  }});

  [
    ["home-hero-layout", 296, 360],
    ["home-highlights", 670, 90],
    ["shop-layout", 296, 460],
    ["shop-filter-sidebar", 296, 420],
    ["shop-toolbar", 296, 48],
    ["cart-layout", 296, 320],
    ["cart-items-card", 296, 260],
    ["cart-summary-card", 296, 260],
    ["checkout-form-section", 296, 430],
    ["checkout-summary-card", 296, 280],
    ["invoice-section", 296, 310],
    ["contact-layout", 296, 380],
    ["admin-overview-zone", 296, 440],
    ["admin-kpi-strip", 296, 72],
    ["admin-stock-card", 380, 340],
    ["admin-orders-card", 380, 340],
    ["adm-orders-wrap", 420, 118],
    ["admin-inbox-section", 550, 150],
    ["admin-inbox-heading", 554, 20],
    ["adm-messages-wrap", 578, 118],
    ["admin-security-card", 760, 400],
  ].forEach(([id, top, h]) => {{
    const el = reg(makeEl("div", id));
    el._docTop = top;
    el._height = h;
    mainEl.appendChild(el);
  }});
  byId.get("admin-overview-zone").appendChild(byId.get("admin-kpi-strip"));
  byId.get("admin-overview-zone").appendChild(byId.get("admin-stock-card"));
  byId.get("admin-overview-zone").appendChild(byId.get("admin-orders-card"));
  byId.get("admin-orders-card").appendChild(byId.get("admin-inbox-section"));
  byId.get("admin-inbox-section").appendChild(byId.get("admin-inbox-heading"));
  byId.get("admin-inbox-section").appendChild(byId.get("adm-messages-wrap"));
  byId.get("adm-messages-wrap").appendChild(byId.get("adm-messages-body"));
  byId.get("adm-orders-wrap").appendChild(byId.get("adm-orders-body"));
  byId.get("adm-messages-body")._docTop = 602;
  byId.get("adm-orders-body")._docTop = 448;
  byId.get("invoice-section").hidden = true;

  // Forms, inputs, buttons, modals
  reg(makeEl("form", "topbar-search-form"));
  const coForm = reg(makeEl("form", "checkout-form"));
  coForm._docTop = 296; coForm._height = 420;
  const ctForm = reg(makeEl("form", "contact-form"));
  ctForm._docTop = 296; ctForm._height = 360;

  ["topbar-search-input", "filter-search", "filter-price-min", "filter-price-max",
   "filter-stock-min", "filter-stock-max", "shop-sort"].forEach((id) => reg(makeEl("input", id)));
  ["co-first", "co-last", "co-email", "co-mobile", "co-addr1", "co-addr2",
   "co-country", "co-city", "co-state", "co-zip"].forEach((id) => {{
    const inp = reg(makeEl("input", id));
    inp.parentForm = coForm;
  }});
  ["ct-name", "ct-email", "ct-subject", "ct-message"].forEach((id) => {{
    const inp = reg(makeEl("input", id));
    inp.parentForm = ctForm;
  }});

  ["hero-prev", "hero-next", "reset-filters-btn", "proceed-checkout-btn",
   "fill-demo-checkout", "place-order-btn", "invoice-back-shop",
   "detail-close", "account-trigger", "account-close", "cart-trigger"].forEach((id) => reg(makeEl("button", id)));

  const detModal = reg(makeEl("div", "detail-modal", ["modal-backdrop"]));
  detModal.hidden = true;
  const detDialog = reg(makeEl("div", "detail-dialog", ["modal-dialog"]));
  detDialog._docTop = 100; detDialog._height = 380;
  detDialog.scrollTop = 0;
  detDialog.scrollHeight = 560;
  detDialog.clientHeight = 380;
  detDialog.getBoundingClientRect = function () {{
    const dr = dock.getBoundingClientRect();
    const top = dock.hidden ? 60 : Math.round(dr.bottom + 8);
    const h = Math.min(this.clientHeight, Math.max(120, env.window.innerHeight - top - 8));
    return {{ top, bottom: top + h, left: 10, right: Math.max(200, env.window.innerWidth - 10), width: Math.max(190, env.window.innerWidth - 20), height: h }};
  }};
  detDialog.scrollTo = function (arg) {{
    const top = typeof arg === "object" ? arg.top : arg;
    const behavior = typeof arg === "object" ? arg.behavior : "auto";
    env.modalScrollCalls = env.modalScrollCalls || [];
    env.modalScrollCalls.push({{ top, behavior, at: nowMs }});
    this.scrollTop = top;
    this.dispatchEvent({{ type: "scroll" }});
  }};
  detModal.appendChild(detDialog);
  detDialog.appendChild(byId.get("detail-content"));
  byId.get("detail-content").getBoundingClientRect = function () {{
    const d = detDialog.getBoundingClientRect();
    const top = d.top + 12 - detDialog.scrollTop;
    const h = Math.max(300, detDialog.scrollHeight - 24);
    return {{ top, bottom: top + h, left: d.left + 10, right: d.right - 10, width: d.width - 20, height: h }};
  }};
  const origDetailSet = Object.getOwnPropertyDescriptor(byId.get("detail-content"), "innerHTML").set;
  Object.defineProperty(byId.get("detail-content"), "innerHTML", {{
    get() {{ return this._innerHTML; }},
    set(v) {{
      origDetailSet.call(this, v);
      const relMap = [
        [".detail-art", 12, 110],
        ["#detail-title", 132, 36],
        [".size-row", 330, 34],
        [".detail-buy-row", 374, 40],
        [".qty-control", 376, 34],
        ["#det-add-btn", 374, 38],
      ];
      relMap.forEach(([sel, relTop, h]) => {{
        const el = sel.startsWith("#") ? byId.get(sel.slice(1)) : this.querySelector(sel);
        if (el) {{
          el.parentElement = this;
          el.getBoundingClientRect = () => {{
            const d = detDialog.getBoundingClientRect();
            const top = d.top + relTop - detDialog.scrollTop;
            return {{ top, bottom: top + h, left: d.left + 12, right: d.right - 12, width: d.width - 24, height: h }};
          }};
        }}
      }});
    }},
  }});
  const accModal = reg(makeEl("div", "account-modal", ["modal-backdrop"]));
  accModal.hidden = true;

  const winListeners = {{}};
  const docListeners = {{}};
  const vvListeners = {{}};
  const body = makeEl("body");
  const rootCssVars = {{}};
  const docEl = {{
    scrollHeight: 2200,
    style: {{
      setProperty(k, v) {{ rootCssVars[k] = String(v); }},
      removeProperty(k) {{ delete rootCssVars[k]; }},
      getPropertyValue(k) {{ return rootCssVars[k] || ""; }},
    }},
  }};

  const document = {{
    body,
    documentElement: docEl,
    getElementById: (id) => byId.get(id) || null,
    createElement: (tag) => makeEl(tag),
    querySelector(sel) {{
      if (sel.startsWith("#") && !sel.includes(" ")) return byId.get(sel.slice(1)) || null;
      if (sel === "#detail-modal .modal-dialog") return detDialog;
      if (sel === '#detail-content [data-size="L"]') return byId.get("detail-content").querySelector('[data-size="L"]');
      if (sel === '[data-cart-inc="1"]') return byId.get("cart-table-body").querySelector('[data-cart-inc="1"]');
      if (sel === "#adm-orders-body .tutorial-row-highlight") return byId.get("adm-orders-body").querySelector(".tutorial-row-highlight");
      if (sel === '#adm-messages-body [data-tutorial-inquiry="true"]') return byId.get("adm-messages-body").querySelector('[data-tutorial-inquiry="true"]');
      if (sel === "#toast-region .toast") return byId.get("toast-region").children[0] || null;
      if (sel.startsWith(".")) return byId.get("detail-content").querySelector(sel);
      return null;
    }},
    querySelectorAll(sel) {{
      if (sel === ".nav-tab") return navTabs;
      if (sel === ".view-panel") return viewPanels;
      if (sel === "[data-nav]") return [byId.get("cart-trigger")];
      if (sel === ".tutorial-spotlight") return allEls.filter((e) => e.classList.contains("tutorial-spotlight"));
      if (sel === ".tutorial-control-focus") return allEls.filter((e) => e.classList.contains("tutorial-control-focus"));
      return [];
    }},
    addEventListener(type, fn) {{ (docListeners[type] = docListeners[type] || []).push(fn); }},
    dispatchEvent(ev) {{
      ev.preventDefault = ev.preventDefault || (() => {{}});
      (docListeners[ev.type] || []).forEach((fn) => fn(ev));
    }},
  }};

  const windowObj = {{
    innerWidth: 1280,
    innerHeight: 650,
    scrollY: 0,
    pageYOffset: 0,
    document,
    localStorage: sharedStorage,
    visualViewport: {{
      addEventListener(type, fn) {{ (vvListeners[type] = vvListeners[type] || []).push(fn); }},
      dispatch(type) {{ (vvListeners[type] || []).forEach((fn) => fn({{ type }})); }},
    }},
    matchMedia(q) {{
      return {{ matches: q.includes("prefers-reduced-motion") ? env.reducedMotion : false }};
    }},
    scrollTo(arg) {{
      const top = typeof arg === "object" ? arg.top : arg;
      const behavior = typeof arg === "object" ? arg.behavior : "auto";
      env.scrollCalls.push({{ top, behavior, at: nowMs }});
      windowObj.scrollY = top;
      windowObj.pageYOffset = top;
      windowObj.dispatchEvent({{ type: "scroll" }});
    }},
    addEventListener(type, fn) {{ (winListeners[type] = winListeners[type] || []).push(fn); }},
    dispatchEvent(ev) {{ (winListeners[ev.type] || []).forEach((fn) => fn(ev)); }},
  }};
  env.window = windowObj;

  const FakeDate = class extends Date {{
    static now() {{ return nowMs; }}
  }};

  function setTimeoutFake(fn, ms) {{
    const id = nextTimerId++;
    timers.set(id, {{ fn, runAt: nowMs + Math.max(0, Number(ms) || 0) }});
    return id;
  }}
  function clearTimeoutFake(id) {{ timers.delete(id); }}
  function advanceTime(ms) {{
    const end = nowMs + ms;
    while (true) {{
      let earliest = null;
      for (const [id, t] of timers.entries()) {{
        if (t.runAt <= end && (!earliest || t.runAt < earliest.t.runAt)) {{
          earliest = {{ id, t }};
        }}
      }}
      if (!earliest) break;
      nowMs = earliest.t.runAt;
      timers.delete(earliest.id);
      earliest.t.fn();
    }}
    nowMs = end;
  }}

  const sandbox = {{
    window: windowObj,
    document,
    localStorage: sharedStorage,
    Date: FakeDate,
    setTimeout: setTimeoutFake,
    clearTimeout: clearTimeoutFake,
    requestAnimationFrame: (fn) => fn(),
    console, Math, Number, String, Array, Object, Boolean, JSON, Set, Map,
  }};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  vm.runInContext(fs.readFileSync({json.dumps(str(DOCS / "data.js"))}, "utf8"), sandbox);
  vm.runInContext(fs.readFileSync({json.dumps(str(DOCS / "artwork.js"))}, "utf8"), sandbox);
  vm.runInContext(fs.readFileSync({json.dumps(str(DOCS / "app.js"))}, "utf8"), sandbox);

  return {{
    api: windowObj.__NBASHOP_TUTORIAL__,
    windowObj, document, body, byId, navTabs, dock, detModal, detDialog, accModal,
    btnWatch, btnPrev, btnPlay, btnNext, btnRestart, btnExit,
    rootCssVars, timers, env, advanceTime,
  }};
}}

const out = (function() {{
{script_body}
}})();
console.log(JSON.stringify(out));
"""
    res = subprocess.run(["node", "-e", harness], capture_output=True, text=True)
    if res.returncode != 0:
        raise AssertionError(f"Node harness failed:\nSTDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}")
    return json.loads(res.stdout.strip().splitlines()[-1])


class NBAShopTutorialTests(unittest.TestCase):
    def test_html_and_css_tutorial_contract_preserves_six_views_and_disclosures(self):
        html = (DOCS / "index.html").read_text(encoding="utf-8")
        css = (DOCS / "styles.css").read_text(encoding="utf-8")

        for tab_id in ("tab-home", "tab-shop", "tab-cart", "tab-checkout", "tab-contact", "tab-admin"):
            self.assertIn(f'id="{tab_id}"', html)
        for req_id in (
            "btnWatchTutorial", "tutorialDock", "tutorialStepBadge", "tutorialStateBadge",
            "tutorialStageTitle", "btnTutPrev", "btnTutPlayPause", "btnTutNext",
            "btnTutRestart", "btnTutExit", "tutorialProgress", "tutorialNarration",
            "home-hero-layout", "shop-layout", "cart-layout", "checkout-form-section",
            "invoice-section", "admin-overview-zone", "admin-security-card",
        ):
            self.assertIn(f'id="{req_id}"', html)

        # No artificial phone frame for responsive web storefront
        self.assertNotIn("phone-bezel", html)
        self.assertNotIn("phone-scale-box", css)

        # Preserved static-demo disclosures & attributions
        self.assertIn("Not affiliated with the NBA", html)
        self.assertIn("No live payments", html)
        self.assertIn("https://htmlcodex.com", html)
        self.assertIn("CC-BY 4.0", html)

    def test_tutorial_session_persistence_isolation_and_exact_manual_restoration(self):
        out = _run_node_harness(
            """
            // 1. Boot manual session, create distinguishable persisted manual state + unrelated localStorage key
            localStorage.setItem("unrelated_portfolio_pref", "keep_me_intact");
            const s0 = bootInstance(localStorage);
            // Add product #11 (stock 22) x2 to manual cart via click on hero/data-add-cart, plus submit manual inquiry & checkout
            const manualAdd = s0.document.createElement("button");
            manualAdd.attrs["data-add-cart"] = "11";
            manualAdd.dataset.addCart = "11";
            manualAdd.click();
            manualAdd.click();
            // Fill & submit manual contact inquiry
            s0.byId.get("ct-name").value = "Manual Owner";
            s0.byId.get("ct-email").value = "manual.owner@example.invalid";
            s0.byId.get("ct-subject").value = "Manual Saved Inquiry";
            s0.byId.get("ct-message").value = "Must survive Watch Tutorial intact.";
            s0.byId.get("contact-form").dispatchEvent({ type: "submit", cancelable: true });

            // Sign in manual demo account via account modal
            s0.byId.get("account-trigger").click();
            const loginForm = s0.byId.get("account-modal-body");
            // Inject manual user & custom order & custom stock directly into persisted storage to test full matrix
            const preObj = JSON.parse(localStorage.getItem("nbashop_demo_state_v1"));
            preObj.demoUser = { username: "manual_owner", name: "Manual Owner", email: "manual.owner@example.invalid" };
            preObj.orders.push({ orderNumber: "MANUAL-ORDER-9999", customer: "Manual Owner", total: 328.0, estimatedDelivery: "2025-02-01", items: [] });
            const p11 = preObj.products.find((p) => p.id === 11);
            p11.stock = 19; // distinguishable stock change
            const preRaw = JSON.stringify(preObj);
            localStorage.setItem("nbashop_demo_state_v1", preRaw);

            // 2. Boot fresh page loading pre-populated manual session
            const app = bootInstance(localStorage);
            const manualBefore = {
              cartUnits: app.api.getState().cartUnits,
              ordersCount: app.api.getState().ordersCount,
              messagesCount: app.api.getState().messagesCount,
              demoUser: app.api.getState().demoUser,
            };

            // 3. Start Watch Tutorial and play all 10 stages to completion
            app.btnWatch.click();
            const storageAtStart = localStorage.getItem("nbashop_demo_state_v1");
            app.advanceTime(60000);
            const tutFinished = app.api.getState();
            const storageDuringFinish = localStorage.getItem("nbashop_demo_state_v1");
            const unrelatedDuringFinish = localStorage.getItem("unrelated_portfolio_pref");

            // 4. Mid-tutorial reload check (new instance reading localStorage BEFORE Exit is ever called!)
            const reloadedMidTut = bootInstance(localStorage);
            const midReloadState = reloadedMidTut.api.getState();

            // 5. Replay from Finish -> must reset cleanly with ZERO duplicate order accumulation
            app.btnPlay.click(); // Replay
            app.advanceTime(60000);
            const afterReplay = app.api.getState();

            // 6. Exit restores exact pre-tutorial manual state & normal persistence works again
            app.btnExit.click();
            const afterExit = app.api.getState();
            const storageAfterExit = localStorage.getItem("nbashop_demo_state_v1");

            // Post-exit manual cart mutation MUST persist normally again
            const postAdd = app.document.createElement("button");
            postAdd.attrs["data-add-cart"] = "6";
            postAdd.dataset.addCart = "6";
            postAdd.click();
            const storageAfterManualPostExit = JSON.parse(localStorage.getItem("nbashop_demo_state_v1"));

            // 7. Cross-context freshness check: another tab updates localStorage while tutorial is active; Exit must NOT overwrite it
            const app2 = bootInstance(localStorage);
            app2.btnWatch.click();
            const externalObj = JSON.parse(localStorage.getItem("nbashop_demo_state_v1"));
            externalObj.demoUser = { username: "other_tab_user", name: "Other Tab", email: "other@example.invalid" };
            const externalRaw = JSON.stringify(externalObj);
            localStorage.setItem("nbashop_demo_state_v1", externalRaw);
            app2.btnExit.click();
            const afterCrossTabExit = {
              demoUser: app2.api.getState().demoUser,
              storagePreserved: localStorage.getItem("nbashop_demo_state_v1") === externalRaw,
            };

            return {
              manualBefore,
              tutFinished,
              afterReplay,
              afterExit,
              midReloadState,
              byteIdenticalAtStart: storageAtStart === preRaw,
              byteIdenticalAtFinish: storageDuringFinish === preRaw,
              byteIdenticalAfterExit: storageAfterExit === preRaw,
              unrelatedPreserved: unrelatedDuringFinish === "keep_me_intact",
              postExitManualPersistedCart6: storageAfterManualPostExit.cart["6"] === 1,
              afterCrossTabExit,
            };
            """
        )

        self.assertEqual(out["manualBefore"]["cartUnits"], 2)
        self.assertEqual(out["manualBefore"]["ordersCount"], 2)
        self.assertEqual(out["manualBefore"]["demoUser"], "manual_owner")

        # Isolated tutorial ran cleanly from deterministic seed: 1 seeded + 1 tutorial order = 2, stock 34 -> 31, inquiry 1 -> 2
        self.assertTrue(out["tutFinished"]["completed"])
        self.assertEqual(out["tutFinished"]["stageId"], "finish")
        self.assertEqual(out["tutFinished"]["ordersCount"], 2)
        self.assertEqual(out["tutFinished"]["messagesCount"], 2)
        self.assertEqual(out["tutFinished"]["product1Stock"], 31)
        self.assertIsNotNone(out["tutFinished"]["orderPlacedNumber"])
        self.assertTrue(out["tutFinished"]["orderPlacedNumber"].startswith("NBA-"))

        # Replay did NOT accumulate duplicate orders or extra stock deductions
        self.assertEqual(out["afterReplay"]["ordersCount"], 2)
        self.assertEqual(out["afterReplay"]["messagesCount"], 2)
        self.assertEqual(out["afterReplay"]["product1Stock"], 31)

        # Byte-for-byte localStorage isolation + mid-tutorial reload safety + unrelated key preserved
        self.assertTrue(out["byteIdenticalAtStart"])
        self.assertTrue(out["byteIdenticalAtFinish"])
        self.assertTrue(out["byteIdenticalAfterExit"])
        self.assertTrue(out["unrelatedPreserved"])
        self.assertEqual(out["midReloadState"]["demoUser"], "manual_owner")
        self.assertEqual(out["midReloadState"]["cartUnits"], 2)
        self.assertEqual(out["midReloadState"]["ordersCount"], 2)

        # Exact Exit restoration + continued manual persistence + cross-tab freshness
        self.assertFalse(out["afterExit"]["active"])
        self.assertFalse(out["afterExit"]["persistenceSuspended"])
        self.assertEqual(out["afterExit"]["demoUser"], "manual_owner")
        self.assertEqual(out["afterExit"]["cartUnits"], 2)
        self.assertEqual(out["afterExit"]["ordersCount"], 2)
        self.assertEqual(out["afterExit"]["product1Stock"], 34)
        self.assertTrue(out["postExitManualPersistedCart6"])
        self.assertEqual(out["afterCrossTabExit"]["demoUser"], "other_tab_user")
        self.assertTrue(out["afterCrossTabExit"]["storagePreserved"])

    def test_tutorial_lifecycle_pause_modal_escape_and_cleanup(self):
        out = _run_node_harness(
            """
            const app = bootInstance(localStorage);
            app.btnWatch.click();
            // Step to Stage 3 (product-detail) paused
            app.btnNext.click(); // Stage 2 catalog-filter
            const s2Paused = app.api.getState();
            app.btnNext.click(); // Stage 3 product-detail (opens modal)
            const s3ModalOpen = !app.detModal.hidden;

            // Resume Stage 3, pause BEFORE 1300ms subAction -> no cart addition, zero pending timers
            app.btnPlay.click();
            app.advanceTime(400);
            app.btnPlay.click(); // Pause
            app.advanceTime(5000);
            const s3AfterPause = app.api.getState();

            // Resume -> let first Escape close modal + pause (WITHOUT exiting tutorial)
            app.btnPlay.click();
            app.document.dispatchEvent({ type: "keydown", key: "Escape" });
            const afterFirstEsc = {
              modalHidden: app.detModal.hidden,
              active: app.api.getState().active,
              playing: app.api.getState().playing,
              timers: app.timers.size,
            };

            // Second Escape (no modal open) exits tutorial cleanly
            app.document.dispatchEvent({ type: "keydown", key: "Escape" });
            app.advanceTime(10000);
            const afterSecondEsc = {
              active: app.api.getState().active,
              dockHidden: app.dock.hidden,
              timers: app.timers.size,
              cssVars: Object.keys(app.rootCssVars),
            };

            // Next from Stage 3 modal automatically closes modal
            app.btnWatch.click();
            app.btnNext.click(); // Stage 2
            app.btnNext.click(); // Stage 3 modal open
            const modalOpenBeforeNext = !app.detModal.hidden;
            app.btnNext.click(); // Stage 4 cart -> closes modal
            const modalHiddenAfterNext = app.detModal.hidden;
            const cartStage = app.api.getState();

            // Manual tab click while playing pauses autoplay safely
            app.btnRestart.click();
            app.navTabs[1].click();
            const afterManualTab = app.api.getState();
            app.btnExit.click();

            return {
              s2Paused, s3ModalOpen, s3AfterPause, afterFirstEsc, afterSecondEsc,
              modalOpenBeforeNext, modalHiddenAfterNext, cartStage, afterManualTab,
            };
            """
        )

        self.assertEqual(out["s2Paused"]["stageId"], "catalog-filter")
        self.assertTrue(out["s3ModalOpen"])
        self.assertFalse(out["s3AfterPause"]["playing"])
        self.assertFalse(out["s3AfterPause"]["subActionDone"])
        self.assertFalse(out["s3AfterPause"]["hasPendingTimers"])
        self.assertEqual(out["s3AfterPause"]["cartUnits"], 0)

        self.assertTrue(out["afterFirstEsc"]["modalHidden"])
        self.assertTrue(out["afterFirstEsc"]["active"])
        self.assertFalse(out["afterFirstEsc"]["playing"])
        self.assertEqual(out["afterFirstEsc"]["timers"], 0)

        self.assertFalse(out["afterSecondEsc"]["active"])
        self.assertTrue(out["afterSecondEsc"]["dockHidden"])
        self.assertEqual(out["afterSecondEsc"]["timers"], 0)
        self.assertEqual(out["afterSecondEsc"]["cssVars"], [])

        self.assertTrue(out["modalOpenBeforeNext"])
        self.assertTrue(out["modalHiddenAfterNext"])
        self.assertEqual(out["cartStage"]["stageId"], "shopping-cart")
        self.assertEqual(out["cartStage"]["cartUnits"], 2)
        self.assertFalse(out["afterManualTab"]["playing"])

    def test_adaptive_viewport_fitting_resize_chains_and_scroll_discrimination(self):
        out = _run_node_harness(
            """
            const app = bootInstance(localStorage);
            app.btnWatch.click();
            app.btnNext.click(); // catalog-filter (paused)
            app.advanceTime(800);

            const mixed = [
              [1366, 768], [1280, 768], [1024, 768], [960, 768], [800, 900],
              [390, 844], [430, 844], [390, 800], [1366, 768], [1440, 900],
            ];
            const mixedSteps = [];
            for (const [w, h] of mixed) {
              app.windowObj.innerWidth = w;
              app.windowObj.innerHeight = h;
              app.windowObj.scrollY = Math.max(0, app.windowObj.scrollY - 50);
              app.windowObj.dispatchEvent({ type: "scroll" });
              app.windowObj.dispatchEvent({ type: "resize" });
              app.windowObj.visualViewport.dispatch("resize");
              app.advanceTime(250);
              mixedSteps.push({
                w, h,
                density: app.body.dataset.tutorialDensity,
                userAway: app.api.getState().userScrolledAway,
                dockOffsetVar: app.rootCssVars["--tut-dock-offset"],
              });
            }

            const heightOnly = [[1440, 900], [1440, 800], [1440, 720], [1440, 650], [1440, 580], [1440, 768]];
            const heightSteps = [];
            for (const [w, h] of heightOnly) {
              app.windowObj.innerWidth = w;
              app.windowObj.innerHeight = h;
              app.windowObj.dispatchEvent({ type: "resize" });
              app.advanceTime(250);
              heightSteps.push({
                h,
                density: app.body.dataset.tutorialDensity,
                userAway: app.api.getState().userScrolledAway,
              });
            }

            // Genuine manual wheel scroll opt-out preserved across resize, cleared on Restart
            app.advanceTime(600);
            app.windowObj.dispatchEvent({ type: "wheel" });
            app.windowObj.scrollY = 0;
            app.windowObj.dispatchEvent({ type: "scroll" });
            const afterWheel = app.api.getState().userScrolledAway;

            app.windowObj.innerWidth = 390;
            app.windowObj.innerHeight = 844;
            app.windowObj.dispatchEvent({ type: "resize" });
            app.advanceTime(250);
            const afterResizeWithOptOut = app.api.getState().userScrolledAway;

            app.btnRestart.click();
            app.advanceTime(250);
            const afterRestart = app.api.getState().userScrolledAway;

            app.btnExit.click();
            const afterExit = {
              activeClass: app.body.classList.contains("tutorial-active"),
              datasetKeys: Object.keys(app.body.dataset).filter((k) => k.startsWith("tutorial")),
              cssVars: Object.keys(app.rootCssVars),
            };

            return { mixedSteps, heightSteps, afterWheel, afterResizeWithOptOut, afterRestart, afterExit };
            """
        )

        self.assertEqual(len(out["mixedSteps"]), 10)
        self.assertTrue(all(s["userAway"] is False for s in out["mixedSteps"]))
        self.assertTrue(all(bool(s["dockOffsetVar"]) for s in out["mixedSteps"]))
        self.assertEqual([s["density"] for s in out["heightSteps"]], ["standard", "standard", "compact", "compact", "tight", "compact"])
        self.assertTrue(all(s["userAway"] is False for s in out["heightSteps"]))
        self.assertTrue(out["afterWheel"])
        self.assertTrue(out["afterResizeWithOptOut"])
        self.assertFalse(out["afterRestart"])
        self.assertFalse(out["afterExit"]["activeClass"])
        self.assertEqual(out["afterExit"]["datasetKeys"], [])
        self.assertEqual(out["afterExit"]["cssVars"], [])

    def test_reduced_motion_mode_completes_all_ten_stages_cleanly(self):
        out = _run_node_harness(
            """
            const app = bootInstance(localStorage);
            app.env.reducedMotion = true;
            app.btnWatch.click();
            const behaviors = app.env.scrollCalls.map((c) => c.behavior);
            app.advanceTime(30000);
            return {
              behaviors,
              finalState: app.api.getState(),
              remainingTimers: app.timers.size,
            };
            """
        )
        self.assertTrue(all(b == "auto" for b in out["behaviors"]))
        self.assertTrue(out["finalState"]["completed"])
        self.assertEqual(out["finalState"]["stageId"], "finish")
        self.assertEqual(out["finalState"]["totalStages"], 10)
        self.assertEqual(out["remainingTimers"], 0)

    def test_stage3_modal_ancestor_clipping_guided_scroll_pause_and_confirmation(self):
        out = _run_node_harness(
            """
            const app = bootInstance(localStorage);
            app.windowObj.innerWidth = 320;
            app.windowObj.innerHeight = 480;
            app.dock._height = 148;
            app.detDialog.clientHeight = 250;
            app.detDialog.scrollHeight = 520;

            const preRaw = localStorage.getItem("nbashop_demo_state_v1");
            app.btnWatch.click();
            app.btnNext.click(); // Stage 2
            app.btnNext.click(); // Stage 3 (paused at phase 0)

            const p0 = app.api.getState();
            // Resume so preSubAction (850ms) guides modal scroll BEFORE size/qty click (1500ms)
            app.btnPlay.click();
            app.advanceTime(1000);
            const p1 = app.api.getState();

            // Advance past subAction (1500ms) -> size L + qty 2, then PAUSE before Add to Cart (3050ms)
            app.advanceTime(700);
            app.btnPlay.click(); // Pause
            const p2Paused = app.api.getState();
            const pausedTimers = app.timers.size;
            app.advanceTime(3000); // Must NOT trigger Add to Cart while paused!
            const afterWaitPaused = app.api.getState();

            // Resume -> preSecondSubAction + Add to Cart execute cleanly and display confirmation
            app.btnPlay.click();
            app.advanceTime(3200);
            const p4AfterAdd = app.api.getState();
            const duringRaw = localStorage.getItem("nbashop_demo_state_v1");

            // Exit cleans status banner and focus classes without writing localStorage
            app.btnExit.click();
            const statusAfterExitHidden = app.byId.get("tutorialActionStatus").hidden;
            const afterExitRaw = localStorage.getItem("nbashop_demo_state_v1");

            return {
              p0, p1, p2Paused, pausedTimers, afterWaitPaused, p4AfterAdd,
              statusAfterExitHidden,
              storageUntouched: preRaw === duringRaw && preRaw === afterExitRaw,
            };
            """
        )
        # Initial constrained 320x480 modal: artwork/title visible, lower controls clipped (NOT falsely visible)
        self.assertEqual(out["p0"]["adaptiveLayout"]["density"], "tight")
        self.assertEqual(out["p0"]["modalVisibility"]["dialog"]["scrollTop"], 0)
        self.assertEqual(out["p0"]["modalVisibility"]["sizeRow"]["visibleRatio"], 0)
        self.assertTrue(out["p0"]["modalVisibility"]["addBtn"]["clippedByAncestor"])
        self.assertEqual(out["p0"]["modalVisibility"]["addBtn"]["visibleRatio"], 0)

        # Before size/qty interaction: modal internally scrolled so controls are 100% visible
        self.assertGreater(out["p1"]["modalVisibility"]["dialog"]["scrollTop"], 0)
        self.assertEqual(out["p1"]["modalVisibility"]["sizeRow"]["visibleRatio"], 1)
        self.assertEqual(out["p1"]["modalVisibility"]["qtyControl"]["visibleRatio"], 1)
        self.assertEqual(out["p1"]["modalVisibility"]["addBtn"]["visibleRatio"], 1)

        # Pause mid-Stage 3 stops Add to Cart timer cleanly
        self.assertEqual(out["pausedTimers"], 0)
        self.assertEqual(out["p2Paused"]["cartUnits"], 0)
        self.assertEqual(out["afterWaitPaused"]["cartUnits"], 0)
        self.assertTrue(out["afterWaitPaused"]["modalVisibility"]["open"])

        # After resume: Add to Cart runs once, shows confirmation status, preserves localStorage
        self.assertEqual(out["p4AfterAdd"]["cartUnits"], 2)
        self.assertIn("Added 2", out["p4AfterAdd"]["actionStatusText"])
        self.assertIn("Cart: 2", out["p4AfterAdd"]["actionStatusText"])
        self.assertTrue(out["statusAfterExitHidden"])
        self.assertTrue(out["storageUntouched"])

    def test_modal_manual_scroll_opt_out_and_active_modal_resize(self):
        out = _run_node_harness(
            """
            const app = bootInstance(localStorage);
            app.windowObj.innerWidth = 320;
            app.windowObj.innerHeight = 480;
            app.dock._height = 148;
            app.detDialog.clientHeight = 250;
            app.detDialog.scrollHeight = 520;

            app.btnWatch.click();
            app.btnNext.click();
            app.btnNext.click(); // Stage 3
            app.advanceTime(300);

            // Genuine user wheel + scroll inside modal dialog
            app.detDialog.dispatchEvent({ type: "wheel" });
            app.detDialog.scrollTop = 95;
            app.detDialog.dispatchEvent({ type: "scroll" });
            const optOutState = app.api.getState();

            // Resume playback: automated preSubAction must NOT override the user's manual modal scrollTop
            app.btnPlay.click();
            app.advanceTime(1000);
            const scrollAfterAuto = app.detDialog.scrollTop;

            // Restart clears opt-out; resizing active Stage 3 modal keeps controls framed without tripping opt-out
            app.btnRestart.click();
            app.btnNext.click();
            app.btnNext.click(); // Stage 3 fresh
            app.btnPlay.click();
            app.advanceTime(1700); // size/qty phase active
            app.btnPlay.click(); // pause on active modal

            const resizeTrace = [];
            for (const [w, h, ch] of [[1366, 768, 380], [390, 844, 520], [320, 480, 250]]) {
              app.windowObj.innerWidth = w;
              app.windowObj.innerHeight = h;
              app.detDialog.clientHeight = ch;
              app.windowObj.dispatchEvent({ type: "resize" });
              app.advanceTime(250);
              const st = app.api.getState();
              resizeTrace.push({
                vp: `${w}x${h}`,
                density: st.adaptiveLayout.density,
                userAway: st.userScrolledAway,
                modalAway: st.modalUserScrolledAway,
                addVis: st.modalVisibility.addBtn ? st.modalVisibility.addBtn.visibleRatio : 0,
              });
            }

            return { optOutState, scrollAfterAuto, resizeTrace };
            """
        )
        self.assertTrue(out["optOutState"]["modalUserScrolledAway"])
        self.assertTrue(out["optOutState"]["userScrolledAway"])
        self.assertEqual(out["scrollAfterAuto"], 95)
        self.assertEqual([r["density"] for r in out["resizeTrace"]], ["compact", "compact", "tight"])
        self.assertTrue(all(not r["userAway"] and not r["modalAway"] for r in out["resizeTrace"]))
        self.assertTrue(all(r["addVis"] == 1 for r in out["resizeTrace"]))

    def test_stage8_mobile_sequential_kpis_then_orders_and_desktop_preservation(self):
        out = _run_node_harness(
            """
            const app = bootInstance(localStorage);
            // Mobile constrained layout: KPI strip and orders card stacked vertically taller than availH
            app.windowObj.innerWidth = 390;
            app.windowObj.innerHeight = 844;
            app.dock._height = 160;
            app.byId.get("admin-overview-zone")._docTop = 296;
            app.byId.get("admin-overview-zone")._height = 980;
            app.byId.get("admin-kpi-strip")._docTop = 296;
            app.byId.get("admin-kpi-strip")._height = 160;
            app.byId.get("admin-stock-card")._docTop = 470;
            app.byId.get("admin-stock-card")._height = 380;
            app.byId.get("admin-orders-card")._docTop = 864;
            app.byId.get("admin-orders-card")._height = 410;

            app.btnWatch.click();
            for (let i = 0; i < 7; i++) app.btnNext.click(); // Jump to Stage 8 (admin-dashboard)
            const mobileP0 = app.api.getState();
            const toastsAtEnter = app.byId.get("toast-region").children.length;

            // Play Stage 8 so subAction (2100ms) transitions focus to #admin-orders-card
            app.btnPlay.click();
            app.advanceTime(2300);
            const mobileP1 = app.api.getState();
            app.btnPlay.click();

            // Desktop layout: full overview fits simultaneously -> resolves to #admin-overview-zone with no extra scroll
            app.windowObj.innerWidth = 1280;
            app.windowObj.innerHeight = 650;
            app.dock._height = 84;
            app.byId.get("admin-overview-zone")._docTop = 296;
            app.byId.get("admin-overview-zone")._height = 440;
            app.byId.get("admin-kpi-strip")._docTop = 296;
            app.byId.get("admin-kpi-strip")._height = 72;
            app.byId.get("admin-stock-card")._docTop = 380;
            app.byId.get("admin-stock-card")._height = 340;
            app.byId.get("admin-orders-card")._docTop = 380;
            app.byId.get("admin-orders-card")._height = 340;

            app.btnPrev.click();
            app.btnNext.click(); // Re-enter Stage 8 on desktop
            const desktopP0 = app.api.getState();
            const scrollCallsBeforeSub = app.env.scrollCalls.length;
            app.btnPlay.click();
            app.advanceTime(2300);
            const scrollCallsAfterSub = app.env.scrollCalls.length;

            return { mobileP0, toastsAtEnter, mobileP1, desktopP0, desktopSubScrolled: scrollCallsAfterSub > scrollCallsBeforeSub };
            """
        )
        self.assertEqual(out["mobileP0"]["stageId"], "admin-dashboard")
        self.assertEqual(out["mobileP0"]["resolvedFocusSelector"], "#admin-kpi-strip")
        self.assertEqual(out["toastsAtEnter"], 0)
        self.assertEqual(out["mobileP1"]["resolvedFocusSelector"], "#admin-orders-card")
        self.assertEqual(out["desktopP0"]["resolvedFocusSelector"], "#admin-overview-zone")
        self.assertFalse(out["desktopSubScrolled"])

    def test_stage8_conditional_third_phase_inbox_inquiry_and_lifecycle(self):
        out = _run_node_harness(
            """
            const app = bootInstance(localStorage);
            const preRaw = localStorage.getItem("nbashop_demo_state_v1");

            // 1. Constrained 320x480: KPIs -> Orders -> Conditional Inbox Section (inquiry starts below fold)
            app.windowObj.innerWidth = 320;
            app.windowObj.innerHeight = 480;
            app.dock._docTop = 80;
            app.dock._height = 192;
            app.byId.get("admin-overview-zone")._docTop = 296;
            app.byId.get("admin-overview-zone")._height = 1040;
            app.byId.get("admin-kpi-strip")._docTop = 296;
            app.byId.get("admin-kpi-strip")._height = 170;
            app.byId.get("admin-stock-card")._docTop = 480;
            app.byId.get("admin-stock-card")._height = 360;
            app.byId.get("admin-orders-card")._docTop = 856;
            app.byId.get("admin-orders-card")._height = 410;
            app.byId.get("adm-orders-wrap")._docTop = 900;
            app.byId.get("adm-orders-wrap")._height = 118;
            app.byId.get("adm-orders-body")._docTop = 928;
            app.byId.get("admin-inbox-section")._docTop = 1048;
            app.byId.get("admin-inbox-section")._height = 190;
            app.byId.get("admin-inbox-heading")._docTop = 1054;
            app.byId.get("admin-inbox-heading")._height = 20;
            app.byId.get("adm-messages-wrap")._docTop = 1082;
            app.byId.get("adm-messages-wrap")._height = 150;
            app.byId.get("adm-messages-body")._docTop = 1108;

            app.btnWatch.click();
            for (let i = 0; i < 7; i++) app.btnNext.click(); // Stage 8 paused at Phase 1 (KPIs)
            const p1 = app.api.getState();

            app.btnPlay.click();
            app.advanceTime(2000); // Past subDelayMs (1800ms) -> Phase 2 (Orders)
            const p2 = app.api.getState();

            app.advanceTime(1900); // Past secondSubDelayMs (3600ms) -> Phase 3 (Inbox heading + inquiry row)
            const p3 = app.api.getState();
            app.btnPlay.click(); // Pause at Phase 3

            // Resize active Stage 8 Phase 3 from 320x480 UP to 1280x650 -> restores simultaneous desktop overview
            app.windowObj.innerWidth = 1280;
            app.windowObj.innerHeight = 650;
            app.dock._height = 84;
            app.byId.get("admin-overview-zone")._docTop = 296;
            app.byId.get("admin-overview-zone")._height = 440;
            app.byId.get("admin-kpi-strip")._docTop = 296;
            app.byId.get("admin-kpi-strip")._height = 72;
            app.byId.get("admin-orders-card")._docTop = 380;
            app.byId.get("admin-orders-card")._height = 340;
            app.byId.get("admin-inbox-section")._docTop = 530;
            app.byId.get("admin-inbox-section")._height = 140;
            app.byId.get("admin-inbox-heading")._docTop = 534;
            app.byId.get("admin-inbox-heading")._height = 20;
            app.byId.get("adm-messages-body")._docTop = 576;
            app.windowObj.dispatchEvent({ type: "resize" });
            app.advanceTime(250);
            const afterResizeToDesktop = app.api.getState();

            // 2. 390x844 where Orders + Inbox heading + inquiry row ALL fit in Phase 2 -> Phase 3 does ZERO extra scroll
            app.windowObj.innerWidth = 390;
            app.windowObj.innerHeight = 844;
            app.dock._height = 156;
            app.byId.get("admin-overview-zone")._docTop = 296;
            app.byId.get("admin-overview-zone")._height = 1040;
            app.byId.get("admin-kpi-strip")._docTop = 296;
            app.byId.get("admin-kpi-strip")._height = 160;
            app.byId.get("admin-orders-card")._docTop = 860;
            app.byId.get("admin-orders-card")._height = 410;
            app.byId.get("admin-inbox-section")._docTop = 1040;
            app.byId.get("admin-inbox-section")._height = 170;
            app.byId.get("admin-inbox-heading")._docTop = 1046;
            app.byId.get("admin-inbox-heading")._height = 20;
            app.byId.get("adm-messages-body")._docTop = 1086;

            app.btnPrev.click();
            app.btnNext.click(); // Re-enter Stage 8 at 390x844
            app.btnPlay.click();
            app.advanceTime(2000); // Phase 2 frames #admin-orders-card
            const mob390P2ScrollY = app.windowObj.scrollY;
            const mob390P2Focus = app.api.getState().resolvedFocusSelector;
            app.advanceTime(1900); // Phase 3 checks actual bounds -> already visible -> zero extra scroll
            const mob390P3ScrollY = app.windowObj.scrollY;
            const mob390P3Focus = app.api.getState().resolvedFocusSelector;
            app.btnPlay.click();

            // 3. Pause before Phase 3 at 320x480 prevents Phase 3; genuine wheel opt-out blocks Phase 3 scroll
            app.windowObj.innerWidth = 320;
            app.windowObj.innerHeight = 480;
            app.dock._height = 192;
            app.byId.get("admin-orders-card")._docTop = 856;
            app.byId.get("admin-inbox-section")._docTop = 1048;
            app.byId.get("admin-inbox-heading")._docTop = 1054;
            app.byId.get("adm-messages-body")._docTop = 1108;

            app.btnPrev.click();
            app.btnNext.click(); // Re-enter Stage 8 at 320x480
            app.btnPlay.click();
            app.advanceTime(2000); // Phase 2
            app.btnPlay.click(); // Pause BEFORE Phase 3
            app.advanceTime(3000);
            const focusWhilePaused = app.api.getState().resolvedFocusSelector;
            const secondDoneWhilePaused = app.api.getState().secondSubActionDone;

            // Genuine user wheel scroll opt-out -> Phase 3 must not override user scrollY
            app.advanceTime(600);
            app.windowObj.dispatchEvent({ type: "wheel" });
            app.windowObj.scrollY = 420;
            app.windowObj.dispatchEvent({ type: "scroll" });
            const optOutSet = app.api.getState().userScrolledAway;
            app.btnPlay.click(); // Resume -> Phase 3 fires but respects userScrolledAway
            app.advanceTime(4000);
            const scrollAfterOptOut = app.windowObj.scrollY;

            app.btnExit.click();
            const postRaw = localStorage.getItem("nbashop_demo_state_v1");

            return {
              p1, p2, p3, afterResizeToDesktop,
              mob390P2ScrollY, mob390P2Focus, mob390P3ScrollY, mob390P3Focus,
              focusWhilePaused, secondDoneWhilePaused, optOutSet, scrollAfterOptOut,
              storageUntouched: preRaw === postRaw,
            };
            """
        )
        # 320x480 3-phase sequence: KPI -> Orders -> Inbox Section with heading & inquiry row 100% visible
        self.assertEqual(out["p1"]["resolvedFocusSelector"], "#admin-kpi-strip")
        self.assertTrue(out["p1"]["adminVisibility"]["kpiStrip"]["full"])
        self.assertEqual(out["p2"]["resolvedFocusSelector"], "#admin-orders-card")
        self.assertTrue(out["p2"]["adminVisibility"]["highlightedOrderRow"]["full"])
        self.assertFalse(out["p2"]["adminVisibility"]["highlightedInquiryRow"]["full"])
        self.assertEqual(out["p3"]["resolvedFocusSelector"], "#admin-inbox-section")
        self.assertTrue(out["p3"]["adminVisibility"]["inboxHeading"]["full"])
        self.assertTrue(out["p3"]["adminVisibility"]["highlightedInquiryRow"]["full"])

        # Resizing active Phase 3 to desktop restores full simultaneous #admin-overview-zone
        self.assertEqual(out["afterResizeToDesktop"]["resolvedFocusSelector"], "#admin-overview-zone")

        # 390x844 preserves existing Phase 2 framing with zero redundant Phase 3 scroll
        self.assertEqual(out["mob390P2Focus"], "#admin-orders-card")
        self.assertEqual(out["mob390P3Focus"], "#admin-orders-card")
        self.assertEqual(out["mob390P2ScrollY"], out["mob390P3ScrollY"])

        # Pause, genuine manual scroll opt-out, and localStorage isolation all hold
        self.assertEqual(out["focusWhilePaused"], "#admin-orders-card")
        self.assertFalse(out["secondDoneWhilePaused"])
        self.assertTrue(out["optOutSet"])
        self.assertEqual(out["scrollAfterOptOut"], 420)
        self.assertTrue(out["storageUntouched"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
