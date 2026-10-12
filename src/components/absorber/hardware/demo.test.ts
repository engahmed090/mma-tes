import { expect, it } from 'vitest';
import { advanceDemo, classification, demoState, DURATION, type Sample } from './demo';
it('advances through the workflow and holds the result until reset', () => {
  expect([0, 2, 4, 6, 9, 12, 14, 16].map(t => demoState(t).step)).toEqual([0,1,1,2,2,3,3,4]);
  expect(advanceDemo(17.9, 1)).toEqual({time:DURATION, playing:false});
  expect(demoState(DURATION).step).toBe(4);
  expect(demoState(0).step).toBe(0);
});
it.each<Sample>(['Reference','Healthy','Research','JuiceReference','JuiceElevated'])('keeps %s display and selected result synchronized', sample => {
  for (const portable of [false,true]) {
    const state = demoState(DURATION, portable, sample);
    expect(state.result).toBe(classification(sample));
    expect(state.screen).toContain(classification(sample));
    expect(JSON.stringify(state)).not.toMatch(/\d+\s*(%|ppm)/);
  }
});
