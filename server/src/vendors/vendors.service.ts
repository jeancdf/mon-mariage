import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Vendor } from '../planner/planner-state.entity';
import { VendorEntity } from './vendor.entity';

@Injectable()
export class VendorsService {
  constructor(
    @InjectRepository(VendorEntity)
    private readonly vendorsRepository: Repository<VendorEntity>,
  ) {}

  async findAll(): Promise<Vendor[]> {
    const vendors = await this.vendorsRepository.find({
      order: { category: 'ASC', name: 'ASC' },
    });
    return vendors.map(vendor => this.mapVendor(vendor));
  }

  async create(input: Partial<Vendor>): Promise<Vendor[]> {
    if (!input.category) throw new NotFoundException('Vendor category required');
    await this.vendorsRepository.save(this.vendorsRepository.create(this.normalize(input)));
    return this.findAll();
  }

  async update(id: string, input: Partial<Vendor>): Promise<Vendor[]> {
    const vendor = await this.vendorsRepository.findOne({ where: { id } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    Object.assign(vendor, this.normalize({ ...this.mapVendor(vendor), ...input }));
    await this.vendorsRepository.save(vendor);
    return this.findAll();
  }

  async delete(id: string): Promise<Vendor[]> {
    const result = await this.vendorsRepository.delete(id);
    if (!result.affected) throw new NotFoundException('Vendor not found');
    return this.findAll();
  }

  private normalize(input: Partial<Vendor>): Partial<VendorEntity> {
    return {
      ...(input.id ? { id: input.id } : {}),
      category: input.category!,
      name: String(input.name ?? '').trim(),
      contactName: String(input.contactName ?? '').trim(),
      phone: String(input.phone ?? '').trim(),
      email: String(input.email ?? '').trim(),
      website: String(input.website ?? '').trim(),
      instagram: String(input.instagram ?? '').trim(),
      address: String(input.address ?? '').trim(),
      priceEstimate: Number(input.priceEstimate) || 0,
      priceFinal: Number(input.priceFinal) || 0,
      depositAmount: Number(input.depositAmount) || 0,
      depositPaid: Boolean(input.depositPaid),
      balanceDueDate: String(input.balanceDueDate ?? ''),
      status: input.status ?? 'a-contacter',
      meetingDate: String(input.meetingDate ?? ''),
      contractSigned: Boolean(input.contractSigned),
      contractUrl: String(input.contractUrl ?? '').trim(),
      rating: Number(input.rating) || 0,
      notes: String(input.notes ?? ''),
      details: input.details ?? {},
    };
  }

  private mapVendor(vendor: VendorEntity): Vendor {
    return {
      id: vendor.id,
      category: vendor.category,
      name: vendor.name,
      contactName: vendor.contactName,
      phone: vendor.phone,
      email: vendor.email,
      website: vendor.website,
      instagram: vendor.instagram,
      address: vendor.address,
      priceEstimate: Number(vendor.priceEstimate) || 0,
      priceFinal: Number(vendor.priceFinal) || 0,
      depositAmount: Number(vendor.depositAmount) || 0,
      depositPaid: vendor.depositPaid,
      balanceDueDate: vendor.balanceDueDate,
      status: vendor.status,
      meetingDate: vendor.meetingDate,
      contractSigned: vendor.contractSigned,
      contractUrl: vendor.contractUrl,
      rating: Number(vendor.rating) || 0,
      notes: vendor.notes,
      details: vendor.details ?? {},
    };
  }
}
