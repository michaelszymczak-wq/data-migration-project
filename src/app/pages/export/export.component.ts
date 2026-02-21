import { Component, inject, signal, computed, effect, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';

import { WorkspaceService } from '../../services/workspace.service';
import { LocalDbService } from '../../services/local-db.service';
import { TargetSchemaService } from '../../services/target-schema.service';
import { ExportService, CategoryExport } from '../../services/export.service';
import { ToastService } from '../../services/toast.service';
import { NoWorkspaceComponent } from '../../shared/no-workspace.component';

import { Category, ALL_CATEGORIES, StagedRecord, RawFile, Classification, Mapping } from '../../models';

interface ChecklistItem {
  label: string;
  ok: boolean;
  detail: string;
}

interface CategoryTab {
  category: Category;
  records: StagedRecord[];
  errorCount: number;
  preview: StagedRecord[];   // first 5 rows
  headers: string[];         // field labels for the preview table
}

@Component({
  selector: 'app-export',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
    MatIconModule,
    MatButtonModule,
    MatTabsModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    NoWorkspaceComponent,
  ],
  styles: [`
    .export-layout { display: flex; flex-direction: column; gap: 24px; }

    /* ── Checklist ──────────────────────────────────────────── */
    .checklist-card {
      background: var(--mat-sys-surface-container, #f3f4f6);
      border-radius: 12px;
      padding: 20px 24px;
    }
    .checklist-card h3 { margin: 0 0 16px; font-size: 16px; font-weight: 600; }
    .checklist-items { display: flex; flex-direction: column; gap: 10px; }
    .check-row {
      display: flex; align-items: flex-start; gap: 12px;
      font-size: 14px;
    }
    .check-row mat-icon { flex-shrink: 0; font-size: 20px; width: 20px; height: 20px; margin-top: 1px; }
    .check-ok   mat-icon { color: #2e7d32; }
    .check-warn mat-icon { color: #e65100; }
    .check-label { font-weight: 500; }
    .check-detail { color: #666; font-size: 12px; margin-top: 2px; }

    /* ── Download all ───────────────────────────────────────── */
    .download-bar {
      display: flex; align-items: center; gap: 12px;
      background: #1a237e;
      color: #fff;
      border-radius: 12px;
      padding: 16px 24px;
    }
    .download-bar mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .download-bar-text { flex: 1; }
    .download-bar-text p { margin: 0; font-size: 13px; opacity: 0.8; }
    .download-bar-text h3 { margin: 0; font-size: 16px; font-weight: 600; }

    /* ── Category tabs ──────────────────────────────────────── */
    .tab-content { padding: 16px 0; display: flex; flex-direction: column; gap: 16px; }

    .tab-stats {
      display: flex; gap: 16px; flex-wrap: wrap;
    }
    .stat-chip {
      padding: 6px 14px; border-radius: 20px; font-size: 13px; font-weight: 500;
      display: flex; align-items: center; gap: 6px;
    }
    .stat-records { background: #e8eaf6; color: #1a237e; }
    .stat-errors  { background: #ffebee; color: #b71c1c; }
    .stat-clean   { background: #e8f5e9; color: #1b5e20; }

    .tab-actions { display: flex; gap: 10px; flex-wrap: wrap; }

    .preview-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid #e0e0e0; }
    .preview-table {
      width: 100%; border-collapse: collapse; font-size: 12px;
    }
    .preview-table th {
      background: #1a237e; color: #fff;
      padding: 8px 10px; text-align: left;
      white-space: nowrap; font-weight: 500;
      position: sticky; top: 0;
    }
    .preview-table td {
      padding: 6px 10px; border-bottom: 1px solid #f0f0f0;
      max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .preview-table tr:last-child td { border-bottom: none; }
    .preview-table tr:nth-child(even) td { background: #fafafa; }
    .has-error td { background: #fff8f8 !important; }
    .err-badge {
      font-size: 11px; color: #c62828;
      padding: 1px 5px; border-radius: 4px; background: #ffebee;
      white-space: nowrap;
    }
    .more-rows {
      text-align: center; padding: 8px; font-size: 12px; color: #888;
      border-top: 1px solid #f0f0f0;
    }

    .empty-tabs {
      text-align: center; padding: 48px 24px; color: #888;
    }
    .empty-tabs mat-icon { font-size: 48px; width: 48px; height: 48px; color: #ccc; display: block; margin: 0 auto 12px; }

    .spinner-overlay {
      display: flex; align-items: center; gap: 12px; padding: 12px 0; color: #555;
    }
  `],
  template: `
    @if (!ws.activeWorkspace()) {
      <app-no-workspace />
    } @else {
      <div class="page-container">
        <div class="page-header">
          <mat-icon>download</mat-icon>
          <h2>Export</h2>
          <span class="spacer"></span>
          @if (loading()) {
            <div class="spinner-overlay">
              <mat-spinner diameter="20" />
              <span>Loading…</span>
            </div>
          }
        </div>

        <div class="export-layout">

          <!-- ── Readiness checklist ───────────────────────── -->
          <div class="checklist-card">
            <h3>Readiness checklist</h3>
            <div class="checklist-items">
              @for (item of checklist(); track item.label) {
                <div class="check-row" [class.check-ok]="item.ok" [class.check-warn]="!item.ok">
                  <mat-icon>{{ item.ok ? 'check_circle' : 'warning' }}</mat-icon>
                  <div>
                    <div class="check-label">{{ item.label }}</div>
                    <div class="check-detail">{{ item.detail }}</div>
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- ── Download All ZIP ──────────────────────────── -->
          <div class="download-bar">
            <mat-icon>folder_zip</mat-icon>
            <div class="download-bar-text">
              <h3>Download All (ZIP)</h3>
              <p>All categories — JSON + CSV per category + manifest</p>
            </div>
            <button mat-flat-button color="accent"
                    [disabled]="tabs().length === 0 || zipping()"
                    (click)="downloadZip()">
              @if (zipping()) { <mat-spinner diameter="18" /> }
              @else { <mat-icon>download</mat-icon> }
              &nbsp;Download ZIP
            </button>
          </div>

          <!-- ── Category tabs ─────────────────────────────── -->
          @if (tabs().length === 0) {
            <div class="empty-tabs">
              <mat-icon>inbox</mat-icon>
              <p>No staged records yet. Go to <strong>Mapping</strong> and generate staging for each file.</p>
            </div>
          } @else {
            <mat-tab-group animationDuration="200ms">
              @for (tab of tabs(); track tab.category) {
                <mat-tab>
                  <ng-template mat-tab-label>
                    {{ tab.category }}
                    @if (tab.errorCount > 0) {
                      <span style="margin-left:6px; color:#c62828; font-size:11px">
                        ⚠ {{ tab.errorCount }}
                      </span>
                    }
                  </ng-template>

                  <div class="tab-content">

                    <!-- stats -->
                    <div class="tab-stats">
                      <div class="stat-chip stat-records">
                        <mat-icon style="font-size:16px;width:16px;height:16px">table_rows</mat-icon>
                        {{ tab.records.length | number }} records
                      </div>
                      @if (tab.errorCount > 0) {
                        <div class="stat-chip stat-errors">
                          <mat-icon style="font-size:16px;width:16px;height:16px">error_outline</mat-icon>
                          {{ tab.errorCount | number }} with errors
                        </div>
                      } @else {
                        <div class="stat-chip stat-clean">
                          <mat-icon style="font-size:16px;width:16px;height:16px">check_circle</mat-icon>
                          No errors
                        </div>
                      }
                    </div>

                    <!-- per-category download buttons -->
                    <div class="tab-actions">
                      <button mat-stroked-button (click)="downloadJson(tab)">
                        <mat-icon>data_object</mat-icon>
                        Download JSON
                      </button>
                      <button mat-stroked-button (click)="downloadCsv(tab)">
                        <mat-icon>table_chart</mat-icon>
                        Download CSV
                      </button>
                    </div>

                    <!-- 5-row preview -->
                    @if (tab.preview.length > 0) {
                      <div class="preview-wrap">
                        <table class="preview-table">
                          <thead>
                            <tr>
                              <th>#</th>
                              @for (h of tab.headers; track h) { <th>{{ h }}</th> }
                              <th>Errors</th>
                            </tr>
                          </thead>
                          <tbody>
                            @for (rec of tab.preview; track rec.id; let i = $index) {
                              <tr [class.has-error]="rec.errors.length > 0">
                                <td>{{ i + 1 }}</td>
                                @for (h of tab.headers; track h) {
                                  <td [title]="cellStr(rec, h, tab)">{{ cellStr(rec, h, tab) }}</td>
                                }
                                <td>
                                  @if (rec.errors.length > 0) {
                                    <span class="err-badge"
                                          [matTooltip]="rec.errors.join('\n')">
                                      {{ rec.errors.length }} error{{ rec.errors.length > 1 ? 's' : '' }}
                                    </span>
                                  }
                                </td>
                              </tr>
                            }
                          </tbody>
                        </table>
                        @if (tab.records.length > 5) {
                          <div class="more-rows">
                            … and {{ tab.records.length - 5 | number }} more rows
                          </div>
                        }
                      </div>
                    }

                  </div>
                </mat-tab>
              }
            </mat-tab-group>
          }

        </div><!-- /export-layout -->
      </div><!-- /page-container -->
    }
  `,
})
export class ExportComponent {
  readonly ws      = inject(WorkspaceService);
  private db       = inject(LocalDbService);
  private schema   = inject(TargetSchemaService);
  private exporter = inject(ExportService);
  private toast    = inject(ToastService);

