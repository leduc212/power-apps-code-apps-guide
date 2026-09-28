/** Quote a CSV cell when it contains a comma, quote or line break. */
function cell(value: unknown): string {
  const text = value == null ? "" : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function toCsv(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n")
}

/** Hands a file to the browser. Works inside the Power Apps player. */
export function downloadFile(content: string, filename: string, type = "text/csv;charset=utf-8") {
  // The byte-order mark makes Excel read the file as UTF-8.
  const url = URL.createObjectURL(new Blob(["﻿", content], { type }))
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
