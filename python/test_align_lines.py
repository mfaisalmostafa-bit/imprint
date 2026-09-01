"""Control tests for order-line alignment. Each rule fires and does not fire.

Opaque tokens only. No product codes. Equality is exact unless a predicate
is passed in.
"""

from __future__ import annotations

import pathlib
import unittest

import align_lines as al


def L(token, method="m1", qty=1, price=10):
    return (token, method, qty, price)


def flags(rows):
    return [p["flags"] for p in rows]


def flagged(rows, flag):
    return [p for p in rows if flag in p["flags"]]


class ControlDefectTests(unittest.TestCase):
    """The measured 3-line order that paged accounting."""

    def setUp(self):
        self.old = [L("A", price=80), L("B", price=120), L("C", price=30)]

    def test_insert_at_head_is_not_a_price_cascade(self):
        """FIRING: one insert, three unchanged. NOT 10 changes, NOT three price moves."""
        new = [L("D", price=50)] + list(self.old)
        rows = al.align_lines(self.old, new)
        self.assertEqual(len(flagged(rows, "inserted")), 1)
        self.assertEqual(flagged(rows, "inserted")[0]["new"][0], "D")
        self.assertEqual(len(flagged(rows, "unchanged")), 3)
        self.assertFalse(al.has_flag(rows, "price-changed"))
        self.assertFalse(al.has_flag(rows, "qty-changed"))
        self.assertFalse(al.has_flag(rows, "deleted"))
        self.assertEqual(len(al.changes(rows)), 1)

    def test_insert_at_middle(self):
        new = [self.old[0], L("D", price=50), self.old[1], self.old[2]]
        rows = al.align_lines(self.old, new)
        self.assertEqual(len(flagged(rows, "inserted")), 1)
        self.assertEqual(len(flagged(rows, "unchanged")), 3)
        self.assertFalse(al.has_flag(rows, "price-changed"))

    def test_insert_at_tail(self):
        new = list(self.old) + [L("D")]
        rows = al.align_lines(self.old, new)
        self.assertEqual(len(flagged(rows, "inserted")), 1)
        self.assertEqual(len(flagged(rows, "unchanged")), 3)
        self.assertFalse(al.has_flag(rows, "price-changed"))

    def test_delete_middle_is_not_a_price_change_on_the_survivor(self):
        """FIRING: B deleted. NOT 'B price 30 -> 260' and 'B removed' together."""
        new = [self.old[0], self.old[2]]
        rows = al.align_lines(self.old, new)
        self.assertEqual(len(flagged(rows, "deleted")), 1)
        self.assertEqual(flagged(rows, "deleted")[0]["old"][0], "B")
        self.assertEqual(len(flagged(rows, "unchanged")), 2)
        self.assertFalse(al.has_flag(rows, "price-changed"))
        self.assertFalse(al.has_flag(rows, "inserted"))

    def test_delete_head(self):
        rows = al.align_lines(self.old, self.old[1:])
        self.assertEqual(flagged(rows, "deleted")[0]["old"][0], "A")
        self.assertEqual(len(flagged(rows, "unchanged")), 2)
        self.assertFalse(al.has_flag(rows, "price-changed"))

    def test_delete_tail(self):
        rows = al.align_lines(self.old, self.old[:-1])
        self.assertEqual(flagged(rows, "deleted")[0]["old"][0], "C")
        self.assertFalse(al.has_flag(rows, "price-changed"))

    def test_identical_lists_report_nothing(self):
        """NOT FIRING: the comparator is silent when the alignment is right."""
        rows = al.align_lines(self.old, list(self.old))
        self.assertTrue(all(p["flags"] == ("unchanged",) for p in rows))
        self.assertEqual(al.changes(rows), [])


class ReorderTests(unittest.TestCase):
    def test_swap_is_not_a_change(self):
        """FIRING: A,B → B,A is zero changes."""
        old = [L("A"), L("B")]
        new = [L("B"), L("A")]
        rows = al.align_lines(old, new)
        self.assertEqual(al.changes(rows), [])
        self.assertEqual(len(rows), 2)

    def test_rotate_three_is_not_a_change(self):
        old = [L("A"), L("B"), L("C")]
        new = [L("C"), L("A"), L("B")]
        self.assertEqual(al.changes(al.align_lines(old, new)), [])

    def test_reorder_plus_a_real_price_change(self):
        """NOT FIRING silence: the one line that moved price is still visible."""
        old = [L("A", price=10), L("B", price=20), L("C", price=30)]
        new = [L("C", price=30), L("A", price=11), L("B", price=20)]
        rows = al.align_lines(old, new)
        ch = al.changes(rows)
        self.assertEqual(len(ch), 1)
        self.assertEqual(ch[0]["flags"], ("price-changed",))
        self.assertEqual(ch[0]["old"][0], "A")


