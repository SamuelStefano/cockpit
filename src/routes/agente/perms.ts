import type { BotPermissions } from '../../../shared/protocol';
import { ALL_PERMISSIONS, permissionsFromProfile, profileFromPermissions, toolsDeniedBy } from '../../../shared/bot-access';

export type Perms = BotPermissions;
export const ALL_PERMS = ALL_PERMISSIONS;
export const permsFromProfile = permissionsFromProfile;
export const profileFromPerms = profileFromPermissions;
export const disallowedTools = toolsDeniedBy;