  loading = signal(false);
  zipping = signal(false);

  // Raw data signals
  private rawFiles       = signal<RawFile[]>([]);
  private classifications = signal<Classification[]>([]);
  private mappings       = signal<Mapping[]>([]);
  private staged         = signal<StagedRecord[]>([]);

  // ── Derived: checklist ───────────────────────────────────────────────────

  readonly checklist = computed<ChecklistItem[]>(() => {
    const files   = this.rawFiles();
    const cls     = this.classifications();
    const maps    = this.mappings();
    const records = this.staged();

    const classifiedCount  = cls.length;
    const mappedCategories = maps.length;
    const stagedCount      = records.length;
    const errorCount       = records.filter(r => r.errors.length > 0).length;

    return [
      {
        label: 'Files imported',
        ok: files.length > 0,
        detail: files.length === 0
          ? 'No files imported yet — go to Import'
          : `${files.length} file${files.length > 1 ? 's' : ''} in workspace`,
      },
      {
        label: 'Files categorised',
        ok: classifiedCount === files.length && files.length > 0,
        detail: files.length === 0
          ? 'Import files first'
          : `${classifiedCount} / ${files.length} classified`,
      },
      {
        label: 'Mappings saved',
        ok: mappedCategories > 0,
        detail: mappedCategories === 0
          ? 'No mappings saved yet — go to Mapping'
          : `${mappedCategories} categor${mappedCategories > 1 ? 'ies' : 'y'} mapped`,
      },
      {
        label: 'Records staged',
        ok: stagedCount > 0,
        detail: stagedCount === 0
          ? 'Generate staging on the Mapping page'
          : `${stagedCount.toLocaleString()} records staged`,
      },
      {
        label: 'No transformation errors',
        ok: errorCount === 0,
        detail: errorCount === 0
          ? 'All records look clean'
          : `${errorCount.toLocaleString()} record${errorCount > 1 ? 's' : ''} have errors — review on Mapping page`,
      },
    ];
  });

