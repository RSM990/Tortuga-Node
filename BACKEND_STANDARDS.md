# Tortuga Backend - Coding Standards
## Last Updated: November 19, 2025
## Status: Backend 100% Pristine, Production Deployed

---

## 📋 **Purpose**

This document defines the established standards for the Tortuga backend codebase. All code must follow these patterns to maintain consistency and quality.

**Core Principle:** Pristine code over rapid development. Quality and consistency are non-negotiable.

---

## 🏗️ **Architecture Overview**

### Tech Stack
- **Runtime:** Node.js 18+
- **Framework:** Express.js
- **Language:** TypeScript (strict mode)
- **Database:** MongoDB with Mongoose
- **Logging:** Winston
- **Validation:** express-validator
- **Auth:** JWT with HTTP-only cookies
- **Deployment:** AWS EC2 with PM2 process manager
- **Secrets:** AWS Systems Manager Parameter Store

### Project Structure
```
src/
├── models/              # Mongoose models
├── controllers/         # Request handlers
├── routes/             # Route definitions
├── middleware/         # Custom middleware
├── services/           # Business logic
├── utils/              # Utility functions
├── validators/         # Request validation
├── config/             # Configuration (logger, etc.)
├── types/              # TypeScript definitions
├── db.ts               # Database connection
├── app.ts              # Express app setup
└── server.ts           # Server entry point
```

---

## 🚀 **Deployment Configuration**

### Environment Variables Management

**Production secrets are stored in AWS Systems Manager Parameter Store:**

```bash
# Parameter Store keys:
/tortuga/prod/SESSION_SECRET  # JWT signing secret
/tortuga/prod/MONGO_URI       # MongoDB connection string
/tortuga/prod/NODE_ENV        # Environment (production)
/tortuga/prod/PORT            # Server port
```

**Non-sensitive config in ecosystem.config.js:**
```javascript
export default {
  apps: [
    {
      name: 'tortuga-app',
      script: 'dist/server.js',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        LOG_LEVEL: 'info',  // ← Non-sensitive config here
      },
    },
  ],
};
```

**Why this split?**
- ✅ Secrets in Parameter Store (secure, audited, encrypted)
- ✅ Non-sensitive config in ecosystem.config.js (version controlled, easy to update)

### Secrets Loading Script

**scripts/load_secrets.sh** loads secrets from Parameter Store at deployment:

```bash
#!/bin/bash
set -e

# 1. Get the parameters from AWS SSM
PARAMS=$(aws ssm get-parameters \
  --names "/tortuga/prod/SESSION_SECRET" "/tortuga/prod/MONGO_URI" "/tortuga/prod/NODE_ENV" "/tortuga/prod/PORT" \
  --with-decryption \
  --query "Parameters[*].{Name:Name,Value:Value}" \
  --output json)

# 2. Parse and export to environment
export NODE_ENV=$(echo "$PARAMS" | jq -r '.[] | select(.Name=="/tortuga/prod/NODE_ENV") | .Value')
export PORT=$(echo "$PARAMS" | jq -r '.[] | select(.Name=="/tortuga/prod/PORT") | .Value')
export SESSION_SECRET=$(echo "$PARAMS" | jq -r '.[] | select(.Name=="/tortuga/prod/SESSION_SECRET") | .Value')
export MONGO_URI=$(echo "$PARAMS" | jq -r '.[] | select(.Name=="/tortuga/prod/MONGO_URI") | .Value')

# 3. Persist for PM2 restarts
cat <<EOF > /home/ec2-user/.tortuga_env
export NODE_ENV='$NODE_ENV'
export PORT='$PORT'
export SESSION_SECRET='$SESSION_SECRET'
export MONGO_URI='$MONGO_URI'
EOF
```

### Production Deployment Flow

```
1. Code pushed to GitHub
2. CodeDeploy triggers deployment to EC2
3. scripts/install_dependencies.sh runs (npm install)
4. scripts/build.sh runs (npm run build)
5. scripts/load_secrets.sh runs (loads from Parameter Store)
6. scripts/start_server.sh runs (PM2 starts app with ecosystem.config.js)
7. Health checks verify deployment
```

### Updating Production Config

