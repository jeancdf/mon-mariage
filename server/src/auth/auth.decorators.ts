import { SetMetadata } from '@nestjs/common';
import type { PermissionLevel, SectionKey } from './auth.types';

export const PUBLIC_ROUTE_KEY = 'publicRoute';
export const PERMISSION_KEY = 'requiredPermission';
export const ORGANIZER_ONLY_KEY = 'organizerOnly';

export const Public = () => SetMetadata(PUBLIC_ROUTE_KEY, true);
export const OrganizerOnly = () => SetMetadata(ORGANIZER_ONLY_KEY, true);
export const RequirePermission = (section: SectionKey, level: PermissionLevel = 'view') =>
  SetMetadata(PERMISSION_KEY, { section, level });
