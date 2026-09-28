#!/usr/bin/env node
/**
 * measure-canvas-app: turns an unpacked Canvas App into a migration inventory.
 *
 * Usage:
 *   node tools/measure-canvas-app.mjs <unpacked-msapp-folder> [> inventory.md]
 *   node tools/measure-canvas-app.mjs <unpacked-msapp-folder> --diff <ScreenA> <ScreenB>
 *
 * --diff prints the lines that differ between two screens once control names are
 * ignored: for a copied screen, those lines are the parameters (and any drift).
 *
 * Unpack first. A .msapp is a zip file:
 *   tar -xf MyApp.msapp -C MyApp-unpacked        (Windows 10+, macOS, Linux)
 * If you have a solution export, the .msapp is inside it under CanvasApps/.
 *
 * Reads Src/**\/*.pa.yaml and References/DataSources.json. No dependencies.
 * The output is Markdown: screen sizes, control types, Power Fx function
 * counts, data sources, and pairs of screens that are near-duplicates.
 */
import { readdirSync, readFileSync, existsSync, statSync } from "node:fs"
import { basename, join, relative } from "node:path"

const root = process.argv[2]
if (!root || !existsSync(join(root, "Src"))) {
  console.error("Usage: node tools/measure-canvas-app.mjs <unpacked-msapp-folder>")
  console.error("The folder must contain Src/ (the .pa.yaml sources). Unpack the .msapp first: tar -xf MyApp.msapp -C MyApp-unpacked")
  process.exit(1)
}

// Power Fx functions worth counting, with what each usually becomes in a Code App.
const FUNCTIONS = {
  If: "if / ternary",
  Switch: "switch / lookup map",
  Filter: "getAll({ filter }) (server) or Array.filter (small, complete lists only)",
  LookUp: "get(id) / getAll({ filter, top: 1 }); in a gallery, one batched fetchByIds",
  Search: "getAll({ filter: contains(...) }) with a debounced input",
  Sort: "getAll({ orderBy })",
  SortByColumns: "getAll({ orderBy })",
  FirstN: "paging (maxPageSize + skipToken)",
  LastN: "paging (maxPageSize + skipToken)",
  Patch: "create / update (send only changed fields)",
  Remove: "delete",
  RemoveIf: "query ids, then delete each (or a custom API)",
  Collect: "TanStack Query cache / local state",
  ClearCollect: "useQuery (the query key replaces the collection)",
  ForAll: "Array.map / Promise.all",
  Set: "global store (Zustand) or context",
  UpdateContext: "component state (useState / useReducer)",
  Navigate: "navigate('/route')",
  Concurrent: "Promise.all",
  Notify: "toast",
  Reset: "reset form state",
  Refresh: "queryClient.invalidateQueries",
  Launch: "window.open / deep link",
  Download: "file download helper",
  IfError: "try / catch, and unwrap() on every service call",
}

const FLOW_CALL = /\b([A-Za-z_][\w]*|'[^']+'|\[[^\]]+\])\.Run\s*\(/g

/** Every *.pa.yaml under a folder, except Studio's editor state. */
function yamlFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...yamlFiles(full))
    else if (name.endsWith(".pa.yaml") && !name.startsWith("_")) out.push(full)
  }
  return out
}

function countMatches(text, regex) {
  return (text.match(regex) ?? []).length
}

const files = yamlFiles(join(root, "Src")).map((path) => {
  const text = readFileSync(path, "utf-8")
  const lines = text.split(/\r?\n/)
  const controls = {}
  for (const line of lines) {
    const m = line.match(/^\s*Control:\s*([\w./]+?)(?:@[\w.]+)?\s*$/)
    if (m) controls[m[1]] = (controls[m[1]] ?? 0) + 1
  }
  const functions = {}
  for (const fn of Object.keys(FUNCTIONS)) {
    const n = countMatches(text, new RegExp(`(?<![\\w.])${fn}\\s*\\(`, "g"))
    if (n) functions[fn] = n
  }
  const flows = {}
  for (const m of text.matchAll(FLOW_CALL)) flows[m[1]] = (flows[m[1]] ?? 0) + 1

  // For duplicate detection. Copied screens rename every control (txtSearch -> txtSearch_2,
  // txtSearch_US), so formulas that are identical in logic differ in text. Replace this file's
  // own control and screen names with a placeholder before comparing.
  const names = new Set()
  for (const line of lines) {
    const m = line.match(/^\s*-?\s*([A-Za-z_][\w]*):\s*$/)
    if (m && !["Screens", "Properties", "Children", "ComponentDefinitions", "CustomProperties"].includes(m[1])) names.add(m[1])
  }
  const nameRegex = names.size
    ? new RegExp(`\\b(?:${[...names].sort((a, b) => b.length - a.length).join("|")})\\b`, "g")
    : null
  const body = new Set(
    lines
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => (nameRegex ? l.replace(nameRegex, "<name>") : l)),
  )

  return {
    path,
    name: basename(path, ".pa.yaml"),
    kind: relative(join(root, "Src"), path).includes("Components") ? "component" : basename(path) === "App.pa.yaml" ? "app" : "screen",
    lines: lines.length,
    controls,
    controlCount: Object.values(controls).reduce((a, b) => a + b, 0),
    functions,
    flows,
    body,
  }
})

