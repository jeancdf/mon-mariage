import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { VendorCategoryKey, VendorDetails, VendorStatus } from '../planner/planner-state.entity';

@Entity({ name: 'vendors' })
@Index(['category'])
export class VendorEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  category!: VendorCategoryKey;

  @Column({ type: 'text', default: '' })
  name!: string;

  @Column({ type: 'text', default: '' })
  contactName!: string;

  @Column({ type: 'text', default: '' })
  phone!: string;

  @Column({ type: 'text', default: '' })
  email!: string;

  @Column({ type: 'text', default: '' })
  website!: string;

  @Column({ type: 'text', default: '' })
  instagram!: string;

  @Column({ type: 'text', default: '' })
  address!: string;

  @Column({ type: 'numeric', default: 0 })
  priceEstimate!: number;

  @Column({ type: 'numeric', default: 0 })
  priceFinal!: number;

  @Column({ type: 'numeric', default: 0 })
  depositAmount!: number;

  @Column({ type: 'boolean', default: false })
  depositPaid!: boolean;

  @Column({ type: 'text', default: '' })
  balanceDueDate!: string;

  @Column({ type: 'text', default: 'a-contacter' })
  status!: VendorStatus;

  @Column({ type: 'text', default: '' })
  meetingDate!: string;

  @Column({ type: 'boolean', default: false })
  contractSigned!: boolean;

  @Column({ type: 'text', default: '' })
  contractUrl!: string;

  @Column({ type: 'int', default: 0 })
  rating!: number;

  @Column({ type: 'text', default: '' })
  notes!: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  details!: VendorDetails;
}
