import { Injectable } from '@nestjs/common';
import { Token } from '../entities/token.entity';
import { PriceConfigService } from '../config/price.config';

@Injectable()
export class MockPriceService {
  constructor(private readonly priceConfig: PriceConfigService) {}

  async getRandomPriceForToken(_token: Token): Promise<bigint> {
    // Simulate API call delay
    await new Promise<void>(resolve => {
      setTimeout(() => {
        resolve();
      }, this.getRandomInt(this.priceConfig.minDelayMs, this.priceConfig.maxDelayMs));
    });

    const dollars = this.getRandomInt(
      this.priceConfig.minPriceDollars,
      this.priceConfig.maxPriceDollars
    );
    const decimalsPart = this.getRandomInt(0, 99999999);
    const price = BigInt(dollars) * 100000000n + BigInt(decimalsPart);
    return price;
  }

  private getRandomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
}
