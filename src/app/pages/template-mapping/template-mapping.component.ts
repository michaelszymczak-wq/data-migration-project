import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';

import { LocalDbService } from '../../services/local-db.service';
import { TemplateService } from '../../services/template.service';
import { TemplateFillService } from '../../services/template-fill.service';
import { XlsxTemplateExportService } from '../../services/xlsx-template-export.service';
import { CanonicalModelService, CanonicalFieldOption } from '../../services/canonical-model.service';
import { WorkspaceService } from '../../services/workspace.service';
import { ToastService } from '../../services/toast.service';
import { TemplateSpec, TemplateMapping, MappingRule, GeneratedSheetPreview } from '../../models';

@Component({
  selector: 'app-template-mapping',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule, MatIconModule, MatTabsModule,
    MatProgressSpinnerModule, MatTooltipModule, MatChipsModule,
  ],
  template: `
    <div class="page">

      <!-- Page header -->
      <div class="page-header">
        <h2><mat-icon>table_view</mat-icon> Template Mapping</h2>
        <div class="header-actions">
          @if (template()) {
            <span class="template-badge">
              <mat-icon>description</mat-icon>
              {{ template()!.name }}
              <span class="sheet-count">({{ template()!.sheets.length }} sheets)</span>
            </span>
          }
          <button mat-stroked-button (click)="fileInput.click()" [disabled]="busy()">
            <mat-icon>upload</mat-icon>
            {{ template() ? 'Replace Template' : 'Upload Template' }}
          </button>
          @if (template()) {
            <button mat-raised-button color="accent"
                    (click)="generateXlsx()"
                    [disabled]="busy() || !ws.activeWorkspace()"
                    matTooltip="Fills all sheets with saved mappings and downloads the XLSX">
              <mat-icon>download</mat-icon> Generate XLSX
            </button>
          }
          <input #fileInput type="file" accept=".xlsx,.xls" hidden
                 (change)="uploadTemplate($event)">
        </div>
      </div>

      <!-- No workspace guard -->
      @if (!ws.activeWorkspace()) {
        <div class="empty-state">
          <mat-icon>folder_off</mat-icon>
          <p>Select a workspace first.</p>
        </div>
      }

      <!-- No template uploaded yet -->
      @else if (!template()) {
        <div class="empty-state">
          <mat-icon class="big-icon">upload_file</mat-icon>
          <h3>No template loaded</h3>
          <p>Upload your migration XLSX template to begin mapping columns.</p>
          <button mat-raised-button color="primary" (click)="fileInput.click()">
            <mat-icon>upload</mat-icon> Upload Template
          </button>
        </div>
      }

      <!-- Main UI — sheet tabs -->
      @else {
        <mat-tab-group animationDuration="0" (selectedIndexChange)="onTabChange($event)">
          @for (sheet of template()!.sheets; track sheet.sheetName; let i = $index) {
            <mat-tab [label]="sheet.sheetName">

              @if (activeSheetIdx() === i) {
                <div class="tab-content">

                  <!-- Tab toolbar -->
                  <div class="tab-toolbar">
                    <span class="record-info">
                      <mat-icon>dataset</mat-icon>
                      {{ recordCount() }} source record{{ recordCount() === 1 ? '' : 's' }}
                      @if (!recordCount()) {
                        <span class="no-records-hint">
                          — run the relevant normalizer / staging step first
                        </span>
                      }
                    </span>
                    <div class="tab-actions">
                      <button mat-stroked-button (click)="saveMapping()" [disabled]="busy()">
                        <mat-icon>save</mat-icon> Save Mapping
                      </button>
                      <button mat-raised-button color="primary"
                              (click)="previewRows()" [disabled]="busy()">
                        <mat-icon>preview</mat-icon> Preview Rows
                      </button>
                    </div>
                  </div>

                  <!-- Mapping editor table -->
                  <div class="mapping-wrap">
                    <table class="mapping-table">
                      <thead>
                        <tr>
                          <th>Template Column</th>
                          <th>Source Type</th>
                          <th>Source Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (rule of editableRules(); track rule.targetColumn; let ri = $index) {
                          <tr [class.mapped]="rule.sourceKind">
                            <td class="col-name">{{ rule.targetColumn }}</td>
                            <td class="col-kind">
                              <select [value]="rule.sourceKind"
                                      (change)="updateRuleKind(ri, $any($event.target).value)">
                                <option value="">— skip —</option>
                                <option value="constant">Constant</option>
                                <option value="field">Field</option>
                                <option value="expression">Expression</option>
                              </select>
                            </td>
                            <td class="col-value">
                              @if (rule.sourceKind === 'field') {
                                <select [value]="rule.sourceValue"
                                        (change)="updateRuleValue(ri, $any($event.target).value)">
                                  <option value="">— pick field —</option>
                                  @for (opt of fieldOptions(sheet.sheetName); track opt.value) {
                                    <option [value]="opt.value">{{ opt.label }}</option>
                                  }
                                </select>
                              } @else if (rule.sourceKind === 'expression') {
                                <input [value]="rule.sourceValue"
                                       (input)="updateRuleValue(ri, $any($event.target).value)"
                                       placeholder='concat("Prefix:",lotComposition.appellation)'
                                       class="expr-input" />
                              } @else if (rule.sourceKind === 'constant') {
                                <input [value]="rule.sourceValue"
                                       (input)="updateRuleValue(ri, $any($event.target).value)"
                                       placeholder="literal value"
                                       class="const-input" />
                              } @else {
                                <span class="skip-hint">column will be left empty</span>
                              }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>

                  <!-- Preview panel -->
                  @if (preview()) {
                    <div class="preview-section">
                      <div class="preview-stats">
                        <mat-chip-set>
                          <mat-chip>Rows to write: {{ preview()!.rowCount }}</mat-chip>
                          @if (preview()!.errors.length) {
                            <mat-chip color="warn" highlighted>
                              Errors: {{ preview()!.errors.length }}
                            </mat-chip>
                          }
                          <mat-chip color="primary" highlighted>
                            Previewing: {{ preview()!.previewRows.length }}
                          </mat-chip>
                        </mat-chip-set>
                        <span class="generated-at">Generated {{ preview()!.generatedAt | date:'medium' }}</span>
                      </div>

                      @if (preview()!.errors.length) {
                        <ul class="error-list">
                          @for (e of preview()!.errors.slice(0, 10); track e) {
                            <li>{{ e }}</li>
                          }
                          @if (preview()!.errors.length > 10) {
                            <li class="more-errors">…and {{ preview()!.errors.length - 10 }} more</li>
                          }
                        </ul>
                      }

                      <div class="preview-table-wrap">
                        <table class="preview-table">
                          <thead>
                            <tr>
                              @for (h of previewHeaders(sheet.headers); track h) {
                                <th>{{ h }}</th>
                              }
                            </tr>
                          </thead>
                          <tbody>
                            @for (row of preview()!.previewRows; track $index) {
                              <tr>
                                @for (h of previewHeaders(sheet.headers); track h) {
                                  <td>{{ row[h] ?? '' }}</td>
                                }
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    </div>
                  }

                </div>
              }

            </mat-tab>
          }
        </mat-tab-group>
      }

      <!-- Busy overlay -->
      @if (busy()) {
        <div class="busy-overlay">
          <mat-spinner diameter="48"></mat-spinner>
        </div>
      }

    </div>
  `,
  styles: [`
    .page {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
      position: relative;
    }

    .page-header {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 24px;

      h2 {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        flex: 1;
        font-size: 22px;
      }
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
    }

    .template-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #e8f5e9;
      color: #2e7d32;
      padding: 6px 12px;
      border-radius: 16px;
      font-size: 13px;
      font-weight: 500;

      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      .sheet-count { opacity: 0.7; font-weight: 400; }
    }

    .empty-state {
      text-align: center;
      padding: 64px 24px;
      color: #666;

      mat-icon { font-size: 56px; width: 56px; height: 56px; margin-bottom: 16px; }
      .big-icon { font-size: 72px; width: 72px; height: 72px; }
      h3 { margin: 0 0 8px; font-size: 20px; color: #333; }
      p { margin: 0 0 24px; }
    }

    .tab-content {
      padding: 20px 0;
    }

    .tab-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
      padding: 12px 16px;
      background: #f5f5f5;
      border-radius: 8px;
    }

    .record-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 14px;
      color: #555;

      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #1565c0; }
      .no-records-hint { color: #e65100; font-style: italic; }
    }

    .tab-actions {
      display: flex;
      gap: 8px;
    }

    /* Mapping table */
    .mapping-wrap {
      overflow-x: auto;
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      margin-bottom: 24px;
    }

    .mapping-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      th {
        background: #1a237e;
        color: white;
        padding: 10px 14px;
        text-align: left;
        font-weight: 500;
        white-space: nowrap;
      }

      td {
        padding: 8px 14px;
        border-bottom: 1px solid #f0f0f0;
        vertical-align: middle;
      }

      tr:last-child td { border-bottom: none; }

      tr.mapped { background: #fafffe; }
      tr:hover td { background: #f5f5f5; }
    }

    .col-name {
      font-weight: 500;
      color: #333;
      min-width: 180px;
    }

    .col-kind {
      min-width: 140px;

      select {
        width: 100%;
        padding: 5px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 13px;
        background: white;
        cursor: pointer;
      }
    }

    .col-value {
      min-width: 300px;

      select, input {
        width: 100%;
        padding: 5px 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 13px;
      }

      .expr-input, .const-input { font-family: monospace; }

      .skip-hint {
        color: #aaa;
        font-style: italic;
        font-size: 12px;
      }
    }

    /* Preview section */
    .preview-section {
      border: 1px solid #e0e0e0;
      border-radius: 8px;
      padding: 16px;
    }

    .preview-stats {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }

    .generated-at {
      font-size: 12px;
      color: #888;
    }

    .error-list {
      background: #fff3e0;
      border-left: 4px solid #e65100;
      padding: 10px 16px;
      margin: 0 0 12px;
      border-radius: 0 4px 4px 0;
      font-size: 13px;
      color: #bf360c;

      li { margin: 4px 0; }
      .more-errors { font-style: italic; opacity: 0.7; }
    }

    .preview-table-wrap {
      overflow-x: auto;
      border: 1px solid #e8e8e8;
      border-radius: 4px;
    }

    .preview-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;

      th {
        background: #f5f5f5;
        padding: 8px 12px;
        text-align: left;
        font-weight: 600;
        color: #555;
        white-space: nowrap;
        border-bottom: 2px solid #ddd;
      }

      td {
        padding: 6px 12px;
        border-bottom: 1px solid #f0f0f0;
        white-space: nowrap;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      tr:hover td { background: #fafafa; }
    }

    /* Busy overlay */
    .busy-overlay {
      position: absolute;
      inset: 0;
      background: rgba(255,255,255,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10;
      border-radius: 8px;
    }
  `],
})
export class TemplateMappingComponent implements OnInit {
  private db           = inject(LocalDbService);
  private templateSvc  = inject(TemplateService);
  private fillSvc      = inject(TemplateFillService);
  private exportSvc    = inject(XlsxTemplateExportService);
  private canonicalSvc = inject(CanonicalModelService);
  ws                   = inject(WorkspaceService);
  private toast        = inject(ToastService);

