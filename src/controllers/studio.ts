// src/controllers/studio.ts - REFACTORED WITH STANDARDIZED RESPONSES
import type { Request, Response, NextFunction } from 'express';
import logger from '../config/logger.js';
import Studio from '../models/Studio.js';
import StudioOwner from '../models/StudioOwner.js';
import League from '../models/League.js';
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
    logger.error('Error creating studio', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    });
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
    logger.error('Error fetching studios', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    });
    return sendErrorResponse(
      res,
      HttpStatus.INTERNAL_SERVER_ERROR,
      'Failed to fetch studios'
    );
  }
}

/**
 * Get single studio with populated owner and league data
 * GET /leagues/:leagueId/studios/:studioId
 */
async function getStudio(req: Request, res: Response) {
  try {
    const { leagueId, studioId } = req.params;

    // Fetch studio
    const studio = await Studio.findOne({
      _id: studioId,
      leagueId, // ✅ Verify studio belongs to this league
    }).lean();

    // ✅ NOT FOUND CHECK
    if (!studio) {
      return sendErrorResponse(res, HttpStatus.NOT_FOUND, 'Studio not found');
    }

    // Fetch league information
    const league = await League.findById(leagueId)
      .select('name slug')
      .lean();

    // Fetch studio owners with user information populated
    const studioOwners = await StudioOwner.find({
      studioId: studio._id,
    })
      .populate('userId', 'firstName lastName email')
      .lean();

    // Enhance studio with additional data
    // Filter out owners where user was deleted/not found
    const enhancedStudio = {
      ...studio,
      league: league || null,
      owners: studioOwners
        .filter((so: any) => so.userId != null)
        .map((so: any) => ({
          userId: so.userId._id,
          firstName: so.userId.firstName || '',
          lastName: so.userId.lastName || '',
          email: so.userId.email,
          roleInStudio: so.roleInStudio,
        })),
    };

    // ✅ SUCCESS RESPONSE
    return sendSuccessResponse(res, enhancedStudio);
  } catch (err) {
    logger.error('Error fetching studio', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    });
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
    logger.error('Error updating studio', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    });
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
    logger.error('Error deleting studio', {
      error: err instanceof Error ? err.message : 'Unknown error',
      stack: err instanceof Error ? err.stack : undefined,
    });
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
