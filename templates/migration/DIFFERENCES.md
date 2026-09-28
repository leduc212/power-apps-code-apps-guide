# Intentional Differences from the Canvas App

Every deliberate change from the Canvas behaviour goes here, so parity reviewers don't report improvements as regressions, and so "why does it do that?" has an answer a year from now. One row per change. Never renumber.

| # | Screen / area | Canvas behaviour | Code App behaviour | Why | Agreed by |
|---|---|---|---|---|---|
| 1 | <list screen> | Loads the first 500 rows into a collection; no real paging | Server-side paging, 25 per page, with a total | The reason for the migration | <person, date> |
| 2 | | | | | |

Kinds of row you'll need:

- **Improvements**: paging, better controls, clearer messages.
- **Canvas bugs fixed**: say what the bug was, and who agreed it was one.
- **Drift resolved**: two copied screens disagreed; say which behaviour won.
- **New features** that only exist in the Code App.
- **Removed behaviour**: say why, and who agreed.
