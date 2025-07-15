import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Routes } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';

// Material imports
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatNativeDateModule } from '@angular/material/core';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./goals-list/goals-list.component').then(c => c.GoalsListComponent)
  },
  {
    path: 'create',
    loadComponent: () => import('./goal-form/goal-form.component').then(c => c.GoalFormComponent)
  },
  {
    path: 'detail/:id',
    loadComponent: () => import('./goal-detail/goal-detail.component').then(c => c.GoalDetailComponent)
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
    MatDatepickerModule,
    MatProgressBarModule,
    MatNativeDateModule
  ],
  declarations: []
})
export class GoalsModule { }
