import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { RoomEntity } from './room.entity';

@Entity({ name: 'houses' })
export class HouseEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  name!: string;

  @OneToMany(() => RoomEntity, room => room.house, {
    cascade: true,
  })
  rooms!: RoomEntity[];
}
