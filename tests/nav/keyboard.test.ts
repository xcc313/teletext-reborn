// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import { attachKeyboard } from '../../src/nav';
import type { FastextColor } from '../../src/model';

// RED step (task 5.1): src/nav does not exist yet.
//
// Assumed API, exported from src/nav/index.ts:
//   attachKeyboard(target: EventTarget, controller: KeyboardTarget): () => void
//     KeyboardTarget = { pressKey(key): void; activateFastext(color): void; cancelEntry(): void }
//     - keydown digits 0-9           -> pressKey(digit)
//     - keydown r / g / y / c        -> activateFastext red / green / yellow / cyan (any case)
//     - keydown Escape / Backspace   -> cancelEntry()
//     - events with ctrl, meta or alt held are ignored
//     - returns a function that removes the listener
//
// Requirements: 2.1, 2.3, 2.4

function setup() {
  const controller = {
    pressKey: vi.fn<(key: string) => void>(),
    activateFastext: vi.fn<(color: FastextColor) => void>(),
    cancelEntry: vi.fn<() => void>(),
  };
  const detach = attachKeyboard(document, controller);
  return { controller, detach };
}

const press = (key: string, init: KeyboardEventInit = {}): void => {
  document.dispatchEvent(new KeyboardEvent('keydown', { key, ...init }));
};

describe('attachKeyboard', () => {
  it('forwards digit keys to the keypad', () => {
    const { controller, detach } = setup();
    press('3');
    press('0');
    expect(controller.pressKey.mock.calls).toEqual([['3'], ['0']]);
    detach();
  });

  it.each([
    ['r', 'red'],
    ['g', 'green'],
    ['y', 'yellow'],
    ['c', 'cyan'],
    ['R', 'red'],
  ] as const)('maps %s to the %s fastext link', (key, color) => {
    const { controller, detach } = setup();
    press(key);
    expect(controller.activateFastext).toHaveBeenCalledWith(color);
    detach();
  });

  it.each(['Escape', 'Backspace'])('cancels the entry on %s', (key) => {
    const { controller, detach } = setup();
    press(key);
    expect(controller.cancelEntry).toHaveBeenCalledTimes(1);
    detach();
  });

  it('ignores unrelated keys and modified key presses', () => {
    const { controller, detach } = setup();
    press('x');
    press('Enter');
    press('3', { ctrlKey: true });
    press('r', { metaKey: true });
    press('g', { altKey: true });
    expect(controller.pressKey).not.toHaveBeenCalled();
    expect(controller.activateFastext).not.toHaveBeenCalled();
    expect(controller.cancelEntry).not.toHaveBeenCalled();
    detach();
  });

  it('stops listening after detach', () => {
    const { controller, detach } = setup();
    detach();
    press('3');
    expect(controller.pressKey).not.toHaveBeenCalled();
  });
});
