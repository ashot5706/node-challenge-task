import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PriceConfigService {
  constructor(private readonly configService: ConfigService) {}

  get minPriceDollars(): number {
    return this.configService.get<number>('PRICE_MIN_DOLLARS', 1);
  }

  get maxPriceDollars(): number {
    return this.configService.get<number>('PRICE_MAX_DOLLARS', 10000000);
  }

  get minDelayMs(): number {
    return this.configService.get<number>('PRICE_API_MIN_DELAY_MS', 50);
  }

  get maxDelayMs(): number {
    return this.configService.get<number>('PRICE_API_MAX_DELAY_MS', 200);
  }
}
