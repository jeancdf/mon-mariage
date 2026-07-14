export type TableShape = 'round' | 'rect';

export interface TableAssignment {
  guestId: string;
  seat: number;
}

export interface Table {
  id: string;
  name: string;
  seats: number;
  shape: TableShape;
  x: number;
  y: number;
  rotation: number;
  assignments: TableAssignment[];
}

export const FLOOR_WIDTH = 1400;
export const FLOOR_HEIGHT = 900;