  // ── Derived: category tabs ───────────────────────────────────────────────

  readonly tabs = computed<CategoryTab[]>(() => {
    const allRecords = this.staged();
    const result: CategoryTab[] = [];

    for (const category of ALL_CATEGORIES) {
      const records = allRecords.filter(r => r.category === category);
      if (records.length === 0) continue;

      const fields  = this.schema.fieldsFor(category);
      const headers = fields.map(f => f.label);

      result.push({
        category,
        records,
        errorCount: records.filter(r => r.errors.length > 0).length,
        preview: records.slice(0, 5),
        headers,
      });
    }
    return result;
  });

  // ── Constructor: reactive reload on workspace change ────────────────────

  constructor() {
    effect(() => {
      const wsId = this.ws.activeId();
      if (wsId) {
        this.load(wsId);
      } else {
        this.rawFiles.set([]);
        this.classifications.set([]);
        this.mappings.set([]);
        this.staged.set([]);
      }
    });
  }

  private async load(wsId: string): Promise<void> {
    this.loading.set(true);
    const [files, cls, maps, recs] = await Promise.all([
      this.db.listRawFilesByWorkspace(wsId),
      this.db.listClassificationsByWorkspace(wsId),
      this.db.listMappingsByWorkspace(wsId),
      this.db.listStagedByWorkspace(wsId),
    ]);
    this.rawFiles.set(files);
    this.classifications.set(cls);
    this.mappings.set(maps);
    this.staged.set(recs);
    this.loading.set(false);
  }

  // ── Helper: cell display value ───────────────────────────────────────────

  cellStr(rec: StagedRecord, headerLabel: string, tab: CategoryTab): string {
    const fields = this.schema.fieldsFor(tab.category);
    const field = fields.find(f => f.label === headerLabel);
    if (!field) return '';
    const val = rec.data[field.key];
    if (val === null || val === undefined) return '';
    return String(val);
  }

  // ── Downloads ────────────────────────────────────────────────────────────

  downloadJson(tab: CategoryTab): void {
    const fields = this.schema.fieldsFor(tab.category);
    const data   = this.exporter.toJson(tab.records, fields);
    const blob   = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const safe   = tab.category.replace(/[^a-z0-9]/gi, '_');
    this.exporter.downloadBlob(blob, `${safe}.json`);
    this.toast.success(`Downloaded ${safe}.json (${tab.records.length} records)`);
  }

  downloadCsv(tab: CategoryTab): void {
    const fields = this.schema.fieldsFor(tab.category);
    const csv    = this.exporter.toCsv(tab.records, fields);
    const blob   = new Blob([csv], { type: 'text/csv' });
    const safe   = tab.category.replace(/[^a-z0-9]/gi, '_');
    this.exporter.downloadBlob(blob, `${safe}.csv`);
    this.toast.success(`Downloaded ${safe}.csv (${tab.records.length} records)`);
  }

  async downloadZip(): Promise<void> {
    this.zipping.set(true);
    const wsName = this.ws.activeWorkspace()?.name ?? 'workspace';
    const exports: CategoryExport[] = this.tabs().map(tab => ({
      category: tab.category,
      records:  tab.records,
      fields:   this.schema.fieldsFor(tab.category),
    }));

    const blob = await this.exporter.toZip(exports, wsName);
    const safe = wsName.replace(/[^a-z0-9]/gi, '_');
    this.exporter.downloadBlob(blob, `${safe}_export.zip`);
    const total = exports.reduce((sum, e) => sum + e.records.length, 0);
    this.toast.success(`Downloaded ZIP — ${exports.length} categories, ${total} records`);
    this.zipping.set(false);
  }
}
