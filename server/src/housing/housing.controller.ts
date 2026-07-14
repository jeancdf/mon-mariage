import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { BedType, House, Room } from '../planner/planner-state.entity';
import { HousingService } from './housing.service';
import { RequirePermission } from '../auth/auth.decorators';

@Controller('housing')
@RequirePermission('housing')
export class HousingController {
  constructor(private readonly housingService: HousingService) {}

  @Get()
  findAll(): Promise<House[]> {
    return this.housingService.findAll();
  }

  @Post('houses')
  @RequirePermission('housing', 'edit')
  createHouse(@Body() body: { name: string }): Promise<House[]> {
    return this.housingService.createHouse(body);
  }

  @Patch('houses/:id')
  @RequirePermission('housing', 'edit')
  updateHouse(@Param('id') id: string, @Body() body: { name?: string }): Promise<House[]> {
    return this.housingService.updateHouse(id, body);
  }

  @Delete('houses/:id')
  @RequirePermission('housing', 'edit')
  deleteHouse(@Param('id') id: string): Promise<House[]> {
    return this.housingService.deleteHouse(id);
  }

  @Post('houses/:houseId/rooms')
  @RequirePermission('housing', 'edit')
  createRoom(
    @Param('houseId') houseId: string,
    @Body() body: { name: string; bedType: BedType; beds: number },
  ): Promise<House[]> {
    return this.housingService.createRoom(houseId, body);
  }

  @Patch('rooms/:roomId')
  @RequirePermission('housing', 'edit')
  updateRoom(@Param('roomId') roomId: string, @Body() body: Partial<Room>): Promise<House[]> {
    return this.housingService.updateRoom(roomId, body);
  }

  @Delete('rooms/:roomId')
  @RequirePermission('housing', 'edit')
  deleteRoom(@Param('roomId') roomId: string): Promise<House[]> {
    return this.housingService.deleteRoom(roomId);
  }

  @Put('assignments/:guestId')
  @RequirePermission('housing', 'edit')
  assignGuest(@Param('guestId') guestId: string, @Body() body: { roomId: string | null }): Promise<House[]> {
    return this.housingService.assignGuest(guestId, body.roomId);
  }

  @Delete('assignments/:guestId')
  @RequirePermission('housing', 'edit')
  unassignGuest(@Param('guestId') guestId: string): Promise<House[]> {
    return this.housingService.assignGuest(guestId, null);
  }
}
