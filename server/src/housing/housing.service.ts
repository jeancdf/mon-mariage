import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BedType, House, Room } from '../planner/planner-state.entity';
import { HouseEntity } from './house.entity';
import { RoomGuestEntity } from './room-guest.entity';
import { RoomEntity } from './room.entity';

@Injectable()
export class HousingService {
  constructor(
    @InjectRepository(HouseEntity)
    private readonly housesRepository: Repository<HouseEntity>,
    @InjectRepository(RoomEntity)
    private readonly roomsRepository: Repository<RoomEntity>,
    @InjectRepository(RoomGuestEntity)
    private readonly assignmentsRepository: Repository<RoomGuestEntity>,
  ) {}

  async findAll(): Promise<House[]> {
    const houses = await this.housesRepository.find({
      relations: { rooms: { assignments: true } },
      order: { name: 'ASC', rooms: { name: 'ASC' } },
    });
    return houses.map(house => this.mapHouse(house));
  }

  async createHouse(input: { name: string }): Promise<House[]> {
    await this.housesRepository.save(this.housesRepository.create({
      name: String(input.name ?? '').trim(),
    }));
    return this.findAll();
  }

  async updateHouse(id: string, input: { name?: string }): Promise<House[]> {
    const house = await this.housesRepository.findOne({ where: { id } });
    if (!house) throw new NotFoundException('House not found');
    house.name = String(input.name ?? house.name).trim();
    await this.housesRepository.save(house);
    return this.findAll();
  }

  async deleteHouse(id: string): Promise<House[]> {
    const result = await this.housesRepository.delete(id);
    if (!result.affected) throw new NotFoundException('House not found');
    return this.findAll();
  }

  async createRoom(houseId: string, input: { name: string; bedType: BedType; beds: number }): Promise<House[]> {
    const house = await this.housesRepository.findOne({ where: { id: houseId } });
    if (!house) throw new NotFoundException('House not found');

    await this.roomsRepository.save(this.roomsRepository.create({
      houseId,
      name: String(input.name ?? '').trim(),
      bedType: input.bedType ?? 'double',
      beds: Number(input.beds) || 1,
    }));
    return this.findAll();
  }

  async updateRoom(roomId: string, input: Partial<Room>): Promise<House[]> {
    const room = await this.roomsRepository.findOne({ where: { id: roomId } });
    if (!room) throw new NotFoundException('Room not found');
    room.name = String(input.name ?? room.name).trim();
    room.bedType = input.bedType ?? room.bedType;
    room.beds = Number(input.beds ?? room.beds) || 1;
    await this.roomsRepository.save(room);
    return this.findAll();
  }

  async deleteRoom(roomId: string): Promise<House[]> {
    const result = await this.roomsRepository.delete(roomId);
    if (!result.affected) throw new NotFoundException('Room not found');
    return this.findAll();
  }

  async assignGuest(guestId: string, roomId: string | null): Promise<House[]> {
    await this.assignmentsRepository.delete({ guestId });
    if (roomId) {
      const room = await this.roomsRepository.findOne({ where: { id: roomId } });
      if (!room) throw new NotFoundException('Room not found');
      await this.assignmentsRepository.save(this.assignmentsRepository.create({ guestId, roomId }));
    }
    return this.findAll();
  }

  private mapHouse(house: HouseEntity): House {
    return {
      id: house.id,
      name: house.name,
      rooms: (house.rooms ?? []).map(room => ({
        id: room.id,
        name: room.name,
        bedType: room.bedType,
        beds: room.beds,
        guestIds: (room.assignments ?? []).map(assignment => assignment.guestId),
      })),
    };
  }
}
