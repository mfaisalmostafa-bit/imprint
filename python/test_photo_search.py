"""Photo Search: isolate + rerank. Never SKU. Dual-framing (80px snap, 140px thumb)."""

from __future__ import annotations

import pathlib
import unittest

import photo_search as s


def rgb_canvas(w: int, h: int, bg: tuple[int, int, int]) -> list[int]:
    out = []
    for _ in range(w * h):
        out.extend(bg)
    return out


def paint(rgb: list[int], w: int, x0: int, y0: int, x1: int, y1: int, col: tuple[int, int, int]) -> None:
    for y in range(y0, y1):
        for x in range(x0, x1):
            i = (y * w + x) * 3
            rgb[i] = col[0]
            rgb[i + 1] = col[1]
            rgb[i + 2] = col[2]


def tumbler(w: int, h: int, *, cream: bool, table: bool = True) -> list[int]:
    bg = (120, 78, 36) if table else (245, 245, 245)
    rgb = rgb_canvas(w, h, bg)
    col = (228, 216, 198) if cream else (22, 22, 24)
    x0, y0 = int(w * 0.38), int(h * 0.20)
    x1, y1 = int(w * 0.62), int(h * 0.82)
    paint(rgb, w, x0, y0, x1, y1, col)
    lid = (200, 120, 40) if cream else (8, 8, 8)
    paint(rgb, w, x0, y0, x1, y0 + max(3, int(h * 0.08)), lid)
    return rgb


def flask(w: int, h: int, *, digital: bool = False) -> list[int]:
    rgb = rgb_canvas(w, h, (8, 8, 10))
    x0, y0 = int(w * 0.42), int(h * 0.10)
    x1, y1 = int(w * 0.58), int(h * 0.88)
    paint(rgb, w, x0, y0, x1, y1, (18, 18, 20))
    if digital:
        paint(rgb, w, x0 + 2, y0 + 2, x1 - 2, y0 + int(h * 0.12), (40, 180, 220))
    return rgb


def bottle(w: int, h: int) -> list[int]:
    rgb = rgb_canvas(w, h, (240, 240, 238))
    x0, y0 = int(w * 0.44), int(h * 0.08)
    x1, y1 = int(w * 0.56), int(h * 0.90)
    paint(rgb, w, x0, y0, x1, y1, (28, 28, 30))
    return rgb


def brick(w: int, h: int, *, white: bool) -> list[int]:
    rgb = rgb_canvas(w, h, (40, 40, 42))
    col = (236, 236, 234) if white else (24, 24, 26)
    paint(rgb, w, int(w * 0.32), int(h * 0.28), int(w * 0.68), int(h * 0.72), col)
    return rgb


def pad(w: int, h: int) -> list[int]:
    rgb = rgb_canvas(w, h, (230, 230, 228))
    paint(rgb, w, int(w * 0.22), int(h * 0.30), int(w * 0.78), int(h * 0.70), (210, 210, 208))
    return rgb


def row(sku: str, name: str, category: str, rgb: list[int], w: int, h: int, **extra: object) -> dict:
    feat = s.describe(w, h, rgb)
    return {
        "sku": sku,
        "name": name,
        "category": category,
        "src": "/",
        "family": s.family_of({"category": category, "name": name}),
        "feat": feat,
        **extra,
    }


class FamilyTests(unittest.TestCase):
    def test_family_from_category_and_name_never_sku(self):
        self.assertEqual(s.family_of({"category": "Drinkware", "name": "Brewbuddy tumbler"}), "tumbler")
        self.assertEqual(s.family_of({"category": "Drinkware", "name": "Shinny Digital Thermal Flask"}), "flask")
        self.assertEqual(s.family_of({"category": "Drinkware", "name": "Stainless Steel Vacuum Bottle"}), "bottle")
        self.assertEqual(s.family_of({"category": "Tech", "name": "Power Bank 5000mAh Compact"}), "powerbank")
        self.assertEqual(s.family_of({"category": "Tech", "name": "Limestone Wireless Charger"}), "charger")
        src = pathlib.Path(__file__).with_name("photo_search.py").read_text()
        self.assertNotIn("sku ===", src)
        self.assertNotIn('sku ==', src)
        self.assertNotIn("TH164", src)

    def test_source_has_no_sku_branches(self):
        src = pathlib.Path(__file__).with_name("photo_search.py").read_text()
        self.assertNotRegex(src, r"\bsku\b.*=.*['\"]")


