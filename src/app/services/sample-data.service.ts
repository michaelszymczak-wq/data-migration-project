import { Injectable } from '@angular/core';

interface SampleSpec { name: string; content: string; }

// ── Sample CSV content ────────────────────────────────────────────────────────

const VESSEL_CSV = `\
Vessel ID,Type,Capacity,Material,Location
TANK-001,Stainless Steel Tank,5000,Stainless Steel,Cellar A
TANK-002,Stainless Steel Tank,3000,Stainless Steel,Cellar A
TANK-003,Stainless Steel Tank,7500,Stainless Steel,Cellar B
OAK-001,French Oak Barrel,60,French Oak,Barrel Room 1
OAK-002,French Oak Barrel,60,French Oak,Barrel Room 1
OAK-003,French Oak Barrel,60,French Oak,Barrel Room 2
PUNCH-001,Puncheon,500,French Oak,Barrel Room 2
EGG-001,Concrete Egg,1500,Concrete,Cellar B
`.trim();

const VINEYARD_CSV = `\
Vineyard Name,Block Name,Variety,Clone,Rootstock,Acres
Home Ranch,Block A,Cabernet Sauvignon,337,101-14,4.5
Home Ranch,Block B,Merlot,181,3309,3.2
Home Ranch,Block C,Cabernet Franc,327,101-14,1.8
Valley View,Block 1,Chardonnay,4,RN,5.1
Valley View,Block 2,Pinot Noir,115,3309,2.8
Valley View,Block 3,Pinot Gris,,,1.4
Summit Estate,East Block,Zinfandel,,,6.0
Summit Estate,West Block,Petite Sirah,,,3.5
`.trim();

const VOLUME_CSV = `\
Lot ID,Date,Volume,Unit,Operation Type
LOT-2023-CAB,2023-10-15,5000,liters,Harvest Fill
LOT-2023-CAB,2023-11-20,4850,liters,Racking
LOT-2023-CAB,2024-01-10,4750,liters,Racking
LOT-2023-MER,2023-10-20,3000,liters,Harvest Fill
LOT-2023-MER,2023-12-05,2950,liters,Racking
LOT-2023-CHD,2023-08-30,7500,liters,Harvest Fill
LOT-2023-CHD,2023-10-01,7350,liters,Press Transfer
LOT-2023-CHD,2024-02-15,7200,liters,Racking
`.trim();

// Lot Composition uses the paired-row pattern:
//   row N  = lot code + variety + vintage + appellation
//   row N+1 = (empty lot code) + variety% + vintage% + appellation%
// "Lot Code" header at position 10 (0-indexed) is detected by label.
const LOT_COMPOSITION_CSV = `\
A,B,C,D,E,F,G,H,I,J,Lot Code,Variety,Vintage,Appellation
,,,,,,,,,,LOT-2023-CAB-01,Cabernet Sauvignon,2023,Napa Valley
,,,,,,,,,,,100,98.761,100
,,,,,,,,,,LOT-2023-CAB-02,Cabernet Sauvignon,2023,Sonoma Coast
,,,,,,,,,,,75.5,100,100
,,,,,,,,,,LOT-2023-MER-01,Merlot,2022,Napa Valley
,,,,,,,,,,,100,100,100
,,,,,,,,,,LOT-2023-CHD-01,Chardonnay,2021,Russian River
,,,,,,,,,,,60,100,100
,,,,,,,,,,LOT-2023-CHD-02,Chardonnay,2021,Sonoma Coast
,,,,,,,,,,,40,100,100
`.trim();

const SAMPLES: SampleSpec[] = [
  { name: 'vessel_sample.csv',          content: VESSEL_CSV },
  { name: 'vineyard_block_sample.csv',  content: VINEYARD_CSV },
  { name: 'volume_sample.csv',          content: VOLUME_CSV },
  { name: 'lot_composition_sample.csv', content: LOT_COMPOSITION_CSV },
];

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class SampleDataService {
  /** Returns browser File objects for all built-in sample datasets. */
  getFiles(): File[] {
    return SAMPLES.map(s => new File([s.content], s.name, { type: 'text/csv' }));
  }

  get count(): number { return SAMPLES.length; }
}
