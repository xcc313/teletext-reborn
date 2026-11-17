import { COLS, ROWS } from '../model';
import type { Cell, Color, FastextLink, Page, Row } from '../model';
import { DEFAULT_FASTEXT, DEFAULT_SERVICE } from '../pipeline/buildPage';
import { typeset } from '../pipeline/typeset';

/** Width of the slot each fastext label starts in. */
const FASTEXT_SLOT = 10;

function textRow(text: string, fg: Color, bg: Color = 'black'): Row {
  const glyphs = Array.from(text);
  return Array.from({ length: COLS }, (_, i): Cell => ({
    char: glyphs[i] ?? ' ',
    fg,
    bg,
  }));
}

function fastextRow(links: readonly FastextLink[]): Row {
  const row = textRow('', 'white');
  links.forEach((link, slot) => {
    Array.from(link.label).forEach((char, i) => {
      row[slot * FASTEXT_SLOT + i] = { char, fg: link.color, bg: 'black' };
    });
  });
  return row;
}

function clock(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/**
 * Builds the teletext-styled "page not found" page for a requested number.
 * Pure; the result passes validatePage.
 */
export function createNotFoundPage(
  number: number,
  now: Date,
  service: string = DEFAULT_SERVICE,
): Page {
  const body = [
    ...typeset(`PAGE NOT FOUND`).map((line) => textRow(line, 'white', 'red')),
    textRow('', 'white'),
    ...typeset(`PAGE ${number} IS NOT ON AIR.`).map((line) => textRow(line, 'yellow')),
    textRow('', 'white'),
    ...typeset('ENTER A PAGE NUMBER FROM 100 TO 899 OR USE THE COLOUR KEYS.').map((line) =>
      textRow(line, 'white'),
    ),
  ];

  const rows: Row[] = [textRow(`P${number} ${service} ${clock(now)}`, 'yellow')];
  for (let r = 1; r < ROWS - 1; r++) rows.push(body[r - 1] ?? textRow('', 'white'));
  rows.push(fastextRow(DEFAULT_FASTEXT));

  return {
    number,
    service,
    rows,
    fastext: [...DEFAULT_FASTEXT],
    stale: false,
    generatedAt: now.toISOString(),
  };
}
