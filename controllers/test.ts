import type { Request, Response } from 'express';

const getTest = (_req: Request, res: Response) => {
  res.json({
    ok: true,
    message: 'Test route is alive',
    env: process.env.NODE_ENV || 'development',
    time: new Date().toISOString(),
  });
};

export default { getTest };