  template       = signal<TemplateSpec | null>(null);
  activeSheetIdx = signal(0);
  editableRules  = signal<MappingRule[]>([]);
  preview        = signal<GeneratedSheetPreview | null>(null);
  recordCount    = signal(0);
  busy           = signal(false);

  private get activeSheet(): { sheetName: string; headers: string[] } | null {
    return this.template()?.sheets[this.activeSheetIdx()] ?? null;
  }

  async ngOnInit(): Promise<void> {
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    const spec = await this.templateSvc.getActive();
    this.template.set(spec);
    if (spec && this.ws.activeWorkspace()) {
      await this.loadSheetMapping(0);
    }
  }

  async onTabChange(idx: number): Promise<void> {
    this.activeSheetIdx.set(idx);
    this.preview.set(null);
    await this.loadSheetMapping(idx);
  }

  private async loadSheetMapping(idx: number): Promise<void> {
    const tmpl  = this.template();
    const sheet = tmpl?.sheets[idx] ?? null;
    const wsId  = this.ws.activeWorkspace()?.id;
    if (!sheet || !wsId || !tmpl) {
      this.editableRules.set([]);
      this.recordCount.set(0);
      return;
    }

    const existing = await this.db.getTemplateMapping(wsId, tmpl.id, sheet.sheetName);
    if (existing) {
      // Ensure every current header has a rule (template may have changed)
      const ruleMap = new Map(existing.rules.map(r => [r.targetColumn, r]));
      const rules = sheet.headers.map(h =>
        ruleMap.get(h) ?? { targetColumn: h, sourceKind: '' as const, sourceValue: '' }
      );
      this.editableRules.set(rules);
    } else {
      // Seed defaults for known columns, blank otherwise
      const rules = sheet.headers.map(h => {
        const d = this.canonicalSvc.defaultRuleFor(sheet.sheetName, h);
        return d ?? { targetColumn: h, sourceKind: '' as const, sourceValue: '' };
      });
      this.editableRules.set(rules);
    }

    // Load count from the associated canonical source
    const count = await this.fillSvc.countRecords(wsId, sheet.sheetName);
    this.recordCount.set(count);

    // Restore persisted preview if available
    const savedPreview = await this.db.getGeneratedSheetPreview(wsId, tmpl.id, sheet.sheetName);
    this.preview.set(savedPreview ?? null);
  }

