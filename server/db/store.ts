import {
  User,
  Victim,
  Counselor,
  Facility,
  Question,
  DailyCheckIn,
  Response,
  QuestionHistory,
  Conversation,
  ConversationMessage,
  VoiceSession,
  VoiceFeature,
  DistressAssessment,
  RiskEvent,
  Alert,
  CounselorAssignment,
  FollowUp,
  Referral,
  ClinicalNote,
  AuditLog,
  AdminConfig,
  SmsLog,
  Session,
} from './types';
import {
  initialUsers,
  initialVictims,
  initialCounselors,
  initialFacilities,
  initialQuestions,
  initialAssessments,
  initialAlerts,
  initialFollowUps,
  initialReferrals,
  initialClinicalNotes,
  initialConversations,
  initialMessages,
  initialVoiceFeatures,
  initialVoiceSessions,
  initialAuditLogs,
  initialSmsLogs,
  initialAdminConfig,
} from './seedData';

class DatabaseStore {
  public users: User[] = [...initialUsers];
  public sessions: Session[] = [];
  public victims: Victim[] = [...initialVictims];
  public counselors: Counselor[] = [...initialCounselors];
  public facilities: Facility[] = [...initialFacilities];
  public questions: Question[] = [...initialQuestions];
  public checkIns: DailyCheckIn[] = [];
  public responses: Response[] = [];
  public questionHistories: QuestionHistory[] = [];
  public conversations: Conversation[] = [...initialConversations];
  public messages: ConversationMessage[] = [...initialMessages];
  public voiceSessions: VoiceSession[] = [...initialVoiceSessions];
  public voiceFeatures: VoiceFeature[] = [...initialVoiceFeatures];
  public assessments: DistressAssessment[] = [...initialAssessments];
  public riskEvents: RiskEvent[] = [];
  public alerts: Alert[] = [...initialAlerts];
  public assignments: CounselorAssignment[] = [];
  public followUps: FollowUp[] = [...initialFollowUps];
  public referrals: Referral[] = [...initialReferrals];
  public clinicalNotes: ClinicalNote[] = [...initialClinicalNotes];
  public auditLogs: AuditLog[] = [...initialAuditLogs];
  public smsLogs: SmsLog[] = [...initialSmsLogs];
  public adminConfig: AdminConfig = { ...initialAdminConfig };

  constructor() {
    // Generate some initial checkIns from assessments
    this.assessments.forEach((ast, idx) => {
      const vic = this.victims.find((v) => v.id === ast.victimId);
      if (vic) {
        const checkInId = `chk-${idx + 1}`;
        this.checkIns.push({
          id: checkInId,
          victimId: vic.id,
          checkInDate: ast.createdAt,
          isCompleted: true,
          completionSource: 'WEB_APP',
          distressScore: ast.score,
          riskLevel: ast.riskLevel,
          notes: ast.reason,
          createdAt: ast.createdAt,
          updatedAt: ast.createdAt,
        });
        ast.checkInId = checkInId;
      }
    });
  }

