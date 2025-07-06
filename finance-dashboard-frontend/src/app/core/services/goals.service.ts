import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService, PaginationParams, FilterParams, PaginatedResponse } from './api.service';
import { ApiResponse } from './http-client.service';
import {
  Goal,
  CreateGoalRequest,
  UpdateGoalRequest,
  AddContributionRequest,
  UpdateContributionRequest,
  GoalProgress,
  GoalSummary,
  GoalAnalytics,
  Contribution,
  Milestone
} from '../../shared/models';

@Injectable({
  providedIn: 'root'
})
export class GoalsService extends ApiService {
  private readonly endpoint = 'goals';  /**
   * Get all goals with filtering and pagination
   */
  getGoals(
    filters?: FilterParams,
    pagination?: PaginationParams
  ): Observable<PaginatedResponse<Goal>> {
    const params = { ...filters, ...pagination };
    return this.get<Goal[]>(this.endpoint, params) as Observable<PaginatedResponse<Goal>>;
  }

  /**
   * Get a single goal by ID
   */
  getGoal(id: string): Observable<Goal> {
    return this.extractData(
      this.get<Goal>(`${this.endpoint}/${id}`)
    );
  }

  /**
   * Create a new goal
   */
  createGoal(data: CreateGoalRequest): Observable<Goal> {
    return this.extractData(
      this.post<Goal>(this.endpoint, data)
    );
  }

  /**
   * Update an existing goal
   */
  updateGoal(id: string, data: Partial<CreateGoalRequest>): Observable<Goal> {
    return this.extractData(
      this.put<Goal>(`${this.endpoint}/${id}`, data)
    );
  }

  /**
   * Delete a goal
   */
  deleteGoal(id: string): Observable<void> {
    return this.extractData(
      this.delete<void>(`${this.endpoint}/${id}`)
    );
  }

  /**
   * Add contribution to a goal
   */
  addContribution(goalId: string, data: {
    amount: number;
    notes?: string;
  }): Observable<Goal> {
    return this.extractData(
      this.post<Goal>(`${this.endpoint}/${goalId}/contributions`, data)
    );
  }
}
