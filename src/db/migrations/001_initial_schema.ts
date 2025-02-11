import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create enum for sync status
  pgm.createType('sync_status', [
    'pending',
    'in_progress',
    'completed',
    'failed'
  ]);

  // Create sync_history table
  pgm.createTable('sync_history', {
    id: { type: 'serial', primaryKey: true },
    status: { type: 'sync_status', notNull: true },
    started_at: { type: 'timestamp', notNull: true },
    completed_at: { type: 'timestamp' },
    error_message: { type: 'text' },
    items_processed: { type: 'integer', default: 0 },
    items_failed: { type: 'integer', default: 0 },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Create pending_items table
  pgm.createTable('pending_items', {
    id: { type: 'serial', primaryKey: true },
    sync_id: {
      type: 'integer',
      references: 'sync_history',
      onDelete: 'CASCADE',
    },
    item_type: { type: 'text', notNull: true },
    item_data: { type: 'jsonb', notNull: true },
    status: { type: 'sync_status', notNull: true, default: 'pending' },
    error_message: { type: 'text' },
    retry_count: { type: 'integer', default: 0 },
    created_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Create indexes
  pgm.createIndex('sync_history', 'status');
  pgm.createIndex('sync_history', 'started_at');
  pgm.createIndex('pending_items', 'sync_id');
  pgm.createIndex('pending_items', 'status');
  pgm.createIndex('pending_items', 'item_type');

  // Create updated_at trigger function
  pgm.createFunction(
    'update_updated_at_column',
    [],
    {
      replace: true,
      language: 'plpgsql',
      returns: 'trigger',
    },
    `
    BEGIN
      NEW.updated_at = current_timestamp;
      RETURN NEW;
    END;
    `
  );

  // Add triggers for updated_at
  pgm.createTrigger('sync_history', 'update_updated_at_trigger', {
    when: 'BEFORE',
    operation: 'UPDATE',
    level: 'ROW',
    function: 'update_updated_at_column',
  });

  pgm.createTrigger('pending_items', 'update_updated_at_trigger', {
    when: 'BEFORE',
    operation: 'UPDATE',
    level: 'ROW',
    function: 'update_updated_at_column',
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop triggers first
  pgm.dropTrigger('sync_history', 'update_updated_at_trigger');
  pgm.dropTrigger('pending_items', 'update_updated_at_trigger');
  
  // Drop function
  pgm.dropFunction('update_updated_at_column', []);
  
  // Drop indexes
  pgm.dropIndex('pending_items', 'item_type');
  pgm.dropIndex('pending_items', 'status');
  pgm.dropIndex('pending_items', 'sync_id');
  pgm.dropIndex('sync_history', 'started_at');
  pgm.dropIndex('sync_history', 'status');
  
  // Drop tables
  pgm.dropTable('pending_items');
  pgm.dropTable('sync_history');
  
  // Drop enum
  pgm.dropType('sync_status');
} 