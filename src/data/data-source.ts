import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'tokens',
  entities: ['src/entities/*.entity.{ts,js}'],
  migrations: ['src/migrations/*.{ts,js}'],
  synchronize: false, // Set to false when using migrations
  logging: process.env.NODE_ENV === 'development',
  // Naming strategy: camelCase in TypeScript -> snake_case in database
  namingStrategy: new SnakeNamingStrategy(),
  // Connection pool configuration
  extra: {
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  },
});