  // ── Rule editing ────────────────────────────────────────────────────────────

  updateRuleKind(idx: number, kind: string): void {
    this.editableRules.update(rules => {
      const copy = [...rules];
      copy[idx] = { ...copy[idx], sourceKind: kind as MappingRule['sourceKind'], sourceValue: '' };
      return copy;
    });
    // Clear preview when mapping changes
    this.preview.set(null);
  }

  updateRuleValue(idx: number, value: string): void {
    this.editableRules.update(rules => {
      const copy = [...rules];
      copy[idx] = { ...copy[idx], sourceValue: value };
      return copy;
    });
    this.preview.set(null);
  }

  // ── Actions ─────────────────────────────────────────────────────────────────

  async uploadTemplate(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.busy.set(true);
    try {
      const spec = await this.templateSvc.loadFromFile(file);
      this.template.set(spec);
      this.activeSheetIdx.set(0);
      this.preview.set(null);
      if (this.ws.activeWorkspace()) {
        await this.loadSheetMapping(0);
      }
      this.toast.success(`Template "${spec.name}" loaded — ${spec.sheets.length} sheets`);
    } catch (err) {
      this.toast.error(`Failed to load template: ${err}`);
    } finally {
      this.busy.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }

  async saveMapping(): Promise<void> {
    const wsId  = this.ws.activeWorkspace()?.id;
    const tmpl  = this.template();
    const sheet = this.activeSheet;
    if (!wsId || !tmpl || !sheet) return;

    const mapping: TemplateMapping = {
      id:          `${wsId}:${tmpl.id}:${sheet.sheetName}`,
      workspaceId: wsId,
      templateId:  tmpl.id,
      sheetName:   sheet.sheetName,
      rules:       this.editableRules(),
      updatedAt:   new Date().toISOString(),
    };
    await this.db.putTemplateMapping(mapping);
    this.toast.success('Mapping saved');
  }

  async previewRows(): Promise<void> {
    const wsId  = this.ws.activeWorkspace()?.id;
    const tmpl  = this.template();
    const sheet = this.activeSheet;
    if (!wsId || !tmpl || !sheet) return;
    this.busy.set(true);
    try {
      const result = await this.fillSvc.fillSheet(
        wsId, sheet.sheetName, sheet.headers, this.editableRules(),
      );
      const p: GeneratedSheetPreview = {
        id:          `${wsId}:${tmpl.id}:${sheet.sheetName}`,
        workspaceId: wsId,
        templateId:  tmpl.id,
        sheetName:   sheet.sheetName,
        rowCount:    result.rows.length,
        previewRows: result.rows.slice(0, 25),
        errors:      result.errors,
        generatedAt: new Date().toISOString(),
      };
      await this.db.putGeneratedSheetPreview(p);
      this.preview.set(p);
      if (result.errors.length) {
        this.toast.info(`Preview ready — ${result.errors.length} issue(s) found`);
      } else {
        this.toast.success(`Preview ready — ${result.rows.length} rows`);
      }
    } finally {
      this.busy.set(false);
    }
  }

  async generateXlsx(): Promise<void> {
    const wsObj = this.ws.activeWorkspace();
    const tmpl  = this.template();
    if (!wsObj || !tmpl) return;
    this.busy.set(true);
    try {
      const filledSheets = [];
      for (const sheet of tmpl.sheets) {
        const mapping = await this.db.getTemplateMapping(wsObj.id, tmpl.id, sheet.sheetName);
        if (!mapping) continue;
        const result = await this.fillSvc.fillSheet(
          wsObj.id, sheet.sheetName, sheet.headers, mapping.rules,
        );
        filledSheets.push({ sheetName: sheet.sheetName, headers: sheet.headers, rows: result.rows });
      }

      if (!filledSheets.length) {
        this.toast.info('No sheets have saved mappings yet — save at least one tab first');
        return;
      }

      await this.exportSvc.generateWorkbook(tmpl, filledSheets, wsObj.name);
      const totalRows = filledSheets.reduce((s, f) => s + f.rows.length, 0);
      this.toast.success(`XLSX downloaded — ${totalRows} rows across ${filledSheets.length} sheet(s)`);
    } catch (err) {
      this.toast.error(`Export failed: ${err}`);
    } finally {
      this.busy.set(false);
    }
  }

  // ── Template helpers ─────────────────────────────────────────────────────────

  fieldOptions(sheetName: string): CanonicalFieldOption[] {
    return this.canonicalSvc.fieldOptionsForSheet(sheetName);
  }

  previewHeaders(sheetHeaders: string[]): string[] {
    // Return only headers that have at least one mapped (non-empty) value in the preview
    const p = this.preview();
    if (!p || !p.previewRows.length) return sheetHeaders;

    const presentKeys = new Set<string>();
    p.previewRows.forEach(row => Object.keys(row).forEach(k => presentKeys.add(k)));

    // Preserve template column order; include all mapped columns
    return sheetHeaders.filter(h => presentKeys.has(h));
  }
}
