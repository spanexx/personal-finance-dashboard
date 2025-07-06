import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { LiveAnnouncer } from '@angular/cdk/a11y';

import { GoalFormComponent } from './goal-form.component';
import { GoalsService } from '../../../core/services/goals.service';
import { CreateGoalRequest } from '../../../shared/models';

// Import Material Modules used by the component's template
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';

describe('GoalFormComponent', () => {
  let component: GoalFormComponent;
  let fixture: ComponentFixture<GoalFormComponent>;
  let mockGoalsService: Partial<GoalsService>;
  let mockRouter: Partial<Router>;
  let mockLiveAnnouncer: Partial<LiveAnnouncer>;
  // No ActivatedRoute needed as this form is for creation only (no edit mode based on current component code)

  beforeEach(async () => {
    mockGoalsService = {
      createGoal: jest.fn(),
    };
    mockRouter = {
      navigate: jest.fn(),
    };
    mockLiveAnnouncer = {
      announce: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [
        GoalFormComponent, // Standalone
        ReactiveFormsModule,
        NoopAnimationsModule,
        MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule,
        MatDatepickerModule, MatNativeDateModule, MatSelectModule
      ],
      providers: [
        FormBuilder,
        { provide: GoalsService, useValue: mockGoalsService },
        { provide: Router, useValue: mockRouter },
        { provide: LiveAnnouncer, useValue: mockLiveAnnouncer },
        // { provide: ActivatedRoute, useValue: {} } // Only if needed for edit mode, not current
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GoalFormComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // ngOnInit
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize goalForm', () => {
    expect(component.goalForm).toBeDefined();
    expect(component.goalForm.get('name')).toBeDefined();
    expect(component.goalForm.get('targetAmount')).toBeDefined();
  });

  it('form should be invalid when empty', () => {
    expect(component.goalForm.valid).toBeFalsy();
  });

  it('name field validity', () => {
    const nameControl = component.goalForm.get('name');
    nameControl?.setValue('');
    expect(nameControl?.hasError('required')).toBeTruthy();
    nameControl?.setValue('My Goal');
    expect(nameControl?.valid).toBeTruthy();
  });

  it('targetAmount field validity', () => {
    const amountControl = component.goalForm.get('targetAmount');
    amountControl?.setValue('');
    expect(amountControl?.hasError('required')).toBeTruthy();
    amountControl?.setValue(0); // min(1)
    expect(amountControl?.hasError('min')).toBeTruthy();
    amountControl?.setValue(100);
    expect(amountControl?.valid).toBeTruthy();
  });

  it('currentAmount field validity', () => {
    const amountControl = component.goalForm.get('currentAmount');
    amountControl?.setValue(-10);
    expect(amountControl?.hasError('min')).toBeTruthy();
    amountControl?.setValue(0);
    expect(amountControl?.valid).toBeTruthy();
    amountControl?.setValue(50);
    expect(amountControl?.valid).toBeTruthy();
  });

  describe('onSubmit', () => {
    it('should not call goalsService.createGoal if form is invalid', () => {
      component.goalForm.get('name')?.setValue(''); // Make form invalid
      component.onSubmit();
      expect(mockGoalsService.createGoal).not.toHaveBeenCalled();
      expect(mockLiveAnnouncer.announce).toHaveBeenCalledWith(expect.stringContaining('Error in name field'), 'assertive');
    });

    it('should call goalsService.createGoal and navigate on success if form is valid', fakeAsync(() => {
      component.goalForm.setValue({
        name: 'New Car', category: 'Savings', targetAmount: 20000,
        currentAmount: 5000, targetDate: new Date(2026, 11, 31), description: 'Save for a new car'
      });
      const mockResponseGoal = { _id: 'g1', ...component.goalForm.value };
      (mockGoalsService.createGoal as jest.Mock).mockReturnValue(of(mockResponseGoal));

      component.onSubmit();
      tick(); // If there are any async operations like debounceTime (none in this submit directly)

      expect(mockLiveAnnouncer.announce).toHaveBeenCalledWith('Creating goal...', 'polite');
      expect(mockGoalsService.createGoal).toHaveBeenCalled();
      expect(mockLiveAnnouncer.announce).toHaveBeenCalledWith('Goal created successfully!', 'polite');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/goals']);
      expect(component.submitting).toBe(false); // Should be reset if navigation happens, or test before nav
    }));

    it('should handle error from goalsService.createGoal', fakeAsync(() => {
      component.goalForm.setValue({
        name: 'New Car', category: 'Savings', targetAmount: 20000,
        currentAmount: 5000, targetDate: new Date(2026, 11, 31), description: 'Save for a new car'
      });
      const errorResponse = { message: 'Creation Failed' };
      (mockGoalsService.createGoal as jest.Mock).mockReturnValue(throwError(() => errorResponse));

      component.onSubmit();
      tick();

      expect(mockLiveAnnouncer.announce).toHaveBeenCalledWith('Creating goal...', 'polite');
      expect(mockGoalsService.createGoal).toHaveBeenCalled();
      expect(mockLiveAnnouncer.announce).toHaveBeenCalledWith(`Error creating goal: ${errorResponse.message}`, 'assertive');
      expect(component.submitting).toBe(false);
      expect(mockRouter.navigate).not.toHaveBeenCalledWith(['/goals']);
    }));

    it('should not submit if already submitting', () => {
      component.goalForm.setValue({
        name: 'New Car', category: 'Savings', targetAmount: 20000,
        currentAmount: 5000, targetDate: new Date(2026, 11, 31), description: 'Save for a new car'
      });
      component.submitting = true;
      component.onSubmit();
      expect(mockGoalsService.createGoal).not.toHaveBeenCalled();
    });
  });

  it('onCancel should navigate to /goals', () => {
    component.onCancel();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/goals']);
  });
});
