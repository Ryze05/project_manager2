import { MIN_GAP, positionBetween } from './position.js';

describe('positionBetween', () => {
  it('takes the middle between two cards', () => {
    expect(positionBetween(1, 2, 2)).toBe(1.5);
    expect(positionBetween(1, 4, 4)).toBe(2.5);
  });

  it('puts a card at the top, under the last one, or at the end of the column', () => {
    expect(positionBetween(null, 3, 5)).toBe(2); // above the first card
    expect(positionBetween(5, null, 5)).toBe(6); // below the last card
    expect(positionBetween(null, null, 5)).toBe(6); // no neighbours: the end
    expect(positionBetween(null, null, 0)).toBe(1); // empty column
  });

  it('asks for renumbering when the gap is too small to split, or the order is wrong', () => {
    expect(positionBetween(1, 1 + MIN_GAP, 2)).toBeNull();
    expect(positionBetween(2, 2, 2)).toBeNull();
    expect(positionBetween(3, 1, 3)).toBeNull(); // "above" is under "below"
  });

  it('still splits a gap that is just big enough', () => {
    const result = positionBetween(1, 1 + MIN_GAP * 4, 2) as number;
    expect(result).toBeGreaterThan(1);
    expect(result).toBeLessThan(1 + MIN_GAP * 4);
  });
});
