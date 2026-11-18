const cell = (v: string | number) => {
  const s = String(v);
  // Spreadsheet formula guard plus RFC 4180 quoting.
  const safe = /^[=+\-@\t\r]/.test(s) && typeof v === "string" ? `'${s}` : s;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export const toCsv = (header: readonly string[], rows: readonly (readonly (string | number)[])[]): string =>
  [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");

/** Save text as a file through a temporary link. */
export const downloadText = (name: string, text: string, type = "text/csv;charset=utf-8") => {
  const url = URL.createObjectURL(new Blob([`﻿${text}`], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};
