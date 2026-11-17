import { COLS, ROWS } from '../model';
import type { Cell, Color, FastextLink, Page, Row } from '../model';
import { typeset } from './typeset';

export const DEFAULT_SERVICE = 'TELETEXT REBORN';

/** Fastext links shared by the generated pages: red, green, yellow, cyan. */
export const DEFAULT_FASTEXT: Page['fastext'] = [
  { label: 'INDEX', target: 100, color: 'red' },
  { label: 'NEWS', target: 101, color: 'green' },
  { label: 'WEATHER', target: 302, color: 'yellow' },
  { label: 'ABOUT', target: 888, color: 'cyan' },
];

/** Rows 1..23. */
export const CONTENT_ROWS = ROWS - 2;

const STALE_MARKER = 'STALE';

/** Width of the slot each fastext label starts in (also the click target width in the UI). */
export const FASTEXT_SLOT = 10;

const CONTROL_CHAR = /\p{Cc}/u;

export interface BodyLine {
  text: string;
  /** Default white. */
  fg?: Color;
  /** Default black; fills the whole row. */
  bg?: Color;
}

export interface BuildPageOptions {
  /** 100..899 */
  number: number;
  now: Date;
  /** Content for rows 1..23; extra lines are dropped. */
  body: readonly BodyLine[];
  service?: string;
  stale?: boolean;
  fastext?: Page['fastext'];
}

/** Typesets text and styles each resulting line (all at most 40 columns). */
export function styledLines(text: string, fg: Color = 'white', bg: Color = 'black'): BodyLine[] {
  return typeset(text).map((line) => ({ text: line, fg, bg }));
}

function textRow(text: string, fg: Color, bg: Color): Row {
  const glyphs = Array.from(text).map((g) => (CONTROL_CHAR.test(g) ? ' ' : g));
  return Array.from({ length: COLS }, (_, i): Cell => ({ char: glyphs[i] ?? ' ', fg, bg }));
}

function clock(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** Writes " STALE" right after the last header glyph (cells beyond column 40 are dropped). */
function writeStaleMarker(header: Row): Row {
  let used = header.length;
  while (used > 0 && header[used - 1]?.char === ' ') used--;
  Array.from(` ${STALE_MARKER}`).forEach((char, i) => {
    if (used + i < COLS) header[used + i] = { char, fg: 'red', bg: 'black' };
  });
  return header;
}

function fastextRow(links: readonly FastextLink[]): Row {
  const row = textRow('', 'white', 'black');
  links.forEach((link, slot) => {
    Array.from(link.label).forEach((char, i) => {
      row[slot * FASTEXT_SLOT + i] = { char, fg: link.color, bg: 'black' };
    });
  });
  return row;
}

/**
 * Assembles a full 40x25 page: header `P{number} {service} {HH:MM}` (plus a
 * STALE marker when stale), body in rows 1..23, fastext row 24. Pure.
 * Callers pass already-typeset body lines (see styledLines).
 */
export function buildPage(options: BuildPageOptions): Page {
  const {
    number,
    now,
    body,
    service = DEFAULT_SERVICE,
    stale = false,
    fastext = DEFAULT_FASTEXT,
  } = options;

  let header = textRow(`P${number} ${service} ${clock(now)}`, 'yellow', 'black');
  if (stale) header = writeStaleMarker(header);

  const rows: Row[] = [header];
  for (let r = 0; r < CONTENT_ROWS; r++) {
    const line = body[r];
    rows.push(
      line === undefined
        ? textRow('', 'white', 'black')
        : textRow(line.text, line.fg ?? 'white', line.bg ?? 'black'),
    );
  }
  rows.push(fastextRow(fastext));

  return {
    number,
    service,
    rows,
    fastext: [...fastext],
    stale,
    generatedAt: now.toISOString(),
  };
}

/**
 * Returns a copy of the page flagged stale with a STALE marker appended to the
 * header. The input is not modified; an already stale page is returned as is.
 */
export function markStale(page: Page): Page {
  if (page.stale) return page;
  const header = writeStaleMarker((page.rows[0] ?? []).map((cell): Cell => ({ ...cell })));
  return { ...page, stale: true, rows: [header, ...page.rows.slice(1)] };
}
