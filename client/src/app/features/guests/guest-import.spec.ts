import { exportGuestRows, importPayload, parseGuestRows, previewGuestImport } from './guest-import';
import { allGuestPeople, emptyGuest } from '../../shared/wedding-utils';
import { createDemoDataset } from '../../demo/demo-data';

const family = () => ({ ...emptyGuest(), id: 'household', firstName: 'Marie Claire', lastName: 'Du Pont',
  email: 'marie@example.fr', organizationRole: 'sibling' as const, hasPlusOne: true, plusOneName: '',
  rsvp: 'confirmed' as const, plusOneRsvp: 'declined' as const, needsHousing: true,
  kids: [{ id: 'child', name: 'Léa', age: 0, rsvp: 'pending' as const }], events: [], notes: 'Une note',
});

describe('Guest workbook', () => {
  it('preserves every effective RSVP when exporting and importing legacy families', () => {
    const guests = createDemoDataset().guests;
    const exported = exportGuestRows(guests);
    const parsed = parseGuestRows([Object.keys(exported[0]), ...exported.map(Object.values)]).guests;
    const imported = previewGuestImport(parsed, guests).map(row => ({ ...guests.find(g => g.id === row.targetId)!, ...importPayload(row, guests) }));
    expect(allGuestPeople(imported)).toEqual(allGuestPeople(guests));
  });
  it('round trips stable IDs, compound names, unnamed +1, age zero and individual RSVP', () => {
    const guest = family();
    const exported = exportGuestRows([guest])[0];
    const parsed = parseGuestRows([Object.keys(exported), Object.values(exported)]).guests;
    const preview = previewGuestImport(parsed, [guest]);
    expect(preview[0].targetId).toBe(guest.id);
    expect(importPayload(preview[0], [guest])).toMatchObject({
      id: guest.id, firstName: 'Marie Claire', lastName: 'Du Pont', kids: guest.kids,
      hasPlusOne: true, plusOneName: '', plusOneRsvp: 'declined', needsHousing: true, events: [], organizationRole: 'sibling',
    });
    expect('inviteToken' in exported).toBe(false);
  });

  it('does not clear absent columns and asks to resolve same-name households', () => {
    const guest = family();
    const rows = parseGuestRows([['Prénom', 'Nom'], ['Marie Claire', 'Du Pont']]).guests;
    const preview = previewGuestImport(rows, [guest]);
    expect(preview[0].targetId).toBe('unresolved');
    preview[0].targetId = guest.id;
    expect(importPayload(preview[0], [guest])).toEqual({ id: 'household', firstName: 'Marie Claire', lastName: 'Du Pont' });
  });

  it('preserves child identity and RSVP for legacy columns matched to a household', () => {
    const guest = family();
    const rows = parseGuestRows([['Prénom', 'Nom', 'Enfants'], ['Marie Claire', 'Du Pont', 'Léa (0 ans)']]).guests;
    expect(importPayload({ guest: rows[0], targetId: guest.id }, [guest]).kids).toEqual([{ ...guest.kids[0], age: '0' }]);
  });

  it('does not silently pick one household when an email is ambiguous', () => {
    const a = family();
    const { id: _id, ...row } = a;
    expect(previewGuestImport([row], [a, { ...a, id: 'other' }])[0].targetId).toBe('unresolved');
  });

  it('rejects malformed child JSON with sheet and row location', () => {
    expect(() => parseGuestRows([['Prénom', 'Enfants JSON'], ['Jean', '{bad}']], 'Famille')).toThrow(/Famille, ligne 2/);
  });
});
