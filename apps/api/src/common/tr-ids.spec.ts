import { isValidTckn, isValidVkn } from './tr-ids.js';

describe('TCKN / VKN', () => {
  it('TCKN algoritması', () => {
    expect(isValidTckn('10000000146')).toBe(true);
    expect(isValidTckn('10000000147')).toBe(false);
    expect(isValidTckn('01234567890')).toBe(false);
    expect(isValidTckn('1234')).toBe(false);
  });
  it('VKN algoritması', () => {
    expect(isValidVkn('1234567890')).toBe(true);
    expect(isValidVkn('1234567891')).toBe(false);
    expect(isValidVkn('123')).toBe(false);
  });
});
