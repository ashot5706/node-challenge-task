import { Controller, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Token } from '../entities/token.entity';

@Controller('api/tokens')
export class TokensController {
  constructor(
    @InjectRepository(Token)
    private readonly tokenRepository: Repository<Token>,
  ) {}

  @Get()
  async getAllTokens(): Promise<Token[]> {
    try {
      return await this.tokenRepository.find();
    } catch (error) {
      throw new HttpException(
        'Failed to fetch tokens',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getTokenById(@Param('id') id: string): Promise<Token> {
    try {
      const token = await this.tokenRepository.findOne({ where: { id } });
      if (!token) {
        throw new HttpException('Token not found', HttpStatus.NOT_FOUND);
      }
      return token;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch token',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('symbol/:symbol')
  async getTokenBySymbol(@Param('symbol') symbol: string): Promise<Token[]> {
    try {
      return await this.tokenRepository.find({ where: { symbol } });
    } catch (error) {
      throw new HttpException(
        'Failed to fetch tokens by symbol',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