**For secrets (SESSION_SECRET, MONGO_URI):**
```
1. AWS Console → Systems Manager → Parameter Store
2. Update parameter value
3. Redeploy or restart: ssh to EC2 → run load_secrets.sh → pm2 restart all
```

**For non-sensitive config (LOG_LEVEL):**
```
1. Edit ecosystem.config.js locally
2. Commit and push
3. CodeDeploy will pick up changes
```

**Quick production restart (after Parameter Store update):**
```bash
# SSH to EC2
ssh -i key.pem ec2-user@your-ec2-ip

# Navigate to project
cd /home/ec2-user/Tortuga-Node

# Reload secrets and restart
./scripts/load_secrets.sh
pm2 restart all

# Verify
pm2 logs --lines 30
```

---

## 📐 **Model Standards**

### Required Pattern

**ALWAYS use this exact pattern:**

```typescript
import mongoose, { Schema, Model } from 'mongoose';
import { BaseDocument } from '../types/base.js';

// 1. Interface for model data (fields only)
export interface IMovie {
  title: string;
  releaseDate: Date;
  studio: string;
  budget?: number;
  revenue?: number;
  // ... other fields
}

// 2. Interface extending BaseDocument (adds _id, createdAt, updatedAt)
export interface IMovieDocument extends IMovie, BaseDocument {}

// 3. Schema with timestamps
const MovieSchema = new Schema<IMovieDocument>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    releaseDate: {
      type: Date,
      required: [true, 'Release date is required'],
    },
    studio: {
      type: String,
      required: [true, 'Studio is required'],
      trim: true,
    },
    budget: {
      type: Number,
      min: [0, 'Budget cannot be negative'],
    },
    revenue: {
      type: Number,
      min: [0, 'Revenue cannot be negative'],
    },
  },
  {
    timestamps: true, // ALWAYS include this
    collection: 'movies',
  }
);

// 4. Indexes for query optimization
MovieSchema.index({ title: 1 });
MovieSchema.index({ releaseDate: -1 });
MovieSchema.index({ studio: 1, releaseDate: -1 }); // Compound for common queries

// 5. Model with singleton pattern
const MovieModel: Model<IMovieDocument> =
  (mongoose.models.Movie as Model<IMovieDocument>) ||
  mongoose.model<IMovieDocument>('Movie', MovieSchema);

export default MovieModel;
```

### BaseDocument Definition

```typescript
// src/types/base.ts
import { Document } from 'mongoose';
import mongoose from 'mongoose';

export interface BaseDocument extends Document {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

### Critical Rules

**✅ ALWAYS:**
- Use `BaseDocument` interface (never define `_id`, `createdAt`, `updatedAt` manually)
- Include `timestamps: true` in schema options
- Use strategic indexes for common queries
- Export both `IModel` and `IModelDocument` interfaces
- Use singleton pattern for model export
- Include `.js` extension in imports

**❌ NEVER:**
- Manually define `_id`, `createdAt`, `updatedAt` fields
- Forget `timestamps: true`
- Skip indexes on frequently queried fields
- Use `extends Document` directly without `BaseDocument`

### Indexing Strategy

```typescript
// Single field - for simple lookups
schema.index({ email: 1 }, { unique: true });
schema.index({ userId: 1 });

// Compound - for queries that filter on multiple fields
schema.index({ leagueId: 1, userId: 1 }, { unique: true });
schema.index({ leagueId: 1, createdAt: -1 });

// Case-insensitive unique - for names/slugs
schema.index(
  { leagueId: 1, name: 1 },
  { 
    unique: true,
    collation: { locale: 'en', strength: 2 }
  }
);

// Text search - for search functionality
schema.index({ title: 'text', description: 'text' });
```

---

## 🎮 **Controller Standards**

### Required Pattern

```typescript
import { Request, Response } from 'express';
import { successResponse, errorResponse, HttpStatus } from '../utils/response.js';
import logger from '../config/logger.js';
import ModelName from '../models/ModelName.js';

// Get all resources (with pagination)
export const getResources = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [data, total] = await Promise.all([
      ModelName.find()
        .limit(Number(limit))
        .skip(skip)
        .sort({ createdAt: -1 }),
      ModelName.countDocuments(),
    ]);

    return res.status(HttpStatus.OK).json(
      successResponse({
        data,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      })
    );
  } catch (error) {
    logger.error('getResources error', { error });
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(errorResponse('Failed to fetch resources'));
  }
};

