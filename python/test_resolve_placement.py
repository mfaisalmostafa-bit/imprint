"""Fire / not-fire for the placement stack. MG-4018 is a geometry control."""

import unittest

from resolve_placement import (
    NECK_OVERRIDE_CONTROL,
    print_face_ok,
    resolve_placement,
)


def rect(x, y, w, h):
    return [
        {"x": x, "y": y},
        {"x": x + w, "y": y},
        {"x": x + w, "y": y + h},
        {"x": x, "y": y + h},
    ]


BODY = rect(0.28, 0.12, 0.44, 0.76)
MID = rect(0.38, 0.42, 0.24, 0.28)


class VocabularyTests(unittest.TestCase):
    def test_unknown_class_raises(self):
        with self.assertRaises(ValueError):
            print_face_ok(MID, "toaster")


class NeckDropTests(unittest.TestCase):
    def test_control_quad_is_not_a_print_face(self):
        face = print_face_ok(NECK_OVERRIDE_CONTROL, "bottle", BODY)
        self.assertFalse(face["ok"])
        self.assertEqual(face["reason"], "neck")

    def test_mid_body_is_a_print_face(self):
        face = print_face_ok(MID, "bottle", BODY)
        self.assertTrue(face["ok"])

    def test_upright_bag_panel_kept(self):
        panel = rect(0.3, 0.4, 0.4, 0.22)
        face = print_face_ok(panel, "bag")
        self.assertTrue(face["ok"])


class PriorityTests(unittest.TestCase):
    def test_drawn_beats_pick(self):
        drawn = rect(0.4, 0.5, 0.2, 0.2)
        pick = rect(0.3, 0.3, 0.2, 0.2)
        r = resolve_placement("bottle", body=BODY, drawn=drawn, pick=pick, engine=MID)
        self.assertEqual(r["source"], "drawn")
        self.assertAlmostEqual(r["quad"][0]["x"], 0.4)

    def test_pick_beats_engine_and_saved(self):
        pick = rect(0.41, 0.48, 0.18, 0.2)
        saved = NECK_OVERRIDE_CONTROL
        r = resolve_placement(
            "bottle", body=BODY, pick=pick, engine=MID, saved=saved
        )
        self.assertEqual(r["source"], "pick")
        self.assertAlmostEqual(r["quad"][0]["x"], 0.41)

    def test_stale_neck_is_dropped_for_engine(self):
        r = resolve_placement("bottle", body=BODY, engine=MID, saved=NECK_OVERRIDE_CONTROL)
        self.assertEqual(r["source"], "engine")
        self.assertEqual(r["dropped"], "neck")
        self.assertAlmostEqual(r["quad"][0]["y"], MID[0]["y"])

    def test_good_saved_beats_engine(self):
        """Aug-29: a staff lock is not clobbered by the next engine guess."""
        engine = rect(0.36, 0.40, 0.28, 0.30)
        r = resolve_placement("bottle", body=BODY, engine=engine, saved=MID)
        self.assertEqual(r["source"], "saved")
        self.assertAlmostEqual(r["quad"][0]["x"], MID[0]["x"])

    def test_good_saved_beats_class(self):
        r = resolve_placement("bottle", body=BODY, saved=MID)
        self.assertEqual(r["source"], "saved")
        self.assertIsNone(r["dropped"])

    def test_no_inputs_falls_to_class(self):
        r = resolve_placement("bottle", body=BODY)
        self.assertEqual(r["source"], "class")


if __name__ == "__main__":
    unittest.main()
