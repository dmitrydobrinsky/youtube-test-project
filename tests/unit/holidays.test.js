import { describe, it, expect } from 'vitest';
import { countWorkingDays, quarterToDateRange, clampDate, countryToCode } from '../../js/utils/holidays.js';

describe('countWorkingDays', () => {
  it('counts Mon–Fri in a standard week', () => {
    // 2026-03-09 (Mon) to 2026-03-13 (Fri)
    expect(countWorkingDays('2026-03-09', '2026-03-13')).toBe(5);
  });

  it('excludes Saturday and Sunday by default', () => {
    // 2026-03-09 (Mon) to 2026-03-15 (Sun) = 5 working days
    expect(countWorkingDays('2026-03-09', '2026-03-15')).toBe(5);
  });

  it('counts two full weeks correctly', () => {
    // 2026-03-09 (Mon) to 2026-03-20 (Fri) = 10 working days
    expect(countWorkingDays('2026-03-09', '2026-03-20')).toBe(10);
  });

  it('deducts holidays', () => {
    const holidays = new Set(['2026-03-11', '2026-03-12']);
    expect(countWorkingDays('2026-03-09', '2026-03-13', new Set([1,2,3,4,5]), holidays)).toBe(3);
  });

  it('returns 1 for same-day (working day)', () => {
    expect(countWorkingDays('2026-03-09', '2026-03-09')).toBe(1);
  });

  it('returns 0 for same-day on weekend', () => {
    // 2026-03-07 is a Saturday
    expect(countWorkingDays('2026-03-07', '2026-03-07')).toBe(0);
  });

  it('uses Sun–Thu for Israeli work week', () => {
    const israelDays = new Set([0, 1, 2, 3, 4]); // Sun–Thu
    // 2026-03-08 (Sun) to 2026-03-12 (Thu) = 5 working days
    expect(countWorkingDays('2026-03-08', '2026-03-12', israelDays)).toBe(5);
    // Friday and Saturday should not count
    expect(countWorkingDays('2026-03-13', '2026-03-14', israelDays)).toBe(0);
  });

  it('accepts Date objects as well as strings', () => {
    const start = new Date('2026-03-09T00:00:00Z');
    const end   = new Date('2026-03-13T00:00:00Z');
    expect(countWorkingDays(start, end)).toBe(5);
  });
});

describe('quarterToDateRange', () => {
  it('parses Q1 correctly', () => {
    const r = quarterToDateRange('Q1 2026');
    expect(r.start.toISOString().slice(0, 10)).toBe('2026-01-01');
    expect(r.end.toISOString().slice(0, 10)).toBe('2026-03-31');
  });

  it('parses Q2 correctly', () => {
    const r = quarterToDateRange('Q2 2026');
    expect(r.start.toISOString().slice(0, 10)).toBe('2026-04-01');
    expect(r.end.toISOString().slice(0, 10)).toBe('2026-06-30');
  });

  it('parses Q3 correctly', () => {
    const r = quarterToDateRange('Q3 2026');
    expect(r.start.toISOString().slice(0, 10)).toBe('2026-07-01');
    expect(r.end.toISOString().slice(0, 10)).toBe('2026-09-30');
  });

  it('parses Q4 correctly', () => {
    const r = quarterToDateRange('Q4 2026');
    expect(r.start.toISOString().slice(0, 10)).toBe('2026-10-01');
    expect(r.end.toISOString().slice(0, 10)).toBe('2026-12-31');
  });

  it('returns null for invalid input', () => {
    expect(quarterToDateRange('')).toBeNull();
    expect(quarterToDateRange('invalid')).toBeNull();
    expect(quarterToDateRange(null)).toBeNull();
  });
});

describe('clampDate', () => {
  it('returns date unchanged when within range', () => {
    expect(clampDate('2026-03-10', '2026-01-01', '2026-12-31')).toBe('2026-03-10');
  });

  it('clamps to start when before range', () => {
    expect(clampDate('2025-12-31', '2026-01-01', '2026-12-31')).toBe('2026-01-01');
  });

  it('clamps to end when after range', () => {
    expect(clampDate('2027-01-01', '2026-01-01', '2026-12-31')).toBe('2026-12-31');
  });
});

describe('countryToCode', () => {
  it('maps Israel', () => expect(countryToCode('Israel')).toBe('IL'));
  it('maps United States', () => expect(countryToCode('United States')).toBe('US'));
  it('maps USA shorthand', () => expect(countryToCode('USA')).toBe('US'));
  it('is case-insensitive', () => expect(countryToCode('ISRAEL')).toBe('IL'));
  it('returns null for unknown country', () => expect(countryToCode('Wakanda')).toBeNull());
  it('returns null for empty string', () => expect(countryToCode('')).toBeNull());
});