// Get single resource
export const getResource = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const resource = await ModelName.findById(id);

    if (!resource) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json(errorResponse('Resource not found'));
    }

    return res.status(HttpStatus.OK).json(successResponse(resource));
  } catch (error) {
    logger.error('getResource error', { error, id: req.params.id });
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(errorResponse('Failed to fetch resource'));
  }
};

// Create resource
export const createResource = async (req: Request, res: Response) => {
  try {
    const resource = await ModelName.create(req.body);
    
    return res
      .status(HttpStatus.CREATED)
      .json(successResponse(resource));
  } catch (error) {
    logger.error('createResource error', { error, body: req.body });
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(errorResponse('Failed to create resource'));
  }
};

// Update resource
export const updateResource = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const resource = await ModelName.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!resource) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json(errorResponse('Resource not found'));
    }

    return res.status(HttpStatus.OK).json(successResponse(resource));
  } catch (error) {
    logger.error('updateResource error', { error, id: req.params.id });
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(errorResponse('Failed to update resource'));
  }
};

// Delete resource
export const deleteResource = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const resource = await ModelName.findByIdAndDelete(id);

    if (!resource) {
      return res
        .status(HttpStatus.NOT_FOUND)
        .json(errorResponse('Resource not found'));
    }

    return res.status(HttpStatus.NO_CONTENT).send();
  } catch (error) {
    logger.error('deleteResource error', { error, id: req.params.id });
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(errorResponse('Failed to delete resource'));
  }
};
```

### Response Utilities

```typescript
// src/utils/response.ts
export enum HttpStatus {
  OK = 200,
  CREATED = 201,
  NO_CONTENT = 204,
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  CONFLICT = 409,
  INTERNAL_SERVER_ERROR = 500,
}

export const successResponse = (data: any) => ({
  success: true,
  data,
});

export const errorResponse = (message: string, errors?: any) => ({
  success: false,
  message,
  ...(errors && { errors }),
});
```

### Critical Rules

**✅ ALWAYS:**
- Use try/catch blocks
- Use `HttpStatus` enum for status codes
- Use `successResponse` and `errorResponse` utilities
- Log errors with Winston logger
- Return proper status codes
- Handle not found cases explicitly
- Validate input (use validators)

**❌ NEVER:**
- Use console.log or console.error
- Return raw data without response wrapper
- Use magic numbers for status codes
- Skip error handling
- Forget to check if resource exists

---

## 📝 **Logging Standards**

### Winston Logger

**ALWAYS use Winston logger, NEVER console.*:**

```typescript
import logger from '../config/logger.js';

// ✅ CORRECT - Structured logging
logger.info('Server started', { port: 3000, env: 'production' });
logger.warn('Slow query detected', { duration: 2500, query: 'findUsers' });
logger.error('Database error', { error: err.message, stack: err.stack });
logger.debug('Request received', { method: 'POST', path: '/api/users' });

// ❌ WRONG - Never use console
console.log('Server started');
console.error('Error:', error);
console.warn('Warning');
```

### Log Levels

- **error:** Application errors, exceptions (always log)
- **warn:** Warnings, unusual situations (log in prod)
- **info:** Important application events (log in prod)
- **debug:** Detailed diagnostic info (dev only)

**Production uses `LOG_LEVEL=info`** (set in ecosystem.config.js)

### Structured Metadata

```typescript
// ✅ CORRECT - Include context as object
logger.error('Failed to create user', {
  error: err.message,
  email: req.body.email,
  timestamp: new Date(),
  requestId: req.id,
});

// ❌ WRONG - String concatenation
logger.error('Failed to create user: ' + err.message);
```

---

## ✅ **Validation Standards**

### express-validator Pattern

```typescript
import { body, param, query } from 'express-validator';

export const createLeagueValidation = [
  body('name')
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Name is required (1-100 characters)'),
  
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Description cannot exceed 500 characters'),
  
  body('startDate')
    .isISO8601()
    .toDate()
    .withMessage('Valid start date is required'),
  
  body('maxStudios')
    .isInt({ min: 2, max: 50 })
    .withMessage('Max studios must be between 2 and 50'),
];

