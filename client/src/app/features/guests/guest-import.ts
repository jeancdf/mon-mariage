import { Guest, GuestCategory } from '../../data/types';
import { gid } from '../../data/seed';

export interface GuestImportResult {
  guests: Guest[];
  skippedRows: number;
}

interface ExcelParser {
  utils: {
    sheet_to_json: (
      sheet: unknown,
      options: { header: 1; blankrows: false },
    ) => unknown[][];
  };
  read: (data: ArrayBuffer, options: { type: 'array' }) => {
    SheetNames: string[];
    Sheets: Record<string, unknown>;
  };
}

const DEFAULT_EVENTS = ['ceremony', 'dinner'] as const;

export const parseGuestWorkbook = async (
  file: File,
): Promise<GuestImportResult> => {
  const xlsx = (await import('xlsx')) as ExcelParser;
  const data = await file.arrayBuffer();
  const workbook = xlsx.read(data, { type: 'array' });
  const firstTwoSheets = workbook.SheetNames.slice(0, 2);
  const importedGuests: Guest[] = [];
  let skippedRows = 0;

  for (const sheetName of firstTwoSheets) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = xlsx.utils.sheet_to_json(sheet, {
      header: 1,
      blankrows: false,
    });
    const guestsFromSheet = parseSheetRows(rows, sheetName);
    importedGuests.push(...guestsFromSheet.guests);
    skippedRows += guestsFromSheet.skippedRows;
  }

  return {
    guests: importedGuests,
    skippedRows,
  };
};

const parseSheetRows = (
  rows: unknown[][],
  sheetName: string,
): GuestImportResult => {
  if (!rows.length) {
    return { guests: [], skippedRows: 0 };
  }

  const [header, ...bodyRows] = rows;
  const nameCol = findColumnIndex(header, [
    'prénom nom',
    'prenom nom',
    'nom',
  ]);
  const plusOneCol = findColumnIndex(header, ['plus 1']);
  const linkCol = findColumnIndex(header, ['liens', 'invite par', 'invité par']);
  const categoryCol = findColumnIndex(header, ['catégorie', 'categorie']);
  const ownerCategory = getOwnerCategory(sheetName);

  if (nameCol < 0) {
    return { guests: [], skippedRows: bodyRows.length };
  }

  const guests: Guest[] = [];
  let skippedRows = 0;

  for (const row of bodyRows) {
    const fullName = getCellText(row[nameCol]);
    if (!isValidGuestName(fullName)) {
      skippedRows += 1;
      continue;
    }

    const plusOneName = getCellText(row[plusOneCol]);
    const relation = getCellText(row[linkCol]);
    const explicitCategory = getCellText(row[categoryCol]);
    const category = mapToGuestCategory(
      explicitCategory || relation,
      ownerCategory,
    );
    const name = splitName(fullName);

    guests.push({
      id: gid(),
      firstName: name.firstName,
      lastName: name.lastName,
      category,
      rsvp: 'pending',
      hasPlusOne: Boolean(plusOneName),
      plusOneName,
      kids: [],
      dietary: '',
      events: [...DEFAULT_EVENTS],
      transport: '',
      notes: `Importé depuis ${sheetName}`,
    });
  }

  return { guests, skippedRows };
};

const findColumnIndex = (header: unknown[], names: string[]): number => {
  const normalizedHeader = header.map(cell =>
    normalize(getCellText(cell)),
  );
  for (const name of names) {
    const expected = normalize(name);
    const exactMatchIndex = normalizedHeader.findIndex(column =>
      column === expected,
    );
    if (exactMatchIndex >= 0) {
      return exactMatchIndex;
    }
  }

  for (const name of names) {
    const expected = normalize(name);
    const looseMatchIndex = normalizedHeader.findIndex(column =>
      column.includes(expected),
    );
    if (looseMatchIndex >= 0) {
      return looseMatchIndex;
    }
  }

  return -1;
};

const getOwnerCategory = (sheetName: string): GuestCategory => {
  const normalizedSheet = normalize(sheetName);
  return normalizedSheet.includes('alice') ? 'famille-elle' : 'famille-moi';
};

const mapToGuestCategory = (
  source: string,
  fallback: GuestCategory,
): GuestCategory => {
  const normalized = normalize(source);

  if (!normalized) return fallback;
  if (normalized.includes('temoin')) return 'temoins';
  if (normalized.includes('enfant')) return 'enfants';
  if (normalized.includes('pote')) return 'amis';
  if (normalized.includes('ami')) return 'amis';
  if (normalized.includes('famille')) return fallback;
  if (normalized.includes('cousin')) return fallback;
  if (normalized.includes('oncle')) return fallback;
  if (normalized.includes('tante')) return fallback;
  return fallback;
};

const splitName = (raw: string): { firstName: string; lastName: string } => {
  const cleaned = raw.trim().replace(/\s+/g, ' ');
  const parts = cleaned.split(' ');

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
};

const isValidGuestName = (value: string): boolean => {
  const normalized = normalize(value);
  if (!normalized) return false;
  if (/^\d+$/.test(normalized)) return false;
  if (normalized.includes('label')) return false;
  if (normalized.includes('nombre d')) return false;
  if (normalized.includes('pourcentage')) return false;
  return true;
};

const getCellText = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const normalize = (value: string): string =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
