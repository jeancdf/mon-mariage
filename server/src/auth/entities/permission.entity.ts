import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import type { AccessProfileKey, SectionKey } from '../auth.types';
import { AccessProfileEntity } from './access-profile.entity';

@Entity({ name: 'access_permissions' })
@Unique(['profileKey', 'section'])
export class PermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  profileKey!: AccessProfileKey;

  @ManyToOne(() => AccessProfileEntity, profile => profile.permissions, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'profileKey', referencedColumnName: 'key' })
  profile!: AccessProfileEntity;

  @Column({ type: 'text' })
  section!: SectionKey;

  @Column({ type: 'boolean', default: false })
  canView!: boolean;

  @Column({ type: 'boolean', default: false })
  canEdit!: boolean;
}
