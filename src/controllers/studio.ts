// src/controllers/studio.ts - REFACTORED WITH STANDARDIZED RESPONSES
import type { Request, Response, NextFunction } from 'express';
import Studio from '../models/Studio.js';
import {
  HttpStatus,
  parsePaginationParams,
  sendPaginatedResponse,
  sendSuccessResponse,
  sendErrorResponse,
  successResponse,
} from '../utils/response.js';

/**
 * Create studio in league
 * POST /leagues/:leagueId/studios
 */
async function createStudio(req: Request, res: Response) {
  try {
    const { leagueId } = req.params;
    const { name } = req.body;

    // ✅ VALIDATION CHECK
    if (!name) {
      return sendErrorResponse(
        res,
        HttpStatus.BAD_REQUEST,
        'Studio name is required'
      );
    }

    const studio = await Studio.create({
      leagueId,
      name,
    });

    // ✅ CREATED RESPONSE (201)
    return res
      .status(HttpStatus.CREATED)
      .json(successResponse(studio, undefined, 'Studio created successfully'));
  } catch (err) {
    console.error('Error creating studio:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to create studio'
    );
  }
}

/**
 * List studios in league (paginated)
 * GET /leagues/:leagueId/studios
 */
async function getStudios(req: Request, res: Response) {
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

    // ✅ PAGINATED RESPONSE
    return sendPaginatedResponse(res, items, { page, limit, total });
  } catch (err) {
    console.error('Error fetching studios:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch studios'
    );
  }
}

/**
 * Get single studio
 * GET /leagues/:leagueId/studios/:studioId
 */
async function getStudio(req: Request, res: Response) {
  try {
    const { leagueId, studioId } = req.params;

    const studio = await Studio.findOne({
      _id: studioId,
      leagueId, // ✅ Verify studio belongs to this league
    }).lean();

    // ✅ NOT FOUND CHECK
    if (!studio) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Studio not found');
    }

    // ✅ SUCCESS RESPONSE
    return sendSuccessResponse(res, studio);
  } catch (err) {
    console.error('Error fetching studio:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch studio'
    );
  }
}

/**
 * Update studio
 * PATCH /leagues/:leagueId/studios/:studioId
 */
async function updateStudio(req: Request, res: Response) {
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

    // ✅ NOT FOUND CHECK
    if (!studio) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Studio not found');
    }

    // ✅ SUCCESS RESPONSE
    return sendSuccessResponse(res, studio, 'Studio updated successfully');
  } catch (err) {
    console.error('Error updating studio:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to update studio'
    );
  }
}

/**
 * Delete studio
 * DELETE /leagues/:leagueId/studios/:studioId
 */
async function deleteStudio(req: Request, res: Response) {
  try {
    const { leagueId, studioId } = req.params;

    const result = await Studio.deleteOne({
      _id: studioId,
      leagueId, // ✅ Verify studio belongs to this league
    });

    // ✅ NOT FOUND CHECK
    if (result.deletedCount === 0) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Studio not found');
    }

    // ✅ NO CONTENT RESPONSE (204)
    return res.status(HttpStatus.NO_CONTENT).send();
  } catch (err) {
    console.error('Error deleting studio:', err);
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to delete studio'
    );
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
