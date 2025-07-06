import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { Router } from '@angular/router';

// Angular Material imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';

// Services
import { UserProfileService } from '../../../core/services/user-profile.service';

// Models
import { UserSession } from '../../../shared/models/user.model';

@Component({
  selector: 'app-session-settings',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatDividerModule,
    MatTooltipModule,
    MatDialogModule,
    MatListModule,
    MatChipsModule
  ],
  templateUrl: './session-settings.component.html',
  styleUrls: ['./session-settings.component.scss']
})
export class SessionSettingsComponent implements OnInit, OnDestroy {
  sessions: UserSession[] = [];
  currentSession: UserSession | null = null;
  isLoading = false;
  loading = false; // Template uses both 'loading' and 'isLoading'
  error = '';
  successMessage = '';
  isRevokingSession = false;
  revokingSessionId: number | null = null;
  isLoggingOutAll = false;
  loggingOutAll = false; // Template uses both property names

  private destroy$ = new Subject<void>();

  constructor(
    private userProfileService: UserProfileService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadSessions();
    this.subscribeToSessionUpdates();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  public loadSessions(): void {
    this.isLoading = true;
    this.loading = true;
    this.error = '';
    this.successMessage = '';
    
    this.userProfileService.getSessions()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (sessions) => {
          this.sessions = sessions;
          this.currentSession = sessions.find(s => s.isCurrent) || null;
          this.isLoading = false;
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading sessions:', error);
          this.error = 'Failed to load sessions';
          this.isLoading = false;
          this.loading = false;
        }
      });
  }

  // Add onBack method for navigation
  onBack(): void {
    this.router.navigate(['/settings']);
  }

  // Add trackBy function for session list
  trackBySessionId(index: number, session: UserSession): number {
    return session.id;
  }

  // Add getBrowserName method
  getBrowserName(userAgent: string): string {
    if (!userAgent) return 'Unknown Browser';
    
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    
    return 'Unknown Browser';
  }

  // Add onRevokeSession method
  onRevokeSession(session: UserSession): void {
    this.revokeSession(session.id);
  }
  // Add onLogoutAllOtherSessions method
  onLogoutAllOtherSessions(): void {
    const confirmDialog = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Sign Out All Other Sessions',
        message: 'Are you sure you want to sign out from all other devices? This will keep your current session active.',
        confirmText: 'Sign Out Others',
        cancelText: 'Cancel'
      }
    });

    confirmDialog.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.isLoggingOutAll = true;
        this.loggingOutAll = true;
        this.userProfileService.logoutAllDevices()
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.successMessage = 'Successfully signed out from all other devices';
              this.loadSessions(); // Refresh the list
              this.isLoggingOutAll = false;
              this.loggingOutAll = false;
            },
            error: (error: any) => {
              console.error('Error signing out all other devices:', error);
              this.error = 'Failed to sign out from other devices';
              this.isLoggingOutAll = false;
              this.loggingOutAll = false;
            }
          });
      }
    });
  }

  // Add onLogoutAllSessions method
  onLogoutAllSessions(): void {
    const confirmDialog = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Sign Out All Sessions',
        message: 'Are you sure you want to sign out from all devices including this one? You will need to sign in again.',
        confirmText: 'Sign Out All',
        cancelText: 'Cancel'
      }
    });

    confirmDialog.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.isLoggingOutAll = true;
        this.loggingOutAll = true;
        this.userProfileService.logoutAllDevices()
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.successMessage = 'Successfully signed out from all devices';
              // Navigate to login since user will be logged out
              this.router.navigate(['/auth/login']);
            },
            error: (error: any) => {
              console.error('Error signing out all devices:', error);
              this.error = 'Failed to sign out from all devices';
              this.isLoggingOutAll = false;
              this.loggingOutAll = false;
            }
          });
      }
    });
  }

  private subscribeToSessionUpdates(): void {
    this.userProfileService.sessions$
      .pipe(takeUntil(this.destroy$))
      .subscribe(sessions => {
        if (sessions) {
          this.sessions = sessions;
        }
      });
  }
  revokeSession(sessionId: number): void {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;

    const confirmDialog = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Revoke Session',
        message: `Are you sure you want to revoke this session? You will be logged out from that device.`,
        confirmText: 'Revoke',
        cancelText: 'Cancel'
      }
    });

    confirmDialog.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.isRevokingSession = true;
        this.revokingSessionId = sessionId;
        this.userProfileService.revokeSession(sessionId)
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.showSuccess('Session revoked successfully');
              this.loadSessions(); // Refresh the list
              this.isRevokingSession = false;
              this.revokingSessionId = null;
            },
            error: (error: any) => {
              console.error('Error revoking session:', error);
              this.showError('Failed to revoke session');
              this.isRevokingSession = false;
              this.revokingSessionId = null;
            }
          });
      }
    });
  }

  logoutAllDevices(): void {
    const confirmDialog = this.dialog.open(ConfirmationDialogComponent, {
      data: {
        title: 'Logout All Devices',
        message: 'Are you sure you want to logout from all devices? You will need to login again on all your devices.',
        confirmText: 'Logout All',
        cancelText: 'Cancel'
      }
    });

    confirmDialog.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.isLoggingOutAll = true;
        this.userProfileService.logoutAllDevices()
          .pipe(takeUntil(this.destroy$))
          .subscribe({
            next: () => {
              this.showSuccess('Successfully logged out from all devices');
              this.loadSessions(); // Refresh the list
              this.isLoggingOutAll = false;
            },
            error: (error) => {
              console.error('Error logging out all devices:', error);
              this.showError('Failed to logout from all devices');
              this.isLoggingOutAll = false;
            }
          });
      }
    });
  }  getDeviceIcon(deviceType: string | undefined): string {
    if (!deviceType) return 'devices';
    
    switch (deviceType.toLowerCase()) {
      case 'mobile':
        return 'smartphone';
      case 'tablet':
        return 'tablet';
      case 'desktop':
        return 'computer';
      case 'laptop':
        return 'laptop';
      default:
        return 'devices';
    }
  }

  getLocationDisplay(session: UserSession): string {
    // This would typically come from session data with IP geolocation
    return 'Location not available';
  }

  getBrowserDisplay(session: UserSession): string {
    // This would typically come from user agent parsing
    return 'Browser information not available';
  }

  formatSessionTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString();
  }
  isSessionCurrent(session: UserSession): boolean {
    return session.isCurrentSession || session.isCurrent || false;
  }

  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['success-snackbar']
    });
  }

  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 7000,
      panelClass: ['error-snackbar']
    });
  }
}

// Confirmation Dialog Component
@Component({
  selector: 'app-confirmation-dialog',
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>{{ data.cancelText }}</button>
      <button mat-raised-button color="warn" [mat-dialog-close]="true">{{ data.confirmText }}</button>
    </mat-dialog-actions>
  `,
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule
  ]
})
export class ConfirmationDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<ConfirmationDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: {
      title: string;
      message: string;
      confirmText: string;
      cancelText: string;
    }
  ) {}
}