class RerankTests(unittest.TestCase):
    def test_cream_tumbler_does_not_lock_black_drinkware(self):
        """Photo 1 analogue: cream tumbler on wood vs black tumbler / flask / bottle."""
        for size in (80, 140):
            q = s.describe(size, size, tumbler(size, size, cream=True, table=True))
            catalog = [
                row("TM176", "Brewbuddy tumbler", "Drinkware", tumbler(size, size, cream=False, table=False), size, size),
                row("FK-DG-SHN", "Shinny Digital Thermal Flask", "Drinkware", flask(size, size, digital=True), size, size),
                row("F18", "Stainless Steel Vacuum Bottle", "Drinkware", bottle(size, size), size, size),
            ]
            # Production embed: all ~56%.
            embed = [{"sku": r["sku"], "score": 0.56} for r in catalog]
            hits = s.rerank(q, catalog, embed)
            ans = s.interpret(hits)
            self.assertFalse(s.is_lock(ans), ans)
            self.assertNotEqual(ans.get("kind"), "winner")
            skus = [h["sku"] for h in (ans.get("hits") or hits)]
            # Digital flask must not beat the tumbler in a colour-capped set.
            if "TM176" in skus and "FK-DG-SHN" in skus:
                self.assertLessEqual(skus.index("TM176"), skus.index("FK-DG-SHN"))

    def test_white_powerbank_drops_wireless_pad(self):
        """Photo 3 analogue: white brick vs power banks + charger pad."""
        for size in (80, 140):
            q = s.describe(size, size, brick(size, size, white=True))
            catalog = [
                row("PWB-2", "Power Bank 5000mAh Compact", "Tech", brick(size, size, white=False), size, size),
                row("CE-WC2", "Limestone Wireless Charger", "Tech", pad(size, size), size, size),
                row("P-1111", "Power Bank 10000mAh", "Tech", brick(size, size, white=True), size, size),
            ]
            embed = [
                {"sku": "PWB-2", "score": 0.67},
                {"sku": "CE-WC2", "score": 0.63},
                {"sku": "P-1111", "score": 0.62},
            ]
            hits = s.rerank(q, catalog, embed)
            charger = [h for h in hits if h["sku"] == "CE-WC2"]
            self.assertEqual(charger, [], "wireless pad must not appear on a brick query")
            ans = s.interpret(hits)
            self.assertFalse(s.is_lock(ans) and ans["hits"][0]["sku"] == "CE-WC2")
            live_skus = [h["sku"] for h in hits]
            self.assertIn("P-1111", live_skus)
            self.assertEqual(live_skus[0], "P-1111")

    def test_identical_flask_locks(self):
        rgb = flask(96, 96, digital=True)
        q = s.describe(96, 96, rgb)
        cat = [row("FLK", "Digital Thermal Flask", "Drinkware", rgb, 96, 96)]
        ans = s.interpret(s.rerank(q, cat))
        self.assertTrue(s.is_lock(ans), ans)
        self.assertEqual(ans["hits"][0]["sku"], "FLK")

    def test_embed_56_is_not_a_lock(self):
        hit = {"sku": "X", "name": "X", "score": 0.56, "familyAgree": True, "colorCap": False}
        ans = s.interpret([hit, {"sku": "Y", "score": 0.53, "familyAgree": True, "colorCap": False}])
        self.assertFalse(s.is_lock(ans))
        self.assertNotEqual(ans.get("kind"), "winner")

    def test_winner_threshold(self):
        ans = s.interpret(
            [
                {"sku": "A", "score": 0.95, "familyAgree": True, "colorCap": False},
                {"sku": "B", "score": 0.70, "familyAgree": True, "colorCap": False},
            ]
        )
        self.assertEqual(ans["kind"], "winner")
        self.assertTrue(s.is_lock(ans))


if __name__ == "__main__":
    unittest.main()
