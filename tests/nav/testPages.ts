import type { Cell, Color, FastextLink, Page, Row } from '../../src/model';

const COLS = 40;
const ROWS = 25;

const cell = (char = ' ', fg: Color = 'white'): Cell => ({ char, fg, bg: 'black' });

function textRow(text: string, fg: Color = 'white'): Row {
  const glyphs = Array.from(text);
  return Array.from({ length: COLS }, (_, i) => cell(glyphs[i] ?? ' ', fg));
}

/** Valid test page whose fastext links point at the given targets (red, green, yellow, cyan). */
export function makeTestPage(
  number: number,
  targets: [number, number, number, number] = [100, 101, 302, 888],
  stale = false,
): Page {
  const fastext: Page['fastext'] = [
    { label: 'INDEX', target: targets[0], color: 'red' },
    { label: 'NEWS', target: targets[1], color: 'green' },
    { label: 'WEATHER', target: targets[2], color: 'yellow' },
    { label: 'ABOUT', target: targets[3], color: 'cyan' },
  ];
  const rows: Row[] = [textRow(`P${number} TELETEXT REBORN 12:34${stale ? ' STALE' : ''}`, 'yellow')];
  for (let r = 1; r < ROWS - 1; r++) rows.push(textRow(r === 1 ? `CONTENT OF ${number}` : ''));
  const last = textRow('');
  fastext.forEach((link: FastextLink, idx) => {
    for (let j = 0; j < link.label.length; j++) {
      last[idx * 10 + j] = cell(link.label[j] ?? ' ', link.color);
    }
  });
  rows.push(last);
  return {
    number,
    service: 'TELETEXT REBORN',
    rows,
    fastext,
    stale,
    generatedAt: '2025-01-01T12:34:00.000Z',
  };
}

export const rowText = (page: Page, r: number): string =>
  (page.rows[r] ?? []).map((c) => c.char).join('');
