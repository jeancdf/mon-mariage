import { Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { BedType } from '../planner/planner-state.entity';
import { HouseEntity } from './house.entity';
import { RoomGuestEntity } from './room-guest.entity';

@Entity({ name: 'rooms' })
export class RoomEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @Column({ type: 'text', default: 'double' })
  bedType!: BedType;

  @Column({ type: 'int', default: 1 })
  beds!: number;

  @ManyToOne(() => HouseEntity, house => house.rooms, {
    onDelete: 'CASCADE',
  })
  house!: HouseEntity;

  @Column({ type: 'uuid' })
  houseId!: string;

  @OneToMany(() => RoomGuestEntity, assignment => assignment.room, {
    cascade: true,
  })
  assignments!: RoomGuestEntity[];
}
