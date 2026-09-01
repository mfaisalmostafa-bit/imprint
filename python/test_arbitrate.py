"""Control tests for prior ⇄ detector arbitration and pick-layer updates.

Each load-bearing rule is shown firing AND not firing. A check that cannot
fail is how work has had to be redone here.

No SKU literals. No client pages — numbers come from the published aggregates.
"""

from __future__ import annotations

import pathlib
import unittest

import arbitrate as a


BODY = [
    {"x": 0.20, "y": 0.10},
    {"x": 0.80, "y": 0.10},
    {"x": 0.80, "y": 0.90},
    {"x": 0.20, "y": 0.90},
]


def at(cx: float, cy: float, w: float = 0.24, h: float = 0.16):
    return a.quad_from_relative({"cx": cx, "cy": cy, "w": w, "h": h}, BODY)


def notebook_prior(n_eff: float = 22.0):
    """Published split: 15 mid-cover, 19 low. Do not average them."""
    return {
        "class": "notebook",
        "n": 38,
        "n_eff": n_eff,
        "cx": {"median": 0.45, "iqr": (0.28, 0.53)},
        "cy": {"median": 0.66, "iqr": (0.49, 0.87)},
        "w": {"median": 0.24, "iqr": (0.20, 0.37)},
        "modes": [
            {"cx": 0.50, "cy": 0.50, "w": 0.24, "h": 0.16, "n": 15, "iqr": (0.45, 0.55)},
            {"cx": 0.28, "cy": 0.90, "w": 0.24, "h": 0.16, "n": 19, "iqr": (0.85, 0.94)},
        ],
    }


def tight_unimodal(n: float = 19, n_eff: float = 19, cy: float = 0.60):
    return {
        "class": "drinkware",
        "n": n,
        "n_eff": n_eff,
        "cx": {"median": 0.53, "iqr": (0.51, 0.56)},
        "cy": {"median": cy, "iqr": (cy - 0.04, cy + 0.04)},
        "w": {"median": 0.29, "iqr": (0.23, 0.35)},
        "modes": [{"cx": 0.53, "cy": cy, "w": 0.29, "h": 0.20, "n": n, "iqr": (cy - 0.04, cy + 0.04)}],
    }


def award_concentrated():
    """The row-median trap: n=38, n_eff=3.3 — not proposable."""
    return {
        "class": "award",
        "n": 38,
        "n_eff": 3.3,
        "cx": {"median": 0.53, "iqr": (0.51, 0.54)},
        "cy": {"median": 0.53, "iqr": (0.52, 0.58)},
        "w": {"median": 0.25, "iqr": (0.22, 0.26)},
        "modes": [{"cx": 0.53, "cy": 0.53, "w": 0.25, "h": 0.25, "n": 38, "iqr": (0.52, 0.58)}],
    }


class SeamTests(unittest.TestCase):
    def test_api_returns_xy_dicts(self):
        q = at(0.5, 0.5)
        self.assertIsInstance(q[0], dict)
        self.assertIn("x", q[0])
        self.assertNotIsInstance(q[0], list)
        # list-pair input still converts
        listed = a.quad_dict([[0.1, 0.2], [0.3, 0.2], [0.3, 0.4], [0.1, 0.4]])
        self.assertEqual(listed[0]["x"], 0.1)

    def test_width_is_always_x_axis(self):
        """A 90° pen must not swap to height/product_height."""
        # Tall thin mark (rotated lockup) on the body.
        mark = a.quad_of_box({"x": 0.45, "y": 0.20, "w": 0.08, "h": 0.50})
        rel = a.relative_of(mark, BODY)
        self.assertAlmostEqual(rel["w"], 0.08 / 0.60, places=5)
        self.assertAlmostEqual(rel["rot"], 0.0, delta=0.5)  # top edge of an AABB
        self.assertAlmostEqual(rel["ext"], 0.50 / 0.80, places=5)
        self.assertLess(rel["w"], rel["ext"])


