import { TransactionDetail, BudgetSummary } from 'ynab';

export type SyncStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface SyncHistoryEntry {
  id: number;
  status: SyncStatus;
  started_at: Date;
  completed_at?: Date;
  items_processed: number;
  items_failed: number;
  error_message?: string;
  created_at: Date;
  updated_at: Date;
}

export interface YNABTransaction extends TransactionDetail {
  local_id?: string;
  sync_status?: 'pending' | 'synced' | 'failed';
  error_message?: string;
}

export interface YNABBudget extends BudgetSummary {
  last_sync_time?: string;
  sync_enabled?: boolean;
}

export interface SyncItem {
  id: string;
  item_type: 'transaction' | 'budget' | 'category';
  action: 'create' | 'update' | 'delete';
  data: any;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  error_message?: string;
  retry_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface SyncResult {
  success: boolean;
  items_processed: number;
  items_failed: number;
  error_message?: string;
}

export interface ServerKnowledge {
  budget_id: string;
  transaction_knowledge: number;
  category_knowledge: number;
  last_sync_time: string;
} 