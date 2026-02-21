import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { WorkspaceService } from '../../services/workspace.service';
import { LocalDbService } from '../../services/local-db.service';
import { ToastService } from '../../services/toast.service';
import { WorkflowStatusService } from '../../services/workflow-status.service';
import { CATEGORY_RULES } from '../../services/classifier.service';

interface WsSummary {
  fileCount: number;
  classifiedCount: number;
  mappingCount: number;
  stagedCount: number;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, DatePipe, DecimalPipe, RouterLink,
    MatIconModule, MatButtonModule, MatExpansionModule,
    MatDividerModule, MatProgressSpinnerModule,
  ],
  styles: [`
    .settings-grid { display: flex; flex-direction: column; gap: 28px; }

    /* ── Cards ──────────────────────────────────────────────── */
    .card {
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      overflow: hidden;
    }
    .card-header {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 20px;
      background: #f5f5f5;
      border-bottom: 1px solid #e0e0e0;
      font-weight: 600; font-size: 15px;
      mat-icon { color: #3f51b5; }
    }
    .card-body { padding: 20px; }

    /* ── Workspace summary ───────────────────────────────────── */
    .ws-name {
      font-size: 20px; font-weight: 600; margin: 0 0 4px;
    }
    .ws-meta {
      font-size: 13px; color: #888; margin: 0 0 16px;
    }
    .ws-stats {
      display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px;
    }
    .ws-stat {
      background: #e8eaf6; color: #1a237e;
      padding: 5px 14px; border-radius: 16px;
      font-size: 13px; font-weight: 500;
      display: flex; align-items: center; gap: 5px;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .ws-actions { display: flex; gap: 10px; flex-wrap: wrap; }

    /* ── Danger zone ─────────────────────────────────────────── */
    .danger-card { border-color: #ffcdd2; }
    .danger-card .card-header {
      background: #fff8f8;
      border-color: #ffcdd2;
      mat-icon { color: #c62828; }
    }
    .danger-row {
      display: flex; align-items: flex-start; gap: 20px;
      padding: 14px 0;
    }
    .danger-row + .danger-row { border-top: 1px solid #ffebee; }
    .danger-text { flex: 1; }
    .danger-text strong { display: block; margin-bottom: 3px; font-size: 14px; }
    .danger-text p { margin: 0; font-size: 13px; color: #888; }

    /* ── Help & Diagnostics ──────────────────────────────────── */
    mat-expansion-panel { box-shadow: none !important; border: 1px solid #e0e0e0; border-radius: 8px !important; margin-bottom: 8px; }

    .help-step {
      display: flex; gap: 12px; align-items: flex-start;
      padding: 10px 0;
    }
    .help-step + .help-step { border-top: 1px solid #f0f0f0; }
    .step-num {
      width: 28px; height: 28px; border-radius: 50%;
      background: #1a237e; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700; flex-shrink: 0;
    }
    .step-body strong { display: block; margin-bottom: 3px; }
    .step-body p { margin: 0; font-size: 13px; color: #666; line-height: 1.5; }

    /* ── Classifier rules table ──────────────────────────────── */
    .rules-table {
      width: 100%; border-collapse: collapse; font-size: 12px;
    }
    .rules-table th {
      background: #1a237e; color: #fff;
      padding: 7px 12px; text-align: left;
      white-space: nowrap;
    }
    .rules-table td {
      padding: 6px 12px;
      border-bottom: 1px solid #f0f0f0;
      vertical-align: top;
    }
    .rules-table tr:last-child td { border-bottom: none; }
    .rules-table tr:nth-child(even) td { background: #fafafa; }
    .cat-dot {
      display: inline-block;
      width: 10px; height: 10px; border-radius: 50%;
      margin-right: 6px; vertical-align: middle;
    }
    .token-list {
      display: flex; flex-wrap: wrap; gap: 4px;
    }
    .token {
      background: #e8eaf6; color: #3f51b5;
      padding: 1px 6px; border-radius: 4px;
      font-size: 11px;
    }

    .spinner-row {
      display: flex; align-items: center; gap: 8px;
      color: #888; font-size: 14px; padding: 8px 0;
    }

    .no-workspace-card {
      padding: 40px; text-align: center; color: #888;
      border: 1px dashed #e0e0e0; border-radius: 10px;
    }
  `],
  template: `
    <div class="page-container">
      <div class="page-header">
        <mat-icon>settings</mat-icon>
        <h2>Settings</h2>
      </div>

      <div class="settings-grid">

        <!-- ── Current workspace ──────────────────────────────── -->
        @if (ws.activeWorkspace(); as active) {
          <div class="card">
            <div class="card-header">
              <mat-icon>folder_open</mat-icon>
              Current Workspace
            </div>
            <div class="card-body">
              <p class="ws-name">{{ active.name }}</p>
              <p class="ws-meta">Created {{ active.createdAt | date:'medium' }}</p>

              @if (resetting()) {
                <div class="spinner-row">
                  <mat-spinner diameter="20" />
                  Resetting workspace data…
                </div>
              } @else {
                <div class="ws-stats">
                  <div class="ws-stat">
                    <mat-icon>upload_file</mat-icon>
                    {{ summary().fileCount }} files
                  </div>
                  <div class="ws-stat">
                    <mat-icon>fact_check</mat-icon>
                    {{ summary().classifiedCount }} classified
                  </div>
                  <div class="ws-stat">
                    <mat-icon>schema</mat-icon>
                    {{ summary().mappingCount }} mappings
                  </div>
                  <div class="ws-stat">
                    <mat-icon>storage</mat-icon>
                    {{ summary().stagedCount }} staged records
                  </div>
                </div>
              }
            </div>
          </div>

          <!-- ── Danger zone ──────────────────────────────────── -->
          <div class="card danger-card">
            <div class="card-header">
              <mat-icon>warning</mat-icon>
              Danger Zone
            </div>
            <div class="card-body">
              <div class="danger-row">
                <div class="danger-text">
                  <strong>Reset workspace data</strong>
                  <p>Deletes all imported files, classifications, mappings, and staged records for <em>{{ active.name }}</em>. The workspace itself is kept.</p>
                </div>
                <button mat-stroked-button color="warn"
                        [disabled]="resetting() || clearing()"
                        (click)="resetWorkspace()">
                  <mat-icon>restart_alt</mat-icon>
                  Reset Data
                </button>
              </div>
              <div class="danger-row">
                <div class="danger-text">
                  <strong>Clear all local data</strong>
                  <p>Permanently deletes ALL workspaces, files, and records stored in this browser. Cannot be undone.</p>
                </div>
                <button mat-flat-button color="warn"
                        [disabled]="resetting() || clearing()"
                        (click)="clearAll()">
                  @if (clearing()) { <mat-spinner diameter="16" /> }
                  @else { <mat-icon>delete_forever</mat-icon> }
                  Clear All Data
                </button>
              </div>
            </div>
          </div>

        } @else {
          <div class="no-workspace-card">
            <mat-icon style="font-size:40px;width:40px;height:40px;display:block;margin:0 auto 8px;color:#ccc">folder_open</mat-icon>
            <p>No workspace active. <a routerLink="/">Select one on the Home page</a> to see workspace settings.</p>
          </div>
        }

        <!-- ── Help / workflow guide ──────────────────────────── -->
        <div>
          <h3 style="margin:0 0 12px;font-size:15px;font-weight:600">
            <mat-icon style="vertical-align:middle;margin-right:6px;color:#3f51b5">help_outline</mat-icon>
            Workflow Guide
          </h3>

          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title><strong>1. Import Files</strong></mat-panel-title>
              <mat-panel-description>Upload your CSV or XLSX spreadsheets</mat-panel-description>
            </mat-expansion-panel-header>
            <div class="help-step">
              <div class="step-num">1</div>
              <div class="step-body">
                <strong>Import</strong>
                <p>Drag & drop or click to upload CSV or XLSX files from your winery management system. Each file is stored locally in your browser (IndexedDB) — nothing is sent to a server. Use the <strong>Load sample files</strong> button on the Import page to try the tool without your own data.</p>
              </div>
            </div>
          </mat-expansion-panel>

          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title><strong>2. Review &amp; Classify</strong></mat-panel-title>
              <mat-panel-description>Auto-categorise files by content type</mat-panel-description>
            </mat-expansion-panel-header>
            <div class="help-step">
              <div class="step-num">2</div>
              <div class="step-body">
                <strong>Review</strong>
                <p>The classifier scans each file's name and column headers to guess its category (Vineyard+block, Vessel, Lot Composition, etc.). You can override the category via the dropdown. Confidence scores use keyword density: filename contributes 35% and column headers 65%.</p>
              </div>
            </div>
          </mat-expansion-panel>

          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title><strong>3. Map Columns</strong></mat-panel-title>
              <mat-panel-description>Connect source columns to InnoVint target fields</mat-panel-description>
            </mat-expansion-panel-header>
            <div class="help-step">
              <div class="step-num">3</div>
              <div class="step-body">
                <strong>Mapping</strong>
                <p>For each file category, drag the source columns to the matching target fields. One mapping is shared across all files of the same category in this workspace. Required fields are marked with ★. Duplicate assignments are highlighted in amber.</p>
              </div>
            </div>
          </mat-expansion-panel>

          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title><strong>4. Generate Staging</strong></mat-panel-title>
              <mat-panel-description>Transform and validate all rows</mat-panel-description>
            </mat-expansion-panel-header>
            <div class="help-step">
              <div class="step-num">4</div>
              <div class="step-body">
                <strong>Stage</strong>
                <p>On the Mapping page, click <em>Generate Staging Preview</em> after saving your mapping. This re-parses the full file (not just the preview rows), coerces values to the correct types (number, date, string), and writes the results to the staging store. Rows with errors are flagged.</p>
              </div>
            </div>
          </mat-expansion-panel>

          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title><strong>5. Export</strong></mat-panel-title>
              <mat-panel-description>Download JSON, CSV, or a ZIP bundle</mat-panel-description>
            </mat-expansion-panel-header>
            <div class="help-step">
              <div class="step-num">5</div>
              <div class="step-body">
                <strong>Export</strong>
                <p>On the Export page, download individual categories as JSON or CSV, or grab a single ZIP containing all categories plus a manifest.json. The ZIP uses field labels as CSV column headers and field keys in JSON. All downloads happen in your browser — no upload required.</p>
              </div>
            </div>
          </mat-expansion-panel>
        </div>

        <!-- ── Diagnostics ────────────────────────────────────── -->
        <div>
          <h3 style="margin:0 0 12px;font-size:15px;font-weight:600">
            <mat-icon style="vertical-align:middle;margin-right:6px;color:#3f51b5">biotech</mat-icon>
            Diagnostics — Classifier Rules
          </h3>
          <p style="font-size:13px;color:#666;margin:0 0 12px">
            The auto-classifier scores each file against these keyword sets.
            Score = 0.35 × (filename hits / filename keywords) + 0.65 × (header hits / header keywords).
            Highest score wins.
          </p>

          <div style="overflow-x:auto;border-radius:8px;border:1px solid #e0e0e0">
            <table class="rules-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Filename keywords</th>
                  <th>Header keywords</th>
                </tr>
              </thead>
              <tbody>
                @for (rule of rules; track rule.category) {
                  <tr>
                    <td style="white-space:nowrap; font-weight:500">{{ rule.category }}</td>
                    <td>
                      <div class="token-list">
                        @for (t of rule.filenameTokens; track t) {
                          <span class="token">{{ t }}</span>
                        }
                      </div>
                    </td>
                    <td>
                      <div class="token-list">
                        @for (t of rule.headerTokens; track t) {
                          <span class="token">{{ t }}</span>
                        }
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  `,
})
export class SettingsComponent {
  readonly ws      = inject(WorkspaceService);
  private db       = inject(LocalDbService);
  private toast    = inject(ToastService);
  private wfStatus = inject(WorkflowStatusService);

