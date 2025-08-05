import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MatSnackBar, MatSnackBarConfig, MatSnackBarHorizontalPosition, MatSnackBarVerticalPosition } from '@angular/material/snack-bar';
// Subject and Observable might not be needed if MatSnackBar is used directly for display
// import { Subject, Observable } from 'rxjs';

export enum NotificationType { // Keep enum for panelClass mapping
  SUCCESS = 'success-snackbar', // Use as panelClass
  ERROR = 'error-snackbar',
  INFO = 'info-snackbar',
  WARNING = 'warning-snackbar'
}

// Interface Notification might not be needed if MatSnackBar is used directly.
// However, it can be kept for internal structure or if we plan to switch back.

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private defaultDuration = 5000;
  private horizontalPosition: MatSnackBarHorizontalPosition = 'center';
  private verticalPosition: MatSnackBarVerticalPosition = 'bottom';
  private actionButtonLabel = 'Dismiss';

  constructor(private snackBar: MatSnackBar, private http: HttpClient) { }
  /**
   * Send a system-wide notification (admin only)
   */
  sendSystemNotification(message: string, severity: string = 'info', event: string = 'SYSTEM_NOTIFICATION') {
    const body = { event, message, severity };
    return this.http.post('/api/socket/notify/system', body);
  }

  /**
   * Send a notification to a specific user (admin only)
   */
  sendUserNotification(userId: string, message: string, event: string = 'USER_ALERT', data: any = {}) {
    const body = { event, message, data };
    return this.http.post(`/api/socket/notify/user/${userId}`, body);
  }

  private showNotification(message: string, type: NotificationType, duration?: number, title?: string, actionLabel?: string) {
    const fullMessage = title ? `${title}: ${message}` : message;
    const config: MatSnackBarConfig = {
      duration: duration || this.defaultDuration,
      horizontalPosition: this.horizontalPosition,
      verticalPosition: this.verticalPosition,
      panelClass: [type], // Use NotificationType enum value as panel class
    };

    this.snackBar.open(fullMessage, actionLabel || this.actionButtonLabel, config);
  }

  success(message: string, title?: string, duration?: number): void {
    this.showNotification(message, NotificationType.SUCCESS, duration, title);
  }

  error(message: string, title?: string, duration?: number): void {
    // Errors often stay longer and might always have a dismiss button
    const errorDuration = duration || this.defaultDuration * 1.5;
    this.showNotification(message, NotificationType.ERROR, errorDuration, title, 'Dismiss');
  }

  info(message: string, title?: string, duration?: number): void {
    this.showNotification(message, NotificationType.INFO, duration, title);
  }

  warning(message: string, title?: string, duration?: number): void {
    this.showNotification(message, NotificationType.WARNING, duration, title);
  }

  // The old withAction method that took a callback is not directly supported by MatSnackBar's
  // simple 'action' string. If a callback is needed, MatSnackBar can open a component.
  // For simplicity, we'll stick to a dismiss action.
  // If more complex actions are needed, the service would need to be more advanced or
  // components would configure their own snackbars with components.

  // Removed private show, generateId, notificationSubject, and notifications$
}
