"""Control tests for the product-frame cropper. Each rule fires and does not fire.

No product codes. Dual framing: 80px phone snap and 140px catalogue thumb.
"""

from __future__ import annotations

import unittest

import crop as c
import imprint_engine as eng


def rgb_canvas(w: int, h: int, bg: tuple[int, int, int]) -> list[int]:
    out: list[int] = []
    for _ in range(w * h):
        out.extend(bg)
    return out


def paint(
    rgb: list[int],
    w: int,
    x0: int,
    y0: int,
    x1: int,
    y1: int,
    col: tuple[int, int, int],
) -> None:
    for y in range(max(0, y0), y1):
        for x in range(max(0, x0), x1):
            i = (y * w + x) * 3
            rgb[i] = col[0]
            rgb[i + 1] = col[1]
            rgb[i + 2] = col[2]


def contains(crop: dict[str, float], body: dict[str, float], frac: float = 0.85) -> bool:
    x = max(0.0, min(crop["x"] + crop["w"], body["x"] + body["w"]) - max(crop["x"], body["x"]))
    y = max(0.0, min(crop["y"] + crop["h"], body["y"] + body["h"]) - max(crop["y"], body["y"]))
    return (x * y) / max(1e-6, body["w"] * body["h"]) >= frac


def identity(crop: dict[str, float]) -> bool:
    return crop["x"] <= 0.02 and crop["y"] <= 0.02 and crop["w"] >= 0.96 and crop["h"] >= 0.96


def tumbler(w: int, h: int, *, table: bool = True, packed: bool = False) -> list[int]:
    bg = (120, 78, 36) if table else (245, 245, 245)
    rgb = rgb_canvas(w, h, bg)
    col = (228, 216, 198)
    if packed:
        x0, y0 = int(w * 0.42), int(h * 0.28)
        x1, y1 = int(w * 0.58), int(h * 0.78)
    else:
        x0, y0 = int(w * 0.34), int(h * 0.16)
        x1, y1 = int(w * 0.66), int(h * 0.86)
    paint(rgb, w, x0, y0, x1, y1, col)
    paint(rgb, w, x0, y0, x1, y0 + max(2, int(h * 0.07)), (200, 120, 40))
    return rgb


def bag_fill(w: int, h: int) -> list[int]:
    rgb = rgb_canvas(w, h, (236, 236, 234))
    paint(rgb, w, int(w * 0.06), int(h * 0.06), int(w * 0.94), int(h * 0.94), (18, 18, 20))
    return rgb


def notebook(w: int, h: int, *, clasp: bool = False) -> list[int]:
    rgb = rgb_canvas(w, h, (232, 232, 230))
    paint(rgb, w, int(w * 0.18), int(h * 0.12), int(w * 0.82), int(h * 0.88), (36, 48, 42))
    if clasp:
        paint(
            rgb,
            w,
            int(w * 0.42),
            int(h * 0.78),
            int(w * 0.58),
            int(h * 0.90),
            (210, 210, 200),
        )
    return rgb


def chrome_plate(w: int, h: int) -> list[int]:
    """Even grey, product mid-frame, high-frequency title bar in the top 12%."""
    rgb = rgb_canvas(w, h, (240, 240, 238))
    paint(rgb, w, int(w * 0.28), int(h * 0.22), int(w * 0.72), int(h * 0.86), (22, 22, 24))
    for x in range(0, w, 2):
        paint(rgb, w, x, 0, x + 1, max(4, int(h * 0.12)), (20, 20, 20) if x % 4 == 0 else (250, 250, 250))
    return rgb


def spec_strip(w: int, h: int) -> list[int]:
    rgb = rgb_canvas(w, h, (245, 245, 245))
    paint(rgb, w, int(w * 0.28), int(h * 0.10), int(w * 0.72), int(h * 0.72), (24, 24, 26))
    paint(rgb, w, 0, int(h * 0.82), w, h, (8, 8, 8))
    return rgb


def two_products(w: int, h: int) -> list[int]:
    rgb = rgb_canvas(w, h, (120, 78, 36))
    paint(rgb, w, int(w * 0.08), int(h * 0.22), int(w * 0.42), int(h * 0.78), (228, 216, 198))
    paint(rgb, w, int(w * 0.56), int(h * 0.22), int(w * 0.90), int(h * 0.78), (18, 18, 20))
    return rgb


