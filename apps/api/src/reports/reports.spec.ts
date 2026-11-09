import { describe, expect, it } from 'vitest';

import { csvCell } from './reports.service.js';

describe('csvCell', () => {
  it('formül enjeksiyonunu etkisizleştirir', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+90 532')).toBe("'+90 532");
    expect(csvCell('-5')).toBe("'-5");
    expect(csvCell('@cmd')).toBe("'@cmd");
  });
  it('ayraç, tırnak ve satır sonunu kaçışlar', () => {
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('a "b"')).toBe('"a ""b"""');
    expect(csvCell('a\nb')).toBe('"a\nb"');
  });
  it('boş değerler', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell('249,90')).toBe('249,90');
  });
});
