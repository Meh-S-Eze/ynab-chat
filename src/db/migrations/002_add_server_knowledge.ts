import { MigrationBuilder, ColumnDefinitions } from 'node-pg-migrate';

export const shorthands: ColumnDefinitions | undefined = undefined;

export async function up(pgm: MigrationBuilder): Promise<void> {
  // Create server_knowledge table
  pgm.createTable('server_knowledge', {
    budget_id: { type: 'text', primaryKey: true },
    transaction_knowledge: { type: 'bigint', notNull: true, default: 0 },
    category_knowledge: { type: 'bigint', notNull: true, default: 0 },
    last_sync_time: { 
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  // Create updated_at trigger
  pgm.createTrigger('server_knowledge', 'update_updated_at_trigger', {
    when: 'BEFORE',
    operation: 'UPDATE',
    level: 'ROW',
    function: 'update_updated_at_column',
  });

  // Add indexes
  pgm.createIndex('server_knowledge', 'last_sync_time');
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  // Drop trigger
  pgm.dropTrigger('server_knowledge', 'update_updated_at_trigger');
  
  // Drop index
  pgm.dropIndex('server_knowledge', 'last_sync_time');
  
  // Drop table
  pgm.dropTable('server_knowledge');
} 