  readonly rules = CATEGORY_RULES;

  resetting = signal(false);
  clearing  = signal(false);
  summary   = signal({ fileCount: 0, classifiedCount: 0, mappingCount: 0, stagedCount: 0 });

  constructor() {
    effect(() => {
      const wsId = this.ws.activeId();
      if (wsId) this.loadSummary(wsId);
      else this.summary.set({ fileCount: 0, classifiedCount: 0, mappingCount: 0, stagedCount: 0 });
    });
  }

  private async loadSummary(wsId: string): Promise<void> {
    const [files, cls, maps, staged] = await Promise.all([
      this.db.listRawFilesByWorkspace(wsId),
      this.db.listClassificationsByWorkspace(wsId),
      this.db.listMappingsByWorkspace(wsId),
      this.db.listStagedByWorkspace(wsId),
    ]);
    this.summary.set({
      fileCount:      files.length,
      classifiedCount: cls.length,
      mappingCount:   maps.length,
      stagedCount:    staged.length,
    });
  }

  async resetWorkspace(): Promise<void> {
    const wsId = this.ws.activeId();
    const wsName = this.ws.activeWorkspace()?.name;
    if (!wsId || !wsName) return;
    if (!confirm(`Reset all data in "${wsName}"? Files, classifications, mappings, and staged records will be deleted. The workspace itself is kept.`)) return;

    this.resetting.set(true);
    await this.db.deleteWorkspaceData(wsId);
    await this.loadSummary(wsId);
    this.wfStatus.refresh();
    this.resetting.set(false);
    this.toast.success(`Workspace "${wsName}" has been reset.`);
  }

  async clearAll(): Promise<void> {
    if (!confirm('Delete ALL local data? This will remove every workspace, file, and record stored in this browser. This cannot be undone.')) return;

    this.clearing.set(true);
    await this.db.clearAll();
    this.ws.setActive(null);
    this.clearing.set(false);
    this.toast.info('All local data cleared.');
  }
}
