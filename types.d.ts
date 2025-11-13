// Extend Express Request type with custom properties
declare namespace Express {
  export interface Request {
    userId?: string;
  }
}

// Custom type declarations for packages without official @types

declare module 'connect-mongodb-session' {
  import { Store } from 'express-session';
  import { EventEmitter } from 'events';

  interface MongoDBStoreOptions {
    uri: string;
    collection?: string;
    connectionOptions?: any;
    expires?: number;
    databaseName?: string;
  }

  class MongoDBStore extends EventEmitter implements Store {
    constructor(
      options: MongoDBStoreOptions,
      callback?: (error: Error) => void
    );
    get(sid: string, callback: (error: any, session?: any) => void): void;
    set(sid: string, session: any, callback?: (error: any) => void): void;
    destroy(sid: string, callback?: (error: any) => void): void;
    length(callback: (error: any, length?: number) => void): void;
    clear(callback?: (error: any) => void): void;
    touch(sid: string, session: any, callback?: (error: any) => void): void;
  }

  function connectMongoDBSession(session: any): typeof MongoDBStore;
  export = connectMongoDBSession;
}

declare module 'express-rate-limit' {
  import { RequestHandler, Request, Response } from 'express';

  interface RateLimitOptions {
    windowMs?: number;
    max?: number;
    limit?: number;
    message?: string;
    statusCode?: number;
    standardHeaders?: boolean;
    legacyHeaders?: boolean;
    skip?: (req: Request, res: Response) => boolean;
    handler?: (req: Request, res: Response) => void;
  }

  function rateLimit(options?: RateLimitOptions): RequestHandler;
  export = rateLimit;
}
