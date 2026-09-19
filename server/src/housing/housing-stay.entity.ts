import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'housing_stays' })
export class HousingStayEntity {
  @PrimaryColumn({ type: 'text' })
  guestId!: string;

  @Column({ type: 'date' })
  arrivalDate!: string;

  /** Checkout is exclusive: no bed is needed for the night of departure. */
  @Column({ type: 'date' })
  departureDate!: string;
}
