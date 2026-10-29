import { Injectable } from '@angular/core';
import { Category, TargetSchemaField } from '../models';

// Barrel-only fields on the Vessel template (yellow in the InnoVint template):
// required only when Vessel type = Barrel.
const BARREL_IF = { field: 'vesselType', equals: 'Barrel' };

const SCHEMAS: Record<Category, TargetSchemaField[]> = {
  // ── InnoVint "Vineyard blocks" import ──────────────────────────────────────
  'Vineyard+block': [
    { key: 'vineyardName',   label: 'Vineyard name',         required: true,  type: 'string' },
    { key: 'grower',         label: 'Grower (Company name)', required: false, type: 'string' },
    { key: 'sourceType',     label: 'Source type',           required: true,  type: 'string' },
    { key: 'appellation',    label: 'Appellation',           required: true,  type: 'string' },
    { key: 'vineyardAddress',label: 'Vineyard address',      required: false, type: 'string' },
    { key: 'owners',         label: 'Owner(s)',              required: false, type: 'string' },
    { key: 'vineyardTags',   label: 'Vineyard tag(s)',       required: false, type: 'string' },
    { key: 'blockName',      label: 'Block name',            required: true,  type: 'string' },
    { key: 'variety',        label: 'Variety',               required: true,  type: 'string' },
    { key: 'clone',          label: 'Clone',                 required: false, type: 'string' },
    { key: 'yearPlanted',    label: 'Year planted',          required: false, type: 'number' },
    { key: 'rowCount',       label: 'Row count',             required: false, type: 'number' },
    { key: 'spacingUnit',    label: 'Spacing unit',          required: false, type: 'string' },
    { key: 'vineSpacing',    label: 'Vine spacing',          required: false, type: 'number' },
    { key: 'rowSpacing',     label: 'Row spacing',           required: false, type: 'number' },
    { key: 'area',           label: 'Area',                  required: false, type: 'number' },
    { key: 'producingVines', label: 'Producing vines',       required: false, type: 'number' },
    { key: 'rootstock',      label: 'Rootstock',             required: false, type: 'string' },
    { key: 'trellis',        label: 'Trellis',               required: false, type: 'string' },
    { key: 'blockTags',      label: 'Block tag(s)',          required: false, type: 'string' },
  ],

  // ── InnoVint "Vessels" import ──────────────────────────────────────────────
  'Vessel': [
    { key: 'vesselCode',     label: 'Vessel code',       required: true,  type: 'string' },
    { key: 'vesselType',     label: 'Vessel type',       required: true,  type: 'string' },
    { key: 'capacityVol',    label: 'Capacity (vol)',    required: true,  type: 'number' },
    { key: 'bottleType',     label: 'Bottle Type',       required: false, type: 'string' },
    { key: 'capacityBottles',label: 'Capacity (bottles)',required: false, type: 'number' },
    { key: 'yearFirstUsed',  label: 'Year first used',   required: false, type: 'number', requiredIf: BARREL_IF, note: 'Required for barrels' },
    { key: 'cooper',         label: 'Cooper',            required: false, type: 'string', requiredIf: BARREL_IF, note: 'Required for barrels' },
    { key: 'style',          label: 'Style',             required: false, type: 'string', requiredIf: BARREL_IF, note: 'Required for barrels' },
    { key: 'wood',           label: 'Wood',              required: false, type: 'string', requiredIf: BARREL_IF, note: 'Required for barrels' },
    { key: 'forest',         label: 'Forest',            required: false, type: 'string', requiredIf: BARREL_IF, note: 'Required for barrels' },
    { key: 'toast',          label: 'Toast',             required: false, type: 'string', requiredIf: BARREL_IF, note: 'Required for barrels' },
    { key: 'color',          label: 'Color',             required: false, type: 'string', requiredIf: BARREL_IF, note: 'Required for barrels' },
    { key: 'tags',           label: 'Tags',              required: false, type: 'string' },
    { key: 'owners',         label: 'Owners',            required: false, type: 'string' },
  ],

  // ── InnoVint "Lot create" import ───────────────────────────────────────────
  'Lot Composition': [
    { key: 'bond',           label: 'Bond',                             required: true,  type: 'string' },
    { key: 'lotCode',        label: 'Lot code',                         required: true,  type: 'string' },
    { key: 'lotName',        label: 'Lot name',                         required: false, type: 'string' },
    { key: 'taxClass',       label: 'Tax class',                        required: true,  type: 'string' },
    { key: 'stage',          label: 'Stage',                            required: true,  type: 'string' },
    { key: 'color',          label: 'Color',                            required: true,  type: 'string' },
    { key: 'style',          label: 'Style',                            required: true,  type: 'string' },
    { key: 'owners',         label: 'Owner(s)',                         required: false, type: 'string' },
    { key: 'componentType',  label: 'Component type',                   required: true,  type: 'string' },
    { key: 'componentPct',   label: 'Component % of total lot volume',  required: true,  type: 'number' },
    { key: 'vineyard',       label: 'Vineyard',                         required: true,  type: 'string' },
    { key: 'block',          label: 'Block',                            required: true,  type: 'string' },
    { key: 'clone',          label: 'Clone',                            required: false, type: 'string' },
    { key: 'pctOfBulk',      label: '% of Bulk',                        required: false, type: 'number' },
    { key: 'vintage',        label: 'Vintage',                          required: true,  type: 'number' },
    { key: 'varietal',       label: 'Varietal',                         required: true,  type: 'string' },
    { key: 'appellation',    label: 'Appellation',                      required: true,  type: 'string' },
    { key: 'tags',           label: 'Tags',                             required: false, type: 'string' },
    { key: 'format',         label: 'Format',                           required: false, type: 'string' },
    { key: 'bottlesPerCase', label: 'Bottles per Case',                 required: false, type: 'number' },
    { key: 'casesPerPallet', label: 'Cases per Pallet',                 required: false, type: 'number' },
  ],

  // ── InnoVint "Volume" import ───────────────────────────────────────────────
  'Volume': [
    { key: 'date',       label: 'Date',        required: true, type: 'date'   },
    { key: 'lotCode',    label: 'Lot Code',    required: true, type: 'string' },
    { key: 'vesselCode', label: 'Vessel Code', required: true, type: 'string' },
    { key: 'volume',     label: 'Volume',      required: true, type: 'number' },
  ],

  'Historical Additive': [
    { key: 'targetId',     label: 'Lot / Vessel ID', required: true,  type: 'string' },
    { key: 'date',         label: 'Date',            required: true,  type: 'date'   },
    { key: 'additiveType', label: 'Additive Type',   required: true,  type: 'string' },
    { key: 'amount',       label: 'Amount',          required: true,  type: 'number' },
    { key: 'unit',         label: 'Unit',            required: false, type: 'string' },
  ],

  'Cost': [
    { key: 'costItem',   label: 'Cost Item',            required: true,  type: 'string' },
    { key: 'date',       label: 'Date',                 required: true,  type: 'date'   },
    { key: 'amount',     label: 'Amount',               required: true,  type: 'number' },
    { key: 'costCenter', label: 'Cost Center / Lot ID', required: false, type: 'string' },
    { key: 'notes',      label: 'Notes',                required: false, type: 'string' },
  ],
};

@Injectable({ providedIn: 'root' })
export class TargetSchemaService {
  fieldsFor(category: Category): TargetSchemaField[] {
    return SCHEMAS[category] ?? [];
  }
}
