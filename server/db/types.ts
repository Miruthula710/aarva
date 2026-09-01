// Database Domain Types matching Prisma Schema

export type Role = 'VICTIM' | 'COUNSELOR' | 'ADMIN';
export type RiskLevel = 'LOW' | 'MILD' | 'ELEVATED' | 'HIGH';
export type AlertStatus = 'PENDING' | 'ACKNOWLEDGED' | 'REVIEWING' | 'RESOLVED' | 'ESCALATED';
export type FollowUpStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'RESCHEDULED' | 'MISSED';
export type ReferralStatus = 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type SmsDeliveryStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED';
export type Language = 'ENGLISH' | 'TAMIL' | 'HINDI' | 'TELUGU' | 'MALAYALAM' | 'KANNADA';

export interface User {
  id: string;
  email?: string | null;
  phoneNumber?: string | null;
  passwordHash: string;
  role: Role;
  name: string;
  preferredLanguage: Language;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface Victim {
  id: string;
  userId: string;
  victimCode: string; // V-1001
  age?: number | null;
  gender?: string | null;
  village?: string | null;
  district?: string | null;
  state?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  assignedCounselorId?: string | null;
  currentDistressScore: number;
  currentRiskLevel: RiskLevel;
  lastCheckInAt?: string | null;
  lastInteractionAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Counselor {
  id: string;
  userId: string;
  badgeNumber: string;
  specialization: string;
  facilityId?: string | null;
  assignedDistrict?: string | null;
  isAvailable: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Facility {
  id: string;
  name: string;
  type: string;
  district: string;
  state: string;
  contactPhone?: string | null;
  address?: string | null;
  hasPsychiatrist: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Question {
  id: string;
  code: string;
  category: 'mood' | 'sleep' | 'stress' | 'social' | 'functioning' | 'safety';
  promptEnglish: string;
  promptTamil: string;
  promptHindi: string;
  promptTelugu: string;
  promptMalayalam: string;
  promptKannada: string;
  weight: number;
  createdAt: string;
}

export interface DailyCheckIn {
  id: string;
  victimId: string;
  checkInDate: string;
  isCompleted: boolean;
  completionSource: 'WEB_APP' | 'PWA_OFFLINE_SYNC' | 'TELEPHONY';
  distressScore: number;
  riskLevel: RiskLevel;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Response {
  id: string;
  checkInId: string;
  questionId: string;
  rawAnswer: string;
  numericValue?: number | null; // 0-10
  sentiment?: string | null;
  createdAt: string;
}

export interface QuestionHistory {
  id: string;
  victimId: string;
  questionId: string;
  askedAt: string;
}

export interface Conversation {
  id: string;
  victimId: string;
  title: string;
  language: Language;
  isArchived: boolean;
  summary?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  sender: 'USER' | 'AI' | 'COUNSELOR';
  content: string;
  language: Language;
  distressScore?: number | null;
  safetyFlag: boolean;
  createdAt: string;
}

export interface VoiceSession {
  id: string;
  victimId: string;
  durationSec: number;
  language: Language;
  audioUri?: string | null;
  transcript?: string | null;
  summary?: string | null;
  createdAt: string;
}

export interface VoiceFeature {
  id: string;
  voiceSessionId: string;
  speechRate?: number | null; // WPM
  pauseFrequency?: number | null;
  pitchVariation?: number | null;
  energyLevel?: number | null;
  voiceStability?: number | null;
  acousticSignal: RiskLevel;
  createdAt: string;
}

export interface DistressAssessment {
  id: string;
  victimId: string;
  checkInId?: string | null;
  score: number; // 0 - 100
  previousScore?: number | null;
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
  riskLevel: RiskLevel;
  confidence: 'Low' | 'Moderate' | 'High';
  reason: string;
  contributingFactors: string[];
  createdAt: string;
}

export interface RiskEvent {
  id: string;
  victimId: string;
  severity: RiskLevel;
  eventType: string;
  description: string;
  isResolved: boolean;
  createdAt: string;
}

export interface AlertLocation {
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  village?: string;
  district?: string;
  state?: string;
  address?: string;
  mapsUrl?: string;
}

export interface Alert {
  id: string;
  victimId: string;
  riskEventId?: string | null;
  assessmentId?: string | null;
  counselorId?: string | null;
  priority: RiskLevel;
  status: AlertStatus;
  title: string;
  currentScore: number;
  previousScore?: number | null;
  trend: string;
  signals: string[];
  recommendedAction: string;
  location?: AlertLocation | null;
  dangerDetails?: {
    threatDetected: boolean;
    keywordsMatched?: string[];
    patientApprovedDispatch: boolean;
    timestamp?: string;
  } | null;
  acknowledgedAt?: string | null;
  resolvedAt?: string | null;
  resolutionNotes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CounselorAssignment {
  id: string;
  victimId: string;
  counselorId: string;
  assignedAt: string;
  isActive: boolean;
  notes?: string | null;
}

export interface FollowUp {
  id: string;
  victimId: string;
  counselorId: string;
  dueDate: string;
  status: FollowUpStatus;
  priority: RiskLevel;
  notes?: string | null;
  outcomeNotes?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Referral {
  id: string;
  victimId: string;
  counselorId: string;
  facilityId: string;
  reason: string;
  status: ReferralStatus;
  notes?: string | null;
  appointmentDate?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  victimId: string;
  scheduledDate: string;
  type: string;
  notes?: string | null;
  isCompleted: boolean;
  createdAt: string;
}

export interface ClinicalNote {
  id: string;
  counselorId: string;
  victimId: string;
  content: string;
  isPrivate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'ALERT' | 'REMINDER' | 'SYSTEM';
  isRead: boolean;
  createdAt: string;
}

export interface SmsLog {
  id: string;
  victimId?: string | null;
  recipientPhone: string;
  message: string;
  purpose: string;
  status: SmsDeliveryStatus;
  providerMessageId?: string | null;
  sentAt: string;
}

export interface AuditLog {
  id: string;
  userId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
}

export interface AdminConfig {
  id: string;
  distressThresholdLow: number;
  distressThresholdMild: number;
  distressThresholdElev: number;
  distressThresholdHigh: number;
  dailyReminderHourUtc: number;
  twilioEnabled: boolean;
  smsGatewayEnabled: boolean;
  autoEscalateHighRisk: boolean;
  emergencyHotlines: {
    name: string;
    number: string;
    description: string;
    tollFree: boolean;
  }[];
  updatedAt: string;
}
