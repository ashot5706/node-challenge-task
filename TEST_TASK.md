# Summary

This files includes all information about founded bugs, antipatterns, points of improvements, and explaination of decisions made

## Folder Structure Improvements

Decided to use layered folder structure instead of domain structure as the project is small and doesn't assumes large scale in the future, this will keep it more maintaiable and easy for implementation new features. If the perspective is to have a large project with microservices then we can change the structure to domain based.

### Misplaced files
1. Misplaced scripts: `src/run-migrations.ts` and `src/data/seed.ts`, created another folder `scripts/` and moved there, also `run-migrations.ts` doesn't make any sense as this functionality is already provided by TypeOrm CLI so changed this command in `package.json` and removed `run-migrations.ts`
```json
"migration:run": "npm run typeorm -- migration:run -d src/data/data-source.ts"
``` 
2. All model files were in `src/models/` without proper categorization
created `src/entities/`, `src/dto/` and `src/schemas` folders and moved corresponding files
seperated 
3. There was 2 different folders for tests, moved all tests to `test/` folder

### Configuration Improvements
This will help in having centralized config with env-specific settings and proper error handling 
1. Created `src/config/database.config.ts` 
2. Created `src/config/kafka.config.ts` 

### API Endpoints
Created separate folder for api endpoints

1. Added health and readiness endpoints under `src/api/health.controller.ts` for service monitoring
2. Added Endpoints for fetching token related data in `src/api/tokens.controller.ts`
   - `GET /api/tokens` - Get all tokens
   - `GET /api/tokens/:id` - Get token by ID
   - `GET /api/tokens/symbol/:symbol` - Get tokens by symbol


## Database Schema Improvements

1. Single table contained data for multiple entities, separated into different tables
2. Mixed naming styles, fixed to have convention - camelCase in TypeScript and snake_case in DB, for that purpose used `SnakeNamingStrategy` from `typeorm-naming-strategies` package
3. Added corresponding relationships and contraints
4. inadequate data types fixed - blockchain addresses as strings, financial data as bigint with transformers (28,0) or (38,0) decimal types in DB
  - (28,0) for prices as they are usually not that big and used scale 0 to work with integers only, convention here is that it shows price in 10^-8 dollars, so $12.34 is stored as 12_34000000n, this will help in safe operations in Node.js side and will opimize operations in DB side as well as integer operations are faster
  - (38,0) for totalSupply as some tokens have very large supplies
5. Poor indexing - fixed by adding indexes on frequently queried columns
6. Added connection pooling and timeout settings in database configuration
7. Seed script updated to use NestJS DI instead of manual repository creation

## Dependency Injection
1. Used NestJS DI properly instead of manual instantiation of services and repositories
2. Used DI for configs as well


## Other Improvements
- Kafka topics moved from configuration to constants for better maintainability
- Implemented dotenv for proper environment variable loading
- Fixed Jest configuration to properly find and run tests in the test directory
- Implemented batch processing with parallel execution for price updates using p-all library
- Fixed batch size to 100 tokens per batch and concurrency to 20 parallel updates
- Implemented transactional price updates with proper sequence: save to DB first, then send Kafka message
- Replaced interval-based price updates with NestJS scheduler using @Cron decorator (every 5 seconds)
- Removed manual start/stop methods in favor of automatic scheduler management
- Added overlapping execution prevention to ensure only one price update cycle runs at a time
- Implemented distributed lock using Redis to prevent overlapping executions across multiple instances
- Added Redis configuration and service for distributed locking



