import { API, GetTransactionsTypeEnum } from 'ynab';
import { backOff } from 'exponential-backoff';
import logger from '../utils/logger';
import { YNABTransaction, YNABBudget, SyncResult, ServerKnowledge } from '../types/ynab';
import pool from '../db/config';

export class YNABService {
  private api: API;
  private serverKnowledge: Map<string, ServerKnowledge> = new Map();

  constructor() {
    const accessToken = process.env.YNAB_TOKEN;
    if (!accessToken) {
      throw new Error('YNAB_TOKEN environment variable is required');
    }
    this.api = new API(accessToken);
  }

  // Get all budgets
  async getBudgets(): Promise<YNABBudget[]> {
    try {
      const response = await this.executeWithRetry(() => 
        this.api.budgets.getBudgets()
      );
      return response.data.budgets as YNABBudget[];
    } catch (error) {
      logger.error('Failed to fetch budgets:', error);
      throw error;
    }
  }

  // Get transactions with server knowledge
  async getTransactions(budgetId: string, sinceDate?: Date): Promise<YNABTransaction[]> {
    try {
      const knowledge = this.serverKnowledge.get(budgetId)?.transaction_knowledge;
      const sinceDateStr = sinceDate?.toISOString().split('T')[0]; // Convert to YYYY-MM-DD
      
      const response = await this.executeWithRetry(() =>
        this.api.transactions.getTransactions(
          budgetId,
          sinceDateStr,
          knowledge ? GetTransactionsTypeEnum.Since : undefined
        )
      );

      // Update server knowledge
      if (response.data.server_knowledge) {
        this.updateServerKnowledge(budgetId, {
          transaction_knowledge: response.data.server_knowledge
        });
      }

      return response.data.transactions as YNABTransaction[];
    } catch (error) {
      logger.error('Failed to fetch transactions:', error);
      throw error;
    }
  }

  // Create a transaction
  async createTransaction(budgetId: string, transaction: YNABTransaction): Promise<YNABTransaction> {
    try {
      const response = await this.executeWithRetry(() =>
        this.api.transactions.createTransaction(budgetId, {
          transaction: {
            account_id: transaction.account_id,
            date: transaction.date,
            amount: transaction.amount,
            payee_id: transaction.payee_id,
            payee_name: transaction.payee_name,
            category_id: transaction.category_id,
            memo: transaction.memo,
            cleared: transaction.cleared,
            approved: transaction.approved,
            flag_color: transaction.flag_color,
            import_id: transaction.import_id
          }
        })
      );

      if (!response.data.transaction) {
        throw new Error('No transaction returned from YNAB API');
      }

      return {
        ...response.data.transaction,
        sync_status: 'synced'
      } as YNABTransaction;
    } catch (error) {
      logger.error('Failed to create transaction:', error);
      throw error;
    }
  }

  // Update a transaction
  async updateTransaction(
    budgetId: string,
    transactionId: string,
    transaction: Partial<YNABTransaction>
  ): Promise<YNABTransaction> {
    try {
      const response = await this.executeWithRetry(() =>
        this.api.transactions.updateTransaction(budgetId, transactionId, {
          transaction: transaction as any
        })
      );
      return response.data.transaction;
    } catch (error) {
      logger.error('Failed to update transaction:', error);
      throw error;
    }
  }

  // Delete a transaction
  async deleteTransaction(budgetId: string, transactionId: string): Promise<void> {
    try {
      await this.executeWithRetry(() =>
        this.api.transactions.deleteTransaction(budgetId, transactionId)
      );
    } catch (error) {
      logger.error('Failed to delete transaction:', error);
      throw error;
    }
  }

  // Execute API call with retry logic
  private async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
    return backOff(() => fn(), {
      numOfAttempts: 3,
      startingDelay: 1000,
      timeMultiple: 2,
      retry: (error: any) => {
        const shouldRetry = error.status === 429 || error.status >= 500;
        if (shouldRetry) {
          logger.warn('Retrying YNAB API call due to:', error);
        }
        return shouldRetry;
      },
    });
  }

  // Update server knowledge
  private async updateServerKnowledge(
    budgetId: string,
    knowledge: Partial<ServerKnowledge>
  ): Promise<void> {
    const current = this.serverKnowledge.get(budgetId) || {
      budget_id: budgetId,
      transaction_knowledge: 0,
      category_knowledge: 0,
      last_sync_time: new Date().toISOString()
    };

    const updated = { ...current, ...knowledge };
    this.serverKnowledge.set(budgetId, updated);

    // Persist to database
    await pool.query(
      `INSERT INTO server_knowledge (budget_id, transaction_knowledge, category_knowledge, last_sync_time)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (budget_id) DO UPDATE
       SET transaction_knowledge = $2,
           category_knowledge = $3,
           last_sync_time = $4`,
      [
        updated.budget_id,
        updated.transaction_knowledge,
        updated.category_knowledge,
        updated.last_sync_time
      ]
    );
  }

  // Load server knowledge from database
  async loadServerKnowledge(): Promise<void> {
    const result = await pool.query('SELECT * FROM server_knowledge');
    result.rows.forEach(row => {
      this.serverKnowledge.set(row.budget_id, row);
    });
  }
} 