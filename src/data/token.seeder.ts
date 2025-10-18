import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Chain, Token } from 'src/entities';
import { Repository } from 'typeorm';
@Injectable()
export class TokenSeeder {
  private readonly logger = new Logger(TokenSeeder.name);

  constructor(
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
    @InjectRepository(Chain)
    private readonly chainRepository: Repository<Chain>
  ) {}

  async seed(): Promise<void> {
    // Check if there are already tokens in the database
    const tokenCount = await this.tokenRepository.count();
    if (tokenCount > 0) {
      this.logger.log('Database already seeded, skipping...');
      return;
    }

    this.logger.log('Seeding initial data...');

    try {
      // First, ensure chains exist
      await this.seedChains();
      
      // Then seed tokens with their logos
      await this.seedTokens();
      
      this.logger.log('Initial data seeded successfully');
    } catch (error) {
      this.logger.error('Failed to seed initial data', error.stack);
      throw error;
    }
  }

  private async seedChains(): Promise<void> {
    const chains = [
      {
        id: '11111111-1111-1111-1111-111111111111',
        name: 'Ethereum',
        chainId: 1,
        isEnabled: true,
        nativeCurrency: 'ETH',
        rpcUrl: 'https://mainnet.infura.io/v3/YOUR_KEY',
        explorerUrl: 'https://etherscan.io',
      },
      {
        id: '22222222-2222-2222-2222-222222222222',
        name: 'Bitcoin',
        chainId: 0,
        isEnabled: true,
        nativeCurrency: 'BTC',
        rpcUrl: null,
        explorerUrl: 'https://blockstream.info',
      },
      {
        id: '33333333-3333-3333-3333-333333333333',
        name: 'Solana',
        chainId: 101,
        isEnabled: true,
        nativeCurrency: 'SOL',
        rpcUrl: 'https://api.mainnet-beta.solana.com',
        explorerUrl: 'https://explorer.solana.com',
      },
    ];

    for (const chainData of chains) {
      const existingChain = await this.chainRepository.findOne({ where: { id: chainData.id } });
      if (!existingChain) {
        const chain = this.chainRepository.create(chainData);
        await this.chainRepository.save(chain);
        this.logger.log(`Created chain: ${chainData.name}`);
      }
    }
  }

  private async seedTokens(): Promise<void> {
    const tokenData = [
      {
        id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        address: '0x0000000000000000000000000000000000000000',
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        isNative: true,
        isProtected: true,
        isVerified: true,
        lastUpdateAuthor: 'Seeder',
        priority: 1,
        totalSupply: 120000000000000000000000000n,
        price: 3000_00000000n, // $3000.00 in 10^-8 dollars
        chainId: '11111111-1111-1111-1111-111111111111',
        logoUrl: '/images/eth_big.png',
      },
      {
        id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        address: '0x0000000000000000000000000000000000000000',
        symbol: 'BTC',
        name: 'Bitcoin',
        decimals: 8,
        isNative: true,
        isProtected: true,
        isVerified: true,
        lastUpdateAuthor: 'Seeder',
        priority: 2,
        totalSupply: 2100000000000000n,
        price: 450000_00000000n, // $45000.00 in 10^-8 dollars
        chainId: '22222222-2222-2222-2222-222222222222',
        logoUrl: '/images/btc_big.png',
      },
      {
        id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
        address: 'So11111111111111111111111111111111111111112', // Solana native token address
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        isNative: true,
        isProtected: true,
        isVerified: true,
        lastUpdateAuthor: 'Seeder',
        priority: 3,
        totalSupply: 500000000000000000n,
        price: 150_00000000n, // $150.00 in 10^-8 dollars
        chainId: '33333333-3333-3333-3333-333333333333',
        logoUrl: '/images/sol_big.png',
      },
    ];

    for (const data of tokenData) {
      const existingToken = await this.tokenRepository.findOne({ where: { id: data.id } });
      if (!existingToken) {
        // Create the token
        const token = this.tokenRepository.create({
          id: data.id,
          address: data.address,
          symbol: data.symbol,
          name: data.name,
          decimals: data.decimals,
          isNative: data.isNative,
          isProtected: data.isProtected,
          isVerified: data.isVerified,
          lastUpdateAuthor: data.lastUpdateAuthor,
          priority: data.priority,
          price: data.price,
          chainId: data.chainId,
          logoUrl: data.logoUrl,
        });

        await this.tokenRepository.save(token);

        this.logger.log(`Created token: ${data.symbol} with logo`);
      }
    }
  }
}