import { Guest, GuestCategory, OrganizationRole, Rsvp, EventKey } from '../../data/types';
import { CATS, EVENT_LABELS, RSVP_LABELS, gid } from '../../data/seed';

export type GuestImportRow = Partial<Guest> & { firstName: string; lastName: string };
export interface GuestImportResult { guests: GuestImportRow[]; skippedRows: number; }
export interface ImportPreviewRow { guest: GuestImportRow; targetId: string; }
const normalize = (value: unknown): string => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const cell = (value: unknown): string => String(value ?? '').trim();
const nameKey = (guest: Pick<Guest, 'firstName' | 'lastName'>) => normalize(`${guest.firstName} ${guest.lastName}`);

export async function parseGuestWorkbook(file: File): Promise<GuestImportResult> {
  const xlsx = await import('xlsx');
  const workbook = xlsx.read(await file.arrayBuffer(), { type: 'array' });
  const result: GuestImportResult = { guests: [], skippedRows: 0 };
  for (const sheetName of workbook.SheetNames.slice(0, 2)) {
    const parsed = parseGuestRows(xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, blankrows: false }) as unknown[][], sheetName);
    result.guests.push(...parsed.guests);
    result.skippedRows += parsed.skippedRows;
  }
  return result;
}

export function parseGuestRows(rows: unknown[][], sheetName = 'Invités'): GuestImportResult {
  if (!rows.length) return { guests: [], skippedRows: 0 };
  const [headers, ...body] = rows;
  const column = (...names: string[]) => headers.findIndex(header => names.map(normalize).includes(normalize(header)));
  const first = column('Prénom', 'Prenom');
  const last = column('Nom');
  const combined = column('Prénom nom', 'Nom complet', 'Nom');
  if (first < 0 && combined < 0) throw new Error(`Feuille « ${sheetName} » : colonne Prénom ou Nom complet manquante.`);
  const guests: GuestImportRow[] = [];
  let skippedRows = 0;
  for (const [index, row] of body.entries()) {
    if (row.every(value => !cell(value))) continue;
    const fullName = cell(row[combined]).split(/\s+/);
    const guest: GuestImportRow = {
      firstName: first >= 0 ? cell(row[first]) : fullName[0],
      lastName: first >= 0 ? cell(row[last]) : fullName.slice(1).join(' '),
    };
    if (!guest.firstName || /^\d+$/.test(guest.firstName)) { skippedRows++; continue; }
    const read = (names: string[], apply: (value: string) => void) => {
      const col = column(...names);
      if (col >= 0) apply(cell(row[col]));
    };
    try {
      read(['Version format'], value => { if (value !== '2') throw new Error('Version du format non prise en charge.'); });
      read(['Identifiant foyer'], value => { if (value) guest.id = value; });
      read(['Adresse e-mail', 'Email', 'E-mail', 'Mail'], value => guest.email = value.toLowerCase());
      read(['Catégorie', 'Categorie'], value => {
        const category = (Object.keys(CATS) as GuestCategory[]).find(key => normalize(key) === normalize(value) || normalize(CATS[key].label) === normalize(value));
        if (!category && value) throw new Error(`Catégorie inconnue : ${value}`);
        if (category) guest.category = category;
      });
      read(['Rôle organisation', 'Organisation'], value => {
        const roles: Record<string, OrganizationRole> = { parent: 'parent', parents: 'parent', sibling: 'sibling', fratrie: 'sibling', witness: 'witness', temoin: 'witness', friend_cousin: 'friend_cousin', 'ami / cousin': 'friend_cousin', other: 'other', autre: 'other' };
        if (!roles[normalize(value)] && value) throw new Error(`Rôle inconnu : ${value}`);
        if (value) guest.organizationRole = roles[normalize(value)];
      });
      read(['RSVP'], value => guest.rsvp = parseRsvp(value));
      read(['+1 (nom)', 'Plus 1'], value => { guest.plusOneName = value; guest.hasPlusOne = Boolean(value); });
      read(['Accompagnateur autorisé'], value => guest.hasPlusOne = parseBoolean(value));
      read(['RSVP accompagnateur'], value => guest.plusOneRsvp = parseRsvp(value));
      if (column('Enfants JSON') >= 0) {
        read(['Enfants JSON'], value => {
          const kids: unknown = JSON.parse(value || '[]');
          if (!Array.isArray(kids)) throw new Error('Liste des enfants invalide.');
          guest.kids = kids.map(item => {
            if (!item || typeof item.name !== 'string' || !item.name.trim()) throw new Error('Prénom enfant manquant.');
            return { id: typeof item.id === 'string' && item.id ? item.id : gid(), name: item.name.trim(), age: item.age ?? '', ...(item.rsvp !== undefined ? { rsvp: parseRsvp(item.rsvp) } : {}) };
          });
        });
      } else {
        read(['Enfants'], value => guest.kids = value.split(',').map(part => part.trim()).filter(Boolean).map(part => {
          const match = part.match(/^(.*?)\s*\((\d+)\s*(?:ans?)?\)$/i);
          return { id: gid(), name: match?.[1]?.trim() || part, age: match?.[2] ?? '' };
        }));
      }
      read(['Régime', 'Restrictions alimentaires'], value => guest.dietary = value);
      read(['Événements'], value => {
        guest.events = value ? value.split(',').map(part => {
          const event = (Object.keys(EVENT_LABELS) as EventKey[]).find(key => normalize(key) === normalize(part) || normalize(EVENT_LABELS[key]) === normalize(part));
          if (!event) throw new Error(`Événement inconnu : ${part}`);
          return event;
        }) : [];
      });
      read(['Transport'], value => guest.transport = value);
      read(['Besoin de couchage'], value => guest.needsHousing = parseBoolean(value));
      read(['Notes'], value => guest.notes = value);
    } catch (error) {
      throw new Error(`${sheetName}, ligne ${index + 2} : ${error instanceof Error ? error.message : 'Données invalides.'}`);
    }
    guests.push(guest);
  }
  return { guests, skippedRows };
}