class RenameMethodPriceTests(unittest.TestCase):
    def test_rename_in_place(self):
        """FIRING: token-changed, not a price-changed, not a cascade."""
        old = [L("A", price=10), L("B", price=20)]
        new = [L("X", price=10), L("B", price=20)]
        rows = al.align_lines(old, new)
        ch = al.changes(rows)
        self.assertEqual(len(ch), 1)
        self.assertEqual(ch[0]["flags"], ("token-changed",))
        self.assertFalse(al.has_flag(rows, "price-changed"))
        self.assertEqual(len(flagged(rows, "unchanged")), 1)

    def test_rename_is_not_reported_as_a_price_move(self):
        """NOT FIRING price-changed when the tokens differ, even if the numbers do."""
        old = [L("A", price=10)]
        new = [L("X", price=99)]
        rows = al.align_lines(old, new)
        self.assertEqual(rows[0]["flags"], ("token-changed",))
        self.assertNotIn("price-changed", rows[0]["flags"])

    def test_method_only(self):
        old = [L("A", method="m1")]
        new = [L("A", method="m2")]
        rows = al.align_lines(old, new)
        self.assertEqual(rows[0]["flags"], ("method-changed",))

    def test_method_only_does_not_fire_on_identical_method(self):
        rows = al.align_lines([L("A", method="m1")], [L("A", method="m1")])
        self.assertEqual(rows[0]["flags"], ("unchanged",))

    def test_price_only(self):
        old = [L("A", price=10)]
        new = [L("A", price=12)]
        rows = al.align_lines(old, new)
        self.assertEqual(rows[0]["flags"], ("price-changed",))

    def test_qty_only(self):
        old = [L("A", qty=1)]
        new = [L("A", qty=3)]
        self.assertEqual(al.align_lines(old, new)[0]["flags"], ("qty-changed",))

    def test_method_and_qty_together(self):
        old = [L("A", method="m1", qty=1)]
        new = [L("A", method="m2", qty=2)]
        flags_ = al.align_lines(old, new)[0]["flags"]
        self.assertIn("method-changed", flags_)
        self.assertIn("qty-changed", flags_)
        self.assertNotIn("price-changed", flags_)


class DuplicateAndTwoMethodTests(unittest.TestCase):
    def test_duplicate_identical_lines_match_in_order(self):
        old = [L("A"), L("A"), L("A")]
        new = [L("A"), L("A"), L("A")]
        rows = al.align_lines(old, new)
        self.assertEqual([p["old_index"] for p in rows], [0, 1, 2])
        self.assertEqual([p["new_index"] for p in rows], [0, 1, 2])
        self.assertEqual(al.changes(rows), [])

    def test_duplicate_one_removed_is_a_single_delete(self):
        """NOT FIRING a rename: three A's vs two A's is one delete."""
        old = [L("A"), L("A"), L("A")]
        new = [L("A"), L("A")]
        rows = al.align_lines(old, new)
        self.assertEqual(len(flagged(rows, "deleted")), 1)
        self.assertEqual(len(flagged(rows, "unchanged")), 2)
        self.assertFalse(al.has_flag(rows, "token-changed"))

    def test_same_token_two_methods_swapped_is_unchanged(self):
        """FIRING: (A,m1),(A,m2) vs (A,m2),(A,m1) is a reorder, not a method change."""
        old = [L("A", method="m1"), L("A", method="m2")]
        new = [L("A", method="m2"), L("A", method="m1")]
        self.assertEqual(al.changes(al.align_lines(old, new)), [])

    def test_same_token_two_methods_one_method_edits(self):
        """NOT FIRING a swap: (A,m1),(A,m2) vs (A,m1),(A,m3) is one method-changed."""
        old = [L("A", method="m1"), L("A", method="m2")]
        new = [L("A", method="m1"), L("A", method="m3")]
        rows = al.align_lines(old, new)
        ch = al.changes(rows)
        self.assertEqual(len(ch), 1)
        self.assertEqual(ch[0]["flags"], ("method-changed",))
        self.assertEqual(ch[0]["old"][1], "m2")

    def test_never_pair_across_token_and_method_while_identical_exists(self):
        """FIRING the hard constraint: B matches B, leftover is insert/delete, not a mash."""
        old = [L("A", method="m1", price=10), L("B", method="m2", price=20)]
        new = [L("B", method="m2", price=20), L("C", method="m3", price=5)]
        rows = al.align_lines(old, new)
        self.assertEqual(len(flagged(rows, "unchanged")), 1)
        self.assertEqual(flagged(rows, "unchanged")[0]["old"][0], "B")
        # A vs C is the leftover rename; B was not consumed as a token+method mash
        self.assertFalse(any(p["old"] and p["old"][0] == "B" and "token-changed" in p["flags"] for p in rows))


