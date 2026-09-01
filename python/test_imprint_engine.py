"""Dual-framing + classifier tests for the Python drop-in.

Run: python3 python/test_imprint_engine.py
"""

from __future__ import annotations

import math
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
        self.assertLessEqual(zb["w"], body["w"] * 0.75)

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


class PlacementRootTests(unittest.TestCase):
    def _paint(self, W, H, fill, fn):
        lum = [float(fill)] * (W * H)
        mask = [0] * (W * H)
        fn(lum, mask, W, H)
        return lum, mask

    def test_notebook_off_strap(self):
        W, H = 80, 100
        body = {"x": 0.15, "y": 0.08, "w": 0.7, "h": 0.84}

        def fn(L, M, w, h):
            for y in range(round(body["y"] * h), round((body["y"] + body["h"]) * h)):
                for x in range(round(body["x"] * w), round((body["x"] + body["w"]) * w)):
                    M[y * w + x] = 1
                    L[y * w + x] = 70
            for y in range(round((body["y"] + body["h"] * 0.48) * h), round((body["y"] + body["h"] * 0.56) * h)):
                for x in range(round(body["x"] * w), round((body["x"] + body["w"]) * w)):
                    L[y * w + x] = 30
            cx0 = round((body["x"] + body["w"] * 0.72) * w)
            cy0 = round((body["y"] + body["h"] * 0.44) * h)
            for y in range(cy0, cy0 + 10):
                for x in range(cx0, cx0 + 10):
                    L[y * w + x] = 200

        lum, mask = self._paint(W, H, 20, fn)
        rec = m.recommend_placement("notebook", rect(body["x"], body["y"], body["w"], body["h"]), w=W, h=H, lum=lum, mask=mask)
        self.assertNotEqual(rec["pick"], "class")
        zb = m.box_of(rec["winner"]["quad"])
        strap = {"x": body["x"], "y": body["y"] + body["h"] * 0.48, "w": body["w"], "h": body["h"] * 0.08}
        self.assertLess(m._overlap(zb, strap), 0.25)

    def test_hygiene_blocks_chrome(self):
        W = H = 80

        def fn(L, M, w, h):
            for y in range(18, 62):
                for x in range(22, 58):
                    M[y * w + x] = 1
                    L[y * w + x] = 70
            for y in range(0, 8):
                for x in range(4, 76):
                    L[y * w + x] = 20 if x % 3 == 0 else 240
            for y in range(70, 78):
                for x in range(8, 28):
                    L[y * w + x] = 15

        lum, mask = self._paint(W, H, 210, fn)
        hyg = m.canvas_hygiene(W, H, lum, mask)
        self.assertFalse(hyg["ok"])
        self.assertTrue(hyg["block"])


def rotated_rect(cx, cy, w, h, deg):
    rad = math.radians(deg)
    c, s = math.cos(rad), math.sin(rad)
    hw, hh = w / 2, h / 2
    corners = [(-hw, -hh), (hw, -hh), (hw, hh), (-hw, hh)]
    out = []
    for x, y in corners:
        out.append({"x": cx + x * c - y * s, "y": cy + x * s + y * c})
    return out


def fill_body(lum, mask, W, H, body, value=70):
    for y in range(round(body["y"] * H), min(H, round((body["y"] + body["h"]) * H))):
        for x in range(round(body["x"] * W), min(W, round((body["x"] + body["w"]) * W))):
            mask[y * W + x] = 1
            lum[y * W + x] = value


