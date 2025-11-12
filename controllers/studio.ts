// backend/src/controllers/studio.ts
import type { Request, Response, NextFunction } from 'express';
import Studio from '../models/Studio.js';
import { paginatedResponse, parsePaginationParams } from '../utils/response.js';

/**
 * Create studio in league
 * POST /leagues/:leagueId/studios
 */
async function createStudio(req: Request, res: Response, next: NextFunction) {
  try {
    const { leagueId } = req.params;
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ message: 'Studio name is required' });
    }

    const studio = await Studio.create({
      leagueId,
      name,
      // Add any other fields from req.body as needed
    });

    return res.status(201).json(studio);
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * List studios in league (paginated)
 * GET /leagues/:leagueId/studios
 */
async function getStudios(req: Request, res: Response, next: NextFunction) {
  try {
    const { leagueId } = req.params;
    const { page, limit, skip } = parsePaginationParams(req.query);

    // Build query
    const query: Record<string, any> = { leagueId };

    // Optional: search by name
    if (req.query.name) {
      query.name = new RegExp(String(req.query.name), 'i');
    }

    // Sorting
    const sort = String(req.query.sort ?? '');
    let sortSpec: Record<string, 1 | -1> = { createdAt: -1, _id: -1 };
    if (sort === 'createdAt_asc') sortSpec = { createdAt: 1, _id: 1 };
    if (sort === 'createdAt_desc') sortSpec = { createdAt: -1, _id: -1 };
    if (sort === 'name_asc') sortSpec = { name: 1, _id: 1 };

    // Execute query
    const [items, total] = await Promise.all([
      Studio.find(query).sort(sortSpec).skip(skip).limit(limit).lean(),
      Studio.countDocuments(query),
    ]);

    // ✅ STANDARDIZED RESPONSE
    return res.json(paginatedResponse(items, page, limit, total));
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Get single studio
 * GET /leagues/:leagueId/studios/:studioId
 */
async function getStudio(req: Request, res: Response, next: NextFunction) {
  try {
    const { leagueId, studioId } = req.params;

    const studio = await Studio.findOne({
      _id: studioId,
      leagueId, // ✅ Verify studio belongs to this league
    }).lean();

    if (!studio) {
      return res.status(404).json({ message: 'Studio not found' });
    }

    return res.json(studio);
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Update studio
 * PATCH /leagues/:leagueId/studios/:studioId
 */
async function updateStudio(req: Request, res: Response, next: NextFunction) {
  try {
    const { leagueId, studioId } = req.params;
    const updates = req.body;

    // Don't allow changing leagueId
    delete updates.leagueId;
    delete updates._id;

    const studio = await Studio.findOneAndUpdate(
      {
        _id: studioId,
        leagueId, // ✅ Verify studio belongs to this league
      },
      updates,
      { new: true, runValidators: true }
    ).lean();

    if (!studio) {
      return res.status(404).json({ message: 'Studio not found' });
    }

    return res.json(studio);
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

/**
 * Delete studio
 * DELETE /leagues/:leagueId/studios/:studioId
 */
async function deleteStudio(req: Request, res: Response, next: NextFunction) {
  try {
    const { leagueId, studioId } = req.params;

    const result = await Studio.deleteOne({
      _id: studioId,
      leagueId, // ✅ Verify studio belongs to this league
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Studio not found' });
    }

    return res.status(204).send();
  } catch (err) {
    (err as any).statusCode ||= 500;
    next(err);
  }
}

const studioController = {
  createStudio,
  getStudios,
  getStudio,
  updateStudio,
  deleteStudio,
};

export default studioController;