export const updateLeagueValidation = [
  param('id')
    .isMongoId()
    .withMessage('Valid league ID is required'),
  
  body('name')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1, max: 100 }),
  
  body('description')
    .optional()
    .isString()
    .trim()
    .isLength({ max: 500 }),
];

export const getLeaguesValidation = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
];
```

### Validation Middleware

```typescript
import { validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { errorResponse, HttpStatus } from '../utils/response.js';

export const validateRequest = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res
      .status(HttpStatus.BAD_REQUEST)
      .json(errorResponse('Validation failed', errors.array()));
  }
  
  next();
};
```

### Usage in Routes

```typescript
import { createLeagueValidation } from '../validators/league.js';
import { validateRequest } from '../middleware/validate.js';

router.post(
  '/leagues',
  isAuth,
  createLeagueValidation,
  validateRequest,
  createLeague
);
```

---

## 🔐 **Middleware Standards**

### Authentication Middleware

```typescript
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { errorResponse, HttpStatus } from '../utils/response.js';
import logger from '../config/logger.js';

export const isAuth = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res
        .status(HttpStatus.UNAUTHORIZED)
        .json(errorResponse('Authentication required'));
    }

    const decoded = jwt.verify(token, process.env.SESSION_SECRET!);
    req.userId = (decoded as any).userId;
    next();
  } catch (error) {
    logger.error('isAuth error', { error });
    return res
      .status(HttpStatus.UNAUTHORIZED)
      .json(errorResponse('Invalid or expired token'));
  }
};
```

### Authorization Middleware

```typescript
export const requireLeagueMember = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { leagueId } = req.params;
    const userId = req.userId;

    const studio = await StudioModel.findOne({ leagueId, userId });

    if (!studio) {
      return res
        .status(HttpStatus.FORBIDDEN)
        .json(errorResponse('You must be a member of this league'));
    }

    req.studioId = studio._id.toString();
    next();
  } catch (error) {
    logger.error('requireLeagueMember error', { error });
    return res
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .json(errorResponse('Authorization check failed'));
  }
};
```

---

## 🗄️ **Database Standards**

### Connection

```typescript
// src/db.ts
import mongoose from 'mongoose';
import logger from './config/logger.js';

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error('MongoDB connection failed', { error });
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error', { error: err });
});
```

**Note:** `MONGO_URI` comes from AWS Parameter Store in production

### Query Patterns

```typescript
// ✅ CORRECT - Use lean() for read-only operations
const movies = await MovieModel.find().lean();

// ✅ CORRECT - Use select() to limit fields
const users = await UserModel.find().select('name email').lean();

// ✅ CORRECT - Use Promise.all for parallel queries
const [users, total] = await Promise.all([
  UserModel.find().limit(10),
  UserModel.countDocuments(),
]);

// ✅ CORRECT - Use populate for relations
const studio = await StudioModel.findById(id).populate('ownerId', 'name email');
```

---

## 📊 **Error Handling Standards**

### Custom Error Classes

```typescript
// src/utils/errors.ts
export class NotFoundError extends Error {
  statusCode = 404;
  
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends Error {
  statusCode = 400;
  
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class UnauthorizedError extends Error {
  statusCode = 401;
  
  constructor(message: string = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
```

### Global Error Handler

```typescript
// src/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import { errorResponse, HttpStatus } from '../utils/response.js';
import logger from '../config/logger.js';

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  logger.error('Error handler caught error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
  });

  const statusCode = err.statusCode || HttpStatus.INTERNAL_SERVER_ERROR;
  const message = err.message || 'Internal server error';

  return res.status(statusCode).json(errorResponse(message));
};
```

---

## 📦 **Service Layer Standards**

### When to Use Services

Use services for:
- Complex business logic
- Logic reused across controllers
- External API calls
- Complex calculations

```typescript
// src/services/slug.ts
import ModelName from '../models/ModelName.js';

export class SlugService {
  static async generateUniqueSlug(
    baseSlug: string,
    leagueId: string
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (await ModelName.findOne({ leagueId, slug })) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    }

    return slug;
  }
}
```

---

## 🔧 **Utility Standards**

### Keep Utilities Focused

```typescript
// src/utils/pagination.ts
export const parsePaginationParams = (query: any) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 10));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const sendPaginatedResponse = (
  res: Response,
  data: any[],
  options: { page: number; limit: number; total: number }
) => {
  return res.status(HttpStatus.OK).json(
    successResponse({
      data,
      pagination: {
        page: options.page,
        limit: options.limit,
        total: options.total,
        pages: Math.ceil(options.total / options.limit),
      },
    })
  );
};
```

---

## 📝 **Code Comments**

### When to Comment

```typescript
// ✅ GOOD - Explains business rule
// CRITICAL: Users can only belong to ONE studio per league
StudioOwnerSchema.index({ leagueId: 1, userId: 1 }, { unique: true });

