import { describe, it, expect } from 'vitest';
import { isScrollBox, boxAbsorbsDrag, shouldBlockPageDrag } from '../../src/systems/scrollLock.js';

/** A vertical scroller with `over` px of hidden content, parked at `top`. */
const vbox = (top, over = 200, overflowY = 'auto') => ({
  overflowX: 'hidden', overflowY,
  scrollLeft: 0, scrollTop: top,
  scrollWidth: 300, scrollHeight: 500 + over, clientWidth: 300, clientHeight: 500,
});
/** A horizontal scroller (the touch skill-bar strip) parked at `left`. */
const hbox = (left, over = 120) => ({
  overflowX: 'auto', overflowY: 'hidden',
  scrollLeft: left, scrollTop: 0,
  scrollWidth: 400 + over, scrollHeight: 60, clientWidth: 400, clientHeight: 60,
});

describe('isScrollBox', () => {
  it('accepts an auto/scroll box with content to spare', () => {
    expect(isScrollBox(vbox(0))).toBe(true);
    expect(isScrollBox(vbox(0, 200, 'scroll'))).toBe(true);
    expect(isScrollBox(hbox(0))).toBe(true);
  });
  it('rejects a box whose content fits — nothing to scroll', () => {
    expect(isScrollBox(vbox(0, 0))).toBe(false);
    expect(isScrollBox(vbox(0, 1))).toBe(false);   // sub-pixel slack doesn't count
  });
  it('rejects hidden/visible overflow — a finger cannot scroll those', () => {
    expect(isScrollBox(vbox(0, 200, 'hidden'))).toBe(false);
    expect(isScrollBox(vbox(0, 200, 'visible'))).toBe(false);
    expect(isScrollBox(vbox(0, 200, 'clip'))).toBe(false);
  });
  it('honours an axis filter', () => {
    expect(isScrollBox(vbox(0), 'y')).toBe(true);
    expect(isScrollBox(vbox(0), 'x')).toBe(false);
    expect(isScrollBox(hbox(0), 'x')).toBe(true);
    expect(isScrollBox(hbox(0), 'y')).toBe(false);
  });
  it('is false for a missing box', () => {
    expect(isScrollBox(null)).toBe(false);
    expect(isScrollBox(undefined, 'y')).toBe(false);
  });
});

describe('boxAbsorbsDrag', () => {
  it('absorbs a drag with room left in that direction', () => {
    expect(boxAbsorbsDrag(vbox(100), 0, -30)).toBe(true);   // finger up → scroll down
    expect(boxAbsorbsDrag(vbox(100), 0, 30)).toBe(true);    // finger down → scroll up
  });
  it('refuses at the top edge when the finger pulls further down', () => {
    expect(boxAbsorbsDrag(vbox(0), 0, 30)).toBe(false);     // would chain to the page
    expect(boxAbsorbsDrag(vbox(0), 0, -30)).toBe(true);     // the other way still scrolls
  });
  it('refuses at the bottom edge when the finger pushes further up', () => {
    expect(boxAbsorbsDrag(vbox(200), 0, -30)).toBe(false);
    expect(boxAbsorbsDrag(vbox(200), 0, 30)).toBe(true);
  });
  it('handles the horizontal axis the same way', () => {
    expect(boxAbsorbsDrag(hbox(60), -30, 0)).toBe(true);
    expect(boxAbsorbsDrag(hbox(0), 30, 0)).toBe(false);
    expect(boxAbsorbsDrag(hbox(120), -30, 0)).toBe(false);
    expect(boxAbsorbsDrag(hbox(120), 30, 0)).toBe(true);
  });
  it('refuses a drag with no movement on the axis it could scroll', () => {
    expect(boxAbsorbsDrag(vbox(100), -30, 0)).toBe(false);
    expect(boxAbsorbsDrag(vbox(100), 0, 0)).toBe(false);
  });
  it('refuses a non-scroller and a missing box', () => {
    expect(boxAbsorbsDrag(vbox(0, 0), 0, -30)).toBe(false);
    expect(boxAbsorbsDrag(null, 0, -30)).toBe(false);
  });
});

describe('shouldBlockPageDrag', () => {
  it('blocks a drag over the map — no scrollable ancestor at all', () => {
    expect(shouldBlockPageDrag([], 0, 40)).toBe(true);
    expect(shouldBlockPageDrag([], 0, -40)).toBe(true);
    expect(shouldBlockPageDrag(null, 0, -40)).toBe(true);
  });
  it('lets a live scroller keep its drag', () => {
    expect(shouldBlockPageDrag([vbox(100)], 0, -40)).toBe(false);
  });
  it('blocks the overscroll past a scroller\'s edge so it never chains to the page', () => {
    expect(shouldBlockPageDrag([vbox(0)], 0, 40)).toBe(true);
    expect(shouldBlockPageDrag([vbox(200)], 0, -40)).toBe(true);
  });
  it('falls through an exhausted inner scroller to an outer one that can still move', () => {
    expect(shouldBlockPageDrag([vbox(0), vbox(100)], 0, 40)).toBe(false);
    expect(shouldBlockPageDrag([vbox(0), vbox(0)], 0, 40)).toBe(true);
  });
  it('picks whichever axis the ancestor scrolls on', () => {
    expect(shouldBlockPageDrag([hbox(60)], -40, 0)).toBe(false);
    expect(shouldBlockPageDrag([hbox(60)], 0, -40)).toBe(true);
  });
});
