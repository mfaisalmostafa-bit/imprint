"""Control tests for two-mode zones. Each rule fires and does not fire.

No product codes. No client pages. Aggregate shapes only: bottles split
on rotation, notebooks on position, pens always along the barrel, awards
never rotate.
"""

from __future__ import annotations

import math
import pathlib
import unittest

import arbitrate as arb
import zone_modes as z


BODY = [
    {"x": 0.20, "y": 0.10},
    {"x": 0.80, "y": 0.10},
    {"x": 0.80, "y": 0.90},
    {"x": 0.20, "y": 0.90},
]


def at(cx, cy, w=0.30, h=0.16, rot=0.0):
    """w >= h so top-edge angle == long-axis angle."""
    return arb.quad_from_relative({"cx": cx, "cy": cy, "w": w, "h": h, "rot": rot}, BODY)


def bottle_zone():
    """Rotation split, position agrees. 17 along the wall, 9 upright."""
    return {
        "modes": [
            {
                "cx_rel": 0.53, "cy_rel": 0.60, "w_of_product_w": 0.29, "h": 0.16,
                "rotation": 0, "n": 9, "n_eff": 8, "iqr": (0.56, 0.64),
            },
            {
                "cx_rel": 0.53, "cy_rel": 0.60, "w_of_product_w": 0.29, "h": 0.16,
                "rotation": 90, "n": 17, "n_eff": 14, "iqr": (0.56, 0.64),
            },
        ]
    }


def notebook_zone():
    """Position split, rotation agrees. Mid-cover vs bottom."""
    return {
        "modes": [
            {
                "cx_rel": 0.50, "cy_rel": 0.49, "w_of_product_w": 0.24, "h": 0.16,
                "rotation": 0, "n": 28, "n_eff": 22, "iqr": (0.40, 0.55),
            },
            {
                "cx_rel": 0.28, "cy_rel": 0.87, "w_of_product_w": 0.24, "h": 0.16,
                "rotation": 0, "n": 41, "n_eff": 30, "iqr": (0.78, 0.94),
            },
        ]
    }


def award_zone():
    """Old single-value zone. Must keep working untouched."""
    return {
        "cx_rel": 0.53,
        "cy_rel": 0.53,
        "w_of_product_w": 0.25,
        "rotation": 0,
        "n": 38,
        "n_eff": 12,
        "iqr": (0.52, 0.58),
    }


def sliver_75_over_18():
    """Long axis 75°, top edge 18°. The defect that used the top edge."""
    short, long = 0.04, 0.28
    top, axis = math.radians(18), math.radians(75)
    tl = [0.45, 0.35]
    tr = [tl[0] + short * math.cos(top), tl[1] + short * math.sin(top)]
    bl = [tl[0] + long * math.cos(axis), tl[1] + long * math.sin(axis)]
    br = [tr[0] + long * math.cos(axis), tr[1] + long * math.sin(axis)]
    return [
        {"x": tl[0], "y": tl[1]},
        {"x": tr[0], "y": tr[1]},
        {"x": br[0], "y": br[1]},
        {"x": bl[0], "y": bl[1]},
    ]


class RepresentationTests(unittest.TestCase):
    def test_old_zone_is_one_mode(self):
        """FIRING: a single-value zone degrades to one mode, rotation 0."""
        modes = z.as_modes(award_zone())
        self.assertEqual(len(modes), 1)
        self.assertAlmostEqual(modes[0]["rotation"], 0.0)
        self.assertAlmostEqual(modes[0]["cx_rel"], 0.53)

    def test_third_mode_raises(self):
        """NOT FIRING a silent drop of the extra mode."""
        zone = {"modes": [
            {"cx_rel": 0.5, "cy_rel": 0.4, "w_of_product_w": 0.2, "rotation": 0, "n": 8, "n_eff": 8},
            {"cx_rel": 0.5, "cy_rel": 0.6, "w_of_product_w": 0.2, "rotation": 0, "n": 8, "n_eff": 8},
            {"cx_rel": 0.5, "cy_rel": 0.8, "w_of_product_w": 0.2, "rotation": 0, "n": 8, "n_eff": 8},
        ]}
        with self.assertRaises(ValueError):
            z.as_modes(zone)

    def test_top_edge_ref_raises(self):
        with self.assertRaises(ValueError):
            z.as_mode({
                "cx_rel": 0.5, "cy_rel": 0.5, "w_of_product_w": 0.2,
                "rotation": 18, "rotation_ref": "top_edge",
            })


