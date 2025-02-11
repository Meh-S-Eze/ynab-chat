import { spawn } from 'child_process';
import path from 'path';
import logger from '../utils/logger';

const runMigrations = async (command: 'up' | 'down' = 'up'): Promise<void> => {
  return new Promise((resolve, reject) => {
    const nodeModulesPath = path.resolve(process.cwd(), 'node_modules');
    const migrationsPath = path.resolve(process.cwd(), 'src/db/migrations');

    const migrate = spawn(
      'node',
      [
        path.join(nodeModulesPath, 'node-pg-migrate/bin/node-pg-migrate'),
        command,
        '--migration-file-language', 'ts',
        '--migrations-dir', migrationsPath,
        '--tsconfig', path.resolve(process.cwd(), 'tsconfig.json'),
      ],
      {
        env: {
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL || 'postgres://localhost:5432/ynab_sync',
        },
        stdio: 'inherit',
      }
    );

    migrate.on('close', (code) => {
      if (code === 0) {
        logger.info(`Database migrations ${command} completed successfully`);
        resolve();
      } else {
        const error = new Error(`Database migrations ${command} failed with code ${code}`);
        logger.error(error);
        reject(error);
      }
    });

    migrate.on('error', (error) => {
      logger.error('Failed to run database migrations:', error);
      reject(error);
    });
  });
};

// Run migrations if this file is executed directly
if (require.main === module) {
  const command = process.argv[2] as 'up' | 'down';
  runMigrations(command)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default runMigrations; 