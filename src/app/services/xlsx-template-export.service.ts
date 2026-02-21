import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { TemplateSpec } from '../models';

export interface FilledSheet {
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

@Injectable({ providedIn: 'root' })
export class XlsxTemplateExportService {

  /**
   * Open the original template workbook, write filled rows under each header row,
   * and trigger a browser download of the resulting XLSX file.
   */
  async generateWorkbook(
    template: TemplateSpec,
    filledSheets: FilledSheet[],
    workspaceName: string,
  ): Promise<void> {
    if (!template.rawBlob) {
      throw new Error('Template has no raw blob — re-upload the template file');
    }

    const arrayBuffer = await template.rawBlob.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });

    for (const { sheetName, headers, rows } of filledSheets) {
      const ws = wb.Sheets[sheetName];
      if (!ws) continue;  // sheet not in template workbook — skip

      if (rows.length > 0) {
        // Write data starting at row 2 (A2), preserving the existing header row
        XLSX.utils.sheet_add_json(ws, rows, {
          header:     headers,
          skipHeader: true,
          origin:     'A2',
        });
      }
    }

    const wbBytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
    const blob = new Blob([wbBytes], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const safeName = workspaceName.replace(/[^a-z0-9]/gi, '_');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `innovint_migration_${safeName}.xlsx`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
