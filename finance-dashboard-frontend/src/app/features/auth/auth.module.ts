import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';

// Material imports
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatStepperModule } from '@angular/material/stepper';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';

const routes: Routes = [
  { 
    path: 'login', 
    loadComponent: () => import('./login/login.component').then(m => m.LoginComponent)
  },
  { 
    path: 'register', 
    loadComponent: () => import('./register/register.component').then(m => m.RegisterComponent)
  },
  { 
    path: 'verify-email',
    loadComponent: () => import('./verify-email/verify-email.component').then(m => m.VerifyEmailComponent)
  },
  { 
    path: 'email-verification-success', 
    loadComponent: () => import('./email-verification-success/email-verification-success.component').then(m => m.EmailVerificationSuccessComponent)
  },
  { 
    path: 'email-verification-failure', 
    loadComponent: () => import('./email-verification-failure/email-verification-failure.component').then(m => m.EmailVerificationFailureComponent)
  },
  { 
    path: 'forgot-password', 
    loadComponent: () => import('./password-reset/password-reset.component').then(m => m.PasswordResetComponent)
  },
  { 
    path: 'reset-password', 
    loadComponent: () => import('./password-reset/password-reset.component').then(m => m.PasswordResetComponent)
  },
  { path: '', redirectTo: 'login', pathMatch: 'full' }
];

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule.forChild(routes),
    
    // Material modules
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatStepperModule,
    MatSelectModule,
    MatCardModule,
    MatProgressBarModule,
    MatDividerModule,
    MatTooltipModule,
    MatStepperModule
  ]
})
export class AuthModule { }
