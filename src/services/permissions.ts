// src/services/permissions.ts
import LeagueModel, { ILeagueDocument } from '../models/League.js';
import StudioOwnerModel from '../models/StudioOwner.js';

export async function canManageLeague(leagueId: string, userId: string) {
  const league = await LeagueModel.findById(leagueId).lean<ILeagueDocument>();
  if (!league) return { ok: false, code: 404 as const };
  const isOwner = String(league.ownerId) === String(userId);
  const isComm =
    Array.isArray(league.commissionerIds) &&
    league.commissionerIds.some((id: any) => String(id) === String(userId));
  return { ok: isOwner || isComm, code: 200 as const };
}

export async function isStudioMember(studioId: string, userId: string) {
  const membership = await StudioOwnerModel.findOne({
    studioId,
    userId,
  }).lean();
  return !!membership;
}
