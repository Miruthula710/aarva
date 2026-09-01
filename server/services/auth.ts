import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { db } from '../db/store';
import { User, Role } from '../db/types';

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionToken?: string;
  victimId?: string;
  counselorId?: string;
}

export function hashPassword(plainText: string): string {
  return bcrypt.hashSync(plainText, 10);
}

export function verifyPassword(plainText: string, hash: string): boolean {
  return bcrypt.compareSync(plainText, hash);
}

export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function sanitizeUser(user: User) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

// Authentication Middleware
export function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : null;

  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No session token provided.' });
  }

  const session = db.getSessionByToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  const user = db.findUserById(session.userId);
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'User account is inactive or not found.' });
  }

  req.user = user;
  req.sessionToken = token;

  if (user.role === 'VICTIM') {
    const victim = db.getVictimByUserId(user.id);
    if (victim) req.victimId = victim.id;
  } else if (user.role === 'COUNSELOR') {
    const counselor = db.getCounselorByUserId(user.id);
    if (counselor) req.counselorId = counselor.id;
  }

  next();
}

// Role-Based Authorization Guard
export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      db.logAudit(
        req.user.id,
        'UNAUTHORIZED_ACCESS_ATTEMPT',
        'Endpoint',
        req.originalUrl,
        { requiredRoles: allowedRoles, actualRole: req.user.role },
        req.ip
      );
      return res.status(403).json({
        error: 'Forbidden: You do not have permission to access this healthcare resource.',
      });
    }

    next();
  };
}
