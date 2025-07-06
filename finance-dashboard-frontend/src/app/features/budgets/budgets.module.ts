import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

// Angular Material Modules
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon, MatIconModule } from '@angular/material/icon';
import { MatCell, MatHeaderCell, MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatStepperModule } from '@angular/material/stepper';
import { MatSliderModule } from '@angular/material/slider';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatMenuModule } from '@angular/material/menu';
import { MatTabsModule } from '@angular/material/tabs';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSortModule } from '@angular/material/sort';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { DragDropModule } from '@angular/cdk/drag-drop';

// Chart.js Integration
import { NgChartsModule } from 'ng2-charts';

// Budget Components
import { BudgetOverviewComponent } from './budget-overview/budget-overview.component';
import { BudgetCreateComponent } from './budget-create/budget-create.component';
import { BudgetEditComponent } from './budget-edit/budget-edit.component';
import { BudgetAnalysisComponent } from './budget-analysis/budget-analysis.component';
import { BudgetWizardComponent } from './budget-wizard/budget-wizard.component';
import { BudgetTemplatesComponent } from './budget-templates/budget-templates.component';
import { BudgetTrackingEnhancedComponent } from './budget-tracking/budget-tracking.component';
import { BudgetCalendarComponent } from './budget-calendar/budget-calendar.component';

// Budget Routes
import { BudgetsRoutingModule } from './budgets-routing.module';

@NgModule({
  declarations: [
    // Only non-standalone components
    BudgetCalendarComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    BudgetsRoutingModule,
    DragDropModule,
    NgChartsModule,
    // Angular Material Modules
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatProgressBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatChipsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatStepperModule,
    MatSliderModule,
    MatCheckboxModule,
    MatTooltipModule,
    MatExpansionModule,    
    MatSlideToggleModule,
    MatMenuModule,
    MatTabsModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatButtonToggleModule,
    // Standalone Components (imported, not declared)
    BudgetOverviewComponent,
    BudgetCreateComponent,
    BudgetEditComponent,
    BudgetAnalysisComponent,
    BudgetWizardComponent,
    BudgetTemplatesComponent,
    BudgetTrackingEnhancedComponent
  ],
  exports: [
    // Export all components for use in other modules
    BudgetOverviewComponent,
    BudgetCreateComponent,
    BudgetEditComponent,
    BudgetAnalysisComponent,
    BudgetWizardComponent,
    BudgetTemplatesComponent,
    BudgetTrackingEnhancedComponent,
    BudgetCalendarComponent
  ]
})
export class BudgetsModule { }
