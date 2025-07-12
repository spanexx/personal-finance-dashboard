import { Component, OnInit } from '@angular/core';
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
import { Store } from '@ngrx/store';
import * as GoalActions from '../../../store/actions/goal.actions';
import { selectGoalLoading, selectGoalError } from '../../../store/selectors/goal.selectors';
import { CategoryService } from '../../../core/services/category.service';
import { Category } from '../../../shared/models';
import { Actions, ofType } from '@ngrx/effects';
import { filter, take } from 'rxjs/operators';

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
  templateUrl: './goal-form.component.html',
  styleUrls: ['./goal-form.component.scss'],

})
export class GoalFormComponent implements OnInit {
  goalForm: FormGroup;
  submitting = false;
  categories: Category[] = [];
  backendError: string | null = null;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private liveAnnouncer: LiveAnnouncer,
    private store: Store,
    private categoryService: CategoryService,
    private actions$: Actions
  ) {
    this.goalForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      targetAmount: [null, [Validators.required, Validators.min(0.01)]],
      category: ['', Validators.required],
      currentAmount: [0, [Validators.min(0)]],
      startDate: [null, Validators.required],
      targetDate: [null, Validators.required],
      priority: ['medium', Validators.required],
      goalType: ['savings', Validators.required],
      status: ['active', Validators.required], // <-- Added status field
      description: ['']
    });
  }

  ngOnInit(): void {
    this.categoryService.getCategories().subscribe({
      next: (categories: any) => {
        console.log('Categories:', categories); // Debugging log
        if (Array.isArray(categories)) {
          this.categories = categories;
        } else if (categories && Array.isArray((categories as { categories?: Category[] }).categories)) {
          this.categories = (categories as { categories: Category[] }).categories;
        } else {
          this.categories = [];
        }
      },
      error: (err) => {
        this.categories = [];
      }
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
      this.backendError = null;
      this.liveAnnouncer.announce('Creating goal...', 'polite');
      const formValue = this.goalForm.value;
      console.log('Form Value:', formValue); // Debugging log
      const goalRequest: any = {
        name: formValue.name,
        category: formValue.category,
        targetAmount: Number(formValue.targetAmount),
        currentAmount: Number(formValue.currentAmount) || 0,
        startDate: formValue.startDate ? new Date(formValue.startDate).toISOString() : undefined,
        targetDate: formValue.targetDate ? new Date(formValue.targetDate).toISOString() : undefined,
        priority: formValue.priority,
        goalType: formValue.goalType, // Use goalType as required by backend
        status: formValue.status, // <-- Include status in payload
        description: formValue.description || ''
      };
      console.log('Goal Request Payload:', goalRequest); // Debugging log
      this.store.dispatch(GoalActions.createGoal({ goal: goalRequest }));
      // Listen for createGoalSuccess action
      this.actions$.pipe(
        ofType(GoalActions.createGoalSuccess),
        take(1)
      ).subscribe(() => {
        this.store.dispatch(GoalActions.loadGoals());
        this.router.navigateByUrl('/goals');
      });
      this.store.select(selectGoalError).subscribe(error => {
        // Only handle if error is an object and has an 'error' property
        if (error && typeof error === 'object' && 'error' in error && (error as any).error && (error as any).error.type === 'ValidationError') {
          this.backendError = (error as any).error.message || 'Validation error occurred.';
          this.liveAnnouncer.announce(this.backendError ?? '', 'assertive');
          this.submitting = false;
        }
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/goals']);
  }
}
