export function prefixMarkdownLines(content: string, start: number, end: number, prefix: string) {
  const lineStart = content.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
  const lastSelectedCharacter = end > start && content[end - 1] === "\n" ? end - 1 : end;
  const nextBreak = content.indexOf("\n", lastSelectedCharacter);
  const lineEnd = nextBreak === -1 ? content.length : nextBreak;
  const selectedLines = content.slice(lineStart, lineEnd);
  const formatted = selectedLines.split("\n").map((line) => `${prefix}${line}`).join("\n");
  const nextContent = `${content.slice(0, lineStart)}${formatted}${content.slice(lineEnd)}`;

  if (start === end) {
    const cursor = start + prefix.length;
    return { content: nextContent, selectionStart: cursor, selectionEnd: cursor };
  }

  return {
    content: nextContent,
    selectionStart: lineStart,
    selectionEnd: lineStart + formatted.length,
  };
}
