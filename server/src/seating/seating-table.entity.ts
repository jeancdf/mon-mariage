import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TableGuestEntity } from './table-guest.entity';

@Entity({ name: 'seating_tables' })
export class SeatingTableEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'int', default: 12 })
  seats!: number;

  @OneToMany(() => TableGuestEntity, assignment => assignment.table, {
    cascade: true,
  })
  assignments!: TableGuestEntity[];
}
