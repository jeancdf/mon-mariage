import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { TableGuestEntity } from './table-guest.entity';
import { TableShape } from './seating.types';

@Entity({ name: 'seating_tables' })
export class SeatingTableEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'int', default: 10 })
  seats!: number;

  @Column({ type: 'text', default: 'rect' })
  shape!: TableShape;

  @Column({ type: 'double precision', nullable: true })
  x!: number | null;

  @Column({ type: 'double precision', nullable: true })
  y!: number | null;

  @Column({ type: 'int', default: 0 })
  rotation!: number;

  @OneToMany(() => TableGuestEntity, assignment => assignment.table, {
    cascade: true,
  })
  assignments!: TableGuestEntity[];
}
