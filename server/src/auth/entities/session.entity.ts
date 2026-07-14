import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { AccountEntity } from './account.entity';

@Entity({ name: 'account_sessions' })
export class SessionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'text' })
  tokenHash!: string;

  @Column({ type: 'text' })
  csrfTokenHash!: string;

  @ManyToOne(() => AccountEntity, account => account.sessions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'accountId' })
  account!: AccountEntity;

  @Column({ type: 'uuid' })
  accountId!: string;

  @Column({ type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  revokedAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSeenAt!: Date | null;

  @Column({ type: 'text', default: '' })
  userAgent!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
