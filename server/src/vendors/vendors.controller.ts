import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Vendor } from '../planner/planner-state.entity';
import { VendorsService } from './vendors.service';
import { RequirePermission } from '../auth/auth.decorators';

@Controller('vendors')
@RequirePermission('vendors')
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  findAll(): Promise<Vendor[]> {
    return this.vendorsService.findAll();
  }

  @Post()
  @RequirePermission('vendors', 'edit')
  create(@Body() body: Partial<Vendor>): Promise<Vendor[]> {
    return this.vendorsService.create(body);
  }

  @Patch(':id')
  @RequirePermission('vendors', 'edit')
  update(@Param('id') id: string, @Body() body: Partial<Vendor>): Promise<Vendor[]> {
    return this.vendorsService.update(id, body);
  }

  @Delete(':id')
  @RequirePermission('vendors', 'edit')
  delete(@Param('id') id: string): Promise<Vendor[]> {
    return this.vendorsService.delete(id);
  }
}
