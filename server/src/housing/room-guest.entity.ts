import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { RoomEntity } from './room.entity';

@Entity({ name: 'room_guests' })
@Unique('UQ_room_guests_person_night', ['guestId', 'night'])
export class RoomGuestEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'text' })
  guestId!: string;

  // Null only for legacy placements, migrated to the wedding night at startup.
  @Column({ type: 'date', nullable: true })
  night!: string | null;

  @ManyToOne(() => RoomEntity, room => room.assignments, {
    onDelete: 'CASCADE',
  })
  room!: RoomEntity;

  @Column({ type: 'uuid' })
  roomId!: string;
}
