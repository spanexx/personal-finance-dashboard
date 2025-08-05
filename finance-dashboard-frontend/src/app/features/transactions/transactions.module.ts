import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { ScrollingModule } from '@angular/cdk/scrolling';

import { TransactionsRoutingModule } from './transactions-routing.module';
import { TransactionListComponent } from './transaction-list/transaction-list.component';
import { TransactionFormComponent } from './transaction-form/transaction-form.component';
import { TransactionCategoryManagerComponent } from './transaction-category-manager/transaction-category-manager.component';
import { QuickAddTransactionComponent } from './quick-add-transaction/quick-add-transaction.component';
import { CreateCategoryModalComponent } from './create-category-modal/create-category-modal.component';
import { CategoryModalComponent } from './category-modal/category-modal.component';
import { TransactionAnalyticsComponent } from './components/transaction-analytics.component';
import { CategoryDetailsDialogComponent } from './components/category-details-dialog.component';
import { CashFlowVisualizationComponent } from './components/cash-flow-visualization.component';
import { ImportDialogComponent } from './components/import-dialog/import-dialog.component';
import { TransactionFiltersComponent } from './components/transaction-filters/transaction-filters.component';
import { TransactionTableComponent } from './components/transaction-table/transaction-table.component';
import { TransactionBulkOperationsComponent } from './components/transaction-bulk-operations/transaction-bulk-operations.component';
import { TransactionExportImportComponent } from './components/transaction-export-import/transaction-export-import.component';
import { TransactionStatisticsComponent } from './components/transaction-statistics/transaction-statistics.component';
import { ExportImportHistoryComponent } from './components/export-import-history/export-import-history.component';

// Shared Directives
import { FocusTrapDirective } from '../../shared/directives/focus-trap.directive';
import { ChartDirective } from '../../shared/directives/chart.directive';
import { AccessibleChartDirective } from '../../shared/directives/accessible-chart.directive';

// Chart.js
import { NgChartsModule } from 'ng2-charts';

// Material Imports
import { MaterialModule } from '../../shared/modules';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';


@NgModule({  declarations: [
    TransactionListComponent,
    TransactionFormComponent,    TransactionCategoryManagerComponent,    QuickAddTransactionComponent,
    CreateCategoryModalComponent,
    CategoryModalComponent,    TransactionAnalyticsComponent,
    CategoryDetailsDialogComponent,
    CashFlowVisualizationComponent,
    ChartDirective,
    AccessibleChartDirective,
    ImportDialogComponent,
    TransactionFiltersComponent,
    TransactionTableComponent,
    TransactionBulkOperationsComponent,
    TransactionExportImportComponent,
    TransactionStatisticsComponent,
    ExportImportHistoryComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    TransactionsRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    ScrollingModule,
    NgChartsModule,
    FocusTrapDirective,
    // Material Modules
    MaterialModule,
    MatDatepickerModule,
    MatNativeDateModule
  ]
})


export class TransactionsModule { }