class ProposableTests(unittest.TestCase):
    def test_n_eff_below_five_is_not_a_prior(self):
        self.assertFalse(a.proposable(award_concentrated()))
        self.assertFalse(a.proposable({"n": 3, "n_eff": 3, "modes": []}))

    def test_n_eff_at_five_is_proposable(self):
        self.assertTrue(a.proposable(tight_unimodal(n=19, n_eff=19)))
        self.assertTrue(a.proposable({"n": 5, "n_eff": 5, "cy": {"median": 0.5, "iqr": (0.4, 0.6)}}))
        # Five equal decks must not fail because inverse-Simpson is 4.999…
        n_eff = a.effective_n({f"d{i}": 1.0 for i in range(5)})
        self.assertTrue(a.proposable({"n": 5, "n_eff": n_eff}))
        self.assertFalse(a.proposable({"n": 5, "n_eff": n_eff - 1}))


class ArbitrateTests(unittest.TestCase):
    def test_concentrated_award_does_not_override_detector(self):
        """FIRING: n=38 n_eff=3.3 is not a prior. Detector stands."""
        det = {"quad": at(0.40, 0.40), "score": 72, "route": "panel"}
        out = a.arbitrate(det, award_concentrated(), BODY, 0.8)
        self.assertEqual(out["source"], "detector")
        self.assertFalse(out["priorProposable"])

    def test_concentrated_award_does_not_invent_a_zone_without_detector(self):
        """NOT FIRING the prior: no detector, n_eff 3.3 → no quad."""
        out = a.arbitrate(None, award_concentrated(), BODY, 0.8)
        self.assertEqual(out["source"], "none")
        self.assertIsNone(out["quad"])

    def test_weak_detector_loses_to_tight_prior(self):
        """FIRING: score 40 vs n_eff=19 tight drinkware → prior."""
        det = {"quad": at(0.53, 0.30), "score": 40, "route": "placeholder"}
        out = a.arbitrate(det, tight_unimodal(), BODY, 0.8)
        self.assertEqual(out["source"], "prior")
        rel = a.relative_of(out["quad"], BODY)
        self.assertAlmostEqual(rel["cy"], 0.60, delta=0.03)

    def test_weak_detector_does_not_lose_when_prior_is_not_proposable(self):
        """NOT FIRING that rule: same score 40, n_eff=3.3 → detector kept."""
        det = {"quad": at(0.40, 0.40), "score": 40, "route": "placeholder"}
        out = a.arbitrate(det, award_concentrated(), BODY, 0.8)
        self.assertEqual(out["source"], "detector")

    def test_seen_plate_beats_tight_prior(self):
        """FIRING: a plate the engine can see is not overridden."""
        det = {"quad": at(0.53, 0.30), "score": 85, "route": "panel"}
        out = a.arbitrate(det, tight_unimodal(), BODY, 0.8)
        self.assertEqual(out["source"], "detector")
        rel = a.relative_of(out["quad"], BODY)
        self.assertAlmostEqual(rel["cy"], 0.30, delta=0.04)

    def test_seen_plate_on_unreadable_body_does_not_beat_prior(self):
        """NOT FIRING: body_confidence 0.35, same plate → prior (bad photo)."""
        det = {"quad": at(0.53, 0.30), "score": 85, "route": "panel"}
        out = a.arbitrate(det, tight_unimodal(), BODY, 0.35)
        self.assertEqual(out["source"], "prior")

    def test_agreement_raises_confidence(self):
        """FIRING: detector in IQR → source agree, confidence > either alone."""
        prior = tight_unimodal()
        det = {"quad": at(0.53, 0.61), "score": 70, "route": "panel"}
        out = a.arbitrate(det, prior, BODY, 0.8)
        self.assertEqual(out["source"], "agree")
        d = a._detector_conf(70, 0.8, "panel")
        p = a._prior_conf(prior)
        self.assertGreater(out["confidence"], max(d, p) - 1e-9)
        self.assertGreater(out["confidence"], d)
        self.assertGreater(out["confidence"], p)

    def test_near_miss_does_not_raise(self):
        """NOT FIRING agree: detector well outside IQR is not 'in the band'."""
        det = {"quad": at(0.53, 0.20), "score": 70, "route": "placeholder"}
        out = a.arbitrate(det, tight_unimodal(), BODY, 0.8)
        self.assertNotEqual(out["source"], "agree")

    def test_valley_weak_detector_picks_nearest_mode_not_the_mean(self):
        """FIRING: notebook valley at 0.66 must not be the answer."""
        det = {"quad": at(0.45, 0.66), "score": 40, "route": "placeholder"}
        out = a.arbitrate(det, notebook_prior(), BODY, 0.8)
        self.assertEqual(out["source"], "prior-bimodal")
        rel = a.relative_of(out["quad"], BODY)
        mean = 0.66
        self.assertGreater(abs(rel["cy"] - mean), 0.10)
        self.assertTrue(rel["cy"] <= 0.55 or rel["cy"] >= 0.85)

    def test_valley_seen_plate_is_kept(self):
        """NOT FIRING nearest-mode: a real plate in the valley is the plate."""
        det = {"quad": at(0.45, 0.66), "score": 80, "route": "panel"}
        out = a.arbitrate(det, notebook_prior(), BODY, 0.8)
        self.assertEqual(out["source"], "detector")
        rel = a.relative_of(out["quad"], BODY)
        self.assertAlmostEqual(rel["cy"], 0.66, delta=0.04)

    def test_no_detector_bimodal_does_not_average(self):
        out = a.arbitrate(None, notebook_prior(), BODY, 0.8)
        self.assertEqual(out["source"], "prior-bimodal")
        rel = a.relative_of(out["quad"], BODY)
        self.assertGreaterEqual(rel["cy"], 0.85)
        self.assertEqual(len(out["modes"]), 2)


