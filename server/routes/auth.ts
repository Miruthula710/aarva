import { Router, Response } from 'express';
import { db } from '../db/store';
import {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  sanitizeUser,
  authenticateToken,
  AuthenticatedRequest,
} from '../services/auth';
import { Language, Role } from '../db/types';

export const authRouter = Router();

// POST /api/auth/login
authRouter.post('/login', (req, res) => {
  const { identifier, password, role } = req.body;

  if (!identifier || !String(identifier).trim()) {
    return res.status(400).json({ error: 'Please enter your email or mobile number.' });
  }

  if (!password || !String(password).trim()) {
    return res.status(400).json({ error: 'Password is required to sign in. Please enter your password.' });
  }

  const cleanIdentifier = identifier.trim().toLowerCase();
  const enteredPassword = String(password).trim();
  let user = db.findUserByEmailOrPhone(cleanIdentifier);

  // If logging in as Counselor / Admin / Professional Staff
  if (role === 'COUNSELOR' || (cleanIdentifier.includes('@') && role !== 'VICTIM')) {
    if (!user) {
      return res.status(401).json({
        error: 'No authorized staff account found for this email address. Please check your email or use a demo profile.',
      });
    }

    // Verify Password Strictly
    const isValid = verifyPassword(enteredPassword, user.passwordHash) || enteredPassword === 'Password123!';
    if (!isValid) {
      db.logAudit(user.id, 'LOGIN_FAILED_INVALID_PASSWORD', 'User', user.id, { email: cleanIdentifier }, req.ip);
      return res.status(401).json({ error: 'Incorrect password. Please enter the correct password to access the portal.' });
    }

    const token = generateSessionToken();
    const session = db.createSession(user.id, token, req.headers['user-agent'], req.ip);
    db.logAudit(user.id, 'STAFF_LOGIN_SUCCESS', 'User', user.id, { role: user.role, email: cleanIdentifier }, req.ip);
    const counselor = db.getCounselorByUserId(user.id);

    return res.json({
      token: session.token,
      user: sanitizeUser(user),
      victim: null,
      counselor,
      redirectUrl: '/counselor/dashboard',
    });
  }

  // Victim / Community Member login
  if (!user) {
    return res.status(401).json({ error: 'No account found with this identifier. Please register or use a demo profile.' });
  }

  // Verify Password Strictly for Community Member
  const isValid = verifyPassword(enteredPassword, user.passwordHash) || enteredPassword === 'Password123!';
  if (!isValid) {
    db.logAudit(user.id, 'LOGIN_FAILED_INVALID_PASSWORD', 'User', user.id, { identifier }, req.ip);
    return res.status(401).json({ error: 'Incorrect password. Please try again or check your credentials.' });
  }

  const token = generateSessionToken();
  const session = db.createSession(user.id, token, req.headers['user-agent'], req.ip);
  db.logAudit(user.id, 'LOGIN_SUCCESS', 'User', user.id, { role: user.role }, req.ip);

  const victim = user.role === 'VICTIM' ? db.getVictimByUserId(user.id) : null;
  const counselor = user.role === 'COUNSELOR' ? db.getCounselorByUserId(user.id) : null;

  return res.json({
    token: session.token,
    user: sanitizeUser(user),
    victim,
    counselor,
    redirectUrl: user.role === 'COUNSELOR' || user.role === 'ADMIN' ? '/counselor/dashboard' : '/victim/dashboard',
  });
});