// ✅ GOOD - Explains complex logic
// Use aggregation to find the highest numeric suffix for unique slug generation
const pipeline = [
  { $match: { leagueId, slug: new RegExp(`^${baseSlug}(-\\d+)?$`) } },
  // ...
];

// ❌ BAD - States the obvious
// Set the name to the request body name
const name = req.body.name;
```

---

## ✅ **Checklist for New Code**

### Models
- [ ] Uses BaseDocument interface
- [ ] Includes timestamps: true
- [ ] Has appropriate indexes
- [ ] Exports IModel and IModelDocument
- [ ] Uses singleton pattern for model export

### Controllers
- [ ] Uses try/catch blocks
- [ ] Uses HttpStatus enum
- [ ] Uses Winston logger (no console.*)
- [ ] Returns consistent response format
- [ ] Handles not found cases
- [ ] Includes proper error messages

### Validation
- [ ] Uses express-validator
- [ ] Applied to all routes with input
- [ ] Includes validateRequest middleware
- [ ] Has appropriate error messages

### Middleware
- [ ] Uses Winston logger
- [ ] Returns consistent error format
- [ ] Includes proper status codes
- [ ] Has error handling

### General
- [ ] TypeScript types are correct
- [ ] Imports use .js extension
- [ ] No console.* statements
- [ ] Error handling is comprehensive
- [ ] Code follows established patterns

---

## 🚫 **Common Mistakes to Avoid**

1. **Using console.* instead of logger**
   ```typescript
   // ❌ WRONG
   console.log('User created');
   
   // ✅ CORRECT
   logger.info('User created', { userId: user._id });
   ```

2. **Not using BaseDocument**
   ```typescript
   // ❌ WRONG
   export interface IMovieDocument extends IMovie, Document {
     _id: mongoose.Types.ObjectId;
     createdAt: Date;
     updatedAt: Date;
   }
   
   // ✅ CORRECT
   export interface IMovieDocument extends IMovie, BaseDocument {}
   ```

3. **Forgetting timestamps**
   ```typescript
   // ❌ WRONG
   const Schema = new Schema<IDocument>({ /* fields */ });
   
   // ✅ CORRECT
   const Schema = new Schema<IDocument>(
     { /* fields */ },
     { timestamps: true }
   );
   ```

4. **Not handling errors**
   ```typescript
   // ❌ WRONG
   export const handler = async (req, res) => {
     const data = await Model.find();
     res.json(data);
   };
   
   // ✅ CORRECT
   export const handler = async (req, res) => {
     try {
       const data = await Model.find();
       return res.status(HttpStatus.OK).json(successResponse(data));
     } catch (error) {
       logger.error('handler error', { error });
       return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json(
         errorResponse('Failed to fetch data')
       );
     }
   };
   ```

---

## 📚 **Additional Resources**

- TypeScript: https://www.typescriptlang.org/docs/
- Mongoose: https://mongoosejs.com/docs/
- Express: https://expressjs.com/
- Winston: https://github.com/winstonjs/winston
- express-validator: https://express-validator.github.io/
- AWS Systems Manager: https://docs.aws.amazon.com/systems-manager/

---

## 🔄 **Updating These Standards**

When patterns evolve:
1. Update this document
2. Commit with clear message: `docs: update backend standards - [what changed]`
3. Review existing code for compliance
4. Update as needed

---

## ✅ **Current Status**

**Last Review:** November 19, 2025
**Status:** 100% Pristine, Production Deployed
**Deployment:** AWS EC2 with PM2
**Files Compliant:** All 35+ backend files

---

*These standards are mandatory for all backend code. Follow them to maintain the pristine codebase.*
