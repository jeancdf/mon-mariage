import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Vendor } from '../planner/planner-state.entity';
import { VendorsService } from './vendors.service';

@Controller('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  findAll(): Promise<Vendor[]> {
    return this.vendorsService.findAll();
  }

  @Post()
  create(@Body() body: Partial<Vendor>): Promise<Vendor[]> {
    return this.vendorsService.create(body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Partial<Vendor>): Promise<Vendor[]> {
    return this.vendorsService.update(id, body);
  }

  @Delete(':id')
  delete(@Param('id') id: string): Promise<Vendor[]> {
    return this.vendorsService.delete(id);
  }
}
