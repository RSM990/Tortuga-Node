// src/controllers/studios.ts
import type { Request, Response } from 'express';
import mongoose from 'mongoose';
import Studio, { StudioDoc } from '../models/Studio.js';

// These are optional; we try/catch dynamic imports so you can add them later
// without breaking compile/runtime if they aren't there yet.
async function loadOptional<T = any>(path: string): Promise<T | null> {
  try {
    const mod = await import(path);
    return (mod as any)?.default ?? mod;
  } catch {
    return null;
  }
}

const isObjectId = (v: unknown) => {
  try {
    return !!v && mongoose.Types.ObjectId.isValid(String(v));
  } catch {
    return false;
  }
};

async function findStudioByIdOrSlug(idOrSlug: string) {
  // Your current Studio schema does NOT have a slug, so we resolve by _id only.
  if (isObjectId(idOrSlug)) {
    const s = await Studio.findById(idOrSlug).lean<StudioDoc>();
    if (s) return s;
  }
  // If/when you add slug: uncomment this
  // return Studio.findOne({ slug: idOrSlug }).lean();
  return null;
}

/**
 * GET /api/studios/:idOrSlug
 * Returns basic studio info + owner (if exists) + budget snapshot.
 */
export async function getStudio(req: Request, res: Response) {
  try {
    const { idOrSlug } = req.params as { idOrSlug: string };
    const studio = await findStudioByIdOrSlug(idOrSlug);
    if (!studio) return res.status(404).json({ message: 'Studio not found' });

    const League = await loadOptional('../models/League.js');
    const StudioOwner = await loadOptional('../models/StudioOwner.js');
    const User = await loadOptional('../models/User.js');
    const StudioMovie = await loadOptional('../models/StudioMovie.js');

    let leagueName: string | undefined;
    let leagueSlug: string | undefined;

    if (League && studio.leagueId) {
      const league = await (League as any)
        .findById(studio.leagueId, { name: 1, slug: 1 })
        .lean();
      leagueName = league?.name;
      leagueSlug = league?.slug;
    }

    let owner: null | {
      _id: string;
      name?: string;
      displayName?: string;
      email?: string;
    } = null;
    if (StudioOwner) {
      const ownerMembership = await (StudioOwner as any)
        .findOne(
          { studioId: studio._id, roleInStudio: /owner/i },
          { userId: 1 }
        )
        .lean();
      if (ownerMembership?.userId && User) {
        const u = await (User as any)
          .findById(ownerMembership.userId, {
            _id: 1,
            name: 1,
            displayName: 1,
            email: 1,
          })
          .lean();
        if (u)
          owner = {
            _id: String(u._id),
            name: u.name,
            displayName: u.displayName,
            email: u.email,
          };
      }
    }

    let budgetUsed = 0;
    if (StudioMovie) {
      const agg = await (StudioMovie as any).aggregate([
        { $match: { studioId: studio._id } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$price', 0] } } } },
      ]);
      budgetUsed = agg?.[0]?.total ?? 0;
    }

    // 🔧 NEW: ensure timestamps exist and are strings (Zod expects string)
    const createdAtIso =
      (studio as any).createdAt instanceof Date
        ? (studio as any).createdAt.toISOString()
        : new Date((studio as any).createdAt ?? Date.now()).toISOString();

    const updatedAtIso =
      (studio as any).updatedAt instanceof Date
        ? (studio as any).updatedAt.toISOString()
        : new Date((studio as any).updatedAt ?? Date.now()).toISOString();

    res.json({
      // optional id mirror if your zod shape uses `id`
      id: String(studio._id),
      _id: studio._id,
      name: studio.name,
      leagueId: studio.leagueId ?? null,
      leagueName,
      leagueSlug,
      owner,
      budgetCap: (studio as any).budgetCap ?? null,
      budgetUsed,
      createdAt: createdAtIso, // ✅
      updatedAt: updatedAtIso, // ✅
    });
  } catch (err) {
    console.error('getStudio error', err);
    res.status(500).json({ message: 'Failed to load studio' });
  }
}

/**
 * GET /api/studios/:idOrSlug/movies
 * Returns minimal holdings list; safe defaults if model not present.
 */
export async function getStudioMovies(req: Request, res: Response) {
  try {
    const { idOrSlug } = req.params as { idOrSlug: string };
    const studio = await findStudioByIdOrSlug(idOrSlug);
    if (!studio) return res.status(404).json({ message: 'Studio not found' });

    const StudioMovie = await loadOptional('../models/StudioMovie.js');
    if (!StudioMovie) return res.json([]); // safe fallback

    const rows = await (StudioMovie as any)
      .find(
        { studioId: studio._id },
        {
          _id: 1,
          movieId: 1,
          title: 1,
          releaseDate: 1,
          price: 1,
          gross: 1,
          awardNoms: 1,
          awardWins: 1,
        }
      )
      .lean();

    const safe = rows.map((r: any) => ({
      _id: r._id,
      movieId: r.movieId ?? r._id,
      title: r.title ?? 'Untitled',
      releaseDate: r.releaseDate ?? null,
      price: typeof r.price === 'number' ? r.price : 0,
      gross: typeof r.gross === 'number' ? r.gross : 0,
      awardNoms: r.awardNoms ?? 0,
      awardWins: r.awardWins ?? 0,
      createdAt:
        r.createdAt instanceof Date ? r.createdAt.toISOString() : undefined,
      updatedAt:
        r.updatedAt instanceof Date ? r.updatedAt.toISOString() : undefined,
    }));

    res.json(safe);
  } catch (err) {
    console.error('getStudioMovies error', err);
    res.status(500).json({ message: 'Failed to load studio movies' });
  }
}

/**
 * GET /api/studios/:idOrSlug/awards
 * Returns aggregate awards data; safe zeros until ETL fills it.
 */
export async function getStudioAwards(req: Request, res: Response) {
  try {
    const { idOrSlug } = req.params as { idOrSlug: string };
    const studio = await findStudioByIdOrSlug(idOrSlug);
    if (!studio) return res.status(404).json({ message: 'Studio not found' });

    // Until your Python ETL populates awards, return 0s
    // (If you have MovieAward + holdings, you can aggregate here later.)
    res.json({ season: null, nominations: 0, wins: 0 });
  } catch (err) {
    console.error('getStudioAwards error', err);
    res.status(500).json({ message: 'Failed to load studio awards' });
  }
}
