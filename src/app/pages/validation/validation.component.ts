import { Component, inject, signal, computed, effect } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

import { WorkspaceService } from '../../services/workspace.service';
import { LocalDbService } from '../../services/local-db.service';
import { TargetSchemaService } from '../../services/target-schema.service';
import { ValidationRulesService, builtInRulesFor } from '../../services/validation-rules.service';
import { ToastService } from '../../services/toast.service';
import { NoWorkspaceComponent } from '../../shared/no-workspace.component';

import {
  Category, ALL_CATEGORIES, ValidationRule, ValidationIssue,
  ValidationRuleType, StagedRecord, TargetSchemaField,
} from '../../models';

interface IssueRow {
  recordIndex: number;
  issue: ValidationIssue;
  identifier: string; // first field value to identify the record (e.g. lotId, vesselId)
}

// Form state for adding a new custom rule
interface RuleForm {
  name: string;
  field: string;
  type: ValidationRuleType;
  severity: 'error' | 'warning';
  min: string;
  max: string;
  pattern: string;
  patternHint: string;
}

const EMPTY_FORM: RuleForm = {
  name: '', field: '', type: 'required', severity: 'error',
  min: '', max: '', pattern: '', patternHint: '',
};

@Component({
  selector: 'app-validation',
  standalone: true,
  imports: [
    CommonModule, DecimalPipe, FormsModule,
    MatIconModule, MatButtonModule, MatSelectModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule,
    MatTooltipModule, MatChipsModule, MatDividerModule,
    MatSlideToggleModule,
    NoWorkspaceComponent,
  ],
  styles: [`
    .val-grid { display: flex; flex-direction: column; gap: 24px; }

    /* ── Top controls ───────────────────────────────────────── */
    .top-bar {
      display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap;
    }
    .top-bar mat-form-field { min-width: 240px; }

    /* ── Rule tables ────────────────────────────────────────── */
    .section-title {
      font-size: 14px; font-weight: 600; margin: 0 0 10px;
      display: flex; align-items: center; gap: 8px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #3f51b5; }
    }

    .rules-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
    }
    .rules-table th {
      background: #1a237e; color: #fff;
      padding: 8px 12px; text-align: left; white-space: nowrap;
    }
    .rules-table td {
      padding: 7px 12px; border-bottom: 1px solid #f0f0f0; vertical-align: middle;
    }
    .rules-table tr:last-child td { border-bottom: none; }
    .rules-table tr:nth-child(even) td { background: #fafafa; }
    .rules-table tr.disabled-row td { opacity: 0.45; }

    .sev-error   { color: #b71c1c; font-weight: 600; }
    .sev-warning { color: #e65100; font-weight: 600; }
    .type-badge {
      background: #e8eaf6; color: #3f51b5;
      padding: 1px 7px; border-radius: 4px; font-size: 11px;
    }
    .builtin-tag {
      background: #f3f3f3; color: #888;
      padding: 1px 6px; border-radius: 4px; font-size: 11px;
    }

    /* ── Add-rule form ──────────────────────────────────────── */
    .add-form {
      border: 1px solid #e0e0e0; border-radius: 8px;
      padding: 16px 20px; background: #fafcff;
      display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end;
    }
    .add-form mat-form-field { min-width: 160px; }
    .add-form .form-title {
      width: 100%; font-size: 13px; font-weight: 600; margin-bottom: -4px;
    }

    /* ── Run validation button + stats ──────────────────────── */
    .run-bar {
      display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
    }
    .stat-chip {
      display: inline-flex; align-items: center; gap: 5px;
      padding: 4px 12px; border-radius: 16px; font-size: 13px; font-weight: 500;
      mat-icon { font-size: 15px; width: 15px; height: 15px; }
    }
    .chip-total { background: #e8eaf6; color: #1a237e; }
    .chip-err   { background: #ffebee; color: #b71c1c; }
    .chip-warn  { background: #fff3e0; color: #e65100; }
    .chip-ok    { background: #e8f5e9; color: #1b5e20; }

    .filter-row {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
    }

    /* ── Issues table ───────────────────────────────────────── */
    .issues-wrap { overflow-x: auto; border-radius: 8px; border: 1px solid #e0e0e0; }
    .issues-table {
      width: 100%; border-collapse: collapse; font-size: 13px;
    }
    .issues-table th {
      background: #1a237e; color: #fff;
      padding: 8px 12px; text-align: left; white-space: nowrap;
      position: sticky; top: 0;
    }
    .issues-table td {
      padding: 7px 12px; border-bottom: 1px solid #f0f0f0;
    }
    .issues-table tr:last-child td { border-bottom: none; }
    .issues-table tr.row-err  td { background: #fff8f8; }
    .issues-table tr.row-warn td { background: #fffde7; }

    .val-value {
      font-family: monospace; font-size: 12px;
      background: #f5f5f5; padding: 1px 5px; border-radius: 3px;
      max-width: 120px; overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; display: inline-block; vertical-align: middle;
    }

    .empty-state {
      text-align: center; padding: 40px 24px; color: #888;
    }
    .empty-state mat-icon {
      font-size: 48px; width: 48px; height: 48px; color: #ccc;
      display: block; margin: 0 auto 12px;
    }

    .no-staged {
      padding: 14px; background: #fff8e1;
      border-radius: 8px; font-size: 14px; color: #795548;
      display: flex; align-items: center; gap: 8px;
    }
  `],
  template: `
    @if (!ws.activeWorkspace()) {
      <app-no-workspace />
    } @else {
      <div class="page-container">
        <div class="page-header">
          <mat-icon>rule</mat-icon>
          <h2>Validation Rules</h2>
        </div>

        <div class="val-grid">

          <!-- ── Category selector ─────────────────────────────── -->
          <div class="top-bar">
            <mat-form-field appearance="outline">
              <mat-label>Category</mat-label>
              <mat-select [ngModel]="selectedCategory()"
                          (ngModelChange)="selectCategory($event)">
                @for (cat of categories; track cat) {
                  <mat-option [value]="cat">{{ cat }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>

          @if (selectedCategory()) {

            <!-- ── Built-in rules ─────────────────────────────── -->
            <div>
              <p class="section-title">
                <mat-icon>verified</mat-icon>
                Built-in Rules
                <span style="font-weight:400;color:#888;font-size:12px">(always active — cannot be removed)</span>
              </p>
              <div style="overflow-x:auto;border-radius:8px;border:1px solid #e0e0e0">
                <table class="rules-table">
                  <thead>
                    <tr>
                      <th>Name</th><th>Field</th><th>Type</th><th>Params</th><th>Severity</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (rule of builtIn(); track rule.id) {
                      <tr>
                        <td>{{ rule.name }}</td>
                        <td><code>{{ rule.field }}</code></td>
                        <td><span class="type-badge">{{ rule.type }}</span></td>
                        <td>{{ paramSummary(rule) }}</td>
                        <td [class.sev-error]="rule.severity==='error'" [class.sev-warning]="rule.severity==='warning'">
                          {{ rule.severity }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>

            <!-- ── Custom rules ───────────────────────────────── -->
            <div>
              <p class="section-title">
                <mat-icon>tune</mat-icon>
                Custom Rules
              </p>

              @if (customRules().length > 0) {
                <div style="overflow-x:auto;border-radius:8px;border:1px solid #e0e0e0;margin-bottom:12px">
                  <table class="rules-table">
                    <thead>
                      <tr>
                        <th>Enabled</th><th>Name</th><th>Field</th><th>Type</th><th>Params</th><th>Severity</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (rule of customRules(); track rule.id) {
                        <tr [class.disabled-row]="!rule.enabled">
                          <td>
                            <mat-slide-toggle color="primary"
                                              [ngModel]="rule.enabled"
                                              (ngModelChange)="toggleRule(rule, $event)" />
                          </td>
                          <td>{{ rule.name }}</td>
                          <td><code>{{ rule.field }}</code></td>
                          <td><span class="type-badge">{{ rule.type }}</span></td>
                          <td>{{ paramSummary(rule) }}</td>
                          <td [class.sev-error]="rule.severity==='error'" [class.sev-warning]="rule.severity==='warning'">
                            {{ rule.severity }}
                          </td>
                          <td>
                            <button mat-icon-button color="warn"
                                    matTooltip="Delete rule"
                                    (click)="deleteRule(rule)">
                              <mat-icon>delete</mat-icon>
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }

              <!-- Add rule toggle -->
              @if (!showAddForm()) {
                <button mat-stroked-button (click)="showAddForm.set(true)">
                  <mat-icon>add</mat-icon> Add Custom Rule
                </button>
              } @else {
                <div class="add-form">
                  <span class="form-title">New rule for {{ selectedCategory() }}</span>

                  <mat-form-field appearance="outline">
                    <mat-label>Rule name</mat-label>
                    <input matInput [(ngModel)]="form.name" placeholder="e.g. Volume max limit">
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Field</mat-label>
                    <mat-select [(ngModel)]="form.field">
                      @for (f of schemaFields(); track f.key) {
                        <mat-option [value]="f.key">{{ f.label }} ({{ f.key }})</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Rule type</mat-label>
                    <mat-select [(ngModel)]="form.type">
                      <mat-option value="required">required — must be non-empty</mat-option>
                      <mat-option value="range">range — numeric min / max</mat-option>
                      <mat-option value="pattern">pattern — regex match</mat-option>
                      <mat-option value="no_future_date">no future date</mat-option>
                      <mat-option value="unique">unique — no duplicates</mat-option>
                    </mat-select>
                  </mat-form-field>

                  @if (form.type === 'range') {
                    <mat-form-field appearance="outline" style="min-width:100px">
                      <mat-label>Min</mat-label>
                      <input matInput type="number" [(ngModel)]="form.min">
                    </mat-form-field>
                    <mat-form-field appearance="outline" style="min-width:100px">
                      <mat-label>Max</mat-label>
                      <input matInput type="number" [(ngModel)]="form.max">
                    </mat-form-field>
                  }

                  @if (form.type === 'pattern') {
                    <mat-form-field appearance="outline" style="min-width:200px">
                      <mat-label>Regex pattern</mat-label>
                      <input matInput [(ngModel)]="form.pattern" placeholder="^[A-Z0-9-]+$">
                    </mat-form-field>
                    <mat-form-field appearance="outline" style="min-width:200px">
                      <mat-label>Pattern hint (shown in error)</mat-label>
                      <input matInput [(ngModel)]="form.patternHint" placeholder="uppercase letters, digits, hyphens">
                    </mat-form-field>
                  }

                  <mat-form-field appearance="outline" style="min-width:130px">
                    <mat-label>Severity</mat-label>
                    <mat-select [(ngModel)]="form.severity">
                      <mat-option value="error">error</mat-option>
                      <mat-option value="warning">warning</mat-option>
                    </mat-select>
                  </mat-form-field>

                  <button mat-flat-button color="primary"
                          [disabled]="!form.name || !form.field"
                          (click)="addRule()">
                    <mat-icon>add</mat-icon> Add
                  </button>
                  <button mat-button (click)="cancelAdd()">Cancel</button>
                </div>
              }
            </div>

            <mat-divider />

            <!-- ── Run validation ─────────────────────────────── -->
            <div>
              <p class="section-title">
                <mat-icon>fact_check</mat-icon>
                Validation Results
              </p>

              @if (stagedCount() === 0) {
                <div class="no-staged">
                  <mat-icon>info</mat-icon>
                  No staged records for <strong>{{ selectedCategory() }}</strong> yet.
                  Go to <strong>Mapping → Generate Staging</strong> first.
                </div>
              } @else {
                <div class="run-bar">
                  <button mat-flat-button color="primary"
                          [disabled]="running()"
                          (click)="runValidation()">
                    @if (running()) { <mat-spinner diameter="18" /> }
                    @else { <mat-icon>play_arrow</mat-icon> }
                    Run Validation ({{ stagedCount() | number }} records)
                  </button>

                  @if (issueRows() !== null) {
                    <div class="stat-chip chip-total">
                      <mat-icon>storage</mat-icon>
                      {{ stagedCount() | number }} records
                    </div>
                    @if (errorIssues() > 0) {
                      <div class="stat-chip chip-err">
                        <mat-icon>error_outline</mat-icon>
                        {{ errorIssues() | number }} errors
                      </div>
                    }
                    @if (warnIssues() > 0) {
                      <div class="stat-chip chip-warn">
                        <mat-icon>warning_amber</mat-icon>
                        {{ warnIssues() | number }} warnings
                      </div>
                    }
                    @if (errorIssues() === 0 && warnIssues() === 0) {
                      <div class="stat-chip chip-ok">
                        <mat-icon>check_circle</mat-icon>
                        All records pass validation
                      </div>
                    }
                  }
                </div>

                @if (issueRows() !== null && issueRows()!.length > 0) {
                  <!-- Filter -->
                  <div class="filter-row" style="margin-top:12px">
                    <mat-form-field appearance="outline" style="min-width:160px">
                      <mat-label>Filter severity</mat-label>
                      <mat-select [ngModel]="severityFilter()"
                                  (ngModelChange)="severityFilter.set($event)">
                        <mat-option value="all">All</mat-option>
                        <mat-option value="error">Errors only</mat-option>
                        <mat-option value="warning">Warnings only</mat-option>
                      </mat-select>
                    </mat-form-field>
                    <mat-form-field appearance="outline" style="min-width:200px">
                      <mat-label>Search identifier</mat-label>
                      <input matInput [ngModel]="identifierFilter()"
                             (ngModelChange)="identifierFilter.set($event)"
                             placeholder="lot code, vessel ID…">
                    </mat-form-field>
                  </div>

                  <div class="issues-wrap" style="margin-top:4px;max-height:480px;overflow-y:auto">
                    <table class="issues-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Record</th>
                          <th>Severity</th>
                          <th>Rule</th>
                          <th>Field</th>
                          <th>Value</th>
                          <th>Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (row of filteredIssues(); track $index) {
                          <tr [class.row-err]="row.issue.severity==='error'"
                              [class.row-warn]="row.issue.severity==='warning'">
                            <td style="color:#aaa">{{ row.recordIndex + 1 }}</td>
                            <td style="font-family:monospace;font-size:12px">{{ row.identifier || '—' }}</td>
                            <td [class.sev-error]="row.issue.severity==='error'"
                                [class.sev-warning]="row.issue.severity==='warning'">
                              {{ row.issue.severity }}
                            </td>
                            <td>{{ row.issue.ruleName }}</td>
                            <td><code>{{ row.issue.field }}</code></td>
                            <td>
                              @if (row.issue.value !== null && row.issue.value !== undefined) {
                                <span class="val-value"
                                      [matTooltip]="String(row.issue.value)">{{ row.issue.value }}</span>
                              } @else {
                                <span style="color:#bbb">empty</span>
                              }
                            </td>
                            <td>{{ row.issue.message }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                    @if (filteredIssues().length < issueRows()!.length) {
                      <div style="text-align:center;padding:8px;font-size:12px;color:#888">
                        Showing {{ filteredIssues().length | number }} of {{ issueRows()!.length | number }} issues
                      </div>
                    }
                  </div>

                } @else if (issueRows() !== null && issueRows()!.length === 0) {
                  <div class="empty-state" style="padding:32px">
                    <mat-icon>check_circle</mat-icon>
                    <p>No validation issues found.</p>
                  </div>
                }
              }
            </div>

          } @else {
            <div class="empty-state">
              <mat-icon>rule</mat-icon>
              <p>Select a category to view and configure its validation rules.</p>
            </div>
          }

        </div>
      </div>
    }
  `,
})
export class ValidationComponent {
  readonly ws        = inject(WorkspaceService);
  private db         = inject(LocalDbService);
  private schema     = inject(TargetSchemaService);
  private validator  = inject(ValidationRulesService);
  private toast      = inject(ToastService);

