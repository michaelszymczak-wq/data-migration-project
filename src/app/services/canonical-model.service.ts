import { Injectable } from '@angular/core';
import { MappingRule } from '../models';

export interface CanonicalFieldOption {
  value: string;  // e.g. 'lotComposition.lotCode'
  label: string;  // e.g. 'lotComposition → lotCode'
}

/** Maps each known template sheet name to its canonical data source key. */
export const SHEET_SOURCE_MAP: Record<string, string> = {
  'B_Lots':          'lotComposition',
  'Vineyard_blocks': 'vineyardBlock',
  'B Vessels':       'vessel',
  'B Volume':        'volume',
};

const CANONICAL_FIELDS: Record<string, string[]> = {
  lotComposition: ['lotCode', 'varietyCode', 'varietyPct', 'vintage', 'vintagePct', 'appellation', 'appellationPct'],
  vineyardBlock:  ['vineyardName', 'blockName', 'variety', 'clone', 'rootstock', 'acres'],
  vessel:         ['vesselId', 'vesselType', 'capacity', 'material', 'location'],
  volume:         ['lotId', 'date', 'volume', 'unit', 'operationType'],
};

/** Default column → mapping rule seeds for well-known sheets. */
const DEFAULT_RULES: Record<string, Record<string, Pick<MappingRule, 'sourceKind' | 'sourceValue'>>> = {
  B_Lots: {
    'Lot code':   { sourceKind: 'field',      sourceValue: 'lotComposition.lotCode' },
    'Variety':    { sourceKind: 'field',      sourceValue: 'lotComposition.varietyCode' },
    'Percentage': { sourceKind: 'field',      sourceValue: 'lotComposition.varietyPct' },
    'Vintage':    { sourceKind: 'field',      sourceValue: 'lotComposition.vintage' },
    'Tags':       { sourceKind: 'expression', sourceValue: 'concat("Appellation:",lotComposition.appellation)' },
  },
};

@Injectable({ providedIn: 'root' })
export class CanonicalModelService {

  /** Returns field picker options for the given sheet's canonical source. */
  fieldOptionsForSheet(sheetName: string): CanonicalFieldOption[] {
    const source = SHEET_SOURCE_MAP[sheetName] ?? '';
    const fields = CANONICAL_FIELDS[source] ?? [];
    return fields.map(f => ({
      value: `${source}.${f}`,
      label: `${source} → ${f}`,
    }));
  }

  /** Returns a seeded MappingRule for a known column, or null if unknown. */
  defaultRuleFor(sheetName: string, column: string): MappingRule | null {
    const seed = DEFAULT_RULES[sheetName]?.[column];
    if (!seed) return null;
    return { targetColumn: column, ...seed };
  }
}
