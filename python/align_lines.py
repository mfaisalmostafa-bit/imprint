"""Minimum-cost alignment of two lists of opaque order lines.

Port these functions. Do not drop this file onto anything that sends
messages, writes a ledger, or decides a price.

Why not Needleman-Wunsch, and why not zip-by-index
--------------------------------------------------
Zip-by-index is the live defect: insert one line at the head and every
later line is compared to the wrong partner, so accounting is paged
about prices that did not change.

Needleman-Wunsch is order-preserving. A swap of two unchanged lines
cannot be a zero-cost alignment under it; the algorithm must either
call them token-changes or a delete+insert. Reordering an order is
not a change. We therefore match as a **bipartite assignment** that
allows crossings.

Cost, as rules, not numbers
---------------------------
A pair is considered in four nested keys. Earlier keys outrank later
ones. There is no weight to tune.

  1. identical token AND method AND qty AND price
  2. identical token AND method (qty and/or price differ)
  3. identical token (method differs)
  4. leftover 1:1 rename (tokens differ) — only after 1–3 are exhausted
  5. unmatched old → deleted; unmatched new → inserted

Within a key, each unmatched new line (ascending index) takes the
unmatched eligible old line of smallest (|i−j|, i). Duplicates therefore
match in order, and the answer does not flap.

Hard constraint encoded by the order of keys
--------------------------------------------
Never pair across a token *and* method change while an unmatched
identical (or same-token) line is still available: keys 1–3 run to
completion before key 4 is allowed to see a leftover.

Tie-break (the reader can predict the pair)
-------------------------------------------
  • new lines are considered in increasing new_index
  • eligible old lines: minimum |old_index − new_index|, then minimum
    old_index
  • leftover renames zip remaining old indices to remaining new indices,
    both sorted — extras are inserts/deletes, never a third kind of pair
  • output: matches and inserts in new_index order, then deletes in
    old_index order

Classifier
----------
Flags are from a closed vocabulary. A pair may carry more than one.
price-changed and qty-changed require the **same token** (price-changed
also requires the same method). A rename is never a price change.
That is the whole reason this module exists.

Equality is a predicate you supply. This module never rounds, never
tolerances a price, never looks at a product identifier, never writes.

Vocabulary — raise on an unmapped value
---------------------------------------
Record fields: token, method, qty, unit_price.
Tuple form: (token, method, qty, unit_price).
Flags: unchanged, token-changed, method-changed, qty-changed,
price-changed, inserted, deleted.
Unknown field, unknown flag, or a predicate that does not return
True/False raises.

Five methods, one spelling: UV printing, UV DTF, laser engraving,
sublimation, embroidery. This file does not name a method.
"""

from __future__ import annotations

from typing import Any, Callable, Mapping, Sequence

FIELDS = ("token", "method", "qty", "unit_price")
FLAGS = frozenset(
    {
        "unchanged",
        "token-changed",
        "method-changed",
        "qty-changed",
        "price-changed",
        "inserted",
        "deleted",
    }
)
Eq = Callable[[Any, Any], bool]


def _as_record(rec: Any) -> dict[str, Any]:
    if isinstance(rec, Mapping):
        missing = [f for f in FIELDS if f not in rec]
        if missing:
            raise KeyError(
                f"line record missing {missing}; fields are {list(FIELDS)}"
            )
        return {f: rec[f] for f in FIELDS}
    if isinstance(rec, (tuple, list)):
        if len(rec) != 4:
            raise KeyError(
                f"tuple line must be (token, method, qty, unit_price); got length {len(rec)}"
            )
        return dict(zip(FIELDS, rec))
    raise TypeError(f"line record must be a 4-tuple or a mapping, not {type(rec).__name__}")


def _pred(fn: Eq | None, a: Any, b: Any, name: str) -> bool:
    if fn is None:
        return a == b
    if not callable(fn):
        raise TypeError(f"{name} must be callable")
    r = fn(a, b)
    if r is not True and r is not False:
        raise ValueError(f"{name} must return True or False, not {r!r}")
    return r


