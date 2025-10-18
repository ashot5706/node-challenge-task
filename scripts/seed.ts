import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';
import { Chain, Token } from 'src/entities';
import { TokenSeeder } from '../src/data/token.seeder';
import { databaseConfig } from '../src/config/database.config';

@Module({
  imports: [
    TypeOrmModule.forRoot(databaseConfig),
    TypeOrmModule.forFeature([Token, Chain]),
  ],
  providers: [TokenSeeder],
})
class SeederModule {}

async function seed() {
  try {
    // Create NestJS application context
    const app = await NestFactory.createApplicationContext(SeederModule);
    console.log('NestJS application context created');

    // Get the seeder service from DI container
    const tokenSeeder = app.get(TokenSeeder);

    // Seed data
    await tokenSeeder.seed();
    console.log('Database seeded successfully');

    // Close the application context
    await app.close();
    console.log('Application context closed');
  } catch (error) {
    console.error('Error during seeding process:', error);
    process.exit(1);
  }
}

// Run the seeder
seed()
  .then(() => {
    console.log('Seeding completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to seed database:', error);
    process.exit(1);
  });
