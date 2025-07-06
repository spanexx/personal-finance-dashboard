import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { LiveAnnouncer } from '@angular/cdk/a11y'; // Import LiveAnnouncer
import { GoalsService } from '../../../core/services/goals.service';
import { CreateGoalRequest } from '../../../shared/models';

@Component({
  selector: 'app-goal-form',
  standalone: true,  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSelectModule
  ],
  template: `
    <div class="form-container">
      <mat-card>
        <mat-card-header>
          <mat-card-title>Create New Financial Goal</mat-card-title>
        </mat-card-header>
        
        <mat-card-content>
          <form [formGroup]="goalForm" (ngSubmit)="onSubmit()">            <mat-form-field appearance="outline">
              <mat-label>Title</mat-label>
              <input matInput formControlName="name" placeholder="e.g., Emergency Fund">
              @if (goalForm.get('name')?.hasError('required') && goalForm.get('name')?.touched) {
                <mat-error>Title is required</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Category</mat-label>
              <mat-select formControlName="category">
                <mat-option value="Savings">Savings</mat-option>
                <mat-option value="Investment">Investment</mat-option>
                <mat-option value="Housing">Housing</mat-option>
                <mat-option value="Education">Education</mat-option>
                <mat-option value="Other">Other</mat-option>
              </mat-select>
              @if (goalForm.get('category')?.hasError('required') && goalForm.get('category')?.touched) {
                <mat-error>Category is required</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Target Amount</mat-label>
              <input matInput type="number" formControlName="targetAmount">
              <span matPrefix>$&nbsp;</span>
              @if (goalForm.get('targetAmount')?.hasError('required') && goalForm.get('targetAmount')?.touched) {
                <mat-error>Target amount is required</mat-error>
              }
              @if (goalForm.get('targetAmount')?.hasError('min')) {
                <mat-error>Amount must be greater than 0</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Current Amount</mat-label>
              <input matInput type="number" formControlName="currentAmount">
              <span matPrefix>$&nbsp;</span>
              @if (goalForm.get('currentAmount')?.hasError('min')) {
                <mat-error>Amount cannot be negative</mat-error>
              }
            </mat-form-field>            <mat-form-field appearance="outline">
              <mat-label>Target Date</mat-label>
              <input matInput [matDatepicker]="picker" formControlName="targetDate">
              <mat-datepicker-toggle matIconSuffix [for]="picker"></mat-datepicker-toggle>
              <mat-datepicker #picker></mat-datepicker>
              @if (goalForm.get('targetDate')?.hasError('required') && goalForm.get('targetDate')?.touched) {
                <mat-error>Target date is required</mat-error>
              }
            </mat-form-field>

            <div class="actions">
              <button mat-button type="button" (click)="onCancel()">Cancel</button>
              <button mat-raised-button color="primary" type="submit" [disabled]="!goalForm.valid">
                Create Goal
              </button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .form-container {
      padding: 24px;
      max-width: 600px;
      margin: 0 auto;
    }

    form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-top: 16px;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 16px;
      margin-top: 16px;
    }
  `]
})
export class GoalFormComponent {
  goalForm: FormGroup;
  submitting = false;
  constructor(
    private fb: FormBuilder,
    private router: Router,
    private goalsService: GoalsService,
    private liveAnnouncer: LiveAnnouncer // Inject LiveAnnouncer
  ) {
    this.goalForm = this.fb.group({
      name: ['', Validators.required],
      category: ['', Validators.required],
      targetAmount: ['', [Validators.required, Validators.min(1)]],
      currentAmount: [0, [Validators.min(0)]],
      targetDate: ['', Validators.required],
      description: ['']
    });
  }

  onSubmit(): void {
    if (this.goalForm.invalid) {
      // Announce first error if any for accessibility
      const firstErrorControl = Object.keys(this.goalForm.controls).find(key => this.goalForm.controls[key].invalid);
      if (firstErrorControl) {
          const label = document.querySelector(`label[for="${firstErrorControl}"]`)?.textContent || firstErrorControl;
          this.liveAnnouncer.announce(`Error in ${label} field. Please check the message.`, 'assertive');
      } else {
          this.liveAnnouncer.announce('Form is invalid. Please check the fields.', 'assertive');
      }
      return;
    }

    if (!this.submitting) {
      this.submitting = true;
      this.liveAnnouncer.announce('Creating goal...', 'polite');
      const goalRequest: CreateGoalRequest = {
        name: this.goalForm.value.name,
        category: this.goalForm.value.category,
        targetAmount: Number(this.goalForm.value.targetAmount),
        priority: this.goalForm.value.priority, // Ensure 'priority' is in formGroup if used
        targetDate: this.goalForm.value.targetDate,
        description: this.goalForm.value.description || ''
      };
      this.goalsService.createGoal(goalRequest).subscribe({
        next: (goal) => {
          this.liveAnnouncer.announce('Goal created successfully!', 'polite');
          console.log('Goal created successfully:', goal);
          this.router.navigate(['/goals']);
          // No need to set submitting = false if navigating away
        },
        error: (error) => {
          const errorMessage = error?.message || 'An unknown error occurred. Please try again.';
          this.liveAnnouncer.announce(`Error creating goal: ${errorMessage}`, 'assertive');
          console.error('Error creating goal:', error);
          // alert('Error creating goal. Please try again.'); // Replaced by announcer
          this.submitting = false;
        }
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/goals']);
  }
}
