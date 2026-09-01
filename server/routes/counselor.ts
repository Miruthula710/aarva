import { Router, Response } from 'express';
import { db } from '../db/store';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../services/auth';
import { AlertStatus, FollowUpStatus, ReferralStatus, RiskLevel } from '../db/types';

export const counselorRouter = Router();

// Protect all counselor routes
counselorRouter.use(authenticateToken);
counselorRouter.use(requireRole('COUNSELOR', 'ADMIN'));

// GET /api/counselor/dashboard
counselorRouter.get('/dashboard', (req: AuthenticatedRequest, res: Response) => {
  const data = db.getCounselorDashboardMetrics(req.counselorId);
  res.json(data);
});

// GET /api/counselor/victims
counselorRouter.get('/victims', (req: AuthenticatedRequest, res: Response) => {
  const { search, riskLevel, language, district } = req.query;

  let victims = db.victims.map((v) => {
    const user = db.findUserById(v.userId);
    const counselor = v.assignedCounselorId ? db.counselors.find((c) => c.id === v.assignedCounselorId) : null;
    const counselorUser = counselor ? db.findUserById(counselor.userId) : null;

    const pendingAlerts = db.alerts.filter((a) => a.victimId === v.id && (a.status === 'PENDING' || a.status === 'ACKNOWLEDGED')).length;
    const pendingFollowUps = db.followUps.filter((f) => f.victimId === v.id && f.status === 'PENDING').length;

    return {
      id: v.id,
      victimCode: v.victimCode,
      name: user?.name || 'Unknown',
      phoneNumber: user?.phoneNumber,
      email: user?.email,
      preferredLanguage: user?.preferredLanguage || 'ENGLISH',
      age: v.age,
      gender: v.gender,
      village: v.village,
      district: v.district,
      state: v.state,
      emergencyContactName: v.emergencyContactName,
      emergencyContactPhone: v.emergencyContactPhone,
      currentDistressScore: v.currentDistressScore,
      currentRiskLevel: v.currentRiskLevel,
      lastCheckInAt: v.lastCheckInAt,
      lastInteractionAt: v.lastInteractionAt,
      assignedCounselorName: counselorUser?.name || 'Unassigned',
      assignedCounselorId: v.assignedCounselorId,
      pendingAlertsCount: pendingAlerts,
      pendingFollowUpsCount: pendingFollowUps,
      createdAt: v.createdAt,
    };
  });

  if (search) {
    const s = String(search).toLowerCase();
    victims = victims.filter(
      (v) =>
        v.name.toLowerCase().includes(s) ||
        v.victimCode.toLowerCase().includes(s) ||
        (v.phoneNumber && v.phoneNumber.includes(s)) ||
        (v.village && v.village.toLowerCase().includes(s))
    );
  }

  if (riskLevel && riskLevel !== 'ALL') {
    victims = victims.filter((v) => v.currentRiskLevel === riskLevel);
  }

  if (language && language !== 'ALL') {
    victims = victims.filter((v) => v.preferredLanguage === language);
  }

  if (district && district !== 'ALL') {
    victims = victims.filter((v) => v.district === district);
  }

  res.json({ victims, total: victims.length });
});

// GET /api/counselor/victims/:id
counselorRouter.get('/victims/:id', (req: AuthenticatedRequest, res: Response) => {
  const enriched = db.getEnrichedVictim(req.params.id);
  if (!enriched) {
    return res.status(404).json({ error: 'Victim record not found.' });
  }

  db.logAudit(req.user!.id, 'VIEW_VICTIM_PROFILE', 'Victim', req.params.id, { victimCode: enriched.victimCode }, req.ip);

  res.json({ victim: enriched });
});

// PATCH /api/counselor/victims/:id
counselorRouter.patch('/victims/:id', (req: AuthenticatedRequest, res: Response) => {
  const victim = db.getVictimById(req.params.id);
  if (!victim) return res.status(404).json({ error: 'Victim not found.' });

  const { assignedCounselorId, emergencyContactName, emergencyContactPhone, village, district } = req.body;

  if (assignedCounselorId !== undefined) victim.assignedCounselorId = assignedCounselorId;
  if (emergencyContactName !== undefined) victim.emergencyContactName = emergencyContactName;
  if (emergencyContactPhone !== undefined) victim.emergencyContactPhone = emergencyContactPhone;
  if (village !== undefined) victim.village = village;
  if (district !== undefined) victim.district = district;
  victim.updatedAt = new Date().toISOString();

  db.logAudit(req.user!.id, 'UPDATE_VICTIM_INFO', 'Victim', victim.id, req.body, req.ip);

  res.json({ success: true, victim });
});

