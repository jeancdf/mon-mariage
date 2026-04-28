import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { SeatingTableEntity } from './seating-table.entity';

@Entity({ name: 'table_guests' })
@Unique(['guestId'])
export class TableGuestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  guestId!: string;

  @ManyToOne(() => SeatingTableEntity, table => table.assignments, {
    onDelete: 'CASCADE',
  })
  table!: SeatingTableEntity;

  @Column({ type: 'uuid' })
  tableId!: string;
}