  // Audit Logger
  public logAudit(userId: string | null, action: string, resourceType: string, resourceId?: string | null, details?: any, ipAddress?: string) {
    const log: AuditLog = {
      id: `aud-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId,
      action,
      resourceType,
      resourceId: resourceId || null,
      details: details ? (typeof details === 'string' ? details : JSON.stringify(details)) : null,
      ipAddress: ipAddress || '127.0.0.1',
      createdAt: new Date().toISOString(),
    };
    this.auditLogs.unshift(log);
    return log;
  }

  // Find User by email or phone
  public findUserById(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  public findUserByEmailOrPhone(identifier: string): User | undefined {
    const clean = identifier.trim().toLowerCase();
    const cleanDigits = identifier.replace(/\D/g, '');
    return this.users.find((u) => {
      if (u.email && u.email.toLowerCase() === clean) return true;
      if (u.phoneNumber) {
        const uDigits = u.phoneNumber.replace(/\D/g, '');
        if (uDigits && cleanDigits && uDigits.endsWith(cleanDigits)) return true;
        if (u.phoneNumber === identifier.trim()) return true;
      }
      return false;
    });
  }

  // Sessions
  public createSession(userId: string, token: string, userAgent?: string, ipAddress?: string): Session {
    const session: Session = {
      id: `sess-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      userId,
      token,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    this.sessions.push(session);
    return session;
  }

  public getSessionByToken(token: string): Session | undefined {
    const sess = this.sessions.find((s) => s.token === token);
    if (!sess) return undefined;
    if (new Date(sess.expiresAt) < new Date()) {
      this.sessions = this.sessions.filter((s) => s.token !== token);
      return undefined;
    }
    return sess;
  }

  public removeSession(token: string) {
    this.sessions = this.sessions.filter((s) => s.token !== token);
  }

  // Victim Helpers
  public getVictimByUserId(userId: string): Victim | undefined {
    return this.victims.find((v) => v.userId === userId);
  }

  public getVictimById(victimId: string): Victim | undefined {
    return this.victims.find((v) => v.id === victimId);
  }

  public getCounselorByUserId(userId: string): Counselor | undefined {
    return this.counselors.find((c) => c.userId === userId);
  }

  public getCounselorById(counselorId: string): Counselor | undefined {
    return this.counselors.find((c) => c.id === counselorId);
  }

  // Enriched Victim Detail for Counselor
  public getEnrichedVictim(victimId: string) {
    const victim = this.victims.find((v) => v.id === victimId);
    if (!victim) return null;

    const user = this.users.find((u) => u.id === victim.userId);
    const counselor = victim.assignedCounselorId ? this.counselors.find((c) => c.id === victim.assignedCounselorId) : null;
    const counselorUser = counselor ? this.users.find((u) => u.id === counselor.userId) : null;

    const victimAssessments = this.assessments
      .filter((a) => a.victimId === victim.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const victimAlerts = this.alerts
      .filter((a) => a.victimId === victim.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const victimFollowUps = this.followUps
      .filter((f) => f.victimId === victim.id)
      .sort((a, b) => new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime());

    const victimReferrals = this.referrals
      .filter((r) => r.victimId === victim.id)
      .map((r) => ({
        ...r,
        facility: this.facilities.find((f) => f.id === r.facilityId) || null,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const victimCheckIns = this.checkIns
      .filter((c) => c.victimId === victim.id)
      .sort((a, b) => new Date(b.checkInDate).getTime() - new Date(a.checkInDate).getTime());

    const victimConversations = this.conversations
      .filter((c) => c.victimId === victim.id)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    const victimNotes = this.clinicalNotes
      .filter((n) => n.victimId === victim.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const victimVoiceSessions = this.voiceSessions
      .filter((vs) => vs.victimId === victim.id)
      .map((vs) => ({
        ...vs,
        features: this.voiceFeatures.find((vf) => vf.voiceSessionId === vs.id) || null,
      }))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return {
      ...victim,
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            preferredLanguage: user.preferredLanguage,
            isActive: user.isActive,
          }
        : null,
      assignedCounselor: counselor
        ? {
            id: counselor.id,
            badgeNumber: counselor.badgeNumber,
            name: counselorUser?.name || 'Assigned Counselor',
            specialization: counselor.specialization,
          }
        : null,
      assessments: victimAssessments,
      alerts: victimAlerts,
      followUps: victimFollowUps,
      referrals: victimReferrals,
      checkIns: victimCheckIns,
      conversations: victimConversations,
      clinicalNotes: victimNotes,
      voiceSessions: victimVoiceSessions,
    };
  }

  // Counselor Dashboard Aggregations
  public getCounselorDashboardMetrics(counselorId?: string) {
    const totalVictims = this.victims.length;
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const activeToday = this.victims.filter((v) => {
      if (!v.lastInteractionAt) return false;
      return new Date(v.lastInteractionAt).getTime() >= todayStart;
    }).length;

    const highRiskVictims = this.victims.filter((v) => v.currentRiskLevel === 'HIGH').length;

    const pendingFollowUps = this.followUps.filter((f) => f.status === 'PENDING' || f.status === 'IN_PROGRESS').length;

    const missedCheckIns = this.victims.filter((v) => {
      if (!v.lastCheckInAt) return true;
      const hoursSinceCheckIn = (Date.now() - new Date(v.lastCheckInAt).getTime()) / 3600000;
      return hoursSinceCheckIn > 24;
    }).length;

    const openReferrals = this.referrals.filter((r) => r.status === 'CREATED' || r.status === 'IN_PROGRESS').length;

    // Risk distribution chart data
    const riskDistribution = [
      { name: 'Low Risk (0-24)', count: this.victims.filter((v) => v.currentRiskLevel === 'LOW').length, color: '#10B981' },
      { name: 'Mild Risk (25-49)', count: this.victims.filter((v) => v.currentRiskLevel === 'MILD').length, color: '#3B82F6' },
      { name: 'Elevated (50-74)', count: this.victims.filter((v) => v.currentRiskLevel === 'ELEVATED').length, color: '#F59E0B' },
      { name: 'High Risk (75-100)', count: this.victims.filter((v) => v.currentRiskLevel === 'HIGH').length, color: '#EF4444' },
    ];

    // Compliance / Weekly Trend sample
    const weeklyCompliance = [
      { day: 'Mon', completed: 18, missed: 3 },
      { day: 'Tue', completed: 22, missed: 2 },
      { day: 'Wed', completed: 20, missed: 4 },
      { day: 'Thu', completed: 25, missed: 1 },
      { day: 'Fri', completed: 24, missed: 3 },
      { day: 'Sat', completed: 19, missed: 5 },
      { day: 'Sun', completed: 21, missed: 2 },
    ];

    // Recent High-Risk Alerts
    const recentAlerts = this.alerts
      .map((alt) => {
        const victim = this.victims.find((v) => v.id === alt.victimId);
        const user = victim ? this.users.find((u) => u.id === victim.userId) : null;
        return {
          ...alt,
          victimName: user?.name || alt.victimId,
          victimCode: victim?.victimCode || 'V-????',
          village: victim?.village,
          language: user?.preferredLanguage,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    return {
      metrics: {
        totalVictims,
        activeToday,
        highRiskVictims,
        pendingFollowUps,
        missedCheckIns,
        openReferrals,
      },
      riskDistribution,
      weeklyCompliance,
      recentAlerts,
    };
  }
}

// Global Singleton for database state
export const db = new DatabaseStore();