class CandidateScoreTests(unittest.TestCase):
    """Pick-sheet scoring. Hard geometry stays; quality is ranked.

    Measured before/after on the seven live routes (classified by
    category/name — SKU labels are comments only):
      CH-1011-B-G  drinkware bottle, 37° specular band
      NB38         stationery notebook, clasp
      NB50L        stationery notebook, left panel
      KC11         awards metal key tag
      CLR-CBL01    tech charging disc → cable hub
      P202         tech power bank placeholder
      (plus a 75° sliver that the old top-edge read as 18°)
    """

    def test_engine_has_no_sku_literals(self):
        src = (ROOT / "imprint_engine.py").read_text()
        for sku in (
            "TH164",
            "BP70",
            "NB146",
            "P202",
            "LR-CBL01",
            "CH-1011-B-G",
            "NB38",
            "NB50L",
            "KC11",
            "CLR-CBL01",
        ):
            self.assertNotIn(sku, src)
        self.assertNotIn("sku ==", src)

    def test_long_axis_not_top_edge(self):
        # Tall sliver: top edge is ~0°, long axis is ~90°.
        sliver = [
            {"x": 0.48, "y": 0.18},
            {"x": 0.51, "y": 0.18},
            {"x": 0.51, "y": 0.82},
            {"x": 0.48, "y": 0.82},
        ]
        top = abs(math.degrees(math.atan2(sliver[1]["y"] - sliver[0]["y"], sliver[1]["x"] - sliver[0]["x"])))
        self.assertLess(top, 8)
        ang = m.long_axis_angle(sliver)
        self.assertGreater(ang, 70)
        up = m.upright_quad(sliver)
        self.assertGreater(m.long_axis_angle(up), 70)

    def test_upright_cycles_long_axis_to_tl_tr(self):
        band = rotated_rect(0.5, 0.5, 0.30, 0.08, 75)
        self.assertGreater(m.long_axis_angle(band), 50)
        up = m.upright_quad(band)
        d01 = math.hypot(up[1]["x"] - up[0]["x"], up[1]["y"] - up[0]["y"])
        d12 = math.hypot(up[2]["x"] - up[1]["x"], up[2]["y"] - up[1]["y"])
        self.assertGreaterEqual(d01, d12 * 0.98)

    def test_sliver_rejected_both_framings(self):
        for body in (
            {"x": 0.44, "y": 0.18, "w": 0.12, "h": 0.62},
            {"x": 0.18, "y": 0.12, "w": 0.64, "h": 0.76},
        ):
            q = rotated_rect(body["x"] + body["w"] / 2, body["y"] + body["h"] / 2, body["w"] * 0.9, body["h"] * 0.04, 75)
            scored = m.score_candidate(q, "bottle", rect(body["x"], body["y"], body["w"], body["h"]))
            self.assertEqual(scored["veto"], "sliver")
            self.assertFalse(m._pickable(scored))

    def test_ch1011_37deg_band_offered_and_fitted(self):
        # CH-1011-B-G analogue — drinkware, 37° specular band.
        self.assertEqual(m.classify(category="Drinkware", name="Stainless print-band bottle"), "bottle")
        body = {"x": 0.38, "y": 0.12, "w": 0.24, "h": 0.76}
        band = rotated_rect(body["x"] + body["w"] / 2, body["y"] + body["h"] * 0.48, body["w"] * 0.72, body["h"] * 0.18, 37)
        self.assertLess(m.long_axis_angle(band), 50)
        W = H = 80
        lum = [40.0] * (W * H)
        mask = [0] * (W * H)
        fill_body(lum, mask, W, H, body, 60)
        maps = {
            "strap": None,
            "clasp": None,
            "ribs": None,
            "specular": [m.box_of(band)],
            "demo": None,
            "panel": None,
        }
        scored = m.score_candidate(
            band,
            "bottle",
            rect(body["x"], body["y"], body["w"], body["h"]),
            w=W,
            h=H,
            lum=lum,
            mask=mask,
            maps=maps,
        )
        # AFTER: glare waived — this box IS the specular route, not a stain.
        self.assertGreaterEqual(scored["metrics"]["glare"], 0.5)
        self.assertTrue(scored["metrics"]["specularRoute"])
        self.assertEqual(scored["metrics"]["glarePen"], 0)
        self.assertGreaterEqual(scored["score"], 90)
        self.assertTrue(scored["offered"], scored)
        self.assertTrue(scored["fitted"])
        self.assertTrue(m._pickable(scored))
        self.assertGreaterEqual(scored["score"], m.OFFER_FLOOR)
        sheet = m.face_candidates(
            "bottle",
            rect(body["x"], body["y"], body["w"], body["h"]),
            w=W,
            h=H,
            lum=lum,
            mask=mask,
            extras=[{"quad": band, "id": "band", "route": "specular"}],
        )
        extra = next(c for c in sheet["sheet"] if c["id"] == "band")
        self.assertTrue(extra["offered"] and extra["fitted"])
        self.assertTrue(extra["metrics"]["specularRoute"])
        self.assertFalse(sheet["autoLock"]["locked"], "band vs mid-body is not a blowout")

    def test_glare_stain_on_class_is_still_penalised(self):
        body = {"x": 0.38, "y": 0.12, "w": 0.24, "h": 0.76}
        stain = {"x": body["x"] + body["w"] * 0.7, "y": body["y"] + 0.08, "w": 0.05, "h": 0.18}
        q = rect(body["x"], body["y"], body["w"], body["h"])
        zone = m.zone_for_class(q, "bottle")
        scored = m.score_candidate(zone, "bottle", q, maps={"specular": [stain], "strap": None, "clasp": None, "ribs": None, "demo": None, "panel": None})
        self.assertFalse(scored["metrics"]["specularRoute"])
        if scored["metrics"]["glare"] > 0:
            self.assertGreater(scored["metrics"]["glarePen"], 0)

    def test_auto_lock_90_50(self):
        top = {"pickable": True, "score": 94, "id": "demo"}
        runner = {"pickable": True, "score": 41, "id": "class"}
        lock = m.auto_lock([top, runner])
        self.assertTrue(lock["locked"])
        close = m.auto_lock([{"pickable": True, "score": 92, "id": "band"}, {"pickable": True, "score": 81, "id": "class"}])
        self.assertFalse(close["locked"])
        miss = m.auto_lock([{"pickable": True, "score": 88, "id": "panel"}])
        self.assertFalse(miss["locked"])
        lonely = m.auto_lock([{"pickable": True, "score": 100, "id": "class"}])
        self.assertFalse(lonely["locked"])

    def test_nb38_clasp_scores_below_panel(self):
        # NB38 analogue — clasp is hardware; panel wins the sheet.
        self.assertEqual(m.classify(category="Stationery", name="PU rubber notebook clasp"), "notebook")
        W, H = 80, 100
        body = {"x": 0.15, "y": 0.08, "w": 0.7, "h": 0.84}
        lum = [20.0] * (W * H)
        mask = [0] * (W * H)
        fill_body(lum, mask, W, H, body, 78)
        for y in range(round((body["y"] + body["h"] * 0.48) * H), round((body["y"] + body["h"] * 0.56) * H)):
            for x in range(round(body["x"] * W), round((body["x"] + body["w"]) * W)):
                lum[y * W + x] = 28
        cx0 = round((body["x"] + body["w"] * 0.72) * W)
        cy0 = round((body["y"] + body["h"] * 0.44) * H)
        for y in range(cy0, cy0 + 10):
            for x in range(cx0, cx0 + 10):
                lum[y * W + x] = 200
        q = rect(body["x"], body["y"], body["w"], body["h"])
        sheet = m.face_candidates("notebook", q, w=W, h=H, lum=lum, mask=mask)
        clasp = {"x": body["x"] + body["w"] * 0.72, "y": body["y"] + body["h"] * 0.44, "w": 0.12, "h": 0.1}
        for c in sheet["sheet"]:
            if c["pickable"]:
                self.assertLess(m._overlap(m.box_of(c["fittedQuad"]), clasp), 0.35)
        rec = m.recommend_placement("notebook", q, w=W, h=H, lum=lum, mask=mask)
        zb = m.box_of(rec["winner"]["quad"])
        self.assertLess(m._overlap(zb, clasp), 0.25)

    def test_nb50l_panel_route(self):
        # NB50L analogue — left cover panel is the pick.
        self.assertEqual(m.classify(category="Stationery", name="Hardcover notebook left panel"), "notebook")
        W = H = 80
        body = {"x": 0.18, "y": 0.12, "w": 0.64, "h": 0.76}
        lum = [18.0] * (W * H)
        mask = [0] * (W * H)
        fill_body(lum, mask, W, H, body, 82)
        for y in range(22, 38):
            for x in range(18, 48):
                lum[y * W + x] = 84
        q = rect(body["x"], body["y"], body["w"], body["h"])
        rec = m.recommend_placement("notebook", q, w=W, h=H, lum=lum, mask=mask)
        self.assertIn(rec["pick"], ("panel", "demo"))
        sheet = m.face_candidates("notebook", q, w=W, h=H, lum=lum, mask=mask)
        live = [c for c in sheet["sheet"] if c["pickable"]]
        self.assertTrue(live)
        self.assertNotEqual(live[0]["id"], "class")

    def test_kc11_key_tag_face_offered(self):
        # KC11 analogue — compact metal face, class/panel stays offered.
        self.assertEqual(m.classify(category="Awards", name="Metal key tag"), "award")
        body = {"x": 0.32, "y": 0.28, "w": 0.36, "h": 0.42}
        q = rect(body["x"], body["y"], body["w"], body["h"])
        scored = m.score_candidate(m.zone_for_class(q, "award"), "award", q)
        self.assertTrue(m._pickable(scored))
        self.assertTrue(m.assert_zone("award", q))

    def test_cable_hub_route(self):
        # CLR-CBL01 analogue — charging disc, hub on the sheet.
        self.assertEqual(m.classify(category="Tech", name="Charging disc cable"), "cable")
        body = {"x": 0.32, "y": 0.30, "w": 0.36, "h": 0.36}
        q = rect(body["x"], body["y"], body["w"], body["h"])
        self.assertTrue(m.assert_zone("cable", q))
        disc = m.disc_quad(q)
        scored = m.score_candidate(disc, "cable", q)
        self.assertTrue(m._pickable(scored))
        sheet = m.face_candidates("cable", q)
        ids = [c["id"] for c in sheet["sheet"]]
        self.assertIn("hub", ids)
        hub = next(c for c in sheet["sheet"] if c["id"] == "hub")
        self.assertTrue(hub["pickable"])

    def test_tech_placeholder_route(self):
        # P202 analogue — bright face on a power bank.
        self.assertEqual(m.classify(category="Tech", name="Cork power bank"), "tech")
        W = H = 80
        lum = [20.0] * (W * H)
        mask = [0] * (W * H)
        fill_body(lum, mask, W, H, {"x": 0.22, "y": 0.28, "w": 0.56, "h": 0.40}, 70)
        for y in range(30, 46):
            for x in range(28, 54):
                lum[y * W + x] = 200
        q = rect(0.22, 0.28, 0.56, 0.40)
        ph = m.placeholder_rect(W, H, lum, mask)
        self.assertIsNotNone(ph)
        sheet = m.face_candidates("tech", q, w=W, h=H, lum=lum, mask=mask)
        live = [c for c in sheet["sheet"] if c["pickable"]]
        self.assertTrue(live)

    def test_chrome_penalised_not_hard_reject(self):
        W = H = 80
        body = {"x": 0.2, "y": 0.2, "w": 0.6, "h": 0.6}
        lum = [70.0] * (W * H)
        mask = [0] * (W * H)
        fill_body(lum, mask, W, H, body, 70)
        # 3 px white dimension line through the class box (≈ 1–5 px on this frame).
        for x in range(18, 62):
            lum[36 * W + x] = 240
            lum[37 * W + x] = 235
            lum[38 * W + x] = 242
        q = rect(body["x"], body["y"], body["w"], body["h"])
        zone = m.zone_for_class(q, "tech")
        scored = m.score_candidate(zone, "tech", q, w=W, h=H, lum=lum, mask=mask)
        self.assertGreater(scored["metrics"]["chrome"], 0.0)
        self.assertLess(scored["score"], 100)

    def test_score_holds_on_both_framings(self):
        catalog = {"x": 0.44, "y": 0.18, "w": 0.12, "h": 0.62}
        canvas = {"x": 0.16, "y": 0.10, "w": 0.68, "h": 0.80}

        def run(body, W, H):
            lum = [30.0] * (W * H)
            mask = [0] * (W * H)
            fill_body(lum, mask, W, H, body, 65)
            q = rect(body["x"], body["y"], body["w"], body["h"])
            band = rotated_rect(
                body["x"] + body["w"] / 2,
                body["y"] + body["h"] * 0.48,
                body["w"] * 0.70,
                body["h"] * 0.20,
                37,
            )
            maps = {
                "strap": None,
                "clasp": None,
                "ribs": None,
                "specular": [m.box_of(band)],
                "demo": None,
                "panel": None,
            }
            return m.score_candidate(band, "bottle", q, w=W, h=H, lum=lum, mask=mask, maps=maps)

        a = run(catalog, 80, 80)
        b = run(canvas, 80, 80)
        self.assertEqual(a["offered"], b["offered"])
        self.assertEqual(a["fitted"], b["fitted"])
        self.assertTrue(a["offered"] and a["fitted"])
        self.assertTrue(m.body_trusted(catalog["w"], "bottle"))
        self.assertTrue(m.body_trusted(canvas["w"], "bottle"))

    def test_api_points_are_dicts(self):
        q = rect(0.2, 0.2, 0.5, 0.5)
        scored = m.score_candidate(q, "bag", q)
        for p in scored["quad"]:
            self.assertIn("x", p)
            self.assertIn("y", p)
            self.assertNotIsInstance(p, list)

    def test_xy_internal_seam(self):
        # Accept [x,y] internally and {x,y} at the boundary.
        q = [[0.2, 0.2], [0.7, 0.2], [0.7, 0.7], [0.2, 0.7]]
        scored = m.score_candidate(q, "bag", q)
        self.assertTrue(isinstance(scored["quad"][0], dict))
        self.assertTrue(m._pickable(scored))



if __name__ == "__main__":
    unittest.main()