class LearnTests(unittest.TestCase):
    def setUp(self):
        self.prior = a.empty_prior(
            "notebook",
            [
                {"cx": 0.50, "cy": 0.50, "w": 0.24, "n": 15, "iqr": (0.45, 0.55)},
                {"cx": 0.28, "cy": 0.90, "w": 0.24, "n": 19, "iqr": (0.85, 0.94)},
            ],
            n=38,
            n_eff=22,
        )

    def _cy(self, prior, which: str) -> float:
        modes = sorted(prior["modes"], key=lambda m: m["cy"])
        return float(modes[0]["cy"] if which == "mid" else modes[-1]["cy"])

    def test_three_picks_do_not_overturn_nineteen(self):
        """FIRING shrinkage: 3 drawn at 0.92, 3 AMs, low mode barely moves."""
        p = self.prior
        before = self._cy(p, "low")
        for i in range(3):
            p = a.update_prior(
                p,
                {"kind": "drawn", "quad": at(0.28, 0.92), "am_id": f"am-{i}"},
                BODY,
            )
        after = self._cy(p, "low")
        self.assertLess(abs(after - before), 0.03)
        self.assertGreater(self._cy(p, "low"), 0.85)

    def test_thirty_drawn_do_move_it(self):
        """NOT FIRING the 'stuck' reading: 30 AMs drawn at 0.92 move the low mode."""
        p = self.prior
        before = self._cy(p, "low")
        for i in range(30):
            p = a.update_prior(
                p,
                {"kind": "drawn", "quad": at(0.28, 0.92), "am_id": f"am-{i}"},
                BODY,
            )
        after = self._cy(p, "low")
        self.assertGreater(abs(after - before), 0.005)
        self.assertGreater(after, before)

    def test_forty_from_one_am_is_not_forty_opinions(self):
        """FIRING concentration: 40 drawn, one AM, n_eff of picks ≈ 1, mode stays."""
        p = self.prior
        before = self._cy(p, "low")
        for i in range(40):
            p = a.update_prior(
                p,
                {"kind": "drawn", "quad": at(0.28, 0.92), "am_id": "solo"},
                BODY,
            )
        after = self._cy(p, "low")
        self.assertLess(abs(after - before), 0.03)

    def test_forty_from_forty_ams_does_move(self):
        """NOT FIRING concentration-as-stuck: 40 AMs at 0.99 move the low mode."""
        p = self.prior
        before = self._cy(p, "low")
        for i in range(40):
            p = a.update_prior(
                p,
                {"kind": "drawn", "quad": at(0.28, 0.99), "am_id": f"am-{i}"},
                BODY,
            )
        self.assertGreater(self._cy(p, "low") - before, 0.02)

    def test_valley_choices_do_not_spawn_a_mode(self):
        """FIRING: choosing the least-wrong of a bad menu does not fill the valley."""
        p = self.prior
        for i in range(8):
            p = a.update_prior(
                p,
                {"kind": "chosen", "quad": at(0.45, 0.66), "am_id": f"am-{i}"},
                BODY,
            )
        vis = a.visible_modes(a.summarise(p))
        cys = [round(float(m["cy"]), 2) for m in vis]
        self.assertTrue(all(cy <= 0.55 or cy >= 0.85 for cy in cys), cys)
        self.assertEqual(len(vis), 2)

    def test_drawn_in_a_new_place_can_spawn_but_stays_invisible_until_five(self):
        """NOT FIRING spawn-as-visible: 3 drawn at 0.20 do not become a prior mode."""
        p = self.prior
        for i in range(3):
            p = a.update_prior(
                p,
                {"kind": "drawn", "quad": at(0.50, 0.20), "am_id": f"am-{i}"},
                BODY,
            )
        vis = a.visible_modes(a.summarise(p))
        self.assertEqual(len(vis), 2)
        p = self.prior
        for i in range(6):
            p = a.update_prior(
                p,
                {"kind": "drawn", "quad": at(0.50, 0.20), "am_id": f"am-{i}"},
                BODY,
            )
        vis = a.visible_modes(a.summarise(p))
        self.assertGreaterEqual(len(vis), 3)

    def test_rejection_is_a_label(self):
        """FIRING: rejecting the mid mode shrinks pick-layer, corpus stays."""
        p = self.prior
        # grow mid with picks, then reject it
        for i in range(10):
            p = a.update_prior(
                p,
                {"kind": "drawn", "quad": at(0.50, 0.50), "am_id": f"grow-{i}"},
                BODY,
            )
        mid_before = next(m for m in a.summarise(p)["modes"] if abs(m["cy"] - 0.50) < 0.08)
        self.assertGreater(mid_before["n_picks"], 1)
        for i in range(10):
            p = a.update_prior(
                p,
                {
                    "kind": "reject",
                    "shortlist": [at(0.50, 0.50)],
                    "am_id": f"rej-{i}",
                },
                BODY,
            )
        mid = next(m for m in a.summarise(p)["modes"] if abs(m["cy"] - 0.50) < 0.08)
        self.assertEqual(mid["n_corpus"], 15)
        self.assertLess(mid["n_picks"], mid_before["n_picks"])
        # corpus mode still visible
        self.assertGreaterEqual(mid["n"], 15)

    def test_rejection_does_not_delete_a_corpus_mode(self):
        """NOT FIRING erase: 20 rejections cannot remove the 15-client mid mode."""
        p = self.prior
        for i in range(20):
            p = a.update_prior(
                p,
                {"kind": "reject", "shortlist": [at(0.50, 0.50)], "am_id": f"r-{i}"},
                BODY,
            )
        vis = a.visible_modes(a.summarise(p))
        self.assertEqual(len(vis), 2)
        self.assertTrue(any(abs(m["cy"] - 0.50) < 0.08 for m in vis))

    def test_drawn_outranks_chosen(self):
        """Same location, 6 chosen vs 6 drawn: drawn moves the mode more."""
        base = a.empty_prior(
            "drinkware",
            [{"cx": 0.53, "cy": 0.60, "w": 0.29, "n": 19, "iqr": (0.56, 0.64)}],
            n=19,
            n_eff=19,
        )
        chosen = base
        drawn = base
        for i in range(12):
            chosen = a.update_prior(
                chosen,
                {"kind": "chosen", "quad": at(0.53, 0.63), "am_id": f"c-{i}"},
                BODY,
            )
            drawn = a.update_prior(
                drawn,
                {"kind": "drawn", "quad": at(0.53, 0.63), "am_id": f"d-{i}"},
                BODY,
            )
        cy_c = a.summarise(chosen)["modes"][0]["cy"]
        cy_d = a.summarise(drawn)["modes"][0]["cy"]
        self.assertGreater(cy_d, cy_c)

    def test_bimodality_survives_a_mean_attack(self):
        """Picks at both modes, plus valley choices, still two modes, not 0.66."""
        p = self.prior
        for i in range(8):
            p = a.update_prior(p, {"kind": "drawn", "quad": at(0.50, 0.50), "am_id": f"m-{i}"}, BODY)
            p = a.update_prior(p, {"kind": "drawn", "quad": at(0.28, 0.90), "am_id": f"l-{i}"}, BODY)
            p = a.update_prior(p, {"kind": "chosen", "quad": at(0.45, 0.66), "am_id": f"v-{i}"}, BODY)
        vis = a.visible_modes(a.summarise(p))
        self.assertEqual(len(vis), 2)
        cys = sorted(float(m["cy"]) for m in vis)
        self.assertLess(cys[0], 0.58)
        self.assertGreater(cys[1], 0.82)
        self.assertGreater(cys[1] - cys[0], 0.25)


