import { Router, Response } from 'express';
import { db } from '../db/store';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../services/auth';

export const adminRouter = Router();

adminRouter.use(authenticateToken);
adminRouter.use(requireRole('COUNSELOR', 'ADMIN'));

// GET /api/admin/config
adminRouter.get('/config', (req: AuthenticatedRequest, res: Response) => {
  res.json({
    config: db.adminConfig,
    systemInfo: {
      totalUsers: db.users.length,
      totalVictims: db.victims.length,
      totalCounselors: db.counselors.length,
      totalAssessments: db.assessments.length,
      totalAlerts: db.alerts.length,
      nodeEnv: process.env.NODE_ENV || 'development',
      geminiKeyPresent: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
      twilioConfigured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_ACCOUNT_SID !== 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'),
    },
  });
});

// PATCH /api/admin/config
adminRouter.patch('/config', (req: AuthenticatedRequest, res: Response) => {
  const { distressThresholdLow, distressThresholdMild, distressThresholdElev, distressThresholdHigh, autoEscalateHighRisk, emergencyHotlines } = req.body;

  if (distressThresholdLow !== undefined) db.adminConfig.distressThresholdLow = Number(distressThresholdLow);
  if (distressThresholdMild !== undefined) db.adminConfig.distressThresholdMild = Number(distressThresholdMild);
  if (distressThresholdElev !== undefined) db.adminConfig.distressThresholdElev = Number(distressThresholdElev);
  if (distressThresholdHigh !== undefined) db.adminConfig.distressThresholdHigh = Number(distressThresholdHigh);
  if (autoEscalateHighRisk !== undefined) db.adminConfig.autoEscalateHighRisk = Boolean(autoEscalateHighRisk);
  if (emergencyHotlines !== undefined && Array.isArray(emergencyHotlines)) db.adminConfig.emergencyHotlines = emergencyHotlines;
  db.adminConfig.updatedAt = new Date().toISOString();

  db.logAudit(req.user!.id, 'UPDATE_ADMIN_CONFIG', 'AdminConfig', 'default', req.body, req.ip);

  res.json({ success: true, config: db.adminConfig });
});