function parseRsvp(value: string): Rsvp {
  const key = (Object.keys(RSVP_LABELS) as Rsvp[]).find(key => normalize(key) === normalize(value) || normalize(RSVP_LABELS[key]) === normalize(value));
  if (!key && value) throw new Error(`RSVP inconnu : ${value}`);
  return key ?? 'pending';
}
function parseBoolean(value: string): boolean {
  if (['oui', 'true', '1'].includes(normalize(value))) return true;
  if (['non', 'false', '0', ''].includes(normalize(value))) return false;
  throw new Error(`Choix oui/non invalide : ${value}`);
}

export function previewGuestImport(rows: GuestImportRow[], existing: Guest[]): ImportPreviewRow[] {
  return rows.map(guest => {
    if (guest.id) return { guest, targetId: existing.some(item => item.id === guest.id) ? guest.id : 'unresolved' };
    const emails = guest.email ? existing.filter(item => normalize(item.email) === normalize(guest.email)) : [];
    if (emails.length === 1) return { guest, targetId: emails[0].id };
    const possibleDuplicate = existing.some(item => nameKey(item) === nameKey(guest))
      || rows.some(other => other !== guest && nameKey(other) === nameKey(guest));
    return { guest, targetId: emails.length > 1 || possibleDuplicate ? 'unresolved' : 'new' };
  });
}

export function importPayload(row: ImportPreviewRow, existing: Guest[]): Partial<Guest> {
  const { id: _id, ...patch } = row.guest;
  if (row.targetId === 'new') return patch;
  const target = existing.find(guest => guest.id === row.targetId);
  if (!target) throw new Error('Choisissez le foyer à mettre à jour.');
  // Preserve child IDs in legacy spreadsheets when an unambiguous name matches.
  const kids = patch.kids?.map(kid => {
    const byId = target.kids.find(item => item.id === kid.id);
    const sameName = target.kids.filter(item => normalize(item.name) === normalize(kid.name));
    const previous = byId ?? (sameName.length === 1 ? sameName[0] : undefined);
    return previous ? { ...previous, ...kid, id: previous.id, rsvp: kid.rsvp ?? previous.rsvp } : kid;
  });
  return { ...patch, ...(kids ? { kids } : {}), id: target.id };
}

export function exportGuestRows(guests: Guest[]): Record<string, string>[] {
  return guests.map(guest => ({
    'Version format': '2', 'Identifiant foyer': guest.id,
    Prénom: guest.firstName, Nom: guest.lastName, 'Adresse e-mail': guest.email,
    'Rôle organisation': guest.organizationRole, Catégorie: CATS[guest.category].label,
    RSVP: guest.rsvp, 'Accompagnateur autorisé': guest.hasPlusOne ? 'Oui' : 'Non',
    '+1 (nom)': guest.plusOneName, 'RSVP accompagnateur': guest.plusOneRsvp ?? guest.rsvp,
    Enfants: guest.kids.map(kid => `${kid.name}${kid.age !== '' ? ` (${kid.age} ans)` : ''}`).join(', '),
    'Enfants JSON': JSON.stringify(guest.kids.map(kid => ({ ...kid, rsvp: kid.rsvp ?? guest.rsvp }))), Régime: guest.dietary,
    Événements: guest.events.map(event => EVENT_LABELS[event]).join(', '),
    Transport: guest.transport, 'Besoin de couchage': guest.needsHousing ? 'Oui' : 'Non', Notes: guest.notes,
  }));
}
