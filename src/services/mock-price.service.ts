import { Injectable } from '@nestjs/common';
import { Token } from '../entities/token.entity';

@Injectable()
export class MockPriceService {
  async getRandomPriceForToken(token: Token): Promise<bigint> {
    // Simulate API call delay  
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, this.getRandomInt(50, 200));
    });
    
    const dollars = this.getRandomInt(1, 10000000);
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
