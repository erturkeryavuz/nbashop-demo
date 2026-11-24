"""Standalone offline security, inventory, attribution, link, artwork, and JS syntax checks for nbashop-demo."""

from __future__ import annotations

import re
import struct
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS = ROOT / "docs"

EXPECTED_DOCS_FILES = {
    ".nojekyll",
    "THIRD-PARTY-NOTICES.md",
    "app.js",
    "artwork.js",
    "data.js",
    "index.html",
    "notices.html",
    "styles.css",
}

FORBIDDEN_EXTS = {
    ".php", ".sql", ".sqlite", ".sqlite3", ".db",
    ".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif",
}

FORBIDDEN_DIRS = ("nba_shop_frontend", "admin_panel", "admin_template", "database")

# Exact two-file authorized exception for original portfolio showcase artwork outside docs/
AUTHORIZED_ARTWORK_PNGS = {
    "media/nbashop-readme-hero.png": (1600, 900),
    "media/nbashop-social-preview.png": (1280, 640),
}

AUTHORIZED_ARTWORK_SVGS = {
    "media/src/nbashop-readme-hero.svg",
    "media/src/nbashop-social-preview.svg",
}

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"

FORBIDDEN_PATTERNS = [
    ("local_user_path", re.compile(r"/Users/[A-Za-z0-9._-]+")),
    ("private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("old_private_repo_link", re.compile(r"github\.com/erturkeryavuz/NBASHOP")),
    ("old_private_pages_link", re.compile(r"erturkeryavuz\.github\.io/NBASHOP")),
    ("db_credentials", re.compile(r"berkhoca_db|ci_ephemeral_")),
    ("legacy_asset_src_or_href", re.compile(r"""(?:src|href)\s*=\s*["'][^"']*(?:nba_shop_frontend|admin_template|\.(?:jpg|jpeg|png|webp|avif))""", re.I)),
    ("jquery_legacy", re.compile(r"jquery-1\.(?:8|9)", re.I)),
]


def find_forbidden_extension_violations(repo_root: Path) -> list[str]:
    violations = []
    for p in repo_root.rglob("*"):
        if not p.is_file() or ".git" in p.parts or "__pycache__" in p.parts:
            continue
        rel = p.relative_to(repo_root).as_posix()
        if p.suffix.lower() in FORBIDDEN_EXTS:
            if rel in AUTHORIZED_ARTWORK_PNGS:
                continue
            violations.append(rel)
    return sorted(violations)


def find_forbidden_directories(repo_root: Path) -> list[str]:
    return [d for d in FORBIDDEN_DIRS if (repo_root / d).exists()]


def find_forbidden_pattern_violations(repo_root: Path, skip_file: Path | None = None) -> list[tuple[str, str]]:
    violations = []
    for p in repo_root.rglob("*"):
        if not p.is_file() or ".git" in p.parts or "__pycache__" in p.parts:
            continue
        if skip_file is not None and p.resolve() == skip_file.resolve():
            continue
        if p.suffix.lower() == ".png":
            continue
        text = p.read_text(encoding="utf-8", errors="replace")
        rel = p.relative_to(repo_root).as_posix()
        for label, pat in FORBIDDEN_PATTERNS:
            if pat.search(text):
                violations.append((label, rel))
    return violations


class NBAShopDemoTests(unittest.TestCase):
    def test_exact_docs_file_inventory(self):
        actual = {
            p.relative_to(DOCS).as_posix()
            for p in DOCS.rglob("*")
            if p.is_file() and p.name != ".DS_Store"
        }
        self.assertEqual(actual, EXPECTED_DOCS_FILES)

    def test_zero_php_sql_or_raster_images_in_repo(self):
        violations = find_forbidden_extension_violations(ROOT)
        self.assertEqual(violations, [], f"Forbidden file type(s) present: {violations}")

    def test_authorized_portfolio_artwork_signatures_dimensions_and_sources(self):
        for rel, expected_dims in AUTHORIZED_ARTWORK_PNGS.items():
            p = ROOT / rel
            self.assertTrue(p.is_file(), f"Missing authorized portfolio artwork: {rel}")
            raw = p.read_bytes()
            self.assertTrue(raw.startswith(PNG_SIGNATURE), f"Invalid PNG signature in {rel}")
            self.assertEqual(raw[12:16], b"IHDR", f"Missing PNG IHDR chunk in {rel}")
            w, h = struct.unpack(">II", raw[16:24])
            self.assertEqual((w, h), expected_dims, f"Unexpected dimensions for {rel}: {(w, h)} != {expected_dims}")

        for rel in AUTHORIZED_ARTWORK_SVGS:
            p = ROOT / rel
            self.assertTrue(p.is_file(), f"Missing editable SVG source: {rel}")
            svg_txt = p.read_text(encoding="utf-8")
            self.assertIn("<svg", svg_txt)
            self.assertIn("</svg>", svg_txt)

        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        self.assertIn("media/nbashop-readme-hero.png", readme)

    def test_zero_private_or_commercial_directories(self):
        found = find_forbidden_directories(ROOT)
        self.assertEqual(found, [], f"Forbidden directory present: {found}")

    def test_zero_secrets_paths_or_stale_private_links(self):
        violations = find_forbidden_pattern_violations(ROOT, skip_file=Path(__file__))
        self.assertEqual(violations, [], f"Forbidden pattern(s) matched: {violations}")

    def test_negative_safety_rejects_unauthorized_rasters_and_forbidden_artifacts(self):
        with tempfile.TemporaryDirectory(prefix="nbashop_neg_safety_") as tmp:
            root = Path(tmp)
            # 1. Exact two-file exception allows ONLY the two authorized paths, rejecting arbitrary PNGs & other rasters
            for rel in (
                "media/nbashop-readme-hero.png",
                "media/nbashop-social-preview.png",
                "media/extra-unauthorized.png",
                "docs/product-photo.png",
                "media/banner.jpg",
                "media/photo.webp",
                "media/anim.gif",
                "index.php",
                "dump.sql",
                "app.sqlite3",
                "legacy.db",
            ):
                fp = root / rel
                fp.parent.mkdir(parents=True, exist_ok=True)
                fp.write_bytes(b"placeholder")

            ext_violations = find_forbidden_extension_violations(root)
            self.assertNotIn("media/nbashop-readme-hero.png", ext_violations)
            self.assertNotIn("media/nbashop-social-preview.png", ext_violations)
            for forbidden in (
                "media/extra-unauthorized.png",
                "docs/product-photo.png",
                "media/banner.jpg",
                "media/photo.webp",
                "media/anim.gif",
                "index.php",
                "dump.sql",
                "app.sqlite3",
                "legacy.db",
            ):
                self.assertIn(forbidden, ext_violations)

            # 2. Forbidden private/commercial directories still rejected
            for bad_dir in FORBIDDEN_DIRS:
                (root / bad_dir).mkdir(parents=True, exist_ok=True)
            self.assertEqual(set(find_forbidden_directories(root)), set(FORBIDDEN_DIRS))

            # 3. Forbidden patterns (local paths, stale private repo links, legacy raster img src) still rejected
            probe = root / "probe.html"
            probe.write_text(
                '<a href="https://github.com/erturkeryavuz/NBASHOP">old</a>\n'
                '<img src="media/product.png" />\n'
                '<!-- /Users/alice/secret -->\n',
                encoding="utf-8",
            )
            pat_labels = {lbl for lbl, _ in find_forbidden_pattern_violations(root)}
            self.assertIn("old_private_repo_link", pat_labels)
            self.assertIn("legacy_asset_src_or_href", pat_labels)
            self.assertIn("local_user_path", pat_labels)

    def test_required_attributions_and_disclaimers_present(self):
        idx = (DOCS / "index.html").read_text(encoding="utf-8")
        notices_html = (DOCS / "notices.html").read_text(encoding="utf-8")
        notices_md = (DOCS / "THIRD-PARTY-NOTICES.md").read_text(encoding="utf-8")
        for doc in (idx, notices_html, notices_md):
            self.assertIn("https://htmlcodex.com", doc)
            self.assertIn("CC-BY 4.0", doc)
        self.assertIn("notices.html", idx)
        self.assertIn("THIRD-PARTY-NOTICES.md", idx)
        self.assertIn("https://github.com/erturkeryavuz/nbashop-demo", idx)

    def test_no_external_runtime_scripts(self):
        for fn in ["index.html", "notices.html"]:
            html = (DOCS / fn).read_text(encoding="utf-8")
            self.assertNotRegex(html, r'<script[^>]+src="https?://')

    def test_relative_links_resolve(self):
        idx = (DOCS / "index.html").read_text(encoding="utf-8")
        for rel in ["styles.css", "data.js", "artwork.js", "app.js", "notices.html", "THIRD-PARTY-NOTICES.md"]:
            self.assertIn(rel, idx)
            self.assertTrue((DOCS / rel).is_file(), f"Missing referenced file: {rel}")

    def test_js_syntax_valid(self):
        node = subprocess.run(["which", "node"], capture_output=True, text=True).stdout.strip()
        if not node:
            self.skipTest("node not installed")
        for js in ["data.js", "artwork.js", "app.js"]:
            r = subprocess.run([node, "--check", str(DOCS / js)], capture_output=True, text=True)
            self.assertEqual(r.returncode, 0, f"JS syntax error in {js}: {r.stderr}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