class RouteVocabularyTests(unittest.TestCase):
    def test_insert_is_a_seen_face(self):
        """FIRING: engine route insert is protected as a seen face."""
        det = {"quad": at(0.20, 0.30), "score": 85, "route": "insert"}
        out = a.arbitrate(det, tight_unimodal(), BODY, 0.8)
        self.assertEqual(out["source"], "detector")
        self.assertIn("seen face", out["reason"])

    def test_recipe_is_declared_not_seen(self):
        """NOT FIRING seen-face protection: recipe is a class guess."""
        self.assertIn("recipe", a.NOT_SEEN)
        self.assertNotIn("recipe", a.SEEN_ROUTES)
        self.assertFalse(a._seen_face("recipe", 85, 0.8))
        self.assertTrue(a._seen_face("insert", 85, 0.8))
        self.assertTrue(a._seen_face("placeholder", 100, 0.8))

    def test_unknown_route_raises(self):
        """NOT FIRING a silent drop: names the engine never emits raise."""
        det = {"quad": at(0.53, 0.30), "score": 85, "route": "plate"}
        with self.assertRaises(ValueError):
            a.arbitrate(det, tight_unimodal(), BODY, 0.8)
        with self.assertRaises(ValueError):
            a.check_route("demo")

    def test_sets_partition_the_engine(self):
        self.assertEqual(a.SEEN_ROUTES | a.NOT_SEEN, a.ENGINE_ROUTES)
        self.assertFalse(a.SEEN_ROUTES & a.NOT_SEEN)
        for phantom in ("plate", "demo"):
            self.assertNotIn(phantom, a.ENGINE_ROUTES)
            self.assertNotIn(phantom, a.SEEN_ROUTES)


