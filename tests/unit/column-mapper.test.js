import { describe, it, expect } from 'vitest';
import { autoMap, applyMapping } from '../../js/components/column-mapper.js';

describe('autoMap', () => {
  it('maps "Initiative" header to title', () => {
    const m = autoMap(['Initiative', 'Description', 'Why']);
    expect(m.title).toBe('Initiative');
  });

  it('maps "Mission" header to title', () => {
    expect(autoMap(['Mission']).title).toBe('Mission');
  });

  it('maps "Why" header to why', () => {
    const m = autoMap(['Initiative', 'Description', 'Why']);
    expect(m.why).toBe('Why');
  });

  it('maps "Reason" header to why', () => {
    expect(autoMap(['Title', 'Reason']).why).toBe('Reason');
  });

  it('maps "Rationale" header to why', () => {
    expect(autoMap(['Title', 'Rationale']).why).toBe('Rationale');
  });

  it('maps "Motivation" header to why', () => {
    expect(autoMap(['Title', 'Motivation']).why).toBe('Motivation');
  });

  it('maps "Description" header to description', () => {
    expect(autoMap(['Title', 'Description']).description).toBe('Description');
  });

  it('maps "Priority" header to priority', () => {
    expect(autoMap(['Title', 'Priority']).priority).toBe('Priority');
  });

  it('is case-insensitive', () => {
    const m = autoMap(['INITIATIVE', 'WHY', 'DESCRIPTION']);
    expect(m.title).toBe('INITIATIVE');
    expect(m.why).toBe('WHY');
    expect(m.description).toBe('DESCRIPTION');
  });

  it('returns empty map for unknown headers', () => {
    const m = autoMap(['Foo', 'Bar', 'Baz']);
    expect(m.title).toBeUndefined();
    expect(m.why).toBeUndefined();
  });
});

describe('applyMapping', () => {
  const rows = [
    { Initiative: 'Migrate DB', Description: 'Move data', Why: 'Cost savings', Priority: 'High' },
    { Initiative: 'New UI',     Description: 'Redesign',  Why: 'UX improvement', Priority: 'Low' },
  ];
  const mapping = { title: 'Initiative', description: 'Description', why: 'Why', priority: 'Priority' };

  it('maps rows to mission fields', () => {
    const result = applyMapping(rows, mapping);
    expect(result[0].title).toBe('Migrate DB');
    expect(result[0].description).toBe('Move data');
    expect(result[0].why).toBe('Cost savings');
    expect(result[0].priority).toBe('High');
  });

  it('includes why in all rows', () => {
    const result = applyMapping(rows, mapping);
    expect(result[1].why).toBe('UX improvement');
  });

  it('drops fully blank rows', () => {
    const withBlank = [...rows, { Initiative: '', Description: '', Why: '', Priority: '' }];
    const result = applyMapping(withBlank, mapping);
    expect(result).toHaveLength(2);
  });

  it('skips unmapped fields', () => {
    const partialMapping = { title: 'Initiative' };
    const result = applyMapping(rows, partialMapping);
    expect(result[0].title).toBe('Migrate DB');
    expect(result[0].why).toBeUndefined();
  });
});
