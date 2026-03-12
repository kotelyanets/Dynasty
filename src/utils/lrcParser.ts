/**
 * lrcParser.ts
 * ─────────────────────────────────────────────────────────────
 * Parses .lrc (synchronized lyric) files into a structured
 * array of timed lines for karaoke-style display.
 *
 * LRC format reference:
 *   [mm:ss.xx] Lyric text here
 *   [01:23.45] Another line
 */

export interface LyricLine {
  /** Time in seconds when this line should become active */
  time: number;
  /** The lyric text */
  text: string;
}

/**
 * Parse a raw LRC string into an array of LyricLine objects,
 * sorted by time ascending.
 */
export function parseLrc(raw: string): LyricLine[] {
  const lines: LyricLine[] = [];
  // Match [mm:ss.xx] or [mm:ss] timestamps
  const lineRegex = /^\[(\d{1,3}):(\d{2})(?:[.:]([\d]{1,3}))?\]\s*(.*)/;

  for (const rawLine of raw.split('\n')) {
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Handle multiple timestamps per line: [00:01.00][00:15.00] text
    const timestamps: number[] = [];
    let remaining = trimmed;
    const tsRegex = /^\[(\d{1,3}):(\d{2})(?:[.:]([\d]{1,3}))?\]/;

    let match = tsRegex.exec(remaining);
    while (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const centiseconds = match[3] ? parseInt(match[3].padEnd(3, '0').slice(0, 3), 10) : 0;
      timestamps.push(minutes * 60 + seconds + centiseconds / 1000);
      remaining = remaining.slice(match[0].length);
      match = tsRegex.exec(remaining);
    }

    const text = remaining.trim();
    // Skip metadata tags like [ti:Title], [ar:Artist], etc.
    if (timestamps.length === 0) {
      // Try the single-line regex in case we missed something
      const singleMatch = lineRegex.exec(trimmed);
      if (singleMatch) {
        const minutes = parseInt(singleMatch[1], 10);
        const seconds = parseInt(singleMatch[2], 10);
        const centiseconds = singleMatch[3] ? parseInt(singleMatch[3].padEnd(3, '0').slice(0, 3), 10) : 0;
        lines.push({
          time: minutes * 60 + seconds + centiseconds / 1000,
          text: singleMatch[4] || '',
        });
      }
      continue;
    }

    for (const time of timestamps) {
      lines.push({ time, text });
    }
  }

  return lines.sort((a, b) => a.time - b.time);
}
