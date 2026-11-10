/** A code group for the Markdown body: fences next to each other with the same `group=` name show as one block with a tab per language. */
export function codeGroupSnippet(name: string, langs: readonly string[] = ["javascript", "python"]): string {
  return `${langs.map((l) => `\`\`\`${l} group=${name}\n\n\`\`\``).join("\n\n")}\n`;
}

/** Puts a code group into `body` at `at`: on a line of its own, with a blank line before it. Returns the new text and where the caret goes (inside the first block). */
export function insertCodeGroup(body: string, at: number, name: string): { body: string; caret: number } {
  const head = body.slice(0, at);
  const lead = head === "" ? "" : head.endsWith("\n\n") ? "" : head.endsWith("\n") ? "\n" : "\n\n";
  const snippet = codeGroupSnippet(name);
  const tail = body.slice(at);
  const gap = tail === "" || tail.startsWith("\n") ? "" : "\n";
  const first = snippet.indexOf("\n") + 1;
  return { body: head + lead + snippet + gap + tail, caret: head.length + lead.length + first };
}