class SplitTests(unittest.TestCase):
    def test_bottles_are_a_rotation_split(self):
        a, b = z.as_modes(bottle_zone())
        self.assertEqual(z.split_of(a, b), "rotation")

    def test_notebooks_are_a_position_split(self):
        a, b = z.as_modes(notebook_zone())
        self.assertEqual(z.split_of(a, b), "position")

    def test_two_copies_are_the_same(self):
        """NOT FIRING a split when both modes agree."""
        a = z.as_mode({"cx_rel": 0.5, "cy_rel": 0.5, "w_of_product_w": 0.2, "rotation": 0, "n": 10, "n_eff": 10})
        b = z.as_mode({"cx_rel": 0.5, "cy_rel": 0.5, "w_of_product_w": 0.2, "rotation": 0, "n": 10, "n_eff": 10})
        self.assertEqual(z.split_of(a, b), "same")


class AngleConventionTests(unittest.TestCase):
    def test_sliver_uses_long_axis_not_top_edge(self):
        """FIRING: 75° sliver is 75°, not 18°."""
        q = sliver_75_over_18()
        self.assertAlmostEqual(z.long_axis_deg(q), 75.0, delta=3)
        self.assertAlmostEqual(arb.top_edge_deg(q), 18.0, delta=3)
        self.assertGreater(z.ang_dist(z.long_axis_deg(q), 18), 40)

    def test_upright_box_is_near_zero(self):
        """NOT FIRING a phantom rotation on an AABB."""
        q = at(0.5, 0.5, rot=0)
        self.assertLess(abs(z.long_axis_deg(q)), 2)

    def test_zero_and_180_are_the_same_baseline(self):
        self.assertAlmostEqual(z.ang_dist(0, 180), 0.0, delta=1e-6)
        self.assertAlmostEqual(z.ang_dist(0, 90), 90.0, delta=1e-6)


