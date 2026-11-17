// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';

// Guards the per-file DOM environment used by the renderer tests (task 4.1).
// If this fails, renderer test failures are an environment problem, not a missing renderer.

describe('happy-dom test environment', () => {
  it('provides document and window', () => {
    expect(typeof document).toBe('object');
    expect(typeof window).toBe('object');
  });

  it('builds, queries, and reads back elements', () => {
    const root = document.createElement('div');
    const cell = document.createElement('span');
    cell.className = 'probe';
    cell.dataset['fg'] = 'red';
    cell.textContent = 'X';
    root.append(cell);
    document.body.append(root);

    const found = document.querySelector<HTMLElement>('.probe[data-fg="red"]');
    expect(found?.textContent).toBe('X');
    root.remove();
  });
});
