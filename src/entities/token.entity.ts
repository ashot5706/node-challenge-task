import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Chain } from './chain.entity';

@Entity('tokens')
@Index(['address', 'chainId'], { unique: true })
@Index(['symbol'])
@Index(['lastPriceUpdate'])
export class Token {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  address: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  symbol: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  name: string;

  @Column({ type: 'smallint', default: 0 })
  decimals: number;

  @Column({ type: 'boolean', default: false })
  isNative: boolean;

  @Column({ type: 'boolean', default: false })
  isProtected: boolean;

  @Column({ type: 'boolean', default: false })
  isVerified: boolean;

  // TODO: create separate users table and link to it
  @Column({ type: 'varchar', length: 100, nullable: true })
  lastUpdateAuthor: string;

  @Column({ type: 'integer', default: 0 })
  priority: number;

  @Column({
    type: 'numeric',
    precision: 38,
    scale: 0,
    nullable: true,
    transformer: {
      to: (value: bigint): string => (value ?? 0n).toString(),
      from: (value: string): bigint => {
        if (value === null || value === undefined) return 0n;
        return BigInt(value);
      },
    },
  })
  totalSupply: bigint;

  // Price in 10^-8 dollars, 10$ = 10,000,000,00
  @Column({
    type: 'numeric',
    precision: 28,
    scale: 0,
    default: 0,
    transformer: {
      to: (value: bigint): string => (value ?? 0n).toString(),
      from: (value: string): bigint => {
        if (value === null || value === undefined) return 0n;
        return BigInt(value);
      },
    },
  })
  price: bigint;

  // Market cap in dollars
  @Column({ type: 'numeric', precision: 28, scale: 0, nullable: true })
  marketCap: string;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  logoUrl: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  lastPriceUpdate: Date;

  // Foreign Keys
  @Column({ type: 'uuid' })
  chainId: string;

  // Relationships
  @ManyToOne(() => Chain, chain => chain.tokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chainId' })
  chain: Chain;
}
