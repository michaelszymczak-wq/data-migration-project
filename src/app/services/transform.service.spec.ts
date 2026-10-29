import { isFieldRequiredForRow } from './transform.service';
import { TargetSchemaField } from '../models';

/** Tests for conditional-required logic (Vessel barrel-only fields). */

const cooper: TargetSchemaField = {
  key: 'cooper', label: 'Cooper', required: false, type: 'string',
  requiredIf: { field: 'vesselType', equals: 'Barrel' },
};
const vesselCode: TargetSchemaField = { key: 'vesselCode', label: 'Vessel code', required: true, type: 'string' };
const tags: TargetSchemaField = { key: 'tags', label: 'Tags', required: false, type: 'string' };

describe('isFieldRequiredForRow', () => {
  it('always true for unconditionally required fields', () => {
    expect(isFieldRequiredForRow(vesselCode, {})).toBe(true);
    expect(isFieldRequiredForRow(vesselCode, { vesselType: 'Tank' })).toBe(true);
  });

  it('always false for plain optional fields', () => {
    expect(isFieldRequiredForRow(tags, { vesselType: 'Barrel' })).toBe(false);
  });

  it('is required when the controlling field matches (barrel row)', () => {
    expect(isFieldRequiredForRow(cooper, { vesselType: 'Barrel' })).toBe(true);
  });

  it('is NOT required when the controlling field differs (tank row)', () => {
    expect(isFieldRequiredForRow(cooper, { vesselType: 'Tank' })).toBe(false);
    expect(isFieldRequiredForRow(cooper, {})).toBe(false);
  });

  it('matches the controlling value case-insensitively', () => {
    expect(isFieldRequiredForRow(cooper, { vesselType: 'barrel' })).toBe(true);
    expect(isFieldRequiredForRow(cooper, { vesselType: ' BARREL ' })).toBe(true);
  });
});