class SelectionTests(unittest.TestCase):
    def test_seen_face_on_bottle_is_not_snapped(self):
        """FIRING: 80° face on a 0/90 class keeps 80°, identity is the 90 mode."""
        det = {"quad": at(0.53, 0.60, rot=80), "score": 100, "route": "panel"}
        out = z.select_mode(det, bottle_zone(), BODY, 0.8)
        self.assertFalse(out["snapped"])
        self.assertAlmostEqual(z.long_axis_deg(out["quad"]), 80.0, delta=3)
        self.assertAlmostEqual(out["mode"]["rotation"], 90.0, delta=1)

    def test_seen_face_is_not_rotated_to_zero_either(self):
        """NOT FIRING snap-to-nearer when nearer is 0: a 37° band stays 37°."""
        det = {"quad": at(0.53, 0.60, rot=37), "score": 100, "route": "specular"}
        out = z.select_mode(det, bottle_zone(), BODY, 0.8)
        self.assertFalse(out["snapped"])
        self.assertAlmostEqual(z.long_axis_deg(out["quad"]), 37.0, delta=3)
        self.assertNotAlmostEqual(z.long_axis_deg(out["quad"]), 0.0, delta=5)

    def test_between_angles_does_not_invent_the_mean(self):
        """FIRING: 45° on 0/90, seen face kept. NOT 45 as a class pose."""
        det = {"quad": at(0.53, 0.60, rot=45), "score": 100, "route": "panel"}
        out = z.select_mode(det, bottle_zone(), BODY, 0.8)
        self.assertTrue(out["between"])
        self.assertAlmostEqual(z.long_axis_deg(out["quad"]), 45.0, delta=3)
        self.assertIsNone(out["mode"])

    def test_weak_bimodal_offers_both(self):
        """FIRING: recipe + bimodal class → both modes, not the heavier."""
        det = {"quad": at(0.53, 0.60, rot=80), "score": 100, "route": "recipe"}
        out = z.select_mode(det, bottle_zone(), BODY, 0.8)
        self.assertIsNone(out["quad"])
        self.assertEqual(len(out["offers"]), 2)
        rots = sorted(float(o["rotation"]) for o in out["offers"])
        self.assertEqual(rots, [0.0, 90.0])

    def test_weak_bimodal_does_not_silently_pick_heavier(self):
        """NOT FIRING heavier-as-default: 17 vs 9 does not become 90°."""
        out = z.select_mode(None, bottle_zone(), BODY, 0.8)
        self.assertIsNone(out["mode"])
        self.assertIsNone(out["quad"])

    def test_must_choose_is_named(self):
        out = z.select_mode(None, bottle_zone(), BODY, 0.8, must_choose=True)
        self.assertIn("must_choose", out["reason"])
        self.assertAlmostEqual(out["mode"]["rotation"], 90.0, delta=1)

    def test_notebook_seen_face_picks_position_not_the_other(self):
        """FIRING: face at the bottom mode is the bottom mode."""
        det = {"quad": at(0.28, 0.87), "score": 100, "route": "insert"}
        out = z.select_mode(det, notebook_zone(), BODY, 0.8)
        self.assertAlmostEqual(out["mode"]["cy_rel"], 0.87, delta=0.02)
        self.assertFalse(out["snapped"])

    def test_notebook_seen_face_does_not_pick_the_other(self):
        """NOT FIRING: face at mid-cover is not the bottom mode."""
        det = {"quad": at(0.50, 0.49), "score": 100, "route": "insert"}
        out = z.select_mode(det, notebook_zone(), BODY, 0.8)
        self.assertAlmostEqual(out["mode"]["cy_rel"], 0.49, delta=0.02)

    def test_notebook_valley_does_not_average(self):
        """FIRING: cy 0.66 is in neither IQR — plate kept, not 0.68."""
        det = {"quad": at(0.45, 0.66), "score": 100, "route": "panel"}
        out = z.select_mode(det, notebook_zone(), BODY, 0.8)
        self.assertTrue(out["between"])
        rel = arb.relative_of(out["quad"], BODY)
        self.assertAlmostEqual(rel["cy"], 0.66, delta=0.03)

    def test_one_trusted_mode_wins(self):
        """FIRING: n_eff 3 sibling is ignored."""
        zone = {
            "modes": [
                {"cx_rel": 0.5, "cy_rel": 0.5, "w_of_product_w": 0.2, "rotation": 0, "n": 19, "n_eff": 12},
                {"cx_rel": 0.5, "cy_rel": 0.8, "w_of_product_w": 0.2, "rotation": 0, "n": 3, "n_eff": 3, "iqr": (0.75, 0.85)},
            ]
        }
        out = z.select_mode(None, zone, BODY, 0.8)
        self.assertAlmostEqual(out["mode"]["cy_rel"], 0.5, delta=0.02)

    def test_untrusted_pair_does_not_invent_a_zone(self):
        """NOT FIRING a prior from two n=3 modes."""
        zone = {
            "modes": [
                {"cx_rel": 0.5, "cy_rel": 0.4, "w_of_product_w": 0.2, "rotation": 0, "n": 3, "n_eff": 3},
                {"cx_rel": 0.5, "cy_rel": 0.7, "w_of_product_w": 0.2, "rotation": 0, "n": 3, "n_eff": 3},
            ]
        }
        out = z.select_mode(None, zone, BODY, 0.8)
        self.assertIsNone(out["mode"])
        self.assertIsNone(out["quad"])

    def test_unimodal_old_zone_still_renders(self):
        out = z.select_mode(None, award_zone(), BODY, 0.8)
        self.assertEqual(out["split"], "unimodal")
        self.assertIsNotNone(out["quad"])
        self.assertAlmostEqual(out["mode"]["rotation"], 0.0)

    def test_sliver_selects_by_long_axis(self):
        """A 75° sliver on a 0/90 class is the 90 mode, not the 18°-nearer-0 trap."""
        det = {"quad": sliver_75_over_18(), "score": 100, "route": "panel"}
        out = z.select_mode(det, bottle_zone(), BODY, 0.8)
        self.assertAlmostEqual(out["mode"]["rotation"], 90.0, delta=1)
        self.assertAlmostEqual(z.long_axis_deg(out["quad"]), 75.0, delta=3)

    def test_unknown_route_raises(self):
        det = {"quad": at(0.5, 0.5), "score": 100, "route": "demo"}
        with self.assertRaises(ValueError):
            z.select_mode(det, award_zone(), BODY, 0.8)


