"""Standalone offline security, inventory, attribution, link, and JS syntax checks for nbashop-demo."""

import re
import subprocess
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

FORBIDDEN_PATTERNS = [
    ("local_user_path", re.compile(r"/Users/[A-Za-z0-9._-]+")),
    ("private_key", re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----")),
    ("old_private_repo_link", re.compile(r"github\.com/erturkeryavuz/NBASHOP")),
    ("old_private_pages_link", re.compile(r"erturkeryavuz\.github\.io/NBASHOP")),
    ("db_credentials", re.compile(r"berkhoca_db|ci_ephemeral_")),
    ("legacy_asset_src_or_href", re.compile(r"""(?:src|href)\s*=\s*["'][^"']*(?:nba_shop_frontend|admin_template|\.(?:jpg|jpeg|png|webp|avif))""", re.I)),
    ("jquery_legacy", re.compile(r"jquery-1\.(?:8|9)", re.I)),
]


class NBAShopDemoTests(unittest.TestCase):
    def test_exact_docs_file_inventory(self):
        actual = {
            p.relative_to(DOCS).as_posix()
            for p in DOCS.rglob("*")
            if p.is_file() and p.name != ".DS_Store"
        }
        self.assertEqual(actual, EXPECTED_DOCS_FILES)

    def test_zero_php_sql_or_raster_images_in_repo(self):
        forbidden_exts = {".php", ".sql", ".sqlite", ".sqlite3", ".db", ".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"}
        for p in ROOT.rglob("*"):
            if not p.is_file() or ".git" in p.parts:
                continue
            self.assertNotIn(p.suffix.lower(), forbidden_exts, f"Forbidden file type present: {p.relative_to(ROOT)}")

    def test_zero_private_or_commercial_directories(self):
        for bad in ["nba_shop_frontend", "admin_panel", "admin_template", "database"]:
            self.assertFalse((ROOT / bad).exists(), f"Forbidden directory present: {bad}")

    def test_zero_secrets_paths_or_stale_private_links(self):
        for p in ROOT.rglob("*"):
            if not p.is_file() or ".git" in p.parts or p == Path(__file__).resolve():
                continue
            text = p.read_text(encoding="utf-8", errors="replace")
            for label, pat in FORBIDDEN_PATTERNS:
                self.assertIsNone(pat.search(text), f"Forbidden pattern '{label}' matched in {p.relative_to(ROOT)}")

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