  readonly categories = ALL_CATEGORIES;
  readonly String     = String; // expose to template

  selectedCategory = signal<Category | null>(null);
  customRules      = signal<ValidationRule[]>([]);
  showAddForm      = signal(false);
  running          = signal(false);
  form             = { ...EMPTY_FORM } as RuleForm;

  // Staged records for the selected category
  private stagedRecords = signal<StagedRecord[]>([]);
  stagedCount = computed(() => this.stagedRecords().length);

  // Validation results
  issueRows     = signal<IssueRow[] | null>(null);
  severityFilter   = signal<'all' | 'error' | 'warning'>('all');
  identifierFilter = signal('');

  readonly builtIn = computed(() =>
    this.selectedCategory() ? builtInRulesFor(this.selectedCategory()!) : []
  );

  readonly schemaFields = computed<TargetSchemaField[]>(() =>
    this.selectedCategory() ? this.schema.fieldsFor(this.selectedCategory()!) : []
  );

  readonly errorIssues = computed(() => (this.issueRows() ?? []).filter(r => r.issue.severity === 'error').length);
  readonly warnIssues  = computed(() => (this.issueRows() ?? []).filter(r => r.issue.severity === 'warning').length);

  readonly filteredIssues = computed(() => {
    let rows = this.issueRows() ?? [];
    const sev = this.severityFilter();
    if (sev !== 'all') rows = rows.filter(r => r.issue.severity === sev);
    const id = this.identifierFilter().trim().toLowerCase();
    if (id) rows = rows.filter(r => r.identifier.toLowerCase().includes(id));
    return rows;
  });