class EmptyTests(unittest.TestCase):
    def test_both_empty(self):
        self.assertEqual(al.align_lines([], []), [])

    def test_old_empty_all_inserted(self):
        rows = al.align_lines([], [L("A"), L("B")])
        self.assertEqual(len(rows), 2)
        self.assertTrue(all(p["flags"] == ("inserted",) for p in rows))

    def test_new_empty_all_deleted(self):
        rows = al.align_lines([L("A"), L("B")], [])
        self.assertTrue(all(p["flags"] == ("deleted",) for p in rows))

    def test_empty_is_not_unchanged(self):
        """NOT FIRING unchanged on a ghost pair."""
        self.assertFalse(al.has_flag(al.align_lines([], [L("A")]), "unchanged"))


class PredicateAndVocabTests(unittest.TestCase):
    def test_supplied_price_predicate_is_the_only_equality(self):
        """FIRING: caller decides 10 vs 10.0; we do not."""
        old = [L("A", price=10)]
        new = [L("A", price=10.0)]
        # default == : 10 == 10.0 is True in Python
        self.assertEqual(al.align_lines(old, new)[0]["flags"], ("unchanged",))
        rows = al.align_lines(old, new, same_price=lambda a, b: False)
        self.assertEqual(rows[0]["flags"], ("price-changed",))

    def test_predicate_must_return_bool(self):
        with self.assertRaises(ValueError):
            al.align_lines([L("A")], [L("A")], same_token=lambda a, b: 1)

    def test_unknown_flag_raises(self):
        with self.assertRaises(ValueError):
            al.has_flag([], "discount-changed")

    def test_bad_record_raises(self):
        with self.assertRaises(KeyError):
            al.align_lines([{"token": "A"}], [L("A")])
        with self.assertRaises(KeyError):
            al.align_lines([("A", "m1", 1)], [L("A")])
        with self.assertRaises(TypeError):
            al.align_lines("A", [L("A")])

    def test_dict_records_round_trip_the_same_object(self):
        old = [{"token": "A", "method": "m1", "qty": 1, "unit_price": 10}]
        new = [{"token": "A", "method": "m1", "qty": 1, "unit_price": 10}]
        rows = al.align_lines(old, new)
        self.assertIs(rows[0]["old"], old[0])
        self.assertIs(rows[0]["new"], new[0])


class DeterminismTests(unittest.TestCase):
    def test_same_input_same_pairs(self):
        old = [L("A"), L("B"), L("A", qty=2), L("C")]
        new = [L("C"), L("A", qty=2), L("X"), L("A")]
        a = al.align_lines(old, new)
        b = al.align_lines(old, new)
        self.assertEqual(a, b)

    def test_mapping_and_tuple_agree_on_flags(self):
        old_t = [L("A", price=10), L("B")]
        new_t = [L("A", price=11), L("B")]
        old_d = [{"token": r[0], "method": r[1], "qty": r[2], "unit_price": r[3]} for r in old_t]
        new_d = [{"token": r[0], "method": r[1], "qty": r[2], "unit_price": r[3]} for r in new_t]
        ft = [p["flags"] for p in al.align_lines(old_t, new_t)]
        fd = [p["flags"] for p in al.align_lines(old_d, new_d)]
        self.assertEqual(ft, fd)


class HygieneTests(unittest.TestCase):
    def test_no_sku_literals(self):
        src = pathlib.Path(__file__).with_name("align_lines.py").read_text()
        self.assertNotRegex(src, r"sku\s*===")
        for token in ("TH164", "NB146", "CH-1011", "Notebook", "Mug"):
            self.assertNotIn(token, src)

    def test_banned_method_words_absent(self):
        src = pathlib.Path(__file__).with_name("align_lines.py").read_text()
        for word in ("deboss", "emboss", "pad print", "screen print"):
            self.assertNotIn(word, src.lower())

    def test_no_io_no_rounding(self):
        src = pathlib.Path(__file__).with_name("align_lines.py").read_text()
        self.assertNotIn("open(", src)
        self.assertNotIn("round(", src)
        self.assertNotIn("datetime", src)


if __name__ == "__main__":
    unittest.main()
