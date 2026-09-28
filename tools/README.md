# Tools

## `measure-canvas-app.mjs`

Turns an unpacked Canvas App into a migration inventory: screen sizes, control types, Power Fx function counts (with what each usually becomes in a Code App), flow calls, data sources, and pairs of screens that were probably copied. See [Chapter 10](../learnings/chapter-10-canvas-to-code.md).

Node 18 or later, no dependencies.

```bash
# A .msapp is a zip file. Unpack it first (tar ships with Windows 10+, macOS and Linux):
tar -xf MyApp.msapp -C MyApp-unpacked

node tools/measure-canvas-app.mjs MyApp-unpacked > inventory.md

# Compare two screens, ignoring control names: what's left is parameters and drift
node tools/measure-canvas-app.mjs MyApp-unpacked --diff ScreenA ScreenB
```

A solution export contains the `.msapp` under `CanvasApps/`. Unpack the solution zip, then the `.msapp`.

Try it on the included made-up app:

```bash
node tools/measure-canvas-app.mjs tools/sample-canvas-app
node tools/measure-canvas-app.mjs tools/sample-canvas-app --diff OpportunitiesNorth OpportunitiesSouth
```

The counts are a sizing aid, not a parser: they come from pattern matching on the YAML. `--diff` compares sets of lines, so a line that appears twice in one screen is only reported once; use a real diff tool for the final read.
