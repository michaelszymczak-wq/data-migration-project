import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { LocalDbService } from './local-db.service';
import { TemplateSpec } from '../models';

@Injectable({ providedIn: 'root' })
export class TemplateService {

  constructor(private db: LocalDbService) {}

  /** Parse an uploaded XLSX file, extract per-sheet headers, persist TemplateSpec. */
  async loadFromFile(file: File): Promise<TemplateSpec> {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });

    const sheets = wb.SheetNames.map(sheetName => {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });
      const firstRow = (rows[0] as unknown[]) ?? [];
      const headers = firstRow
        .map(h => String(h ?? '').trim())
        .filter(Boolean);
      return { sheetName, headers };
    });

    const spec: TemplateSpec = {
      id:          `template-${Date.now()}`,
      name:        file.name,
      importedAt:  new Date().toISOString(),
      sheets,
      source:      'uploaded',
      rawBlob:     new Blob([arrayBuffer], {
        type: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    };

    await this.db.putTemplateSpec(spec);
    return spec;
  }

  /** Return the most recently imported TemplateSpec, or null if none exists. */
  async getActive(): Promise<TemplateSpec | null> {
    const all = await this.db.listTemplateSpecs();
    if (!all.length) return null;
    return all.sort((a, b) => b.importedAt.localeCompare(a.importedAt))[0];
  }
}
