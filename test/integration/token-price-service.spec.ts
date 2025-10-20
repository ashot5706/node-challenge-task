import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  GenericContainer,
  Network,
  StartedTestContainer,
} from 'testcontainers';
import { Kafka, Consumer, logLevel, KafkaMessage } from 'kafkajs';
import { TokenPriceUpdateService } from '../../src/services/token-price-update.service';
import { MockPriceService } from '../../src/services/mock-price.service';
import { KafkaProducerService } from '../../src/kafka/kafka-producer.service';
import { DistributedLockService } from '../../src/services/distributed-lock.service';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Token } from '../../src/entities/token.entity';
import { Chain } from '../../src/entities/chain.entity';
import { KAFKA_TOPICS } from '../../src/constants/kafka-topics';
import * as entities from '../../src/entities';
import { KafkaConfigService } from 'src/config/kafka.config';
import { PriceConfigService } from 'src/config/price.config';
import { RedisConfigService } from 'src/config/redis.config';
import { KafkaClientService } from 'src/kafka/kafka-client.service';
import { TokenSeeder } from 'src/data/token.seeder';
import { findPort } from 'find-open-port';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Suppress KafkaJS partitioner warning during tests
process.env.KAFKAJS_NO_PARTITIONER_WARNING = 'true';

describe('Token Price Update E2E Tests', () => {
  let moduleRef: TestingModule;
  let tokenRepository: Repository<Token>;
  let chainRepository: Repository<Chain>;
  let tokenPriceUpdateService: TokenPriceUpdateService;
  let kafkaConsumer: Consumer;

  let postgresContainer: StartedTestContainer;
  let kafkaContainer: StartedTestContainer;
  let zookeeperContainer: StartedTestContainer;
  let redisContainer: StartedTestContainer;

  const testId = Math.random().toString(36).substring(7);

  beforeAll(async () => {
    jest.setTimeout(180000); // 3 minutes timeout for container startup

    const network = await new Network().start();
    let postgresHost: string;
    let mappedPostgresPort: number;
    let redisHost: string;
    let mappedRedisPort: number;
    let kafkaHost: string;
    const kafkaPort = await findPort();
    let mappedKafkaPort: number;

    try {
      // Start Postgres container
      postgresContainer = await new GenericContainer('postgres:15-alpine')
        .withName(`postgres-test-${testId}`)
        .withEnvironment({
          POSTGRES_USER: 'test',
          POSTGRES_PASSWORD: 'test',
          POSTGRES_DB: 'test_tokens',
        })
        .withExposedPorts(5432)
        .start();

      postgresHost = postgresContainer.getHost();
      mappedPostgresPort = postgresContainer.getMappedPort(5432);

      // Start Redis container
      redisContainer = await new GenericContainer('redis:7-alpine')
        .withName(`redis-test-${testId}`)
        .withExposedPorts(6379)
        .start();

      redisHost = redisContainer.getHost();
      mappedRedisPort = redisContainer.getMappedPort(6379);

      zookeeperContainer = await new GenericContainer(
        'confluentinc/cp-zookeeper:7.3.0'
      )
        .withName(`zookeeper-test-${testId}`)
        .withEnvironment({
          ZOOKEEPER_CLIENT_PORT: '2181',
          ZOOKEEPER_TICK_TIME: '2000',
        })
        .withExposedPorts(2181)
        .withNetwork(network)
        .start();

      // Wait for Zookeeper to start
      await new Promise(resolve => setTimeout(resolve, 3000));

      kafkaContainer = await new GenericContainer('confluentinc/cp-kafka:7.3.0')
        .withExposedPorts(kafkaPort)
        .withEnvironment({
          KAFKA_BROKER_ID: '1',
          KAFKA_ZOOKEEPER_CONNECT: `zookeeper-test-${testId}:2181`,
          KAFKA_LISTENERS: `PLAINTEXT://0.0.0.0:${kafkaPort}`,
          KAFKA_ADVERTISED_LISTENERS: `PLAINTEXT://localhost:${kafkaPort}`,
          KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: '1',
          KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true',
        })
        .withNetwork(network)
        .withExposedPorts({ container: kafkaPort, host: kafkaPort })
        .start();

      kafkaHost = kafkaContainer.getHost();
      mappedKafkaPort = kafkaContainer.getMappedPort(kafkaPort);

      // Wait for Kafka to be fully ready
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Setup Kafka consumer
      const kafka = new Kafka({
        clientId: 'test-client',
        brokers: [`${kafkaHost}:${mappedKafkaPort}`],
        logLevel: logLevel.NOTHING,
      });

      kafkaConsumer = kafka.consumer({ groupId: 'test-consumer-group' });
      await kafkaConsumer.connect();
      await kafkaConsumer.subscribe({
        topic: KAFKA_TOPICS.TOKEN_PRICE_UPDATES,
        fromBeginning: false,
      });

      // Create NestJS test module
      moduleRef = await Test.createTestingModule({
        imports: [
          ConfigModule.forRoot({
            isGlobal: true,
          }),
          TypeOrmModule.forRoot({
            type: 'postgres',
            host: postgresHost,
            port: mappedPostgresPort,
            username: 'test',
            password: 'test',
            database: 'test_tokens',
            entities: Object.values(entities),
            synchronize: true,
            logging: false,
            dropSchema: true, // Ensure a clean schema for each test run
          }),
          TypeOrmModule.forFeature([Token, Chain]),
        ],
        providers: [
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                const config = {
                  REDIS_HOST: redisHost,
                  REDIS_PORT: mappedRedisPort,
                  REDIS_DATABASE: 0,
                  KAFKA_BROKERS: `${kafkaHost}:${mappedKafkaPort}`,
                  KAFKA_CLIENT_ID: 'test-client',
                  KAFKA_RETRY_INITIAL_TIME: 500,
                  KAFKA_RETRY_ATTEMPTS: 3,
                };
                return config[key] || defaultValue;
              }),
            },
          },
          // Configuration services
          KafkaConfigService,
          PriceConfigService,
          RedisConfigService,

          // Core services
          KafkaClientService,
          KafkaProducerService,
          DistributedLockService,
          MockPriceService,
          TokenPriceUpdateService,
          TokenSeeder,
        ],
      }).compile();

      tokenRepository = moduleRef.get<Repository<Token>>(
        getRepositoryToken(Token)
      );
      chainRepository = moduleRef.get<Repository<Chain>>(
        getRepositoryToken(Chain)
      );
      tokenPriceUpdateService = moduleRef.get<TokenPriceUpdateService>(
        TokenPriceUpdateService
      );
    } catch (error) {
      console.error('Error during test setup:', error);
      throw error;
    }
  }, 180000);

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }

    if (kafkaConsumer) {
      await kafkaConsumer.disconnect();
    }

    if (postgresContainer) {
      await postgresContainer.stop();
    }

    if (kafkaContainer) {
      await kafkaContainer.stop();
    }

    if (zookeeperContainer) {
      await zookeeperContainer.stop();
    }

    if (redisContainer) {
      await redisContainer.stop();
    }
  }, 30000);

  beforeEach(async () => {
    // Clear database before each test
    await tokenRepository.query('DELETE FROM tokens;');
    await chainRepository.query('DELETE FROM chains;');

    const tokenSeeder = moduleRef.get(TokenSeeder);

    // Seed data
    await tokenSeeder.seed();
  });

  describe('Token Price update integration tests', () => {
    it('should update token price and send Kafka message', async () => {
      const token = await tokenRepository.findOne({
        where: { symbol: 'ETH' },
      });
      expect(token).toBeDefined();
      if (!token) {
        throw new Error('Token MOCK1 not found in database');
      }

      const messages: KafkaMessage[] = [];

      await kafkaConsumer.run({
        eachMessage: async (payload: {
          message: KafkaMessage;
        }): Promise<void> => {
          messages.push(payload.message);
        },
      });

      try {
        await tokenPriceUpdateService.handlePriceUpdateCron();
      } catch (error) {
        console.error('Error during price update handling:', error);
      }

      await kafkaConsumer.stop();

      const updatedToken = await tokenRepository.findOne({
        where: { symbol: 'ETH' },
      });
      expect(updatedToken).toBeDefined();
      expect(updatedToken?.price).not.toEqual(token.price);

      const { key, value } =
        messages.find(msg => msg.key?.toString() === token.id) || {};
      expect(key).toBeDefined();
      expect(value).toBeDefined();

      const valueParsed: {
        tokenId?: string;
        symbol?: string;
        oldPrice?: string;
        newPrice?: string;
        timestamp?: string;
      } = JSON.parse(value?.toString() ?? '{}');

      expect(valueParsed.tokenId).toBe(token.id);
      expect(valueParsed.newPrice).toBe(updatedToken?.price.toString());
    }, 10000);
  });
});