const diffIndex = process.argv.indexOf("--diff")
if (diffIndex > 0) {
  const [nameA, nameB] = process.argv.slice(diffIndex + 1, diffIndex + 3)
  const [a, b] = [nameA, nameB].map((n) => files.find((f) => f.name === n))
  if (!a || !b) {
    console.error(`--diff needs two screen names. Available: ${files.map((f) => f.name).join(", ")}`)
    process.exit(1)
  }
  const onlyIn = (x, y) => [...x.body].filter((line) => !y.body.has(line))
  console.log(`# ${a.name} vs ${b.name}\n\nControl names are shown as <name>. Every remaining difference is either a parameter or drift.\n`)
  console.log(`## Only in ${a.name}\n\n\`\`\`\n${onlyIn(a, b).join("\n")}\n\`\`\`\n`)
  console.log(`## Only in ${b.name}\n\n\`\`\`\n${onlyIn(b, a).join("\n")}\n\`\`\``)
  process.exit(0)
}

const sum = (xs, f) => xs.reduce((a, x) => a + f(x), 0)
const merge = (objs) => {
  const out = {}
  for (const o of objs) for (const [k, v] of Object.entries(o)) out[k] = (out[k] ?? 0) + v
  return Object.entries(out).sort((a, b) => b[1] - a[1])
}
const fmt = (n) => n.toLocaleString("en-US")

const report = []
const h = (s) => report.push("", s, "")

report.push(`# Canvas App inventory: ${basename(root)}`)
report.push("", `Generated by \`tools/measure-canvas-app.mjs\` on ${new Date().toISOString().slice(0, 10)}.`)

h("## Screens and components")
report.push("| File | Kind | YAML lines | Controls |", "|---|---|---|---|")
for (const f of [...files].sort((a, b) => b.lines - a.lines)) {
  report.push(`| ${f.name} | ${f.kind} | ${fmt(f.lines)} | ${fmt(f.controlCount)} |`)
}
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`
report.push(`| **Total** | ${plural(files.filter((f) => f.kind === "screen").length, "screen")}, ${plural(files.filter((f) => f.kind === "component").length, "component")} | **${fmt(sum(files, (f) => f.lines))}** | **${fmt(sum(files, (f) => f.controlCount))}** |`)

h("## Control types")
report.push("Every control is rebuilt in the Code App. Pick one component-library equivalent per type; `Classic/...` are the legacy controls.", "")
report.push("| Control | Count |", "|---|---|")
for (const [k, v] of merge(files.map((f) => f.controls))) report.push(`| ${k} | ${fmt(v)} |`)

h("## Power Fx functions")
report.push("| Function | Count | Usually becomes |", "|---|---|---|")
for (const [k, v] of merge(files.map((f) => f.functions))) report.push(`| \`${k}\` | ${fmt(v)} | ${FUNCTIONS[k]} |`)

const flowCalls = merge(files.map((f) => f.flows))
h("## Flow calls (`.Run(`)")
if (!flowCalls.length) report.push("None found.")
else {
  report.push("Each becomes a generated service (`pa app add flow`). See Chapter 8.", "")
  report.push("| Flow | Calls |", "|---|---|")
  for (const [k, v] of flowCalls) report.push(`| ${k} | ${v} |`)
}

h("## Data sources")
const dsPath = join(root, "References", "DataSources.json")
if (!existsSync(dsPath)) report.push("`References/DataSources.json` not found.")
else {
  const sources = JSON.parse(readFileSync(dsPath, "utf-8")).DataSources ?? []
  const names = (type) => [...new Set(sources.filter((s) => s.Type === type).map((s) => s.Name))].sort()
  const tables = names("NativeCDSDataSourceInfo")
  const services = names("ServiceInfo")
  report.push(`**Dataverse tables (${tables.length})**, each one \`pa app add data-source --connector dataverse --table <logical-name>\`:`, "")
  report.push(tables.length ? tables.map((t) => `- ${t}`).join("\n") : "- none")
  report.push("", `**Connectors and flows (${services.length})**, each one \`pa app add data-source\` or \`pa app add flow\`:`, "")
  report.push(services.length ? services.map((t) => `- ${t}`).join("\n") : "- none")
  const other = {}
  for (const s of sources) if (s.Type !== "NativeCDSDataSourceInfo" && s.Type !== "ServiceInfo") other[s.Type] = (other[s.Type] ?? 0) + 1
  if (Object.keys(other).length) {
    report.push("", `Also listed (metadata the Code App gets from generated models, no action needed): ${Object.entries(other).map(([t, n]) => `${t} ${n}`).join(", ")}.`)
  }
}

h("## Near-duplicate screens")
const screens = files.filter((f) => f.kind === "screen" && f.lines > 50)
const pairs = []
for (let i = 0; i < screens.length; i++) {
  for (let j = i + 1; j < screens.length; j++) {
    const [a, b] = [screens[i].body, screens[j].body]
    let shared = 0
    for (const line of a) if (b.has(line)) shared++
    const similarity = shared / Math.max(a.size, b.size)
    if (similarity >= 0.7) pairs.push([screens[i].name, screens[j].name, similarity])
  }
}
if (!pairs.length) report.push("No pair of screens shares 70% or more of its lines.")
else {
  report.push("Screens that share most of their lines were probably copied. Build them once, parameterised; the differing lines are the parameters.", "")
  report.push("| Screen | Screen | Shared lines |", "|---|---|---|")
  for (const [a, b, s] of pairs.sort((x, y) => y[2] - x[2])) report.push(`| ${a} | ${b} | ${Math.round(s * 100)}% |`)
}

console.log(report.join("\n"))
