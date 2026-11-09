import { describe, expect, it } from 'vitest';

import { maskName } from './reviews.service.js';

describe('maskName', () => {
  it('soyadın yalnızca baş harfi', () => {
    expect(maskName('Ayşe Nur Yılmaz')).toBe('Ayşe Y.');
    expect(maskName('ali şahin')).toBe('ali Ş.');
    expect(maskName('Cem')).toBe('Cem');
    expect(maskName('   ')).toBe('Müşteri');
  });
});