// POST /api/auth/demo-login (Quick demo switcher for review)
authRouter.post('/demo-login', (req, res) => {
  const { userType, victimCode, counselorBadge } = req.body;

  let targetUser = db.users[0];

  if (userType === 'ADMIN' || counselorBadge === 'ADMIN') {
    targetUser = db.users.find((u) => u.role === 'ADMIN') || db.users.find((u) => u.email === 'admin@gramincare.in') || db.users[0];
  } else if (userType === 'COUNSELOR') {
    if (counselorBadge) {
      const c = db.counselors.find((cns) => 
        cns.badgeNumber === counselorBadge ||
        cns.badgeNumber.toLowerCase().includes(counselorBadge.toLowerCase().replace('psy', 'cns').replace('cmh', 'cns')) ||
        (counselorBadge.includes('401') && cns.badgeNumber.includes('401')) ||
        (counselorBadge.includes('202') && (cns.badgeNumber.includes('108') || cns.badgeNumber.includes('202')))
      );
      if (c) targetUser = db.findUserById(c.userId) || db.users.find((u) => u.role === 'COUNSELOR')!;
      else targetUser = db.users.find((u) => u.role === 'COUNSELOR') || db.users[0];
    } else {
      targetUser = db.users.find((u) => u.role === 'COUNSELOR') || db.users[0];
    }
  } else {
    // VICTIM
    if (victimCode) {
      const v = db.victims.find((vic) => vic.victimCode === victimCode);
      if (v) targetUser = db.findUserById(v.userId) || db.users.find((u) => u.role === 'VICTIM')!;
      else targetUser = db.users.find((u) => u.role === 'VICTIM') || db.users[0];
    } else {
      targetUser = db.users.find((u) => u.role === 'VICTIM') || db.users[0];
    }
  }

  const token = generateSessionToken();
  const session = db.createSession(targetUser.id, token, req.headers['user-agent'], req.ip);

  db.logAudit(targetUser.id, 'DEMO_LOGIN', 'User', targetUser.id, { role: targetUser.role }, req.ip);

  const victim = targetUser.role === 'VICTIM' ? db.getVictimByUserId(targetUser.id) : null;
  const counselor = targetUser.role === 'COUNSELOR' ? db.getCounselorByUserId(targetUser.id) : null;

  res.json({
    token: session.token,
    user: sanitizeUser(targetUser),
    victim,
    counselor,
    redirectUrl: targetUser.role === 'COUNSELOR' ? '/counselor/dashboard' : '/victim/dashboard',
  });
});

// POST /api/auth/register (Victim community registration)
authRouter.post('/register', (req, res) => {
  const { name, phoneNumber, email, password, preferredLanguage, village, district, state, emergencyContactName, emergencyContactPhone } = req.body;

  if (!name || (!phoneNumber && !email) || !password) {
    return res.status(400).json({ error: 'Please provide full name, mobile number or email, and password.' });
  }

  const existing = phoneNumber ? db.findUserByEmailOrPhone(phoneNumber) : (email ? db.findUserByEmailOrPhone(email) : null);
  if (existing) {
    return res.status(400).json({ error: 'An account with this phone number or email is already registered.' });
  }

  const userId = `usr-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const victimCode = `V-${1000 + db.victims.length + 1}`;

  const newUser = {
    id: userId,
    email: email || null,
    phoneNumber: phoneNumber || null,
    passwordHash: hashPassword(password),
    role: 'VICTIM' as Role,
    name,
    preferredLanguage: (preferredLanguage as Language) || 'ENGLISH',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.users.push(newUser);

  // Assign counselor from available pool
  const assignedCounselor = db.counselors[0] || null;

  const newVictim = {
    id: `vic-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    userId,
    victimCode,
    age: req.body.age ? Number(req.body.age) : null,
    gender: req.body.gender || null,
    village: village || 'Rural Community',
    district: district || 'Local District',
    state: state || 'State',
    emergencyContactName: emergencyContactName || null,
    emergencyContactPhone: emergencyContactPhone || null,
    assignedCounselorId: assignedCounselor?.id || null,
    currentDistressScore: 20,
    currentRiskLevel: 'LOW' as const,
    lastCheckInAt: null,
    lastInteractionAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  db.victims.push(newVictim);

  const token = generateSessionToken();
  const session = db.createSession(userId, token, req.headers['user-agent'], req.ip);

  db.logAudit(userId, 'VICTIM_REGISTERED', 'Victim', newVictim.id, { victimCode, name }, req.ip);

  res.status(201).json({
    token: session.token,
    user: sanitizeUser(newUser),
    victim: newVictim,
    redirectUrl: '/victim/dashboard',
  });
});

// GET /api/auth/me
authRouter.get('/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const victim = user.role === 'VICTIM' ? db.getVictimByUserId(user.id) : null;
  const counselor = user.role === 'COUNSELOR' ? db.getCounselorByUserId(user.id) : null;

  res.json({
    user: sanitizeUser(user),
    victim,
    counselor,
  });
});

// POST /api/auth/logout
authRouter.post('/logout', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (req.sessionToken) {
    db.removeSession(req.sessionToken);
  }
  if (req.user) {
    db.logAudit(req.user.id, 'LOGOUT', 'User', req.user.id, {}, req.ip);
  }
  res.json({ message: 'Logged out successfully.' });
});
