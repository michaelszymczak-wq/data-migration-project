import { Injectable } from '@angular/core';
import { Category, TargetSchemaField } from '../models';

const SCHEMAS: Record<Category, TargetSchemaField[]> = {
  'Vineyard+block': [
    { key: 'vineyardName', label: 'Vineyard Name', required: true,  type: 'string' },
    { key: 'blockName',    label: 'Block Name',    required: true,  type: 'string' },
    { key: 'variety',      label: 'Variety',       required: true,  type: 'string' },
    { key: 'clone',        label: 'Clone',         required: false, type: 'string' },
    { key: 'rootstock',    label: 'Rootstock',     required: false, type: 'string' },
    { key: 'acres',        label: 'Acres',         required: false, type: 'number' },
  ],

  'Vessel': [
    { key: 'vesselId',   label: 'Vessel ID',   required: true,  type: 'string' },
    { key: 'vesselType', label: 'Type',         required: true,  type: 'string' },
    { key: 'capacity',   label: 'Capacity',     required: false, type: 'number' },
    { key: 'material',   label: 'Material',     required: false, type: 'string' },
    { key: 'location',   label: 'Location',     required: false, type: 'string' },
  ],

  'Lot Composition': [
    { key: 'lotId',          label: 'Lot ID',           required: true,  type: 'string' },
    { key: 'componentLotId', label: 'Component Lot ID', required: true,  type: 'string' },
    { key: 'percent',        label: 'Percent',          required: true,  type: 'number' },
  ],

  'Volume': [
    { key: 'lotId',         label: 'Lot ID',         required: true,  type: 'string' },
    { key: 'date',          label: 'Date',           required: true,  type: 'date'   },
    { key: 'volume',        label: 'Volume',         required: true,  type: 'number' },
    { key: 'unit',          label: 'Unit',           required: false, type: 'string' },
    { key: 'operationType', label: 'Operation Type', required: false, type: 'string' },
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
