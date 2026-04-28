import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { BedType, House, Room } from '../planner/planner-state.entity';
import { HousingService } from './housing.service';

@Controller('housing')
export class HousingController {
  constructor(private readonly housingService: HousingService) {}

  @Get()
  findAll(): Promise<House[]> {
    return this.housingService.findAll();
  }

  @Post('houses')
  createHouse(@Body() body: { name: string }): Promise<House[]> {
    return this.housingService.createHouse(body);
  }

  @Patch('houses/:id')
  updateHouse(@Param('id') id: string, @Body() body: { name?: string }): Promise<House[]> {
    return this.housingService.updateHouse(id, body);
  }

  @Delete('houses/:id')
  deleteHouse(@Param('id') id: string): Promise<House[]> {
    return this.housingService.deleteHouse(id);
  }

  @Post('houses/:houseId/rooms')
  createRoom(
    @Param('houseId') houseId: string,
    @Body() body: { name: string; bedType: BedType; beds: number },
  ): Promise<House[]> {
    return this.housingService.createRoom(houseId, body);
  }

  @Patch('rooms/:roomId')
  updateRoom(@Param('roomId') roomId: string, @Body() body: Partial<Room>): Promise<House[]> {
    return this.housingService.updateRoom(roomId, body);
  }

  @Delete('rooms/:roomId')
  deleteRoom(@Param('roomId') roomId: string): Promise<House[]> {
    return this.housingService.deleteRoom(roomId);
  }

  @Put('assignments/:guestId')
  assignGuest(@Param('guestId') guestId: string, @Body() body: { roomId: string | null }): Promise<House[]> {
    return this.housingService.assignGuest(guestId, body.roomId);
  }

  @Delete('assignments/:guestId')
  unassignGuest(@Param('guestId') guestId: string): Promise<House[]> {
    return this.housingService.assignGuest(guestId, null);
  }
}
