import { Injectable } from '@angular/core';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { StagedRecord, TargetSchemaField, Category } from '../models';

export interface CategoryExport {
  category: Category;
  records: StagedRecord[];
  fields: TargetSchemaField[];
}

@Injectable({ providedIn: 'root' })
export class ExportService {

  /** Convert staged records to a JSON-serialisable array using field keys as property names. */
  toJson(records: StagedRecord[], fields: TargetSchemaField[]): Record<string, unknown>[] {
    const keys = fields.map(f => f.key);
    return records.map(r => {
      const obj: Record<string, unknown> = { _errors: r.errors };
      for (const key of keys) {
        obj[key] = r.data[key] ?? null;
      }
      return obj;
    });
  }

  /** Convert staged records to a CSV string using field labels as column headers. */
  toCsv(records: StagedRecord[], fields: TargetSchemaField[]): string {
    const rows = records.map(r => {
      const obj: Record<string, unknown> = {};
      for (const f of fields) {
        obj[f.label] = r.data[f.key] ?? '';
      }
      return obj;
    });
    return Papa.unparse(rows, { header: true });
  }

  /** Build a ZIP archive containing {category}.json + {category}.csv per category + manifest.json. */
  async toZip(exports: CategoryExport[], workspaceName: string): Promise<Blob> {
    const zip = new JSZip();
    const manifest: Record<string, unknown> = {
      workspace: workspaceName,
      exportedAt: new Date().toISOString(),
      categories: [] as unknown[],
    };
    const categories = manifest['categories'] as unknown[];

    for (const ce of exports) {
      const safeCategory = ce.category.replace(/[^a-z0-9]/gi, '_');
      const jsonRows = this.toJson(ce.records, ce.fields);
      const csvText  = this.toCsv(ce.records, ce.fields);

      zip.file(`${safeCategory}.json`, JSON.stringify(jsonRows, null, 2));
      zip.file(`${safeCategory}.csv`, csvText);
      categories.push({
        category: ce.category,
        recordCount: ce.records.length,
        errorCount: ce.records.filter(r => r.errors.length > 0).length,
      });
    }

    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  }

  /** Trigger a browser file download for any Blob. */
  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
