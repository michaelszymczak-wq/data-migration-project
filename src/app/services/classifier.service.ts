import { Injectable } from '@angular/core';
import { Category } from '../models';

// ── Category colour palette (used by Review page and future phases) ───────────
export const CATEGORY_COLOR: Record<Category, string> = {
  'Vineyard+block':      '#558b2f',
  'Vessel':              '#1565c0',
  'Lot Composition':     '#7b1fa2',
  'Volume':              '#e65100',
  'Historical Additive': '#c62828',
  'Cost':                '#4e342e',
};

// ── Rules table (exported so Settings/diagnostics page can display it) ────────
export interface CategoryRule {
  category: Category;
  filenameTokens: string[];
  headerTokens: string[];
}

export const CATEGORY_RULES: CategoryRule[] = [
  {
    category: 'Vineyard+block',
    filenameTokens: ['vineyard', 'block', 'variety', 'clone', 'vyd', 'blk', 'planting', 'blocks'],
    headerTokens: [
      'vineyard', 'block', 'variety', 'clone', 'rootstock', 'acres',
      'appellation', 'sub_block', 'block_name', 'vine_spacing',
      'row_direction', 'planting_year', 'scion', 'row_count',
    ],
  },
  {
    category: 'Vessel',
    filenameTokens: ['vessel', 'tank', 'barrel', 'puncheon', 'cooperage', 'vessels', 'tanks', 'barrels'],
    headerTokens: [
      'tank', 'barrel', 'puncheon', 'vessel', 'capacity', 'material',
      'location', 'vessel_id', 'tank_id', 'barrel_id', 'vessel_name',
      'cooperage', 'oak', 'vessel_type', 'size',
    ],
  },
  {
    category: 'Lot Composition',
    filenameTokens: ['lot', 'blend', 'component', 'composition', 'components', 'blend_component'],
    headerTokens: [
      'lot', 'component', 'blend', 'percent', 'source_lot',
      'lot_id', 'component_lot', 'percentage', 'blend_percent',
      'source', 'destination_lot', 'blend_ratio',
    ],
  },
  {
    category: 'Volume',
    filenameTokens: ['volume', 'transfer', 'gallons', 'movement', 'volumes', 'transfers'],
    headerTokens: [
      'volume', 'gallons', 'liters', 'qty', 'transfer',
      'ending_volume', 'beginning_volume', 'quantity',
      'gallon', 'volume_change', 'operation_type',
    ],
  },
  {
    category: 'Historical Additive',
    filenameTokens: ['additive', 'addition', 'treatment', 'so2', 'enzyme', 'nutrient', 'additions', 'additives'],
    headerTokens: [
      'additive', 'addition', 'so2', 'enzyme', 'nutrient',
      'treatment', 'chemical', 'dosage', 'product',
      'application_date', 'product_name', 'amount_per_gallon',
    ],
  },
  {
    category: 'Cost',
    filenameTokens: ['cost', 'invoice', 'charge', 'labor', 'expense', 'costs', 'charges', 'billing'],
    headerTokens: [
      'cost', 'rate', 'labor', 'charge', 'invoice',
      'gl', 'amount', 'price', 'expense', 'cost_center',
      'account', 'cost_per_gallon', 'total_cost',
    ],
  },
];

// ── Public result type ─────────────────────────────────────────────────────────
export interface ClassifyResult {
  category: Category;
  confidence: number;
  notes: string;
}

// ── Service ───────────────────────────────────────────────────────────────────
@Injectable({ providedIn: 'root' })
export class ClassifierService {

  classify(filename: string, headers: string[]): ClassifyResult {
    const scored = CATEGORY_RULES.map(rule => ({
      rule,
      score: this.scoreRule(filename, headers, rule),
    }));
    scored.sort((a, b) => b.score - a.score);

    const { rule, score } = scored[0];

    // Build human-readable match evidence
    const fn   = filename.toLowerCase();
    const hdrs = headers.map(h => h.toLowerCase());
    const fnHits  = rule.filenameTokens.filter(t => fn.includes(t));
    const hdrHits = rule.headerTokens.filter(t => hdrs.some(h => h.includes(t) || t.includes(h.replace(/[^a-z]/g, ''))));

    const parts: string[] = [];
    if (fnHits.length)  parts.push(`filename[${fnHits.join(', ')}]`);
    if (hdrHits.length) parts.push(`headers[${hdrHits.slice(0, 4).join(', ')}]`);
    const notes = `auto: ${parts.join('; ') || 'no keyword matches'}`;

    return {
      category:   rule.category,
      confidence: Math.round(score * 1000) / 1000,
      notes,
    };
  }

  // ── Scoring ────────────────────────────────────────────────────────────────
  // Combined score 0..1: filename contributes 35%, headers 65%.
  // Each dimension is (hits / keyword_count) so scores are comparable
  // across categories regardless of rule length.

  private scoreRule(filename: string, headers: string[], rule: CategoryRule): number {
    const fn   = filename.toLowerCase();
    const hdrs = headers.map(h => h.toLowerCase());

    const fnHits  = rule.filenameTokens.filter(t => fn.includes(t)).length;
    const fnScore = rule.filenameTokens.length > 0 ? fnHits / rule.filenameTokens.length : 0;

    // Header matching: token found in any header string, or any header found in token
    const hdrHits = rule.headerTokens.filter(t =>
      hdrs.some(h => h.includes(t) || t.includes(h.replace(/[^a-z]/g, '')))
    ).length;
    const hdrScore = rule.headerTokens.length > 0 ? hdrHits / rule.headerTokens.length : 0;

    return 0.35 * fnScore + 0.65 * hdrScore;
  }
}