// GET /api/counselor/alerts
counselorRouter.get('/alerts', (req: AuthenticatedRequest, res: Response) => {
  const { status, priority } = req.query;

  let alerts = db.alerts.map((alt) => {
    const victim = db.victims.find((v) => v.id === alt.victimId);
    const user = victim ? db.users.find((u) => u.id === victim.userId) : null;
    const counselor = alt.counselorId ? db.counselors.find((c) => c.id === alt.counselorId) : null;
    const counselorUser = counselor ? db.users.find((u) => u.id === counselor.userId) : null;

    return {
      ...alt,
      victimName: user?.name || 'Unknown Victim',
      victimCode: victim?.victimCode || 'V-????',
      victimPhone: user?.phoneNumber,
      victimVillage: victim?.village,
      victimDistrict: victim?.district,
      preferredLanguage: user?.preferredLanguage,
      counselorName: counselorUser?.name || 'Unassigned',
    };
  });

  if (status && status !== 'ALL') {
    alerts = alerts.filter((a) => a.status === status);
  }

  if (priority && priority !== 'ALL') {
    alerts = alerts.filter((a) => a.priority === priority);
  }

  alerts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ alerts, total: alerts.length });
});

// POST /api/counselor/alerts/:id/action
counselorRouter.post('/alerts/:id/action', (req: AuthenticatedRequest, res: Response) => {
  const alert = db.alerts.find((a) => a.id === req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found.' });

  const { action, resolutionNotes, reassignCounselorId } = req.body;

  if (action === 'ACKNOWLEDGE') {
    alert.status = 'ACKNOWLEDGED';
    alert.acknowledgedAt = new Date().toISOString();
    alert.counselorId = req.counselorId || alert.counselorId;
  } else if (action === 'RESOLVE') {
    alert.status = 'RESOLVED';
    alert.resolvedAt = new Date().toISOString();
    alert.resolutionNotes = resolutionNotes || 'Resolved after counselor review.';
  } else if (action === 'ESCALATE') {
    alert.status = 'ESCALATED';
    alert.priority = 'HIGH';
    alert.resolutionNotes = resolutionNotes || 'Escalated to Medical Officer & Tele-MANAS.';
  } else if (action === 'REASSIGN' && reassignCounselorId) {
    alert.counselorId = reassignCounselorId;
  }
  alert.updatedAt = new Date().toISOString();

  db.logAudit(req.user!.id, `ALERT_${action}`, 'Alert', alert.id, { action, resolutionNotes }, req.ip);

  res.json({ success: true, alert });
});

// GET /api/counselor/followups
counselorRouter.get('/followups', (req: AuthenticatedRequest, res: Response) => {
  const followUps = db.followUps.map((f) => {
    const victim = db.victims.find((v) => v.id === f.victimId);
    const user = victim ? db.users.find((u) => u.id === victim.userId) : null;
    const counselor = db.counselors.find((c) => c.id === f.counselorId);
    const counselorUser = counselor ? db.users.find((u) => u.id === counselor.userId) : null;

    const isOverdue = new Date(f.dueDate).getTime() < Date.now() && f.status === 'PENDING';

    return {
      ...f,
      isOverdue,
      victimName: user?.name || 'Unknown',
      victimCode: victim?.victimCode || 'V-????',
      victimPhone: user?.phoneNumber,
      counselorName: counselorUser?.name || 'Assigned Counselor',
    };
  }).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  res.json({ followUps });
});

// POST /api/counselor/followups
counselorRouter.post('/followups', (req: AuthenticatedRequest, res: Response) => {
  const { victimId, dueDate, priority, notes } = req.body;
  if (!victimId || !dueDate) {
    return res.status(400).json({ error: 'Victim and due date are required.' });
  }

  const newFollowUp = {
    id: `flw-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    victimId,
    counselorId: req.counselorId || db.counselors[0].id,
    dueDate: new Date(dueDate).toISOString(),
    status: 'PENDING' as FollowUpStatus,
    priority: (priority as RiskLevel) || 'MILD',
    notes: notes || null,
    outcomeNotes: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.followUps.push(newFollowUp);
  db.logAudit(req.user!.id, 'CREATE_FOLLOWUP', 'FollowUp', newFollowUp.id, { victimId, dueDate }, req.ip);

  res.status(201).json({ success: true, followUp: newFollowUp });
});

// PATCH /api/counselor/followups/:id
counselorRouter.patch('/followups/:id', (req: AuthenticatedRequest, res: Response) => {
  const followUp = db.followUps.find((f) => f.id === req.params.id);
  if (!followUp) return res.status(404).json({ error: 'Follow-up not found.' });

  const { status, outcomeNotes, dueDate, notes } = req.body;

  if (status !== undefined) {
    followUp.status = status;
    if (status === 'COMPLETED') followUp.completedAt = new Date().toISOString();
  }
  if (outcomeNotes !== undefined) followUp.outcomeNotes = outcomeNotes;
  if (dueDate !== undefined) followUp.dueDate = new Date(dueDate).toISOString();
  if (notes !== undefined) followUp.notes = notes;
  followUp.updatedAt = new Date().toISOString();

  db.logAudit(req.user!.id, 'UPDATE_FOLLOWUP', 'FollowUp', followUp.id, req.body, req.ip);

  res.json({ success: true, followUp });
});

// GET /api/counselor/referrals
counselorRouter.get('/referrals', (req: AuthenticatedRequest, res: Response) => {
  const referrals = db.referrals.map((r) => {
    const victim = db.victims.find((v) => v.id === r.victimId);
    const user = victim ? db.users.find((u) => u.id === victim.userId) : null;
    const facility = db.facilities.find((f) => f.id === r.facilityId);

    return {
      ...r,
      victimName: user?.name || 'Unknown',
      victimCode: victim?.victimCode || 'V-????',
      facilityName: facility?.name || 'Primary Health Centre',
      facilityType: facility?.type || 'PHC',
      facilityPhone: facility?.contactPhone,
    };
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  res.json({ referrals });
});

// POST /api/counselor/referrals
counselorRouter.post('/referrals', (req: AuthenticatedRequest, res: Response) => {
  const { victimId, facilityId, reason, appointmentDate, notes } = req.body;
  if (!victimId || !facilityId || !reason) {
    return res.status(400).json({ error: 'Victim, facility, and reason are required.' });
  }

  const referral = {
    id: `ref-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    victimId,
    counselorId: req.counselorId || db.counselors[0].id,
    facilityId,
    reason,
    status: 'CREATED' as ReferralStatus,
    notes: notes || null,
    appointmentDate: appointmentDate ? new Date(appointmentDate).toISOString() : null,
    completedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.referrals.push(referral);
  db.logAudit(req.user!.id, 'CREATE_REFERRAL', 'Referral', referral.id, { victimId, facilityId }, req.ip);

  res.status(201).json({ success: true, referral });
});

// POST /api/counselor/notes
counselorRouter.post('/notes', (req: AuthenticatedRequest, res: Response) => {
  const { victimId, content } = req.body;
  if (!victimId || !content) {
    return res.status(400).json({ error: 'Victim and note content are required.' });
  }

  const note = {
    id: `note-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    counselorId: req.counselorId || db.counselors[0].id,
    victimId,
    content,
    isPrivate: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.clinicalNotes.push(note);
  db.logAudit(req.user!.id, 'ADD_CLINICAL_NOTE', 'ClinicalNote', note.id, { victimId }, req.ip);

  res.status(201).json({ success: true, note });
});

// GET /api/counselor/facilities
counselorRouter.get('/facilities', (req: AuthenticatedRequest, res: Response) => {
  res.json({ facilities: db.facilities });
});

// GET /api/counselor/audit-logs
counselorRouter.get('/audit-logs', (req: AuthenticatedRequest, res: Response) => {
  const logs = db.auditLogs.slice(0, 50).map((l) => {
    const user = l.userId ? db.findUserById(l.userId) : null;
    return {
      ...l,
      userName: user?.name || 'System / Automated Scheduler',
      userRole: user?.role || 'SYSTEM',
    };
  });
  res.json({ logs });
});