  constructor() {
    effect(() => {
      const wsId = this.ws.activeId();
      if (!wsId) {
        this.customRules.set([]);
        this.stagedRecords.set([]);
        this.issueRows.set(null);
      }
    });
  }

  async selectCategory(cat: Category): Promise<void> {
    this.selectedCategory.set(cat);
    this.issueRows.set(null);
    this.showAddForm.set(false);
    Object.assign(this.form, { ...EMPTY_FORM });
    await this.reload();
  }

  private async reload(): Promise<void> {
    const wsId = this.ws.activeId();
    const cat  = this.selectedCategory();
    if (!wsId || !cat) return;

    const [rules, staged] = await Promise.all([
      this.db.listValidationRulesByCategory(wsId, cat),
      this.db.listStagedByWorkspace(wsId),
    ]);
    this.customRules.set(rules);
    this.stagedRecords.set(staged.filter(r => r.category === cat));
  }

  // ── Run validation ────────────────────────────────────────────────────────

  async runValidation(): Promise<void> {
    const cat  = this.selectedCategory();
    const wsId = this.ws.activeId();
    if (!cat || !wsId) return;

    this.running.set(true);
    const allRules  = [...builtInRulesFor(cat), ...this.customRules()];
    const validated = this.validator.validateRecords(this.stagedRecords(), allRules);

    // Persist updated records (with fresh validationIssues)
    await this.db.putStagedRecords(validated);
    this.stagedRecords.set(validated);

    // Build issue rows for display
    const identifierKey = this.schemaFields()[0]?.key ?? '';
    const rows: IssueRow[] = [];
    validated.forEach((rec, idx) => {
      for (const issue of rec.validationIssues ?? []) {
        rows.push({
          recordIndex: idx,
          issue,
          identifier: String(rec.data[identifierKey] ?? ''),
        });
      }
    });
    this.issueRows.set(rows);

    const msg = rows.length === 0
      ? `Validation passed — ${validated.length} records clean`
      : `${rows.length} issue${rows.length > 1 ? 's' : ''} found across ${validated.length} records`;
    rows.length === 0 ? this.toast.success(msg) : this.toast.info(msg);
    this.running.set(false);
  }

