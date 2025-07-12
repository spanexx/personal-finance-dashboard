export const paymentMethods = [
  { value: 'cash', label: 'Cash' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'check', label: 'Check' },
  { value: 'digital_wallet', label: 'Digital Wallet' },
  { value: 'other', label: 'Other' }
];

export const transactionTypes = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
  { value: 'transfer', label: 'Transfer' }
];

export const statusOptions = [
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'cancelled', label: 'Cancelled' }
];

export const dateRangePresets = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'lastWeek', label: 'Last Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'last3Months', label: 'Last 3 Months' },
  { value: 'last6Months', label: 'Last 6 Months' },
  { value: 'thisYear', label: 'This Year' },
  { value: 'lastYear', label: 'Last Year' },
  { value: 'custom', label: 'Custom Range' }
];

export const bulkOperations = [
  { value: 'delete', label: 'Delete Selected', icon: 'delete', color: 'warn' },
  { value: 'categorize', label: 'Change Category', icon: 'category', color: 'primary' },
  { value: 'export', label: 'Export Selected', icon: 'download', color: 'accent' },
  { value: 'duplicate', label: 'Duplicate Selected', icon: 'content_copy', color: 'primary' }
];

export const exportFormats: { value: 'csv' | 'excel' | 'pdf', label: string, icon: string }[] = [
  { value: 'csv', label: 'CSV', icon: 'table_chart' },
  { value: 'excel', label: 'Excel', icon: 'grid_on' },
  { value: 'pdf', label: 'PDF', icon: 'picture_as_pdf' }
];

export const getDateRangeFromPreset = (preset: string): { startDate: Date | null; endDate: Date | null } => {
  const today = new Date();
  let startDate: Date | null = null;
  let endDate: Date | null = null;

  switch (preset) {
    case 'today':
      startDate = endDate = new Date(today);
      break;
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      startDate = endDate = yesterday;
      break;
    case 'thisWeek':
      startDate = new Date(today);
      startDate.setDate(today.getDate() - today.getDay());
      endDate = new Date();
      break;
    case 'lastWeek':
      const lastWeekEnd = new Date(today);
      lastWeekEnd.setDate(today.getDate() - today.getDay() - 1);
      startDate = new Date(lastWeekEnd);
      startDate.setDate(lastWeekEnd.getDate() - 6);
      endDate = lastWeekEnd;
      break;
    case 'thisMonth':
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      endDate = new Date();
      break;
    case 'lastMonth':
      const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      startDate = lastMonth;
      endDate = new Date(today.getFullYear(), today.getMonth(), 0);
      break;
    case 'last3Months':
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 3);
      endDate = new Date();
      break;
    case 'last6Months':
      startDate = new Date(today);
      startDate.setMonth(today.getMonth() - 6);
      endDate = new Date();
      break;
    case 'thisYear':
      startDate = new Date(today.getFullYear(), 0, 1);
      endDate = new Date();
      break;
    case 'lastYear':
      startDate = new Date(today.getFullYear() - 1, 0, 1);
      endDate = new Date(today.getFullYear() - 1, 11, 31);
      break;
    default:
      // 'custom' or other values will return null values
      break;
  }

  return { startDate, endDate };
};

export const convertToCSV = (transactions: any[]): string => {
  if (!transactions || transactions.length === 0) {
    return '';
  }

  // Helper function to get category name
  const getCategoryName = (category: any): string => {
    if (!category) return '';
    if (typeof category === 'string') return category;
    if (typeof category === 'object') {
      return category.name || category._id || '';
    }
    return String(category);
  };

  // Define CSV headers
  const headers = [
    'Date',
    'Description',
    'Category',
    'Type',
    'Amount',
    'Payment Method',
    'Status',
    'Payee',
    'Notes',
    'Tags'
  ];

  // Convert transactions to CSV rows
  const csvRows = transactions.map(transaction => {
    return [
      transaction.date ? new Date(transaction.date).toLocaleDateString() : '',
      escapeCsvValue(transaction.description || ''),
      escapeCsvValue(getCategoryName(transaction.category)),
      escapeCsvValue(transaction.type || ''),
      transaction.amount?.toString() || '0',
      escapeCsvValue(transaction.paymentMethod || ''),
      escapeCsvValue(transaction.status || ''),
      escapeCsvValue(transaction.payee || ''),
      escapeCsvValue(transaction.notes || ''),
      transaction.tags && Array.isArray(transaction.tags) 
        ? escapeCsvValue(transaction.tags.join('; ')) 
        : ''
    ].join(',');
  });

  // Combine headers and rows
  return [headers.join(','), ...csvRows].join('\n');
};

// Helper function to escape CSV values
const escapeCsvValue = (value: any): string => {
  // Convert to string if not already a string
  const stringValue = value != null ? String(value) : '';
  
  // Escape CSV values that contain commas, quotes, or newlines
  if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
};

/**
 * Calculate optimal page size based on total transaction count
 * @param totalCount Total number of transactions
 * @returns Optimal page size
 */
export const calculateOptimalPageSize = (totalCount: number): number => {
  if (totalCount <= 25) {
    // Show all transactions if 25 or fewer
    return Math.max(totalCount, 10); // Minimum of 10 for consistency
  } else if (totalCount <= 100) {
    // For small collections, show all transactions in one page
    return totalCount;
  } else if (totalCount <= 200) {
    // For medium collections up to 200, show all in one page
    return totalCount;
  } else if (totalCount <= 500) {
    // For larger collections up to 500, show all in one page (good UX for most users)
    return totalCount;
  } else if (totalCount <= 1000) {
    // For large collections, use smart pagination with 250 per page
    return 250;
  } else if (totalCount <= 5000) {
    // For very large collections, use 500 per page (backend max)
    return 500;
  } else {
    // For enterprise-level datasets, use 500 per page with virtual scrolling
    return 500;
  }
};

/**
 * Determine if infinite scroll should be enabled based on dataset size
 * @param totalCount Total number of transactions
 * @returns Whether to enable infinite scroll pagination
 */
export const shouldUseInfiniteScroll = (totalCount: number): boolean => {
  return totalCount > 500; // Enable infinite scroll for large datasets
};

/**
 * Calculate initial page size for efficient loading
 * @param totalCount Total number of transactions
 * @returns Initial page size for first load
 */
export const calculateInitialPageSize = (totalCount: number | null): number => {
  // If we don't know the total count yet, start with a reasonable default
  if (totalCount === null || totalCount === undefined) {
    return 100; // Conservative initial load
  }
  
  // Use the optimal size, but cap it for performance
  const optimal = calculateOptimalPageSize(totalCount);
  return Math.min(optimal, 500); // Never load more than 500 on initial load
};

/**
 * Update page size based on total transaction count with accessibility announcement
 * @param totalCount Total number of transactions
 * @param currentPageSize Current page size to compare
 * @param liveAnnouncer Live announcer service for accessibility
 * @returns Object containing the new page size and whether it changed
 */
export const calculatePageSizeUpdate = (
  totalCount: number, 
  currentPageSize: number
): { newPageSize: number; hasChanged: boolean; message?: string } => {
  const optimalPageSize = calculateOptimalPageSize(totalCount);
  
  if (currentPageSize !== optimalPageSize) {
    return {
      newPageSize: optimalPageSize,
      hasChanged: true,
      message: `Page size automatically adjusted to ${optimalPageSize} to better display your ${totalCount} transactions`
    };
  }
  
  return {
    newPageSize: currentPageSize,
    hasChanged: false
  };
};
