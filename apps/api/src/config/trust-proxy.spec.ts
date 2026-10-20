import { trustProxySetting } from './trust-proxy';

describe('trustProxySetting', () => {
  it('defaults to off and accepts an explicit hop count without blanket trust', () => {
    expect(trustProxySetting()).toBe(false);
    expect(trustProxySetting('false')).toBe(false);
    expect(trustProxySetting('1')).toBe(1);
    expect(trustProxySetting('2')).toBe(2);
    expect(trustProxySetting('true')).toBe(false);
    expect(trustProxySetting('0')).toBe(false);
  });
});
