import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import { SeatingService } from './seating.service';
import { Table, TableShape } from './seating.types';

@Controller('seating')
export class SeatingController {
  constructor(private readonly seatingService: SeatingService) {}

  @Get()
  findAll(): Promise<Table[]> {
    return this.seatingService.findAll();
  }

  @Post('tables')
  createTable(@Body() body: { name: string; seats: number; shape?: TableShape; x?: number; y?: number }): Promise<Table[]> {
    return this.seatingService.createTable(body);
  }

  @Patch('tables/:id')
  updateTable(@Param('id') id: string, @Body() body: Partial<Table>): Promise<Table[]> {
    return this.seatingService.updateTable(id, body);
  }

  @Delete('tables/:id')
  deleteTable(@Param('id') id: string): Promise<Table[]> {
    return this.seatingService.deleteTable(id);
  }

  @Put('assignments/:guestId')
  assignGuest(
    @Param('guestId') guestId: string,
    @Body() body: { tableId: string | null; seat?: number | null },
  ): Promise<Table[]> {
    return this.seatingService.assignGuest(guestId, body.tableId, body.seat);
  }

  @Delete('assignments/:guestId')
  unassignGuest(@Param('guestId') guestId: string): Promise<Table[]> {
    return this.seatingService.assignGuest(guestId, null);
  }
}
