/**
 * @format
 */

import fillNumberLength from '../utils/fillNumberLength';

// Rendering the whole <App /> needs every native module (Firebase, IAP,
// notifications, ...) mocked, so this suite sticks to pure helpers.
describe('fillNumberLength', () => {
  it('strips non-digits and pads with asterisks', () => {
    expect(fillNumberLength('12-3', 6)).toBe('123***');
  });

  it('trims input longer than the target length', () => {
    expect(fillNumberLength('1234567890', 4)).toBe('1234');
  });
});
