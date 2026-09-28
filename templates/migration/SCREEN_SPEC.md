# Screen Spec: <ScreenName>

> **Source:** `<ScreenName>.pa.yaml` from solution export `<solution>_<version>`.
> **Extracted by:** <who or which agent> · **Confirmed by:** <person> on <date>
>
> This spec is the acceptance contract for the screen. It captures every behaviour of the Canvas screen, so nothing is dropped in translation. Write it before any code, and get it confirmed by someone who knows how the screen is used.

## 1. Purpose and entry

- What the screen is for, and who uses it (roles).
- How users get here (navigation, deep link, parameters).

## 2. Data

| Source | Read / write | Columns | Filter / sort | Notes |
|---|---|---|---|---|
| `<table>` | read | | | |

Flows and connectors called:

| Flow / connector | When | Inputs | Outputs used | Failure handling in Canvas |
|---|---|---|---|---|
| | | | | |

## 3. State

| Canvas | Kind | Becomes |
|---|---|---|
| `gblSomething` | `Set` (global) | store field |
| `locSomething` | `UpdateContext` (screen) | component state |
| `colSomething` | `Collect` / `ClearCollect` | query key |

## 4. Controls and behaviour

| Control | Event / property | Power Fx behaviour | Target implementation |
|---|---|---|---|
| `btnSave` | OnSelect | validate → Patch → notify → navigate | |

## 5. Business rules (must be exact)

- Validation: required fields, formats, cross-field rules, and the exact messages.
- Calculations and derived values.
- Conditional visibility and disabled states, with the exact conditions.
- Formatting: dates, numbers, currency, labels.
- Edge cases: blanks, duplicates, missing related records.

## 6. Logic that isn't on this screen

- Anything a flow is assumed to do that the screen actually does (or the reverse). Check the flow definitions in the export.

## 7. Parity checklist

Run against the live Canvas app with the same records.

- [ ] Field-by-field values match for <known record>
- [ ] Each action produces the same data result
- [ ] Validation messages match
- [ ] Role gating matches
- [ ] Every intentional difference is in `DIFFERENCES.md`

## 8. Tests

- Pure functions to extract and unit-test (validators, calculations, mappers).

## 9. Open questions

- Anything ambiguous in the YAML, with who can answer it.