class PriorKeyTests(unittest.TestCase):
    def test_reads_cx_rel_not_the_dead_centre(self):
        """FIRING: their key names round-trip to the corpus centre."""
        prior = {
            "class": "award",
            "n": 38,
            "n_eff": 12.0,
            "cx_rel": {"median": 0.534, "iqr": (0.51, 0.54)},
            "cy_rel": {"median": 0.529, "iqr": (0.52, 0.58)},
            "w_of_product_w": {"median": 0.254, "iqr": (0.22, 0.26)},
            "mark_extent_along_baseline": {"median": 0.254, "iqr": (0.22, 0.26)},
        }
        modes = a._modes_of(prior)
        self.assertAlmostEqual(modes[0]["cx"], 0.534, places=3)
        self.assertAlmostEqual(modes[0]["cy"], 0.529, places=3)
        self.assertAlmostEqual(modes[0]["w"], 0.254, places=3)
        out = a.arbitrate(None, prior, BODY, 0.8)
        rel = a.relative_of(out["quad"], BODY)
        self.assertAlmostEqual(rel["cx"], 0.534, delta=0.02)
        self.assertNotAlmostEqual(rel["w"], 0.5, delta=0.1)

    def test_unmapped_keys_raise(self):
        """NOT FIRING a silent (0.5, 0.5) prior."""
        with self.assertRaises(KeyError):
            a._modes_of({"n": 19, "n_eff": 19, "modes": [{"n": 19}]})
        with self.assertRaises(KeyError):
            a.iqr_span(None)
        with self.assertRaises(KeyError):
            a.iqr_span({"median": 0.5})


