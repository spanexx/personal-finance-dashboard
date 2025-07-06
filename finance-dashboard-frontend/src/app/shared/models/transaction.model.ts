export interface TransactionAttachment {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  url: string;
  uploadedAt: Date;
}

export interface RecurringConfig {
  isRecurring: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  endDate?: Date;
  nextDueDate?: Date;
  maxOccurrences?: number;
  currentOccurrence: number;
}

export interface Location {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
}

export interface Transaction {
  id: string;
  _id: string;
  user: string;
  amount: number;
  payee?: string;
  description: string;
  notes?: string;
  category: string;
  type: 'income' | 'expense' | 'transfer';
  date: Date;
  paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'check' | 'digital_wallet' | 'other';
  attachments: TransactionAttachment[];
  tags: string[];
  location?: Location;
  merchant?: string;
  referenceNumber?: string;
  status: 'pending' | 'completed' | 'cancelled' | 'failed';
  recurringConfig?: RecurringConfig;
  parentTransactionId?: string;
  transferAccount?: string;
  exchangeRate?: number;
  originalCurrency?: string;
  originalAmount?: number;
  isReconciled: boolean;
  reconciledAt?: Date;
  reconciledBy?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  deletedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateTransactionRequest {
  amount: number;
  description: string;
  notes?: string;
  category: string;
  type: 'income' | 'expense' | 'transfer';
  date: Date;
  paymentMethod: 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'check' | 'digital_wallet' | 'other';
  tags?: string[];
  location?: Location;
  merchant?: string;
  referenceNumber?: string;
  status?: 'pending' | 'completed' | 'cancelled' | 'failed';
  recurringConfig?: RecurringConfig;
  transferAccount?: string;
  exchangeRate?: number;
  originalCurrency?: string;
  originalAmount?: number;
  payee?: string; // Added to match usage in quick-add-transaction
}

export interface UpdateTransactionRequest {
  amount?: number;
  description?: string;
  notes?: string;
  category?: string;
  type?: 'income' | 'expense' | 'transfer';
  date?: Date;
  paymentMethod?: 'cash' | 'credit_card' | 'debit_card' | 'bank_transfer' | 'check' | 'digital_wallet' | 'other';
  tags?: string[];
  location?: Location;
  merchant?: string;
  referenceNumber?: string;
  status?: 'pending' | 'completed' | 'cancelled' | 'failed';
  recurringConfig?: RecurringConfig;
  transferAccount?: string;
  exchangeRate?: number;
  originalCurrency?: string;
  originalAmount?: number;
  isReconciled?: boolean;
}

export interface TransactionFilters {
  startDate?: Date | string;
  endDate?: Date | string;
  category?: string;
  type?: 'income' | 'expense' | 'transfer';
  paymentMethod?: string;
  status?: string;
  tags?: string[];
  merchant?: string;
  minAmount?: number;
  maxAmount?: number;
  isReconciled?: boolean;
  isDeleted?: boolean;
  compareWith?: 'previous' | 'lastYear';
}

export interface TransactionSummary {
  totalIncome: number;
  totalExpense: number;
  netAmount: number;
  transactionCount: number;
  averageTransaction: number;
  categoryBreakdown: Array<{
    category: string;
    amount: number;
    count: number;
    percentage: number;
  }>;
}

export interface BulkTransactionOperation {
  operation: 'delete' | 'update' | 'reconcile';
  transactionIds: string[];
  updateData?: Partial<UpdateTransactionRequest>;
}

export interface TransactionUploadResponse {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    message: string;
  }>;
  transactions: Transaction[];
}