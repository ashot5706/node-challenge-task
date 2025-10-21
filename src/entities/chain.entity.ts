import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { Token } from './token.entity';

@Entity('chains')
export class Chain {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'integer', unique: true, nullable: true })
  chainId: number;

  @Column({ type: 'boolean', default: true })
  isEnabled: boolean;

  @Column({ type: 'varchar', length: 10, nullable: true })
  nativeCurrency: string;

  @CreateDateColumn()
  createdAt: Date;

  // Relationships
  @OneToMany(() => Token, token => token.chain)
  tokens: Token[];
}