class GroupKeyTests(unittest.TestCase):
    def test_by_and_job_are_the_concentration_keys(self):
        """FIRING: 40 events from one `by` stay one opinion."""
        p = a.empty_prior(
            "drinkware",
            [{"cx": 0.53, "cy": 0.60, "w": 0.29, "n": 19, "iqr": (0.56, 0.64)}],
            n=19,
            n_eff=19,
        )
        before = p["modes"][0]["cy"]
        for i in range(40):
            p = a.update_prior(
                p,
                {"kind": "drawn", "quad": at(0.53, 0.63), "by": "one-person", "job": f"job-{i}"},
                BODY,
            )
        self.assertLess(abs(a.summarise(p)["modes"][0]["cy"] - before), 0.03)

    def test_unattributable_event_raises(self):
        """NOT FIRING id() as a group: missing by/job is an error."""
        p = a.empty_prior(
            "drinkware",
            [{"cx": 0.53, "cy": 0.60, "w": 0.29, "n": 19, "iqr": (0.56, 0.64)}],
            n=19,
            n_eff=19,
        )
        with self.assertRaises(ValueError):
            a.update_prior(p, {"kind": "drawn", "quad": at(0.53, 0.63)}, BODY)


class RotationTests(unittest.TestCase):
    def test_rotated_band_round_trips(self):
        """FIRING: a 36.9° top edge comes back as 36.9°, not 0."""
        src = a.quad_from_relative({"cx": 0.50, "cy": 0.48, "w": 0.30, "h": 0.12, "rot": 36.9}, BODY)
        self.assertAlmostEqual(a.top_edge_deg(src), 36.9, delta=0.2)
        rel = a.relative_of(src, BODY)
        self.assertAlmostEqual(rel["rot"], 36.9, delta=0.2)
        back = a.quad_from_relative(rel, BODY)
        self.assertAlmostEqual(a.top_edge_deg(back), 36.9, delta=0.5)

    def test_upright_mark_stays_upright(self):
        """NOT FIRING rotation: an axis-aligned box stays near 0."""
        src = a.quad_from_relative({"cx": 0.50, "cy": 0.50, "w": 0.24, "h": 0.16, "rot": 0}, BODY)
        self.assertAlmostEqual(a.top_edge_deg(src), 0.0, delta=0.2)
        self.assertAlmostEqual(a.relative_of(src, BODY)["rot"], 0.0, delta=0.2)


class NearModeTests(unittest.TestCase):
    def test_opposite_cx_is_not_agreement(self):
        """FIRING: cy match + opposite cx does not raise confidence."""
        prior = tight_unimodal()
        det = {"quad": at(0.20, 0.60), "score": 90, "route": "panel"}
        out = a.arbitrate(det, prior, BODY, 0.8)
        self.assertNotEqual(out["source"], "agree")

    def test_same_cx_and_cy_does_agree(self):
        """NOT FIRING the miss: matching both axes is agreement."""
        prior = tight_unimodal()
        det = {"quad": at(0.53, 0.61), "score": 70, "route": "panel"}
        out = a.arbitrate(det, prior, BODY, 0.8)
        self.assertEqual(out["source"], "agree")


class HygieneTests(unittest.TestCase):
    def test_no_sku_literals_in_source(self):
        src = pathlib.Path(__file__).with_name("arbitrate.py").read_text()
        self.assertNotIn("TH164", src)
        self.assertNotIn("NB146", src)
        self.assertNotIn("CH-1011", src)
        self.assertNotRegex(src, r"sku\s*===")
        self.assertNotRegex(src, r"\bsku\b.*=.*['\"]")

    def test_banned_method_words_absent(self):
        src = pathlib.Path(__file__).with_name("arbitrate.py").read_text()
        for word in ("deboss", "emboss", "pad print", "screen print", "pad_print"):
            self.assertNotIn(word, src.lower())

    def test_inverse_simpson_examples(self):
        self.assertAlmostEqual(a.effective_n({"a": 40}), 1.0)
        self.assertAlmostEqual(a.effective_n({f"k{i}": 1 for i in range(40)}), 40.0)
        self.assertAlmostEqual(a.effective_n({"a": 20, "b": 20}), 2.0)
        n5 = a.effective_n({f"k{i}": 1 for i in range(5)})
        self.assertTrue(n5 + a.N_MIN_EPS >= 5)

    def test_no_id_fallback(self):
        src = pathlib.Path(__file__).with_name("arbitrate.py").read_text()
        self.assertNotIn("id(event)", src)
        self.assertNotIn("id(event)", src.replace(" ", ""))
        self.assertIn("by:", src)
        self.assertIn("job:", src)


if __name__ == "__main__":
    unittest.main()
