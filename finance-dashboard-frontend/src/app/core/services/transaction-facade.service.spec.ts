import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { TransactionFacadeService } from './transaction-facade.service';
import { AppState } from '../../store/state/app.state';
import * as TransactionActions from '../../store/actions/transaction.actions';
import { 
  getAllTransactions,
  getTransactionLoading,
  getTransactionError,
  getTransactionPagination,
  getTransactionFilters,
  getSelectedTransaction,
  getTotalTransactionsCount
} from '../../store/selectors/transaction.selectors';
import { Transaction, TransactionFilters } from '../../shared/models/transaction.model';

describe('TransactionFacadeService', () => {
  let service: TransactionFacadeService;
  let store: MockStore<AppState>;
  
  // Mock transaction matching the shared Transaction model
  const mockTransaction: Transaction = {
    _id: '1', 
    id: '1', // Adding id property to match Transaction interface
    user: 'u1', 
    amount: 100, 
    description: 'Test', 
    category: 'cat1', 
    type: 'expense' as 'expense', // Type assertion to satisfy type restrictions
    date: new Date(), 
    paymentMethod: 'cash', 
    status: 'completed', 
    attachments: [], 
    tags: [],
    isReconciled: false, 
    createdAt: new Date(), 
    updatedAt: new Date(), 
    isDeleted: false
  };

  const initialState = {
    transactions: {
      transactions: [mockTransaction],
      selectedTransaction: null,
      loading: false,
      error: null,
      pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      filters: null
    }
  } as unknown as AppState;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TransactionFacadeService,
        provideMockStore({ initialState })
      ]
    });
    
    service = TestBed.inject(TransactionFacadeService);
    store = TestBed.inject(MockStore);
    
    // Spy on store dispatch using jasmine's spyOn for Angular testing
    spyOn(store, 'dispatch').and.callThrough();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get transactions from store', (done) => {
    service.getTransactions().subscribe(transactions => {
      expect(transactions).toEqual([mockTransaction]);
      done();
    });
  });

  it('should get loading state from store', (done) => {
    service.isLoading().subscribe(loading => {
      expect(loading).toBe(false);
      done();
    });
  });

  it('should get error state from store', (done) => {
    service.getError().subscribe(error => {
      expect(error).toBeNull();
      done();
    });
  });

  it('should get pagination from store', (done) => {
    service.getPagination().subscribe(pagination => {
      expect(pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
      done();
    });
  });

  it('should get filters from store', (done) => {
    service.getFilters().subscribe(filters => {
      expect(filters).toBeNull();
      done();
    });
  });

  it('should dispatch loadTransactions action', () => {
    const filters: TransactionFilters = { type: 'expense' as 'expense' };
    service.loadTransactions(filters, 1, 20);
    
    expect(store.dispatch).toHaveBeenCalledWith(
      TransactionActions.loadTransactions({ filters, page: 1, limit: 20 })
    );
  });

  it('should dispatch updateFilters action', () => {
    const filters: TransactionFilters = { type: 'expense' as 'expense' };
    service.updateFilters(filters);
    
    expect(store.dispatch).toHaveBeenCalledWith(
      TransactionActions.updateTransactionFilters({ filters })
    );
  });

  it('should dispatch selectTransaction action', () => {
    service.selectTransaction('1');
    
    expect(store.dispatch).toHaveBeenCalledWith(
      TransactionActions.selectTransaction({ transactionId: '1' })
    );
  });

  it('should dispatch clearSelectedTransaction action', () => {
    service.clearSelectedTransaction();
    
    expect(store.dispatch).toHaveBeenCalledWith(
      TransactionActions.clearSelectedTransaction()
    );
  });

  it('should dispatch deleteTransaction action', () => {
    service.deleteTransaction('1');
    
    expect(store.dispatch).toHaveBeenCalledWith(
      TransactionActions.deleteTransaction({ transactionId: '1' })
    );
  });

  it('should dispatch setLoading action', () => {
    service.setLoading(true);
    
    expect(store.dispatch).toHaveBeenCalledWith(
      TransactionActions.setTransactionLoading({ loading: true })
    );
  });
});