def cluttered(w: int, h: int) -> list[int]:
    """One product-sized body, one tiny blob of clutter."""
    rgb = rgb_canvas(w, h, (120, 78, 36))
    paint(rgb, w, int(w * 0.30), int(h * 0.20), int(w * 0.70), int(h * 0.80), (236, 236, 234))
    paint(rgb, w, int(w * 0.04), int(h * 0.04), int(w * 0.10), int(h * 0.10), (40, 40, 40))
    return rgb


class VocabularyTests(unittest.TestCase):
    def test_unknown_class_raises(self):
        rgb = rgb_canvas(80, 80, (240, 240, 240))
        with self.assertRaises(c.CropError):
            c.crop_frame(80, 80, rgb, cls="plate")

    def test_default_class_is_in_vocabulary(self):
        rgb = bag_fill(80, 80)
        r = c.crop_frame(80, 80, rgb, cls="default")
        self.assertIn(r["kind"], c.KINDS)

    def test_unmapped_kind_on_is_ready_raises(self):
        with self.assertRaises(c.CropError):
            c.is_ready({"kind": "maybe"})


class StudioIdentityTests(unittest.TestCase):
    def test_bag_that_fills_the_frame_is_identity(self):
        """FIRING: a studio bag is not cropped in."""
        for size in (80, 140):
            rgb = bag_fill(size, size)
            r = c.crop_frame(size, size, rgb, cls="bag")
            self.assertEqual(r["kind"], "studio", r)
            self.assertTrue(identity(r["crop"]))
            self.assertTrue(c.is_ready(r))

    def test_studio_does_not_refuse(self):
        """NOT FIRING: a clean plate is not a refuse."""
        rgb = bag_fill(80, 80)
        r = c.crop_frame(80, 80, rgb, cls="bag")
        self.assertNotEqual(r["kind"], "refuse")


class PackedIsolationTests(unittest.TestCase):
    def test_packed_tumbler_on_wood_crops_to_the_body(self):
        """FIRING: body ~0.12–0.30 of frame becomes the crop, table does not."""
        for size in (80, 140):
            rgb = tumbler(size, size, table=True, packed=True)
            r = c.crop_frame(size, size, rgb, cls="bottle")
            self.assertEqual(r["kind"], "packed", r)
            self.assertTrue(c.is_ready(r))
            self.assertIsNotNone(r["body"])
            self.assertTrue(contains(r["crop"], r["body"]))
            self.assertLess(r["crop"]["w"] * r["crop"]["h"], 0.85)
            self.assertGreater(r["body"]["w"], 0.10)
            self.assertLess(r["body"]["w"], 0.40)

    def test_packed_is_not_identity(self):
        """NOT FIRING: a packed shot does not ship the whole table."""
        rgb = tumbler(80, 80, table=True, packed=True)
        r = c.crop_frame(80, 80, rgb, cls="bottle")
        self.assertFalse(identity(r["crop"]))

    def test_grey_studio_tumbler_is_isolated_not_the_table(self):
        rgb = tumbler(80, 80, table=False, packed=False)
        r = c.crop_frame(80, 80, rgb, cls="bottle")
        self.assertIn(r["kind"], ("isolated", "packed", "studio"))
        self.assertTrue(contains(r["crop"], r["body"]))


class ClusterTests(unittest.TestCase):
    def test_two_product_sized_blobs_refuse(self):
        """FIRING: tumbler + bag on one desk is a cluster, not a pick."""
        for size in (80, 140):
            rgb = two_products(size, size)
            r = c.crop_frame(size, size, rgb, cls="bottle")
            self.assertEqual(r["kind"], "refuse", r)
            self.assertFalse(c.is_ready(r))
            self.assertIn("cluster", r["reason"])

    def test_tiny_clutter_is_not_a_cluster(self):
        """NOT FIRING: a 3% floor miss is clutter, the product still crops."""
        rgb = cluttered(80, 80)
        r = c.crop_frame(80, 80, rgb, cls="tech")
        self.assertNotEqual(r["kind"], "refuse", r)
        self.assertTrue(c.is_ready(r))
        self.assertTrue(contains(r["crop"], r["body"]))


