import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as entities from '../entities';

export const databaseConfig: TypeOrmModuleOptions = {
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'tokens',
  entities: Object.values(entities),
  migrations: [`${__dirname}../src/migrations/*.{ts,js}`],
  migrationsRun: false,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  // Naming strategy: camelCase in TypeScript -> snake_case in database
  namingStrategy: new SnakeNamingStrategy(),
  // Connection pool configuration
  extra: {
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  },
};
