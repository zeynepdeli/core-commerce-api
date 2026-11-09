import { BadRequestException } from '@nestjs/common';

import { assertSameIds } from './reorder.js';

describe('assertSameIds', () => {
  it('aynı küme farklı sırada → geçer', () => {
    expect(() => assertSameIds(['a', 'b', 'c'], ['c', 'a', 'b'])).not.toThrow();
  });

  it.each([
    [['a', 'b'], ['a']],
    [
      ['a', 'b'],
      ['a', 'b', 'c'],
    ],
    [
      ['a', 'b'],
      ['a', 'x'],
    ],
  ])('farklı küme reddedilir: %j ← %j', (existing, ids) => {
    expect(() => assertSameIds(existing, ids)).toThrow(BadRequestException);
  });
});
