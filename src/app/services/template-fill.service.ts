import { Injectable } from '@angular/core';
import { LocalDbService } from './local-db.service';
import { MappingRule } from '../models';
import { SHEET_SOURCE_MAP } from './canonical-model.service';

export interface FillResult {
  rows: Record<string, unknown>[];
  errors: string[];
}

@Injectable({ providedIn: 'root' })
export class TemplateFillService {

  constructor(private db: LocalDbService) {}

  /** Fill template rows for one sheet using the supplied mapping rules. */
  async fillSheet(
    workspaceId: string,
    sheetName: string,
    headers: string[],
    rules: MappingRule[],
  ): Promise<FillResult> {
    const source = SHEET_SOURCE_MAP[sheetName] ?? '';
    const records = await this.loadSource(workspaceId, source);
    const errors: string[] = [];

    if (!records.length) {
      errors.push(`No ${source || sheetName} records found in this workspace`);
    }

    const rows = records.map((rec, rowIdx) => {
      const row: Record<string, unknown> = {};

      for (const header of headers) {
        const rule = rules.find(r => r.targetColumn === header && r.sourceKind);
        if (!rule || !rule.sourceKind) continue;
        try {
          row[header] = this.resolveRule(rule, rec);
        } catch (err) {
          errors.push(`Row ${rowIdx + 1}, "${header}": ${err}`);
        }
      }

      // Check required columns
      for (const rule of rules.filter(r => r.required && r.sourceKind)) {
        const v = row[rule.targetColumn];
        if (v === undefined || v === null || v === '') {
          errors.push(`Row ${rowIdx + 1}: required column "${rule.targetColumn}" is empty`);
        }
      }

      return row;
    });

    return { rows, errors };
  }

  /** Count how many source records exist for a given sheet's canonical source. */
  async countRecords(workspaceId: string, sheetName: string): Promise<number> {
    const source = SHEET_SOURCE_MAP[sheetName] ?? '';
    const records = await this.loadSource(workspaceId, source);
    return records.length;
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async loadSource(workspaceId: string, source: string): Promise<Record<string, unknown>[]> {
    switch (source) {
      case 'lotComposition': {
        const recs = await this.db.listNormalizedByWorkspace(workspaceId);
        return recs.map(r => ({
          lotCode:        r.lotCode,
          varietyCode:    r.varietyCode,
          varietyPct:     r.varietyPct,
          vintage:        r.vintage,
          vintagePct:     r.vintagePct,
          appellation:    r.appellation,
          appellationPct: r.appellationPct,
        }));
      }
      case 'vineyardBlock': {
        const staged = await this.db.listStagedByWorkspace(workspaceId);
        return staged
          .filter(r => r.category === 'Vineyard+block')
          .map(r => r.data as Record<string, unknown>);
      }
      case 'vessel': {
        const staged = await this.db.listStagedByWorkspace(workspaceId);
        return staged
          .filter(r => r.category === 'Vessel')
          .map(r => r.data as Record<string, unknown>);
      }
      case 'volume': {
        const staged = await this.db.listStagedByWorkspace(workspaceId);
        return staged
          .filter(r => r.category === 'Volume')
          .map(r => r.data as Record<string, unknown>);
      }
      default:
        return [];
    }
  }

  private resolveRule(rule: MappingRule, record: Record<string, unknown>): unknown {
    switch (rule.sourceKind) {
      case 'constant':
        return rule.sourceValue;
      case 'field': {
        const parts = rule.sourceValue.split('.');
        const field = parts.length > 1 ? parts[1] : parts[0];
        return record[field] ?? '';
      }
      case 'expression':
        return this.evalExpression(rule.sourceValue, record);
      default:
        return '';
    }
  }

  // ── Expression evaluator ──────────────────────────────────────────────────
  // Supports: concat(arg1, arg2, ...)
  //   arg: quoted string "literal" or field path source.field

  private evalExpression(expr: string, record: Record<string, unknown>): string {
    expr = expr.trim();
    const concatMatch = expr.match(/^concat\(([\s\S]*)\)$/);
    if (concatMatch) {
      return this.splitArgs(concatMatch[1])
        .map(a => this.evalArg(a.trim(), record))
        .join('');
    }
    return this.evalArg(expr, record);
  }

  private evalArg(arg: string, record: Record<string, unknown>): string {
    if ((arg.startsWith('"') && arg.endsWith('"')) ||
        (arg.startsWith("'") && arg.endsWith("'"))) {
      return arg.slice(1, -1);
    }
    const parts = arg.split('.');
    const field = parts.length > 1 ? parts[1] : parts[0];
    const val = record[field];
    return val != null ? String(val) : '';
  }

  private splitArgs(s: string): string[] {
    const args: string[] = [];
    let depth = 0, start = 0;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')') depth--;
      else if (s[i] === ',' && depth === 0) {
        args.push(s.slice(start, i).trim());
        start = i + 1;
      }
    }
    args.push(s.slice(start).trim());
    return args;
  }
}
