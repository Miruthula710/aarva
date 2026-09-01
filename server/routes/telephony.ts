import { Router, Response } from 'express';
import { db } from '../db/store';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../services/auth';
import {
  isTwilioConfigured,
  sendSmsNotification,
  triggerDailyCheckInReminders,
  initiateCounselorCall,
} from '../services/telephony';

export const telephonyRouter = Router();

// Protect endpoints for counselor / system
telephonyRouter.use(authenticateToken);

// GET /api/telephony/status
telephonyRouter.get('/status', (req: AuthenticatedRequest, res: Response) => {
  res.json({
    twilioConfigured: isTwilioConfigured(),
    smsGatewayEnabled: db.adminConfig.smsGatewayEnabled,
    twilioPhoneNumber: process.env.TWILIO_PHONE_NUMBER || '+1 (555) 019-2831 [Demo Gateway]',
    totalSmsSent: db.smsLogs.length,
    recentSmsLogs: db.smsLogs.slice(0, 10),
  });
});

// POST /api/telephony/call (Initiate outbound call)
telephonyRouter.post('/call', requireRole('COUNSELOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { victimId, phoneNumber } = req.body;
  if (!victimId || !phoneNumber) {
    return res.status(400).json({ error: 'Victim and phone number are required.' });
  }

  const result = await initiateCounselorCall({
    victimId,
    phoneNumber,
    counselorId: req.counselorId,
  });

  res.json(result);
});

// POST /api/notifications/sms/send
telephonyRouter.post('/sms/send', requireRole('COUNSELOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const { victimId, phoneNumber, message, purpose } = req.body;
  if (!phoneNumber || !message) {
    return res.status(400).json({ error: 'Phone number and message are required.' });
  }

  const result = await sendSmsNotification({
    victimId,
    phoneNumber,
    message,
    purpose: purpose || 'FOLLOWUP_NOTICE',
  });

  res.json(result);
});

// POST /api/notifications/sms/remind-missed (Automated check-in reminders check)
telephonyRouter.post('/sms/remind-missed', requireRole('COUNSELOR', 'ADMIN'), async (req: AuthenticatedRequest, res: Response) => {
  const result = await triggerDailyCheckInReminders();
  res.json({
    success: true,
    message: `Triggered SMS check-in reminders for ${result.sentCount} victim(s) with missed check-in (>24h).`,
    result,
  });
});

// GET /api/notifications/sms/logs
telephonyRouter.get('/sms/logs', requireRole('COUNSELOR', 'ADMIN'), (req: AuthenticatedRequest, res: Response) => {
  res.json({ logs: db.smsLogs });
});
