import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

const BASE: MatSnackBarConfig = { duration: 3500, horizontalPosition: 'end', verticalPosition: 'bottom' };

@Injectable({ providedIn: 'root' })
export class ToastService {
  private snack = inject(MatSnackBar);

  success(message: string, duration = 3500): void {
    this.snack.open(message, '✕', { ...BASE, duration, panelClass: ['toast-success'] });
  }

  error(message: string, duration = 6000): void {
    this.snack.open(message, '✕', { ...BASE, duration, panelClass: ['toast-error'] });
  }

  info(message: string, duration = 3000): void {
    this.snack.open(message, '✕', { ...BASE, duration, panelClass: ['toast-info'] });
  }
}
