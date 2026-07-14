import { Column, Entity, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import type { AccessProfileKey } from '../auth.types';
import { PermissionEntity } from './permission.entity';

@Entity({ name: 'access_profiles' })
export class AccessProfileEntity {
  @PrimaryColumn({ type: 'text' })
  key!: AccessProfileKey;

  @Column({ type: 'text' })
  name!: string;

  @OneToMany(() => PermissionEntity, permission => permission.profile)
  permissions!: PermissionEntity[];

  @UpdateDateColumn()
  updatedAt!: Date;
}

