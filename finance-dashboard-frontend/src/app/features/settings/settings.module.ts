import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';

// Angular Material imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { MatStepperModule } from '@angular/material/stepper';
import { MatRadioModule } from '@angular/material/radio';
import { MatChipsModule } from '@angular/material/chips';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./settings-overview/settings-overview.component').then(c => c.SettingsOverviewComponent)
  },
  {
    path: 'profile',
    loadComponent: () => import('./profile-settings/profile-settings.component').then(c => c.ProfileSettingsComponent)
  },
  {
    path: 'preferences',
    loadComponent: () => import('./user-preferences/user-preferences.component').then(c => c.UserPreferencesComponent)
  },
  {
    path: 'notifications',
    loadComponent: () => import('./notification-settings/notification-settings.component').then(c => c.NotificationSettingsComponent)
  },  {
    path: 'security',
    loadComponent: () => import('./security-settings/security-settings.component').then(c => c.SecuritySettingsComponent)
  },
  {
    path: 'privacy',
    loadComponent: () => import('./privacy-settings/privacy-settings.component').then(c => c.PrivacySettingsComponent)
  }
];

@NgModule({
  imports: [
    CommonModule,
    RouterModule.forChild(routes),
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatSlideToggleModule,    MatTabsModule,
    MatDividerModule,
    MatSnackBarModule,
    MatDialogModule,
    MatStepperModule,
    MatRadioModule,
    MatChipsModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatTooltipModule,
    MatExpansionModule
  ],
  declarations: []
})
export class SettingsModule { }
