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
