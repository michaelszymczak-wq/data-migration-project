import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-create-workspace-dialog',
  standalone: true,
  imports: [
    FormsModule,
    MatDialogModule, MatButtonModule,
    MatInputModule, MatFormFieldModule,
  ],
  template: `
    <h2 mat-dialog-title>New Workspace</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" style="width:100%;margin-top:8px">
        <mat-label>Workspace name</mat-label>
        <input matInput [(ngModel)]="name" placeholder="e.g. Napa 2018 Migration"
               (keyup.enter)="submit()" autofocus>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-raised-button color="primary"
              [disabled]="!name().trim()"
              (click)="submit()">
        Create
      </button>
    </mat-dialog-actions>
  `,
})
export class CreateWorkspaceDialogComponent {
  name = signal('');

  constructor(private ref: MatDialogRef<CreateWorkspaceDialogComponent>) {}

  submit(): void {
    if (this.name().trim()) {
      this.ref.close(this.name().trim());
    }
  }
}
