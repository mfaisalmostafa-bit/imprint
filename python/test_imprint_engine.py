"""Dual-framing + classifier tests for the Python drop-in.

Run: python3 python/test_imprint_engine.py
"""

from __future__ import annotations

import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

import imprint_engine as m  # noqa: E402


def rect(x, y, w, h):
    return [
        {"x": x, "y": y},
        {"x": x + w, "y": y},
        {"x": x + w, "y": y + h},
        {"x": x, "y": y + h},
    ]


class ClassifyTests(unittest.TestCase):
    def test_by_category_and_family(self):
        self.assertEqual(m.classify(category="Writing", name="Metal twist pen"), "pen")
        self.assertEqual(m.classify(category="Drinkware", name="UrbanChill bottle"), "bottle")
        self.assertEqual(m.classify(category="Packaging", name="Laptop backpack"), "bag")
        self.assertEqual(m.classify(category="Stationery", name="PU rubber notebook"), "notebook")
        self.assertEqual(m.classify(category="Tech", name="Cork power bank"), "tech")
        self.assertEqual(m.classify(category="Tech", name="Disc cable"), "cable")
        self.assertEqual(m.classify(family="drinkware"), "bottle")
        self.assertEqual(m.classify(family={"family": "cables"}), "cable")

    def test_sku_literals_do_not_classify(self):
        self.assertEqual(m.classify(sku="TH164"), "default")
        self.assertEqual(m.classify({"sku": "BP70", "id": "bp70"}), "default")
        self.assertEqual(m.classify(sku="NB146", id="nb146"), "default")
        self.assertEqual(m.classify(sku="P202", id="p202"), "default")
        self.assertEqual(m.classify(sku="LR-CBL01", id="lr-cbl01"), "default")

    def test_source_has_no_sku_literals(self):
        src = (ROOT / "imprint_engine.py").read_text()
        for sku in ("TH164", "BP70", "NB146", "P202", "LR-CBL01"):
            self.assertNotIn(sku, src)
        self.assertNotIn("sku ==", src)
        self.assertNotIn("sku==", src)


class ZoneAndCropTests(unittest.TestCase):
    def test_notebook_band_and_crop(self):
        body = {"x": 0.18, "y": 0.12, "w": 0.64, "h": 0.76}
        crop = m.smart_canvas_crop(body, "notebook")
        self.assertTrue(m.notebook_crop_sane(crop, body))
        self.assertLess(m.class_scale("notebook")["canvasFill"], 0.72)
        zone = m.zone_for_class(rect(body["x"], body["y"], body["w"], body["h"]), "notebook")
        zb = m.box_of(zone)
        self.assertLess(zb["h"], body["h"] * 0.28)
        self.assertGreater(zb["y"], body["y"] + body["h"] * 0.4)

    def test_cable_disc_square(self):
        body = rect(0.2, 0.2, 0.6, 0.6)
        disc = m.disc_quad(body)
        bw = disc[1]["x"] - disc[0]["x"]
        bh = disc[2]["y"] - disc[1]["y"]
        self.assertLess(abs(bw - bh), 0.02)
        self.assertLess(bw, 0.55)
        self.assertTrue(m.assert_zone("cable", body))


class DualFramingTests(unittest.TestCase):
    CATALOG = {
        "pen": {"x": 0.12, "y": 0.40, "w": 0.76, "h": 0.18},
        "bottle": {"x": 0.44, "y": 0.18, "w": 0.12, "h": 0.62},
        "bag": {"x": 0.05, "y": 0.08, "w": 0.90, "h": 0.84},
        "notebook": {"x": 0.18, "y": 0.12, "w": 0.64, "h": 0.76},
        "tech": {"x": 0.26, "y": 0.28, "w": 0.48, "h": 0.36},
        "cable": {"x": 0.32, "y": 0.30, "w": 0.36, "h": 0.36},
    }

    def test_thresholds_hold_on_both_framings(self):
        for cls, body in self.CATALOG.items():
            spec = m.class_scale(cls)
            self.assertTrue(
                m.body_trusted(body["w"], cls),
                f"{cls} catalog body {body['w']} untrusted",
            )
            q = rect(body["x"], body["y"], body["w"], body["h"])
            self.assertTrue(m.assert_zone(cls, q), f"{cls} catalog zone")
            crop = m.smart_canvas_crop(body, cls)
            canvas = m.body_on_canvas(body, crop)
            self.assertTrue(
                m.body_trusted(canvas["w"], cls),
                f"{cls} canvas body {canvas['w']} untrusted",
            )
            cq = rect(canvas["x"], canvas["y"], canvas["w"], canvas["h"])
            self.assertTrue(m.assert_zone(cls, cq), f"{cls} canvas zone")
            if cls == "notebook":
                self.assertTrue(m.notebook_crop_sane(crop, body))
                self.assertGreaterEqual(canvas["h"], 0.55)
            zone = m.zone_for_class(q, cls)
            zw = zone[1]["x"] - zone[0]["x"]
            catalog_fit = m.fit_mark_scale(body["w"], zw, spec["maxScale"], spec["minScale"], cls)
            canvas_zone = m.zone_for_class(cq, cls)
            czw = canvas_zone[1]["x"] - canvas_zone[0]["x"]
            canvas_fit = m.fit_mark_scale(canvas["w"], czw, spec["maxScale"], spec["minScale"], cls)
            self.assertTrue(catalog_fit["trusted"], f"{cls} catalog fit")
            self.assertTrue(canvas_fit["trusted"], f"{cls} canvas fit")
            c_ratio = m.mark_body_ratio(catalog_fit["scale"], zw, body["w"])
            v_ratio = m.mark_body_ratio(canvas_fit["scale"], czw, canvas["w"])
            self.assertLessEqual(c_ratio, spec["markOfBody"] + 0.08, f"{cls} catalog {c_ratio}")
            self.assertLessEqual(v_ratio, spec["markOfBody"] + 0.08, f"{cls} canvas {v_ratio}")
            if cls == "bag":
                self.assertLess(c_ratio, 0.55)
                self.assertLess(v_ratio, 0.55)

    def test_placeholder_both_framings(self):
        def paint(W, H, bx, by, bw, bh, px, py, pw, ph):
            lum = [20.0] * (W * H)
            mask = [0] * (W * H)
            for y in range(by, by + bh):
                for x in range(bx, bx + bw):
                    mask[y * W + x] = 1
                    lum[y * W + x] = 70.0
            for y in range(py, py + ph):
                for x in range(px, px + pw):
                    lum[y * W + x] = 200.0
            return m.placeholder_rect(W, H, lum, mask)

        catalog = paint(200, 200, 70, 70, 60, 50, 78, 82, 44, 22)
        canvas = paint(200, 200, 20, 40, 160, 120, 50, 70, 100, 50)
        self.assertIsNotNone(catalog)
        self.assertIsNotNone(canvas)


if __name__ == "__main__":
    unittest.main()
