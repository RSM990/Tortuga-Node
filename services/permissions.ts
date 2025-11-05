// src/services/permissions.ts
import League, { LeagueDoc } from '../models/League.js';
import StudioOwner from '../models/StudioOwner.js';

export async function canManageLeague(leagueId: string, userId: string) {
  const league = await League.findById(leagueId).lean<LeagueDoc>();
  if (!league) return { ok: false, code: 404 as const };
  const isOwner = String(league.ownerId) === String(userId);
  const isComm =
    Array.isArray(league.commissionerIds) &&
    league.commissionerIds.some((id: any) => String(id) === String(userId));
  return { ok: isOwner || isComm, code: 200 as const };
}

export async function isStudioMember(studioId: string, userId: string) {
  const membership = await StudioOwner.findOne({ studioId, userId }).lean();
  return !!membership;
}
