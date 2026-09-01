export type Role = 'VICTIM' | 'COUNSELOR' | 'ADMIN';
export type RiskLevel = 'LOW' | 'MILD' | 'ELEVATED' | 'HIGH';
export type AlertStatus = 'PENDING' | 'ACKNOWLEDGED' | 'REVIEWING' | 'RESOLVED' | 'ESCALATED';
export type FollowUpStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'RESCHEDULED' | 'MISSED';
export type ReferralStatus = 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type Language = 'ENGLISH' | 'TAMIL' | 'HINDI' | 'TELUGU' | 'MALAYALAM' | 'KANNADA';

export interface User {
  id: string;
  email?: string | null;
  phoneNumber?: string | null;
  name: string;
  role: Role;
  preferredLanguage: Language;
  isActive: boolean;
}

export interface Victim {
  id: string;
  userId: string;
  victimCode: string;
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
  name?: string;
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
}

export interface DistressAssessment {
  id: string;
  victimId: string;
  checkInId?: string | null;
  score: number;
  previousScore?: number | null;
  trend: 'INCREASING' | 'STABLE' | 'DECREASING';
  riskLevel: RiskLevel;
  confidence: 'Low' | 'Moderate' | 'High';
  reason: string;
  contributingFactors: string[];
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
  victimName?: string;
  victimCode?: string;
  victimPhone?: string;
  victimVillage?: string;
  victimDistrict?: string;
  preferredLanguage?: Language;
  counselorName?: string;
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

export interface FollowUp {
  id: string;
  victimId: string;
  counselorId: string;
  victimName?: string;
  victimCode?: string;
  victimPhone?: string;
  counselorName?: string;
  dueDate: string;
  status: FollowUpStatus;
  priority: RiskLevel;
  notes?: string | null;
  outcomeNotes?: string | null;
  completedAt?: string | null;
  isOverdue?: boolean;
}

export interface Referral {
  id: string;
  victimId: string;
  counselorId: string;
  facilityId: string;
  victimName?: string;
  victimCode?: string;
  facilityName?: string;
  facilityType?: string;
  facilityPhone?: string | null;
  reason: string;
  status: ReferralStatus;
  notes?: string | null;
  appointmentDate?: string | null;
  completedAt?: string | null;
  createdAt: string;
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

export interface VoiceFeature {
  id: string;
  voiceSessionId: string;
  speechRate?: number | null;
  pauseFrequency?: number | null;
  pitchVariation?: number | null;
  energyLevel?: number | null;
  voiceStability?: number | null;
  acousticSignal: RiskLevel;
}

export interface EmergencyHotline {
  name: string;
  number: string;
  description: string;
  tollFree: boolean;
}

export interface OfflineSyncItem {
  id: string;
  type: 'OFFLINE_CHECKIN' | 'OFFLINE_SOS';
  timestamp: string;
  payload: any;
}
