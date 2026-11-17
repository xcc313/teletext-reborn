export const PALETTE = [
  'black',
  'red',
  'green',
  'yellow',
  'blue',
  'magenta',
  'cyan',
  'white',
] as const;

export type Color = (typeof PALETTE)[number];

/** Fastext link colors, in required left-to-right order. */
export const FASTEXT_COLORS = ['red', 'green', 'yellow', 'cyan'] as const;

export type FastextColor = (typeof FASTEXT_COLORS)[number];

export const COLS = 40;
export const ROWS = 25;
export const MIN_PAGE = 100;
export const MAX_PAGE = 899;

/** One printable glyph with foreground and background color. */
export interface Cell {
  char: string;
  fg: Color;
  bg: Color;
}

/** Exactly 40 cells. */
export type Row = Cell[];

export interface FastextLink {
  label: string;
  target: number;
  color: FastextColor;
}

export interface Page {
  /** 100..899 */
  number: number;
  service: string;
  /** Exactly 25 rows; row 0 is the header, row 24 the fastext row. */
  rows: Row[];
  fastext: [FastextLink, FastextLink, FastextLink, FastextLink];
  stale: boolean;
  /** ISO timestamp */
  generatedAt: string;
}
