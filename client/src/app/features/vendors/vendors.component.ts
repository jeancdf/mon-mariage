import { Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Vendor, VendorCategoryKey, VendorStatus } from '../../data/types';
import {
  VENDOR_CATEGORIES,
  VENDOR_STATUS_OPTIONS,
  VendorCategoryDef,
  defaultDetailsFor,
  emptyVendor,
  getVendorCategory,
  mergeDetails,
} from '../../data/vendor-categories';
import { VendorsApiService } from '../../data/vendors-api.service';
import { WeddingStore } from '../../data/store';
import { fmtCurrency, fmtShortDate } from '../../shared/wedding-utils';
import { IconComponent } from '../../shared/icon.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog.component';
import { ToastService } from '../../shared/toast.service';

type StatusFilter = 'all' | VendorStatus;
type ContactLinkKind = 'phone' | 'email' | 'website' | 'instagram';

interface UpcomingPayment {
  vendor: Vendor;
  amount: number;
}

@Component({
  selector: 'app-vendors',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, IconComponent, ConfirmDialogComponent],
  templateUrl: './vendors.component.html',
})
export class VendorsComponent {
  readonly store = inject(WeddingStore);
  private readonly api = inject(VendorsApiService);
  private readonly toast = inject(ToastService);

  readonly categories = VENDOR_CATEGORIES;
  readonly statusOptions = VENDOR_STATUS_OPTIONS;
  readonly fmtCurrency = fmtCurrency;
  readonly fmtShortDate = fmtShortDate;

  readonly search = signal('');
  readonly statusFilter = signal<StatusFilter>('all');
  readonly expanded = signal<Record<VendorCategoryKey, boolean>>(
    Object.fromEntries(VENDOR_CATEGORIES.map(c => [c.key, true])) as Record<VendorCategoryKey, boolean>,
  );

  readonly editing = signal<Vendor | null>(null);
  readonly addingFor = signal<VendorCategoryKey | null>(null);
  readonly vendorPendingDeletion = signal<Vendor | null>(null);

  readonly vendorsByCategory = computed(() => {
    const all = this.store.vendors();
    const query = this.search().trim().toLowerCase();
    const status = this.statusFilter();
    const filtered = all.filter(v => {
      if (status !== 'all' && v.status !== status) return false;
      if (!query) return true;
      return (
        v.name.toLowerCase().includes(query) ||
        v.contactName.toLowerCase().includes(query) ||
        v.notes.toLowerCase().includes(query) ||
        v.email.toLowerCase().includes(query)
      );
    });
    const map = new Map<VendorCategoryKey, Vendor[]>();
    for (const cat of VENDOR_CATEGORIES) map.set(cat.key, []);
    for (const v of filtered) map.get(v.category)?.push(v);
    return map;
  });

  readonly totals = computed(() => {
    const vendors = this.store.vendors();
    const reserved = vendors.filter(v =>
      v.status === 'reserve' || v.status === 'acompte-paye' || v.status === 'solde-paye'
    ).length;
    const totalSpent = vendors
      .filter(v => v.status !== 'ecarte')
      .reduce((sum, v) => sum + (v.priceFinal || v.priceEstimate || 0), 0);
    return { count: vendors.length, reserved, totalSpent };
  });

  readonly upcomingPayments = computed<UpcomingPayment[]>(() =>
    this.store.vendors()
      .filter(v => Boolean(v.balanceDueDate) && v.status !== 'solde-paye' && v.status !== 'ecarte')
      .map(v => ({ vendor: v, amount: this.balanceAmount(v) }))
      .filter(payment => payment.amount > 0)
      .sort((a, b) => a.vendor.balanceDueDate.localeCompare(b.vendor.balanceDueDate)),
  );

  vendorsFor(key: VendorCategoryKey): Vendor[] {
    return this.vendorsByCategory().get(key) ?? [];
  }

  isExpanded(key: VendorCategoryKey): boolean {
    return this.expanded()[key] !== false;
  }

  toggleCategory(key: VendorCategoryKey): void {
    this.expanded.update(s => ({ ...s, [key]: s[key] === false }));
  }

  statusLabel(status: VendorStatus): string {
    return this.statusOptions.find(o => o.value === status)?.label ?? status;
  }

  statusTone(status: VendorStatus): string {
    return this.statusOptions.find(o => o.value === status)?.tone ?? 'neutral';
  }