def _flags_of(
    o: Mapping[str, Any] | None,
    n: Mapping[str, Any] | None,
    same_token: Eq | None,
    same_method: Eq | None,
    same_qty: Eq | None,
    same_price: Eq | None,
) -> tuple[str, ...]:
    if o is None and n is None:
        raise ValueError("a pair needs an old line or a new line")
    if o is None:
        return ("inserted",)
    if n is None:
        return ("deleted",)
    flags: list[str] = []
    tok = _pred(same_token, o["token"], n["token"], "same_token")
    meth = _pred(same_method, o["method"], n["method"], "same_method")
    qty = _pred(same_qty, o["qty"], n["qty"], "same_qty")
    price = _pred(same_price, o["unit_price"], n["unit_price"], "same_price")
    if not tok:
        flags.append("token-changed")
    if not meth:
        flags.append("method-changed")
    if tok and not qty:
        flags.append("qty-changed")
    if tok and meth and not price:
        flags.append("price-changed")
    if not flags:
        flags.append("unchanged")
    unknown = set(flags) - FLAGS
    if unknown:
        raise ValueError(f"unmapped flags {sorted(unknown)}")
    return tuple(flags)


def _pick_old(unmatched_old: Sequence[int], new_j: int) -> int:
    """Tie-break: min |i-j|, then min i."""
    return min(unmatched_old, key=lambda i: (abs(i - new_j), i))


def align_lines(
    old: Sequence[Any],
    new: Sequence[Any],
    *,
    same_token: Eq | None = None,
    same_method: Eq | None = None,
    same_qty: Eq | None = None,
    same_price: Eq | None = None,
) -> list[dict[str, Any]]:
    """Align two lists of line records. See module docstring for the keys.

    Returns a list of {old, new, old_index, new_index, flags}. Original
    records are returned unchanged (the objects you passed in).
    """
    if old is None or new is None:
        raise TypeError("old and new must be sequences, not None")
    old_recs = [_as_record(r) for r in old]
    new_recs = [_as_record(r) for r in new]
    m, n = len(old_recs), len(new_recs)
    used_old = [False] * m
    used_new = [False] * n
    pairs: list[tuple[int | None, int | None]] = []

    def token(i: int, j: int) -> bool:
        return _pred(same_token, old_recs[i]["token"], new_recs[j]["token"], "same_token")

    def method(i: int, j: int) -> bool:
        return _pred(same_method, old_recs[i]["method"], new_recs[j]["method"], "same_method")

    def qty(i: int, j: int) -> bool:
        return _pred(same_qty, old_recs[i]["qty"], new_recs[j]["qty"], "same_qty")

    def price(i: int, j: int) -> bool:
        return _pred(same_price, old_recs[i]["unit_price"], new_recs[j]["unit_price"], "same_price")

    def identical(i: int, j: int) -> bool:
        return token(i, j) and method(i, j) and qty(i, j) and price(i, j)

    def take(phase_ok) -> None:
        for j in range(n):
            if used_new[j]:
                continue
            eligible = [i for i in range(m) if not used_old[i] and phase_ok(i, j)]
            if not eligible:
                continue
            i = _pick_old(eligible, j)
            used_old[i] = True
            used_new[j] = True
            pairs.append((i, j))

    take(identical)
    take(lambda i, j: token(i, j) and method(i, j))
    take(lambda i, j: token(i, j))

    leftover_o = [i for i in range(m) if not used_old[i]]
    leftover_n = [j for j in range(n) if not used_new[j]]
    k = min(len(leftover_o), len(leftover_n))
    for i, j in zip(leftover_o[:k], leftover_n[:k]):
        pairs.append((i, j))
    for i in leftover_o[k:]:
        pairs.append((i, None))
    for j in leftover_n[k:]:
        pairs.append((None, j))

    out: list[dict[str, Any]] = []
    for oi, nj in pairs:
        o_orig = old[oi] if oi is not None else None
        n_orig = new[nj] if nj is not None else None
        o_rec = old_recs[oi] if oi is not None else None
        n_rec = new_recs[nj] if nj is not None else None
        flags = _flags_of(o_rec, n_rec, same_token, same_method, same_qty, same_price)
        out.append(
            {
                "old": o_orig,
                "new": n_orig,
                "old_index": oi,
                "new_index": nj,
                "flags": flags,
            }
        )

    def sort_key(p: Mapping[str, Any]) -> tuple:
        nj, oi = p["new_index"], p["old_index"]
        # matches+inserts by new_index; deletes after, by old_index
        if nj is None:
            return (1, oi if oi is not None else 0, 0)
        return (0, nj, oi if oi is not None else -1)

    out.sort(key=sort_key)
    return out


def changes(aligned: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Drop unchanged pairs. Does not compose a message."""
    return [dict(p) for p in aligned if p["flags"] != ("unchanged",)]


def has_flag(aligned: Sequence[Mapping[str, Any]], flag: str) -> bool:
    if flag not in FLAGS:
        raise ValueError(f"unmapped flag {flag!r}; vocabulary is {sorted(FLAGS)}")
    return any(flag in p["flags"] for p in aligned)
