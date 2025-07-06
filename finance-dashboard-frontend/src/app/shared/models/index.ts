export * from './budget.model';
export * from './category.model';
export * from './goal.model';
export * from './transaction.model';
export * from './user.model';

export interface PaginatedResponse<T> {
  data: T[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}