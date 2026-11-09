import { SetMetadata } from '@nestjs/common';

import type { Role } from '../../generated/prisma/client.js';

export const ROLES_KEY = 'roles';

/**
 * Uca erişebilecek EN DÜŞÜK rol. Hiyerarşi: CUSTOMER < ADMIN < SUPER_ADMIN.
 * @Roles('ADMIN') → ADMIN ve SUPER_ADMIN erişir.
 */
export const Roles = (minimum: Role) => SetMetadata(ROLES_KEY, minimum);
