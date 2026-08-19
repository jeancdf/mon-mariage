import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { AccessProfileKey, AccountStatus } from '../auth.types';
import { AccessProfileEntity } from './access-profile.entity';
import { SessionEntity } from './session.entity';

@Entity({ name: 'accounts' })
export class AccountEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', nullable: true, unique: true })
  guestId!: string | null;

  @Index({ unique: true })
  @Column({ type: 'text' })
  email!: string;

  @Column({ type: 'text', nullable: true, select: false })
  passwordHash!: string | null;

  @Index({ unique: true })
  @Column({ type: 'text', nullable: true, select: false })
  invitationTokenHash!: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  invitationExpiresAt!: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  invitationSentAt!: Date | null;

  @Column({ type: 'text', default: 'pending' })
  status!: AccountStatus;

  @Column({ type: 'text', default: 'other' })
  profileKey!: AccessProfileKey;

  @ManyToOne(() => AccessProfileEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'profileKey', referencedColumnName: 'key' })
  profile!: AccessProfileEntity;

  @Column({ type: 'boolean', default: false })
  isOrganizer!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastLoginAt!: Date | null;

  @Column({ type: 'text', default: '' })
  lastLoginIp!: string;

  @OneToMany(() => SessionEntity, session => session.account)
  sessions!: SessionEntity[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
