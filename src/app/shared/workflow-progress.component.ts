import { Component, inject, computed } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { WorkflowStatusService } from '../services/workflow-status.service';

interface Step {
  label: string;
  route: string;
  icon: string;
  doneIcon: string;
  done: boolean;
  tooltip: string;
}

@Component({
  selector: 'app-workflow-progress',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, MatIconModule, MatTooltipModule],
  styles: [`
    :host { display: block; background: #0d1770; }

    .progress-strip {
      display: flex;
      align-items: stretch;
      height: 40px;
      padding: 0 8px;
    }

    .step {
      display: flex; align-items: center; gap: 6px;
      padding: 0 14px;
      font-size: 12px; font-weight: 500;
      color: rgba(255,255,255,0.55);
      text-decoration: none;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      border-radius: 4px;
      position: relative;
    }
    .step:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.85); }

    .step.active-step { color: #fff; background: rgba(255,255,255,0.12); }

    .step.done-step { color: rgba(160,210,160,0.9); }
    .step.done-step mat-icon { color: #66bb6a; }
    .step.done-step.active-step { color: #a5d6a7; }

    mat-icon.step-icon {
      font-size: 16px; width: 16px; height: 16px;
      color: rgba(255,255,255,0.4);
    }

    .connector {
      display: flex; align-items: center;
      color: rgba(255,255,255,0.2);
      font-size: 16px;
      padding: 0 2px;
    }
  `],
  template: `
    <nav class="progress-strip">
      @for (step of steps(); track step.route; let last = $last) {
        <a class="step"
           [class.done-step]="step.done"
           [routerLink]="step.route"
           routerLinkActive="active-step"
           [routerLinkActiveOptions]="{ exact: step.route === '/' }"
           [matTooltip]="step.tooltip">
          <mat-icon class="step-icon">{{ step.done ? step.doneIcon : step.icon }}</mat-icon>
          {{ step.label }}
        </a>
        @if (!last) {
          <span class="connector">›</span>
        }
      }
    </nav>
  `,
})
export class WorkflowProgressComponent {
  private status = inject(WorkflowStatusService);

  readonly steps = computed<Step[]>(() => [
    {
      label: '1. Import',
      route: '/import',
      icon: 'upload_file',
      doneIcon: 'check_circle',
      done: this.status.importDone(),
      tooltip: this.status.importDone() ? 'Files imported ✓' : 'Upload CSV / XLSX files',
    },
    {
      label: '2. Review',
      route: '/review',
      icon: 'fact_check',
      doneIcon: 'check_circle',
      done: this.status.reviewDone(),
      tooltip: this.status.reviewDone() ? 'Files classified ✓' : 'Classify files by category',
    },
    {
      label: '3. Mapping',
      route: '/mapping',
      icon: 'schema',
      doneIcon: 'check_circle',
      done: this.status.mappingDone(),
      tooltip: this.status.mappingDone() ? 'Mappings saved ✓' : 'Map source columns to target fields',
    },
    {
      label: '4. Stage',
      route: '/mapping',
      icon: 'storage',
      doneIcon: 'check_circle',
      done: this.status.stagingDone(),
      tooltip: this.status.stagingDone() ? 'Records staged ✓' : 'Generate staging preview on Mapping page',
    },
    {
      label: '5. Export',
      route: '/export',
      icon: 'download',
      doneIcon: 'download_done',
      done: false,
      tooltip: 'Download JSON / CSV / ZIP',
    },
  ]);
}
