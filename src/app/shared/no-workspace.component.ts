import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-no-workspace',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="empty-state">
      <mat-icon>folder_off</mat-icon>
      <h3>No workspace selected</h3>
      <p>Please create or open a workspace first.</p>
      <a mat-raised-button color="primary" routerLink="/">Go to Home</a>
    </div>
  `,
})
export class NoWorkspaceComponent {}
