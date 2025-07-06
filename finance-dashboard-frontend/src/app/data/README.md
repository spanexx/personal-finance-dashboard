# Mock Data Structure for Personal Finance Dashboard

This directory contains mock data for the Personal Finance Dashboard frontend development.
These JSON files simulate API responses until the backend is fully integrated.

## Files Structure

- `users.json` - User profiles and authentication data
- `transactions.json` - Financial transactions
- `categories.json` - Transaction categories
- `budgets.json` - Budget definitions and allocations
- `goals.json` - Financial goals
- `reports.json` - Saved reports configuration

## Data Relationships

- Transactions reference categories via categoryId
- Budgets reference categories via categoryId
- Users own transactions, budgets, goals, and reports

## Mock API Guidelines

1. Use these files with HttpClient and HttpInterceptor to simulate API calls
2. Follow the same data structure that will be used in the real API
3. Maintain realistic data for testing various scenarios
4. Include edge cases for testing error handling

## Example Usage in Services

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import * as mockTransactions from '../data/transactions.json';

@Injectable({
  providedIn: 'root'
})
export class TransactionService {
  constructor(private http: HttpClient) {}

  // When using real API:
  // getTransactions(): Observable<Transaction[]> {
  //   return this.http.get<Transaction[]>('/api/transactions');
  // }

  // For development with mock data:
  getTransactions(): Observable<Transaction[]> {
    return of(mockTransactions.data);
  }
}
```

Update this README as needed when adding new mock data files or changing data structures.
