import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { RoomEntity } from './room.entity';

@Entity({ name: 'room_guests' })
@Unique(['guestId'])
export class RoomGuestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  guestId!: string;

  @ManyToOne(() => RoomEntity, room => room.assignments, {
    onDelete: 'CASCADE',
  })
  room!: RoomEntity;

  @Column({ type: 'uuid' })
  roomId!: string;
}
