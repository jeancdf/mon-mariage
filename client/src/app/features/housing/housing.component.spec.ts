import { TestBed } from '@angular/core/testing';
import { HousingComponent } from './housing.component';
import { HousingApiService, HousingCalendar } from '../../data/housing-api.service';
import { AuthService } from '../../auth/auth.service';
import { ToastService } from '../../shared/toast.service';

describe('Housing calendar', () => {
  const calendar: HousingCalendar = {
    weddingDate: '2027-07-16', startDate: '2027-07-09', endDate: '2027-07-18',
    nights: ['2027-07-14', '2027-07-15', '2027-07-16', '2027-07-17'],
    houses: [{ id: 'house', name: 'Maison', rooms: [
      { id: 'prep', name: 'Préparation', beds: 1, bedType: 'single', guestIds: [] },
      { id: 'wedding', name: 'Mariage', beds: 1, bedType: 'double', guestIds: [] },
    ] }],
    people: [{ id: 'guest', firstName: 'Camille', lastName: 'Martin', category: 'amis', rsvp: 'confirmed',
      parentGuestId: 'guest', isPlusOne: false, isKid: false, needsHousing: true,
      arrivalDate: '2027-07-15', departureDate: '2027-07-17' }],
    assignments: [
      { guestId: 'guest', roomId: 'prep', night: '2027-07-15' },
      { guestId: 'guest', roomId: 'wedding', night: '2027-07-16' },
    ],
  };
  let component: HousingComponent;
  let assignGuest: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    assignGuest = vi.fn().mockRejectedValue({ error: { message: 'Chambre complète.' } });
    TestBed.configureTestingModule({ providers: [
      { provide: HousingApiService, useValue: { loadCalendar: async () => structuredClone(calendar), assignGuest } },
      { provide: AuthService, useValue: { can: () => true } },
      { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
    ] });
    component = TestBed.runInInjectionContext(() => new HousingComponent());
    await Promise.resolve();
  });

  it('shows the wedding night by default and the actual room on each preparation night', () => {
    expect(component.selectedNight()).toBe('2027-07-16');
    expect(component.houses()[0].rooms[1].guestIds).toEqual(['guest']);
    component.selectNight('2027-07-15');
    expect(component.houses()[0].rooms[0].guestIds).toEqual(['guest']);
    expect(component.houses()[0].rooms[1].guestIds).toEqual([]);
    expect(component.roomForNight('guest', '2027-07-16')).toBe('Maison · Mariage');
  });

  it('does not count arrivals before their stay or on the checkout night as needing beds', () => {
    component.calendar.set({ ...calendar, assignments: [] });
    component.selectNight('2027-07-14');
    expect(component.requestedGuests()).toEqual([]);
    component.selectNight('2027-07-15');
    expect(component.requestedGuests()).toHaveLength(1);
    component.selectNight('2027-07-17');
    expect(component.requestedGuests()).toEqual([]);
    expect(component.roomForNight('guest', '2027-07-17')).toBe('Hors séjour');
  });

  it('retains the itinerary when a period reservation fails', async () => {
    component.selectPerson('guest');
    component.selectedRoomId = 'wedding';
    component.assignmentFrom = '2027-07-15';
    component.assignmentUntil = '2027-07-17';
    await component.assignSelection();
    expect(assignGuest).toHaveBeenCalledWith('guest', 'wedding', '2027-07-15', '2027-07-17');
    expect(component.calendar()?.assignments).toEqual(calendar.assignments);
    expect(component.assigning()).toBe(false);
  });

  it('removes only the displayed night with the room remove action', async () => {
    component.selectNight('2027-07-15');
    await component.unassignGuest('guest');
    expect(assignGuest).toHaveBeenCalledWith('guest', null, '2027-07-15', '2027-07-16');
  });

  it('opens a person on the displayed night with their current room preselected', () => {
    component.selectPerson('guest');
    expect(component.selectedPerson()?.firstName).toBe('Camille');
    expect(component.selectedRoomId).toBe('wedding');
    expect(component.assignmentFrom).toBe('2027-07-16');
    expect(component.assignmentUntil).toBe('2027-07-17');
    component.closePerson();
    expect(component.selectedPerson()).toBeUndefined();
  });

  it('steps between nights and stops at the ends of the calendar', () => {
    expect(component.previousNight()).toBe('2027-07-15');
    expect(component.nextNight()).toBe('2027-07-17');
    component.selectNight('2027-07-14');
    expect(component.previousNight()).toBeUndefined();
    component.selectNight('2027-07-17');
    expect(component.nextNight()).toBeUndefined();
  });

  it('lists everyone without a bed by default', () => {
    component.calendar.set({ ...calendar, assignments: [] });
    component.selectNight('2027-07-15');
    expect(component.housingFilter()).toBe('all');
    expect(component.unassignedGuests().map(guest => guest.id)).toEqual(['guest']);
  });
});