  // ── Custom rule management ────────────────────────────────────────────────

  async addRule(): Promise<void> {
    const wsId = this.ws.activeId();
    const cat  = this.selectedCategory();
    if (!wsId || !cat || !this.form.name || !this.form.field) return;

    const rule: ValidationRule = {
      id:          crypto.randomUUID(),
      workspaceId: wsId,
      category:    cat,
      name:        this.form.name.trim(),
      field:       this.form.field,
      type:        this.form.type,
      params: {
        min:         this.form.min   !== '' ? Number(this.form.min)   : undefined,
        max:         this.form.max   !== '' ? Number(this.form.max)   : undefined,
        pattern:     this.form.pattern     || undefined,
        patternHint: this.form.patternHint || undefined,
      },
      severity: this.form.severity,
      builtIn:  false,
      enabled:  true,
      createdAt: new Date().toISOString(),
    };

    await this.db.putValidationRule(rule);
    this.customRules.update(list => [...list, rule]);
    this.toast.success(`Rule "${rule.name}" added`);
    this.cancelAdd();
  }

  async toggleRule(rule: ValidationRule, enabled: boolean): Promise<void> {
    const updated = { ...rule, enabled };
    await this.db.putValidationRule(updated);
    this.customRules.update(list => list.map(r => r.id === rule.id ? updated : r));
  }

  async deleteRule(rule: ValidationRule): Promise<void> {
    await this.db.deleteValidationRule(rule.id);
    this.customRules.update(list => list.filter(r => r.id !== rule.id));
    this.toast.info(`Rule "${rule.name}" deleted`);
  }

  cancelAdd(): void {
    this.showAddForm.set(false);
    Object.assign(this.form, { ...EMPTY_FORM });
  }

  // ── Display helpers ───────────────────────────────────────────────────────

  paramSummary(rule: ValidationRule): string {
    const p = rule.params;
    switch (rule.type) {
      case 'range': {
        const parts: string[] = [];
        if (p.min !== undefined) parts.push(`min ${p.min}`);
        if (p.max !== undefined) parts.push(`max ${p.max}`);
        return parts.join(', ') || '—';
      }
      case 'pattern':
        return p.pattern ? `/${p.pattern}/` : '—';
      default:
        return '—';
    }
  }
}
