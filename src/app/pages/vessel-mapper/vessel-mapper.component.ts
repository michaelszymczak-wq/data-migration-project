import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import Papa from 'papaparse';
import {
  VesselMapperService,
  VesselMapperConfig,
  MapResult,
} from '../../services/vessel-mapper.service';

@Component({
  selector: 'app-vessel-mapper',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
    MatSelectModule,
    MatFormFieldModule,
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <h2>Vessel Import Mapper</h2>
        <p class="subtitle">Upload VINx2 barrel list + InnoVint attribute table, run fuzzy matching in-browser, then download the import-ready CSV.</p>
      </div>

      <!-- ── Step 1: Upload Files ── -->
      <section class="card">
        <div class="section-title">
          <span class="step-badge">1</span>
          Upload Files
        </div>
        <div class="upload-row">
          <div class="upload-box" [class.loaded]="vinx2Text()">
            <label>
              <mat-icon>table_chart</mat-icon>
              <span>VINx2 Barrel List CSV</span>
              <input type="file" accept=".csv" (change)="onVinx2File($event)" />
            </label>
            @if (vinx2Name()) {
              <div class="file-info">
                <mat-icon class="ok-icon">check_circle</mat-icon>
                <span>{{ vinx2Name() }}</span>
                @if (vinx2Rows()) {
                  <span class="row-count">{{ vinx2Rows() }} rows detected</span>
                }
              </div>
            } @else {
              <div class="file-hint">No file selected</div>
            }
          </div>

          <div class="upload-box" [class.loaded]="attrText()">
            <label>
              <mat-icon>rule</mat-icon>
              <span>InnoVint Attribute Table CSV</span>
              <input type="file" accept=".csv" (change)="onAttrFile($event)" />
            </label>
            @if (attrName()) {
              <div class="file-info">
                <mat-icon class="ok-icon">check_circle</mat-icon>
                <span>{{ attrName() }}</span>
                <span class="row-count">Loaded</span>
              </div>
            } @else {
              <div class="file-hint">No file selected</div>
            }
          </div>
        </div>
      </section>

      <!-- ── Step 2: Options ── -->
      <section class="card">
        <div class="section-title">
          <span class="step-badge">2</span>
          Options
        </div>
        <div class="options-row">
          <mat-form-field appearance="outline" class="opt-field">
            <mat-label>Color source</mat-label>
            <mat-select [value]="config().colorDerivation" (valueChange)="patchConfig('colorDerivation', $event)">
              <mat-option value="last_contained">Last Contained</mat-option>
              <mat-option value="none">None (leave blank)</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="opt-field">
            <mat-label>Duplicates</mat-label>
            <mat-select [value]="config().duplicateHandling" (valueChange)="patchConfig('duplicateHandling', $event)">
              <mat-option value="include_all">Include all</mat-option>
              <mat-option value="keep_first">Keep first</mat-option>
              <mat-option value="keep_last">Keep last</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="opt-field">
            <mat-label>Unmatched values</mat-label>
            <mat-select [value]="config().unmatchedAction" (valueChange)="patchConfig('unmatchedAction', $event)">
              <mat-option value="leave_blank">Leave blank</mat-option>
              <mat-option value="use_closest">Use closest match</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <div class="run-row">
          <button
            mat-raised-button
            color="primary"
            [disabled]="!vinx2Text() || !attrText() || busy()"
            (click)="runMapping()"
          >
            @if (busy()) {
              <mat-spinner diameter="18" style="display:inline-block;margin-right:8px;vertical-align:middle"></mat-spinner>
            } @else {
              <mat-icon>play_arrow</mat-icon>
            }
            Run Mapping
          </button>
          @if (!vinx2Text() || !attrText()) {
            <span class="run-hint">Upload both files to enable</span>
          }
        </div>
      </section>

      <!-- ── Results ── -->
      @if (result(); as res) {
        <section class="card">
          <div class="section-title">Results</div>

          <div class="chips-row">
            <mat-chip-set>
              <mat-chip>
                <mat-icon matChipAvatar>table_rows</mat-icon>
                {{ res.rows.length }} rows
              </mat-chip>
              <mat-chip [class.warn-chip]="res.unmatched.length > 0">
                <mat-icon matChipAvatar>warning</mat-icon>
                {{ res.unmatched.length }} unmatched
              </mat-chip>
              <mat-chip [class.warn-chip]="res.duplicateCodes.length > 0">
                <mat-icon matChipAvatar>content_copy</mat-icon>
                {{ res.duplicateCodes.length }} duplicate codes
              </mat-chip>
            </mat-chip-set>

            <div class="download-buttons">
              <button mat-stroked-button color="primary" (click)="downloadMapped()">
                <mat-icon>download</mat-icon>
                Mapped CSV
              </button>
              <button mat-stroked-button (click)="downloadUnmatched()" [disabled]="res.unmatched.length === 0">
                <mat-icon>download</mat-icon>
                Unmatched Report
              </button>
            </div>
          </div>

          <!-- Tab switcher -->
          <div class="tab-bar">
            <button
              mat-button
              [class.active-tab]="activeTab() === 'preview'"
              (click)="activeTab.set('preview')"
            >
              <mat-icon>preview</mat-icon>
              Mapped Preview
            </button>
            <button
              mat-button
              [class.active-tab]="activeTab() === 'unmatched'"
              (click)="activeTab.set('unmatched')"
            >
              <mat-icon>report_problem</mat-icon>
              Unmatched Values ({{ res.unmatched.length }})
            </button>
          </div>

          <!-- Mapped Preview table -->
          @if (activeTab() === 'preview') {
            <div class="table-wrap">
              <table class="data-table">
                <thead>
                  <tr>
                    @for (h of previewHeaders; track h) {
                      <th>{{ h }}</th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (row of res.rows | slice:0:50; track $index) {
                    <tr>
                      @for (h of previewHeaders; track h) {
                        <td>{{ row[h] }}</td>
                      }
                    </tr>
                  }
                </tbody>
              </table>
              @if (res.rows.length > 50) {
                <div class="table-footer">Showing first 50 of {{ res.rows.length }} rows</div>
              }
            </div>
          }

          <!-- Unmatched table -->
          @if (activeTab() === 'unmatched') {
            @if (res.unmatched.length === 0) {
              <div class="empty-state">
                <mat-icon>check_circle</mat-icon>
                <p>All values matched successfully!</p>
              </div>
            } @else {
              <div class="table-wrap">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>Row #</th>
                      <th>VINx2 Field</th>
                      <th>VINx2 Value</th>
                      <th>InnoVint Field</th>
                      <th>Closest Match</th>
                      <th>Action Taken</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (u of res.unmatched; track $index) {
                      <tr>
                        <td>{{ u.rowNumber }}</td>
                        <td>{{ u.vinx2Field }}</td>
                        <td class="highlight-cell">{{ u.vinx2Value }}</td>
                        <td>{{ u.innovintField }}</td>
                        <td class="muted-cell">{{ u.closestMatch || '—' }}</td>
                        <td>{{ u.actionTaken }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          }
        </section>
      }
    </div>
  `,
  styles: [`
    .page-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 24px;
      h2 { margin: 0 0 4px; font-size: 24px; font-weight: 600; }
      .subtitle { margin: 0; color: rgba(0,0,0,0.6); font-size: 14px; }
    }

    .card {
      background: white;
      border-radius: 8px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.12);
      padding: 20px 24px;
      margin-bottom: 20px;
    }

    .section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #1a237e;
    }

    .step-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #1a237e;
      color: white;
      font-size: 13px;
      font-weight: 700;
      flex-shrink: 0;
    }

    /* ── Upload ── */
    .upload-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    .upload-box {
      border: 2px dashed #ccc;
      border-radius: 8px;
      padding: 16px;
      transition: border-color 0.2s;

      &.loaded { border-color: #43a047; border-style: solid; }

      label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        font-weight: 500;
        margin-bottom: 10px;

        input[type=file] { display: none; }
        mat-icon { color: #1a237e; }
      }
    }

    .file-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;

      .ok-icon { color: #43a047; font-size: 18px; }
      .row-count {
        margin-left: 4px;
        background: #e8f5e9;
        color: #2e7d32;
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 500;
      }
    }

    .file-hint { font-size: 13px; color: rgba(0,0,0,0.4); font-style: italic; }

    /* ── Options ── */
    .options-row {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;

      .opt-field { min-width: 200px; }
    }

    .run-row {
      display: flex;
      align-items: center;
      gap: 12px;

      .run-hint { font-size: 13px; color: rgba(0,0,0,0.45); }
    }

    /* ── Results ── */
    .chips-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }

    .warn-chip { --mdc-chip-container-color: #fff3e0 !important; }

    .download-buttons {
      display: flex;
      gap: 8px;
    }

    .tab-bar {
      display: flex;
      gap: 4px;
      border-bottom: 2px solid #e0e0e0;
      margin-bottom: 16px;

      .active-tab {
        color: #1a237e;
        border-bottom: 2px solid #1a237e;
        margin-bottom: -2px;
        font-weight: 600;
      }
    }

    /* ── Table ── */
    .table-wrap {
      overflow-x: auto;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;

      th {
        background: #f5f5f5;
        border: 1px solid #e0e0e0;
        padding: 8px 10px;
        text-align: left;
        white-space: nowrap;
        font-weight: 600;
        position: sticky;
        top: 0;
      }

      td {
        border: 1px solid #e0e0e0;
        padding: 6px 10px;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      tr:nth-child(even) td { background: #fafafa; }
      tr:hover td { background: #e8eaf6; }
    }

    .highlight-cell { font-weight: 500; color: #b71c1c; }
    .muted-cell { color: rgba(0,0,0,0.5); }

    .table-footer {
      text-align: center;
      padding: 8px;
      font-size: 13px;
      color: rgba(0,0,0,0.5);
      border-top: 1px solid #e0e0e0;
    }

    .empty-state {
      text-align: center;
      padding: 32px;
      color: rgba(0,0,0,0.4);

      mat-icon { font-size: 40px; width: 40px; height: 40px; color: #43a047; }
      p { margin-top: 8px; }
    }
  `],
})
export class VesselMapperComponent {
  private mapper = inject(VesselMapperService);

  vinx2Text  = signal<string | null>(null);
  attrText   = signal<string | null>(null);
  vinx2Name  = signal('');
  attrName   = signal('');
  vinx2Rows  = signal(0);
  result     = signal<MapResult | null>(null);
  busy       = signal(false);
  activeTab  = signal<'preview' | 'unmatched'>('preview');
  config     = signal<VesselMapperConfig>({
    colorDerivation: 'last_contained',
    duplicateHandling: 'include_all',
    defaultVesselType: 'Barrel',
    unmatchedAction: 'leave_blank',
  });

  readonly previewHeaders = [
    'Vessel code', 'Vessel type', 'Capacity (vol)', 'Bottle Type',
    'Capacity (bottles)', 'Year first used', 'Cooper', 'Style',
    'Wood', 'Forest', 'Toast', 'Color', 'Tags', 'Owners',
  ];

  onVinx2File(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.vinx2Name.set(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      this.vinx2Text.set(text);
      // Quick row count
      const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
      this.vinx2Rows.set(parsed.data.length);
    };
    reader.readAsText(file);
  }

  onAttrFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.attrName.set(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      this.attrText.set(e.target?.result as string);
    };
    reader.readAsText(file);
  }

  runMapping(): void {
    const vinx2 = this.vinx2Text();
    const attr  = this.attrText();
    if (!vinx2 || !attr) return;

    this.busy.set(true);
    this.result.set(null);

    // Run in next tick so spinner renders
    setTimeout(() => {
      try {
        const parsed = Papa.parse<Record<string, string>>(vinx2, { header: true, skipEmptyLines: true });
        const attrMap = this.mapper.parseAttrTable(attr);
        const res = this.mapper.mapAll(parsed.data, attrMap, this.config());
        this.result.set(res);
        this.activeTab.set('preview');
      } finally {
        this.busy.set(false);
      }
    }, 0);
  }

  downloadMapped(): void {
    const res = this.result();
    if (!res) return;
    const csv = Papa.unparse(res.rows, { header: true, columns: this.previewHeaders });
    this.downloadBlob(new Blob([csv], { type: 'text/csv' }), 'innovint_vessels.csv');
  }

  downloadUnmatched(): void {
    const res = this.result();
    if (!res || res.unmatched.length === 0) return;
    const csv = Papa.unparse(res.unmatched, { header: true });
    this.downloadBlob(new Blob([csv], { type: 'text/csv' }), 'unmatched_report.csv');
  }

  patchConfig<K extends keyof VesselMapperConfig>(key: K, value: VesselMapperConfig[K]): void {
    this.config.update(c => ({ ...c, [key]: value }));
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
