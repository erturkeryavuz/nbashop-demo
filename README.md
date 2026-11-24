# NBASHOP — Interactive Portfolio Showcase

![NBASHOP — Synthetic Basketball Storefront & PHP/MySQL Security Audit](media/nbashop-readme-hero.png)

**Live Storefront Showcase (GitHub Pages):** [https://erturkeryavuz.github.io/nbashop-demo/](https://erturkeryavuz.github.io/nbashop-demo/)

An independent, static, client-side interactive portfolio showcase for **NBASHOP**, an educational PHP/MySQL e-commerce engineering project by **Ertürk Eryavuz**.

> **Source Availability, Non-Shop & Non-Affiliation Notice**
> - The original PHP/MySQL storefront, database schema, and administrative backend repository is **private**.
> - This public repository contains **only** the sanitized static portfolio showcase (`docs/`), original portfolio showcase artwork (`media/`), third-party attribution notices, and offline verification checks.
> - This website is a **static interactive demonstration, not a live online shop**. No genuine orders, no payment processing, no card/IBAN collection, and no real customer registrations occur through this showcase.
> - Previously verified PHP/MySQL security remediation tests (`14/14` offline static checks and `17/17` PHP 8.3 / MySQL 8.0 / Apache 2.4 CI runtime security tests covering prepared statements, `password_verify`, CSRF/XSS/IDOR protections, safe image upload validation, and Apache `.htaccess` guards) were executed against the **original private PHP/MySQL engineering codebase**, not against this static browser runtime.
> - NBASHOP is an independent student portfolio project and is **not affiliated with, endorsed by, or sponsored by the National Basketball Association (NBA), Nike, Under Armour, New Era, or any commercial sports franchise or merchandise brand**.

## What This Showcase Demonstrates

- **Interactive Watch Tutorial (10 Stages, Isolated Session):** Guided walkthrough with Play/Pause, Previous, Next, Restart, Replay, Exit / Explore Manually, reduced-motion support, and adaptive viewport fitting across desktop and mobile viewports. Watch Tutorial runs in a fully isolated in-memory synthetic session so it never overwrites or contaminates a visitor's persisted manual-mode state (`nbashop_demo_state_v1`), restoring the exact manual session and layout on Exit.
- **Synthetic Storefront Catalog (14 Items):** 100% synthetic basketball merchandise catalog across 12 source-backed categories illustrated with **original inline vector SVGs** (`docs/artwork.js`), zero third-party retail product photography, and zero commercial admin theme files.
- **Interactive Client-Side Flows:** Category navigation, search, price/stock/category filtering, sorting, pagination, product detail modal with size & quantity selection, stock-bounded shopping cart (`$10.00` flat shipping), simulated non-payment order-preview checkout (`DEMO-ORDER-0001`), simulated contact inquiry & demo account switching (`@example.invalid`), and an interactive Admin & Security inspector summarizing the backend hardening architecture.

## Attribution & Third-Party Notices

- **EShopper Visual Heritage:** Adapted from [HTML Codex](https://htmlcodex.com) under **Creative Commons Attribution 4.0 International (`CC-BY 4.0`)**, with the required credit link preserved in the storefront footer.
- **Typography:** `Poppins` loaded from Google Fonts under the **SIL Open Font License 1.1 (`OFL-1.1`)**.
- **Product & Portfolio Artwork:** Original inline vector SVG product graphics in `docs/artwork.js` and original editable SVG portfolio showcase banners in `media/src/`.

Full attribution details:
- [docs/THIRD-PARTY-NOTICES.md](docs/THIRD-PARTY-NOTICES.md)
- [https://erturkeryavuz.github.io/nbashop-demo/notices.html](https://erturkeryavuz.github.io/nbashop-demo/notices.html)

## Local Preview & Offline Verification

```bash
# Run deterministic offline safety, inventory, artwork, link, and JS syntax checks
python3 -B tests/verify_demo.py

# Run tutorial lifecycle, persistence isolation, and adaptive layout regression tests
python3 -B -m unittest discover -s tests -v

# Preview locally
python3 -m http.server 8080 --directory docs
# Open http://127.0.0.1:8080/
```
