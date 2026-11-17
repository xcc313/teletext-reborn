import { COLS } from '../model';

const HIGH_SURROGATE = /[\uD800-\uDBFF]$/;

/** Cuts a word to at most COLS UTF-16 units without leaving half of a surrogate pair. */
function truncateWord(word: string): string {
  const cut = word.slice(0, COLS);
  return HIGH_SURROGATE.test(cut) ? cut.slice(0, -1) : cut;
}

function wrapParagraph(paragraph: string): string[] {
  const words = paragraph.split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return [''];

  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > COLS) {
      if (current !== '') lines.push(current);
      lines.push(truncateWord(word));
      current = '';
    } else if (current === '') {
      current = word;
    } else if (current.length + 1 + word.length <= COLS) {
      current += ` ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current !== '') lines.push(current);
  return lines;
}

/**
 * Turns arbitrary text into teletext lines of at most COLS (40) characters.
 * Splits on \n or \r\n, wraps greedily at spaces, truncates words longer than
 * COLS onto their own line, and keeps blank input lines as ''.
 */
export function typeset(text: string): string[] {
  if (text === '') return [];
  return text.split(/\r?\n/).flatMap(wrapParagraph);
}