class ChromeStripTests(unittest.TestCase):
    def test_title_bar_is_stripped(self):
        """FIRING: chrome at the top is not in the crop."""
        rgb = chrome_plate(140, 140)
        r = c.crop_frame(140, 140, rgb, cls="tech")
        self.assertEqual(r["kind"], "stripped", r)
        self.assertGreaterEqual(r["crop"]["y"], 0.02)
        self.assertTrue(contains(r["crop"], r["body"]))
        self.assertLess(r["crop"]["y"] + r["crop"]["h"], 1.01)

    def test_spec_strip_is_stripped(self):
        """FIRING: a black spec band at the bottom falls outside the crop."""
        rgb = spec_strip(140, 140)
        r = c.crop_frame(140, 140, rgb, cls="bottle")
        self.assertIn(r["kind"], ("stripped", "packed", "isolated"), r)
        self.assertTrue(c.is_ready(r))
        self.assertLess(r["crop"]["y"] + r["crop"]["h"], 0.90)
        self.assertTrue(contains(r["crop"], r["body"]))

    def test_clean_plate_is_not_stripped(self):
        """NOT FIRING: no chrome, no strip, no stripped kind."""
        rgb = bag_fill(80, 80)
        r = c.crop_frame(80, 80, rgb, cls="bag")
        self.assertNotEqual(r["kind"], "stripped")


class NotebookCoverTests(unittest.TestCase):
    def test_notebook_keeps_the_cover(self):
        """FIRING: crop keeps ≥0.85 of the cover, even with a clasp highlight."""
        rgb = notebook(140, 140, clasp=True)
        r = c.crop_frame(140, 140, rgb, cls="notebook")
        self.assertTrue(c.is_ready(r), r)
        self.assertTrue(eng.notebook_crop_sane(r["crop"], r["body"]))
        self.assertTrue(contains(r["crop"], r["body"], 0.85))

    def test_notebook_is_not_a_clasp_only_clip(self):
        """NOT FIRING: clasp highlight does not become the body."""
        rgb = notebook(140, 140, clasp=True)
        r = c.crop_frame(140, 140, rgb, cls="notebook")
        self.assertGreater(r["body"]["h"], 0.50)
        self.assertGreater(r["body"]["w"], 0.40)


class RefuseTests(unittest.TestCase):
    def test_empty_frame_refuses(self):
        rgb = rgb_canvas(80, 80, (240, 240, 238))
        r = c.crop_frame(80, 80, rgb, cls="default")
        self.assertEqual(r["kind"], "refuse")
        self.assertFalse(c.is_ready(r))

    def test_tiny_frame_raises(self):
        rgb = rgb_canvas(4, 4, (0, 0, 0))
        with self.assertRaises(c.CropError):
            c.crop_frame(4, 4, rgb)


class PixelBoxTests(unittest.TestCase):
    def test_pixel_box_round_trips_a_ready_crop(self):
        rgb = tumbler(80, 80, table=True, packed=True)
        r = c.crop_frame(80, 80, rgb, cls="bottle")
        box = c.pixel_box(r["crop"], 80, 80)
        self.assertGreater(box["x1"] - box["x0"], 8)
        self.assertGreater(box["y1"] - box["y0"], 8)

    def test_pixel_box_raises_outside_the_frame(self):
        with self.assertRaises(c.CropError):
            c.pixel_box({"x": -0.2, "y": 0, "w": 0.5, "h": 0.5}, 80, 80)


class DualFramingTests(unittest.TestCase):
    def test_kind_agrees_on_80_and_140(self):
        for builder, cls, expect in (
            (lambda s: bag_fill(s, s), "bag", "studio"),
            (lambda s: tumbler(s, s, packed=True), "bottle", "packed"),
            (lambda s: two_products(s, s), "bottle", "refuse"),
        ):
            a = c.crop_frame(80, 80, builder(80), cls=cls)
            b = c.crop_frame(140, 140, builder(140), cls=cls)
            self.assertEqual(a["kind"], expect, (cls, a))
            self.assertEqual(b["kind"], expect, (cls, b))


if __name__ == "__main__":
    unittest.main()