class SizeTests(unittest.TestCase):
    def test_rotated_mark_x_clamp_is_not_the_barrel(self):
        """FIRING: a 90° mark reports X-clamp and along-baseline as different numbers."""
        # Tall thin mark: across is X (small), along is Y (large).
        q = arb.quad_from_relative({"cx": 0.50, "cy": 0.50, "w": 0.10, "h": 0.50, "rot": 0}, BODY)
        # AABB: long axis is Y ≈ 90°.
        size = z.read_size(q, BODY)
        self.assertEqual(size["size_axis"], "y")
        self.assertAlmostEqual(size["w_of_product_w"], 0.10, places=5)
        self.assertAlmostEqual(size["mark_extent_along_baseline"], 0.50, places=5)
        self.assertGreater(size["mark_extent_along_baseline"], size["w_of_product_w"])

    def test_upright_mark_uses_x_for_both(self):
        """NOT FIRING a swap on an upright mark."""
        q = at(0.50, 0.50, w=0.30, h=0.16, rot=0)
        size = z.read_size(q, BODY)
        self.assertEqual(size["size_axis"], "x")
        self.assertAlmostEqual(size["w_of_product_w"], size["mark_extent_along_baseline"], places=5)

    def test_cap_rejects_ambiguous_max_scale(self):
        size = z.read_size(at(0.5, 0.5), BODY)
        with self.assertRaises(KeyError):
            z.within_cap(size, {"max_scale": 0.5})

    def test_cap_checks_the_named_axis(self):
        q = arb.quad_from_relative({"cx": 0.50, "cy": 0.50, "w": 0.10, "h": 0.50, "rot": 0}, BODY)
        size = z.read_size(q, BODY)
        # Overflow-on-X is small; along-baseline is large.
        self.assertTrue(z.within_cap(size, {"max_w_of_product_w": 0.30}))
        self.assertFalse(z.within_cap(size, {"max_mark_extent_along_baseline": 0.20}))
        self.assertTrue(z.within_cap(size, {"max_mark_extent_along_baseline": 0.90}))


class HygieneTests(unittest.TestCase):
    def test_vocabularies_match_arbitrate(self):
        self.assertEqual(z.ENGINE_ROUTES, arb.ENGINE_ROUTES)
        self.assertEqual(z.SEEN_ROUTES, arb.SEEN_ROUTES)
        self.assertEqual(z.NOT_SEEN, arb.NOT_SEEN)

    def test_no_sku_literals(self):
        src = pathlib.Path(__file__).with_name("zone_modes.py").read_text()
        self.assertNotRegex(src, r"sku\s*===")
        for token in ("TH164", "NB146", "CH-1011", "NB38", "KC11"):
            self.assertNotIn(token, src)

    def test_banned_method_words_absent(self):
        src = pathlib.Path(__file__).with_name("zone_modes.py").read_text()
        for word in ("deboss", "emboss", "pad print", "screen print"):
            self.assertNotIn(word, src.lower())

    def test_no_id_fallback(self):
        src = pathlib.Path(__file__).with_name("zone_modes.py").read_text()
        self.assertNotIn("id(event)", src)


if __name__ == "__main__":
    unittest.main()