  startAdding(key: VendorCategoryKey): void {
    this.editing.set(emptyVendor(key));
    this.addingFor.set(key);
  }

  startEditing(vendor: Vendor): void {
    this.editing.set({
      ...vendor,
      details: mergeDetails(vendor.category, vendor.details),
    });
    this.addingFor.set(null);
  }

  cancelEdit(): void {
    this.editing.set(null);
    this.addingFor.set(null);
  }

  isEditing(vendor: Vendor): boolean {
    return this.editing()?.id === vendor.id && this.addingFor() === null;
  }

  isAddingFor(key: VendorCategoryKey): boolean {
    return this.addingFor() === key;
  }

  fieldsFor(key: VendorCategoryKey): VendorCategoryDef['fields'] {
    return getVendorCategory(key).fields;
  }

  updateField(key: string, value: string | number | boolean): void {
    const current = this.editing();
    if (!current) return;
    this.editing.set({ ...current, [key]: value });
  }

  updateDetail(key: string, value: string | number | boolean): void {
    const current = this.editing();
    if (!current) return;
    this.editing.set({ ...current, details: { ...current.details, [key]: value } });
  }

  detailValue(key: string): string | number | boolean {
    const current = this.editing();
    if (!current) return '';
    const value = current.details?.[key];
    return value === undefined || value === null ? '' : value;
  }

  detailString(key: string): string {
    const v = this.detailValue(key);
    return typeof v === 'string' ? v : String(v ?? '');
  }

  detailNumber(key: string): number {
    const v = this.detailValue(key);
    return typeof v === 'number' ? v : Number(v) || 0;
  }

  detailBool(key: string): boolean {
    const v = this.detailValue(key);
    return typeof v === 'boolean' ? v : Boolean(v);
  }

  async save(): Promise<void> {
    const vendor = this.editing();
    if (!vendor || !vendor.name.trim()) return;
    const payload: Vendor = {
      ...vendor,
      name: vendor.name.trim(),
      details: { ...defaultDetailsFor(vendor.category), ...vendor.details },
    };
    try {
      const list = this.addingFor()
        ? await this.api.createVendor(payload)
        : await this.api.updateVendor(payload);
      this.store.replaceVendors(list);
      this.cancelEdit();
    } catch {
      this.toast.error("Impossible d'enregistrer le prestataire.");
    }
  }

  requestDeleteVendor(vendor: Vendor): void {
    this.vendorPendingDeletion.set(vendor);
  }

  cancelDeleteVendor(): void {
    this.vendorPendingDeletion.set(null);
  }

  async confirmDeleteVendor(): Promise<void> {
    const vendor = this.vendorPendingDeletion();
    if (!vendor) return;
    this.vendorPendingDeletion.set(null);
    await this.deleteVendor(vendor);
  }

  private async deleteVendor(vendor: Vendor): Promise<void> {
    try {
      const list = await this.api.deleteVendor(vendor.id);
      this.store.replaceVendors(list);
      if (this.editing()?.id === vendor.id) this.cancelEdit();
    } catch {
      this.toast.error('Impossible de supprimer le prestataire.');
    }
  }

  async quickStatus(vendor: Vendor, status: VendorStatus): Promise<void> {
    if (vendor.status === status) return;
    try {
      const list = await this.api.updateVendor({ ...vendor, status });
      this.store.replaceVendors(list);
    } catch {
      this.toast.error('Impossible de mettre à jour le statut.');
    }
  }

  vendorPriceLabel(vendor: Vendor): string {
    const price = vendor.priceFinal || vendor.priceEstimate;
    if (!price) return '—';
    return fmtCurrency(price) + (vendor.priceFinal ? '' : ' (est.)');
  }

  contactHref(vendor: Vendor, kind: ContactLinkKind): string {
    if (kind === 'phone') return `tel:${vendor.phone}`;
    if (kind === 'email') return `mailto:${vendor.email}`;
    if (kind === 'instagram') return `https://instagram.com/${vendor.instagram.replace(/^@/, '')}`;
    return vendor.website.startsWith('http') ? vendor.website : `https://${vendor.website}`;
  }

  private balanceAmount(vendor: Vendor): number {
    const price = vendor.priceFinal || vendor.priceEstimate || 0;
    if (!vendor.depositPaid) return price;
    return Math.max(price - (vendor.depositAmount || 0), 0);
  }
}
