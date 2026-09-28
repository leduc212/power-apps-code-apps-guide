# Migration Tracker

**Reference:** `<solution>_<version>` (the Canvas export every spec was extracted from).
**Method:** one screen per slice. Spec → confirm → build → parity check against live Canvas → tests → commit.
**Status is honest:** "Built" is not "done". A slice is done when its parity check has passed.

## Screens

| # | Screen | YAML lines | Spec | Built | Parity | Tests | Notes |
|---|---|---|---|---|---|---|---|
| 0 | Spike: one paged list + one flow | - | - | ⬜ | ⬜ | - | Proves paging, a flow call, deploy |
| 1 | <small screen> | | ⬜ | ⬜ | ⬜ | ⬜ | |
| 2 | <shared components> | | ⬜ | ⬜ | ⬜ | ⬜ | |
| 3 | <CRUD screen> | | ⬜ | ⬜ | ⬜ | ⬜ | |
| 4 | <core screen>, parameterised | | ⬜ | ⬜ | ⬜ | ⬜ | Built once for <ScreenA> + <ScreenB> |

Legend: ⬜ not started · 🟡 in progress · ✅ done · ⏳ awaiting live parity

## Sub-slices of large screens

| Screen | Sub-slice | Built | Parity | Notes |
|---|---|---|---|---|
| | | | | |

## Reference version history

| Version | Date | What changed in Canvas | Specs affected |
|---|---|---|---|
| | | | |

## Known gaps

- Anything deliberately deferred, with the reason and who agreed.
