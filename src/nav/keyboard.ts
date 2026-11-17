import type { FastextColor } from '../model';

export interface KeyboardTarget {
  pressKey(key: string): void;
  activateFastext(color: FastextColor): void;
  cancelEntry(): void;
}

const FASTEXT_KEYS = new Map<string, FastextColor>([
  ['r', 'red'],
  ['g', 'green'],
  ['y', 'yellow'],
  ['c', 'cyan'],
]);

/**
 * Wires keydown events to the navigation controller: digits type a page number,
 * r/g/y/c activate the red/green/yellow/cyan fastext links, Escape/Backspace cancel
 * a partial entry. Returns a function that removes the listener.
 */
export function attachKeyboard(target: EventTarget, controller: KeyboardTarget): () => void {
  const onKeyDown = (event: Event): void => {
    if (!(event instanceof KeyboardEvent)) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const { key } = event;
    const color = FASTEXT_KEYS.get(key.toLowerCase());
    if (/^\d$/.test(key)) {
      controller.pressKey(key);
    } else if (color) {
      controller.activateFastext(color);
    } else if (key === 'Escape' || key === 'Backspace') {
      controller.cancelEntry();
    }
  };

  target.addEventListener('keydown', onKeyDown);
  return () => target.removeEventListener('keydown', onKeyDown);
}
