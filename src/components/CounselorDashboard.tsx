import React, { useState, useEffect } from 'react';
import {
  Users,
  ShieldAlert,
  Calendar,
  Building2,
  PhoneCall,
  MessageSquare,
  FileText,
  Activity,
  CheckCircle,
  AlertTriangle,
  Download,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Send,
  LogOut,
  ChevronRight,
  Clock,
  Check,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Volume2,
  FileSpreadsheet,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { User, Counselor, Alert, FollowUp, Referral, RiskLevel } from '../types';
import { apiRequest } from '../lib/api';
import { generateVictimPdfReport } from '../lib/reports';

interface CounselorDashboardProps {
  user: User;
  counselor: Counselor;
  onLogout: () => void;
}

type TabType = 'OVERVIEW' | 'BENEFICIARIES' | 'ALERTS' | 'FOLLOWUPS' | 'REFERRALS' | 'AUDIT_LOGS';

export const CounselorDashboard: React.FC<CounselorDashboardProps> = ({
  user,
  counselor,
  onLogout,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('OVERVIEW');
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [victims, setVictims] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const [selectedVictimId, setSelectedVictimId] = useState<string | null>(null);
  const [enrichedVictim, setEnrichedVictim] = useState<any>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState('ALL');
  const [languageFilter, setLanguageFilter] = useState('ALL');

  // Action Modals & Forms
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [isSchedulingFollowUp, setIsSchedulingFollowUp] = useState(false);
  const [newFollowUpDate, setNewFollowUpDate] = useState('');
  const [newFollowUpNotes, setNewFollowUpNotes] = useState('');
  const [isCreatingReferral, setIsCreatingReferral] = useState(false);
  const [newReferralFacility, setNewReferralFacility] = useState('');
  const [newReferralReason, setNewReferralReason] = useState('');

  // Telephony & SMS
  const [telephonyMessage, setTelephonyMessage] = useState<string | null>(null);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [customSmsText, setCustomSmsText] = useState('');

  const loadAllData = async () => {
    try {
      const [dash, vics, alts, flws, refs, facs, logs] = await Promise.all([
        apiRequest('/api/counselor/dashboard'),
        apiRequest('/api/counselor/victims'),
        apiRequest('/api/counselor/alerts'),
        apiRequest('/api/counselor/followups'),
        apiRequest('/api/counselor/referrals'),
        apiRequest('/api/counselor/facilities'),
        apiRequest('/api/counselor/audit-logs'),
      ]);
      setDashboardData(dash);
      setVictims(vics.victims || []);
      setAlerts(alts.alerts || []);
      setFollowUps(flws.followUps || []);
      setReferrals(refs.referrals || []);
      setFacilities(facs.facilities || []);
      setAuditLogs(logs.logs || []);
    } catch (e) {
      console.error('Failed to load counselor data:', e);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const loadEnrichedVictim = async (id: string) => {
    try {
      const data = await apiRequest(`/api/counselor/victims/${id}`);
      setEnrichedVictim(data.victim);
      setSelectedVictimId(id);
    } catch (e) {
      console.error('Failed to load victim detail:', e);
    }
  };

  const handleAlertAction = async (alertId: string, action: 'ACKNOWLEDGE' | 'RESOLVE' | 'ESCALATE', notes?: string) => {
    try {
      await apiRequest(`/api/counselor/alerts/${alertId}/action`, {
        method: 'POST',
        body: JSON.stringify({ action, resolutionNotes: notes }),
      });
      loadAllData();
      if (selectedVictimId) loadEnrichedVictim(selectedVictimId);
    } catch (e) {
      console.error('Alert action error:', e);
    }
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVictimId || !newNoteContent.trim()) return;

    try {
      await apiRequest('/api/counselor/notes', {
        method: 'POST',
        body: JSON.stringify({
          victimId: selectedVictimId,
          content: newNoteContent.trim(),
        }),
      });
      setNewNoteContent('');
      setIsAddingNote(false);
      loadEnrichedVictim(selectedVictimId);
    } catch (e) {
      console.error('Create note error:', e);
    }
  };

  const handleCreateFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVictimId || !newFollowUpDate) return;

    try {
      await apiRequest('/api/counselor/followups', {
        method: 'POST',
        body: JSON.stringify({
          victimId: selectedVictimId,
          dueDate: newFollowUpDate,
          priority: enrichedVictim?.currentRiskLevel || 'MILD',
          notes: newFollowUpNotes.trim(),
        }),
      });
      setNewFollowUpDate('');
      setNewFollowUpNotes('');
      setIsSchedulingFollowUp(false);
      loadAllData();
      loadEnrichedVictim(selectedVictimId);
    } catch (e) {
      console.error('Create followup error:', e);
    }
  };

  const handleCreateReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVictimId || !newReferralFacility || !newReferralReason) return;

    try {
      await apiRequest('/api/counselor/referrals', {
        method: 'POST',
        body: JSON.stringify({
          victimId: selectedVictimId,
          facilityId: newReferralFacility,
          reason: newReferralReason.trim(),
        }),
      });
      setNewReferralFacility('');
      setNewReferralReason('');
      setIsCreatingReferral(false);
      loadAllData();
      loadEnrichedVictim(selectedVictimId);
    } catch (e) {
      console.error('Create referral error:', e);
    }
  };

  const handleInitiateCall = async (victim: any) => {
    try {
      const res = await apiRequest('/api/telephony/call', {
        method: 'POST',
        body: JSON.stringify({
          victimId: victim.id,
          phoneNumber: victim.phoneNumber || victim.user?.phoneNumber || '+91 98401 23456',
        }),
      });
      setTelephonyMessage(res.message);
      setTimeout(() => setTelephonyMessage(null), 7000);
    } catch (e: any) {
      setTelephonyMessage(e.message);
    }
  };

  const handleSendCustomSms = async (victim: any) => {
    if (!customSmsText.trim()) return;
    setIsSendingSms(true);
    try {
      const res = await apiRequest('/api/notifications/sms/send', {
        method: 'POST',
        body: JSON.stringify({
          victimId: victim.id,
          phoneNumber: victim.phoneNumber || victim.user?.phoneNumber || '+91 98401 23456',
          message: customSmsText.trim(),
          purpose: 'FOLLOWUP_NOTICE',
        }),
      });
      setCustomSmsText('');
      setTelephonyMessage(`SMS sent: ${res.log.providerMessageId}`);
      setTimeout(() => setTelephonyMessage(null), 6000);
    } catch (e: any) {
      setTelephonyMessage(e.message);
    } finally {
      setIsSendingSms(false);
    }
  };

  const handleTriggerMissedCheckInReminders = async () => {
    try {
      const res = await apiRequest('/api/notifications/sms/remind-missed', { method: 'POST' });
      setTelephonyMessage(res.message);
      setTimeout(() => setTelephonyMessage(null), 8000);
      loadAllData();
    } catch (e: any) {
      setTelephonyMessage(e.message);
    }
  };

  const handleDownloadPdf = (victimData: any) => {
    generateVictimPdfReport({
      victimCode: victimData.victimCode,
      name: victimData.user?.name || victimData.name || 'Beneficiary',
      age: victimData.age,
      gender: victimData.gender,
      village: victimData.village,
      district: victimData.district,
      preferredLanguage: victimData.user?.preferredLanguage || victimData.preferredLanguage,
      assignedCounselorName: user.name,
      counselorBadge: counselor.badgeNumber,
      assessments: victimData.assessments || [],
      clinicalNotes: victimData.clinicalNotes || [],
      referrals: victimData.referrals || [],
    });
  };

  const filteredVictims = victims.filter((v) => {
    const matchesSearch =
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.victimCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.village && v.village.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesRisk = riskFilter === 'ALL' || v.currentRiskLevel === riskFilter;
    const matchesLang = languageFilter === 'ALL' || v.preferredLanguage === languageFilter;

    return matchesSearch && matchesRisk && matchesLang;
  });

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col">
      {/* Top Banner Notification if telephony dispatched */}
      {telephonyMessage && (
        <div className="px-4 py-2.5 bg-teal-800 text-teal-100 text-xs font-semibold flex items-center justify-between animate-in slide-in-from-top">
          <div className="flex items-center gap-2 max-w-3xl">
            <CheckCircle className="w-4 h-4 text-teal-300 shrink-0" />
            <span>{telephonyMessage}</span>
          </div>
          <button onClick={() => setTelephonyMessage(null)} className="text-teal-300 hover:text-white font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* Main Professional Header */}
      <header className="bg-slate-900 text-white px-6 py-3.5 border-b border-slate-800 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-teal-500/20 text-teal-400 rounded-xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight">Aarva Health Care Clinical Counselor Portal</h1>
            <p className="text-xs text-slate-400">
              District Mental Health & Care Coordination | {counselor.specialization} ({counselor.badgeNumber})
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            id="btn-run-sms-reminders"
            onClick={handleTriggerMissedCheckInReminders}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer transition-colors"
            title="Send automated SMS to missed check-ins"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Run SMS Reminders</span>
          </button>

          <div className="text-right hidden sm:block">
            <span className="text-xs font-bold text-white block">{user.name}</span>
            <span className="text-[10px] text-teal-400 font-medium">{user.role}</span>
          </div>

          <button
            id="btn-counselor-logout"
            onClick={onLogout}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            title="Log out"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Navigation Sub-Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-2 flex items-center justify-between overflow-x-auto shadow-2xs">
        <nav className="flex items-center gap-1 sm:gap-2">
          {[
            { key: 'OVERVIEW', label: 'Dashboard Overview', icon: Activity },
            { key: 'BENEFICIARIES', label: `Beneficiaries (${victims.length})`, icon: Users },
            { key: 'ALERTS', label: `High-Risk Alerts (${alerts.filter((a) => a.status === 'PENDING').length})`, icon: ShieldAlert },
            { key: 'FOLLOWUPS', label: `Follow-Ups (${followUps.filter((f) => f.status === 'PENDING').length})`, icon: Calendar },
            { key: 'REFERRALS', label: `Facility Referrals (${referrals.length})`, icon: Building2 },
            { key: 'AUDIT_LOGS', label: 'Compliance Logs', icon: FileText },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key && !selectedVictimId;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setActiveTab(tab.key as TabType);
                  setSelectedVictimId(null);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <button
          onClick={loadAllData}
          className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors shrink-0 ml-2"
          title="Refresh Data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Main Work Area */}
      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* VIEW 1: ENRICHED PATIENT DOSSIER VIEW (When selected) */}
        {selectedVictimId && enrichedVictim ? (
          <div className="space-y-6 animate-in fade-in">
            {/* Top Navigation Back */}
            <div className="flex items-center justify-between">
              <button
                id="btn-back-to-directory"
                onClick={() => setSelectedVictimId(null)}
                className="flex items-center gap-1.5 text-xs font-bold text-teal-800 hover:text-teal-900 cursor-pointer"
              >
                ← Back to Beneficiaries Directory
              </button>

              <div className="flex items-center gap-2">
                <button
                  id="btn-call-victim"
                  onClick={() => handleInitiateCall(enrichedVictim)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Initiate Telephony Call</span>
                </button>

                <button
                  id="btn-download-pdf-dossier"
                  onClick={() => handleDownloadPdf(enrichedVictim)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-teal-400" />
                  <span>Download PDF Dossier</span>
                </button>
              </div>
            </div>

            {/* Header Demographic Dossier Card */}
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-black text-slate-900">
                      {enrichedVictim.user?.name || 'Beneficiary'}
                    </h2>
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-800 text-xs font-bold rounded-md font-mono">
                      {enrichedVictim.victimCode}
                    </span>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-black ${
                        enrichedVictim.currentRiskLevel === 'HIGH'
                          ? 'bg-red-100 text-red-800'
                          : enrichedVictim.currentRiskLevel === 'ELEVATED'
                          ? 'bg-amber-100 text-amber-800'
                          : enrichedVictim.currentRiskLevel === 'MILD'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {enrichedVictim.currentRiskLevel} RISK ({enrichedVictim.currentDistressScore}/100)
                    </span>
                  </div>

                  <p className="text-xs text-slate-500">
                    Location: {enrichedVictim.village}, {enrichedVictim.district}, {enrichedVictim.state} | Preferred Language: {enrichedVictim.user?.preferredLanguage} | Age: {enrichedVictim.age || 'N/A'} yrs ({enrichedVictim.gender || 'N/A'})
                  </p>
                </div>

                <div className="text-right text-xs space-y-0.5">
                  <span className="text-slate-500 block">Mobile: {enrichedVictim.user?.phoneNumber || 'N/A'}</span>
                  <span className="text-slate-500 block">Emergency Contact: {enrichedVictim.emergencyContactName} ({enrichedVictim.emergencyContactPhone})</span>
                </div>
              </div>
            </div>

            {/* Grid: Distress Trend & Vocal Acoustics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Distress History & Assessment Summaries */}
              <div className="lg:col-span-2 space-y-6">
                {/* Distress Trend Line Chart */}
                <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-teal-600" />
                    <span>Distress Score Trajectory (Recent Evaluations)</span>
                  </h3>

                  <div className="h-56 w-full pt-2">
                    {enrichedVictim.assessments && enrichedVictim.assessments.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={[...enrichedVictim.assessments].reverse()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                          <XAxis
                            dataKey="createdAt"
                            tickFormatter={(v) => new Date(v).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            tick={{ fontSize: 10, fill: '#64748B' }}
                          />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748B' }} />
                          <Tooltip
                            formatter={(value: any) => [`${value} / 100`, 'Distress Score']}
                            labelFormatter={(l: any) => new Date(l).toLocaleString()}
                          />
                          <Line
                            type="monotone"
                            dataKey="score"
                            stroke="#0D9488"
                            strokeWidth={3}
                            dot={{ fill: '#0D9488', r: 5 }}
                            activeDot={{ r: 8 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400 italic">
                        No historical distress assessments recorded yet.
                      </div>
                    )}
                  </div>
                </div>

                {/* Latest Clinical Assessment Breakdown */}
                {enrichedVictim.assessments && enrichedVictim.assessments[0] && (
                  <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Latest Assessment Detail ({new Date(enrichedVictim.assessments[0].createdAt).toLocaleDateString()})
                      </h4>
                      <span className="text-xs text-slate-500 font-mono">
                        Trend: {enrichedVictim.assessments[0].trend} | Confidence: {enrichedVictim.assessments[0].confidence}
                      </span>
                    </div>

                    <p className="text-sm font-medium text-slate-800 bg-slate-50 p-3.5 rounded-2xl border border-slate-100 leading-relaxed">
                      {enrichedVictim.assessments[0].reason}
                    </p>

                    <div className="space-y-1.5 pt-1">
                      <span className="text-xs font-bold text-slate-500">Contributing Distress Signals:</span>
                      <div className="flex flex-wrap gap-2">
                        {enrichedVictim.assessments[0].contributingFactors.map((f: string, i: number) => (
                          <span key={i} className="px-2.5 py-1 bg-teal-50 text-teal-800 text-xs font-medium rounded-lg border border-teal-200">
                            • {f}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Clinical Notes Observation Log */}
                <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-teal-600" />
                      <span>Professional Clinical Notes ({enrichedVictim.clinicalNotes?.length || 0})</span>
                    </h3>
                    <button
                      onClick={() => setIsAddingNote(!isAddingNote)}
                      className="flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-800 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add Note</span>
                    </button>
                  </div>

                  {isAddingNote && (
                    <form onSubmit={handleCreateNote} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                      <textarea
                        required
                        rows={3}
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                        placeholder="Enter clinical observations, coping mechanisms, or care plan..."
                        className="w-full p-3 text-xs bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600"
                      />
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingNote(false)}
                          className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-4 py-1.5 bg-teal-700 text-white text-xs font-bold rounded-lg shadow-xs cursor-pointer"
                        >
                          Save Clinical Note
                        </button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-3 max-h-60 overflow-y-auto">
                    {enrichedVictim.clinicalNotes && enrichedVictim.clinicalNotes.length > 0 ? (
                      enrichedVictim.clinicalNotes.map((note: any) => (
                        <div key={note.id} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>Clinical Observation</span>
                            <span>{new Date(note.createdAt).toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-slate-800 font-medium leading-relaxed">{note.content}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic">No clinical notes recorded yet.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Col: Vocal Acoustic Signals, Direct SMS & Referrals */}
              <div className="space-y-6">
                {/* Vocal Acoustic Signals */}
                <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-teal-600" />
                    <span>Voice Acoustic Signals</span>
                  </h3>

                  {enrichedVictim.voiceSessions && enrichedVictim.voiceSessions[0]?.features ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-600">Acoustic Signal Risk:</span>
                        <span
                          className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                            enrichedVictim.voiceSessions[0].features.acousticSignal === 'HIGH'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {enrichedVictim.voiceSessions[0].features.acousticSignal}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs text-center">
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">Speech Rate</span>
                          <span className="font-bold text-slate-800">{enrichedVictim.voiceSessions[0].features.speechRate} WPM</span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">Pauses / min</span>
                          <span className="font-bold text-slate-800">{enrichedVictim.voiceSessions[0].features.pauseFrequency}</span>
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-400 italic">
                        * Non-diagnostic supplementary wellbeing indicator.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No voice sessions recorded yet.</p>
                  )}
                </div>

                {/* Direct Custom SMS Follow-up Dispatch */}
                <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-2">
                    <Send className="w-4 h-4 text-teal-600" />
                    <span>Send Supportive SMS Notice</span>
                  </h3>

                  <div className="space-y-2">
                    <textarea
                      rows={2}
                      value={customSmsText}
                      onChange={(e) => setCustomSmsText(e.target.value)}
                      placeholder="Type brief check-in or appointment reminder message..."
                      className="w-full p-2.5 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-600"
                    />
                    <button
                      onClick={() => handleSendCustomSms(enrichedVictim)}
                      disabled={!customSmsText.trim() || isSendingSms}
                      className="w-full py-2 bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                    >
                      {isSendingSms ? 'Dispatching...' : 'Send SMS to Beneficiary'}
                    </button>
                  </div>
                </div>

                {/* Schedule Follow-Up & Referrals Action Panel */}
                <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">Care Coordination</h3>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsSchedulingFollowUp(!isSchedulingFollowUp)}
                        className="text-[11px] font-bold text-teal-700 hover:underline cursor-pointer"
                      >
                        + Follow-up
                      </button>
                      <button
                        onClick={() => setIsCreatingReferral(!isCreatingReferral)}
                        className="text-[11px] font-bold text-indigo-700 hover:underline cursor-pointer"
                      >
                        + Referral
                      </button>
                    </div>
                  </div>

                  {/* Follow-up form */}
                  {isSchedulingFollowUp && (
                    <form onSubmit={handleCreateFollowUp} className="p-3 bg-teal-50/70 rounded-2xl border border-teal-200 space-y-2 text-xs">
                      <label className="font-bold text-slate-700 block">Due Date & Time</label>
                      <input
                        type="datetime-local"
                        required
                        value={newFollowUpDate}
                        onChange={(e) => setNewFollowUpDate(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Notes on follow-up goal..."
                        value={newFollowUpNotes}
                        onChange={(e) => setNewFollowUpNotes(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                      <button type="submit" className="w-full py-1.5 bg-teal-700 text-white font-bold rounded-lg cursor-pointer">
                        Schedule Follow-Up
                      </button>
                    </form>
                  )}

                  {/* Referral form */}
                  {isCreatingReferral && (
                    <form onSubmit={handleCreateReferral} className="p-3 bg-indigo-50/70 rounded-2xl border border-indigo-200 space-y-2 text-xs">
                      <label className="font-bold text-slate-700 block">Healthcare Facility</label>
                      <select
                        required
                        value={newReferralFacility}
                        onChange={(e) => setNewReferralFacility(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                      >
                        <option value="">Select Facility...</option>
                        {facilities.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name} ({f.type})
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        required
                        placeholder="Clinical Referral Reason..."
                        value={newReferralReason}
                        onChange={(e) => setNewReferralReason(e.target.value)}
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                      <button type="submit" className="w-full py-1.5 bg-indigo-700 text-white font-bold rounded-lg cursor-pointer">
                        Create Referral
                      </button>
                    </form>
                  )}

                  <div className="space-y-2 text-xs">
                    <span className="text-[11px] font-bold text-slate-400 uppercase block">Active Referrals:</span>
                    {enrichedVictim.referrals && enrichedVictim.referrals.length > 0 ? (
                      enrichedVictim.referrals.map((r: any) => (
                        <div key={r.id} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="font-bold text-slate-900 block">{r.facility?.name || 'PHC Centre'}</span>
                          <span className="text-slate-500 text-[11px]">Reason: {r.reason} ({r.status})</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-400 italic">No facility referrals recorded.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : activeTab === 'OVERVIEW' ? (
          /* VIEW 2: DASHBOARD OVERVIEW */
          <div className="space-y-6">
            {/* Top 6 KPI Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {[
                { label: 'Total Beneficiaries', value: dashboardData?.metrics?.totalVictims || 0, color: 'border-slate-300' },
                { label: 'Active Today', value: dashboardData?.metrics?.activeToday || 0, color: 'border-emerald-400 text-emerald-700' },
                { label: 'High-Risk Distress', value: dashboardData?.metrics?.highRiskVictims || 0, color: 'border-red-400 text-red-700' },
                { label: 'Missed Check-ins (>24h)', value: dashboardData?.metrics?.missedCheckIns || 0, color: 'border-amber-400 text-amber-700' },
                { label: 'Pending Follow-ups', value: dashboardData?.metrics?.pendingFollowUps || 0, color: 'border-indigo-400 text-indigo-700' },
                { label: 'Open Referrals', value: dashboardData?.metrics?.openReferrals || 0, color: 'border-teal-400 text-teal-700' },
              ].map((kpi, idx) => (
                <div key={idx} className={`p-4 bg-white rounded-2xl border ${kpi.color} shadow-2xs space-y-1`}>
                  <span className="text-[11px] font-bold text-slate-500 uppercase block tracking-wider leading-tight">
                    {kpi.label}
                  </span>
                  <p className="text-2xl font-black">{kpi.value}</p>
                </div>
              ))}
            </div>

            {/* Charts Row: Risk Distribution & Compliance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Risk Distribution Bar Chart */}
              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-600" />
                  <span>District Risk Distribution</span>
                </h3>

                <div className="h-60 w-full pt-2">
                  {dashboardData?.riskDistribution ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData.riskDistribution}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748B' }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748B' }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#0D9488" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : null}
                </div>
              </div>

              {/* Weekly Check-in Compliance Trend */}
              <div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-teal-600" />
                  <span>Weekly Check-in Completion Trend</span>
                </h3>

                <div className="h-60 w-full pt-2">
                  {dashboardData?.weeklyCompliance ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData.weeklyCompliance}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#64748B' }} />
                        <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                        <Tooltip />
                        <Bar dataKey="completed" name="Completed" fill="#10B981" stackId="a" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="missed" name="Missed" fill="#F59E0B" stackId="a" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : null}
                </div>
              </div>
            </div>

            {/* High-Risk Alerts Quick Triage Feed */}
            <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-red-600" />
                  <h3 className="text-sm font-bold text-slate-900">Priority Clinical Triage Alerts</h3>
                </div>
                <button
                  onClick={() => setActiveTab('ALERTS')}
                  className="text-xs font-bold text-teal-700 hover:underline cursor-pointer"
                >
                  View All Alerts ({alerts.length}) →
                </button>
              </div>

              <div className="space-y-3">
                {alerts.slice(0, 4).map((alt) => (
                  <div
                    key={alt.id}
                    className="p-4 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-3 transition-colors"
                  >
                    <div className="space-y-1 max-w-xl">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-black rounded-md">
                          {alt.priority} PRIORITY
                        </span>
                        <span className="text-xs font-bold text-slate-900">{alt.title}</span>
                        <span className="text-[10px] text-slate-500">
                          {new Date(alt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600">
                        {alt.recommendedAction}
                      </p>
                      {alt.location && (
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-700 pt-0.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span>Location: {alt.location.address || `${alt.location.village}, ${alt.location.district}`}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => loadEnrichedVictim(alt.victimId)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg cursor-pointer"
                      >
                        Review Profile
                      </button>
                      {alt.status === 'PENDING' && (
                        <button
                          onClick={() => handleAlertAction(alt.id, 'ACKNOWLEDGE')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'BENEFICIARIES' ? (
          /* VIEW 3: BENEFICIARIES DIRECTORY */
          <div className="space-y-4">
            {/* Search & Filters */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, beneficiary code, or village..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                >
                  <option value="ALL">All Risk Levels</option>
                  <option value="LOW">Low Risk</option>
                  <option value="MILD">Mild Risk</option>
                  <option value="ELEVATED">Elevated Risk</option>
                  <option value="HIGH">High Risk</option>
                </select>

                <select
                  value={languageFilter}
                  onChange={(e) => setLanguageFilter(e.target.value)}
                  className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2"
                >
                  <option value="ALL">All Languages</option>
                  <option value="TAMIL">Tamil</option>
                  <option value="HINDI">Hindi</option>
                  <option value="TELUGU">Telugu</option>
                  <option value="MALAYALAM">Malayalam</option>
                  <option value="KANNADA">Kannada</option>
                  <option value="ENGLISH">English</option>
                </select>
              </div>
            </div>

            {/* Beneficiary Table */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-4">Beneficiary</th>
                      <th className="p-4">Location</th>
                      <th className="p-4">Distress Score</th>
                      <th className="p-4">Last Check-in</th>
                      <th className="p-4">Pending Alerts</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredVictims.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-slate-900">{v.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{v.victimCode} • {v.preferredLanguage}</div>
                        </td>
                        <td className="p-4 text-slate-600">
                          {v.village || 'N/A'}, {v.district}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2.5 py-1 rounded-full text-[11px] font-black ${
                              v.currentRiskLevel === 'HIGH'
                                ? 'bg-red-100 text-red-800'
                                : v.currentRiskLevel === 'ELEVATED'
                                ? 'bg-amber-100 text-amber-800'
                                : v.currentRiskLevel === 'MILD'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {v.currentDistressScore}/100 ({v.currentRiskLevel})
                          </span>
                        </td>
                        <td className="p-4 text-slate-500">
                          {v.lastCheckInAt
                            ? new Date(v.lastCheckInAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : 'Missed (>24h)'}
                        </td>
                        <td className="p-4">
                          {v.pendingAlertsCount > 0 ? (
                            <span className="px-2 py-0.5 bg-red-100 text-red-800 font-bold rounded-md">
                              {v.pendingAlertsCount} Alert(s)
                            </span>
                          ) : (
                            <span className="text-slate-400">None</span>
                          )}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => loadEnrichedVictim(v.id)}
                            className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg cursor-pointer"
                          >
                            Dossier
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : activeTab === 'ALERTS' ? (
          /* VIEW 4: ALERTS TRIAGE */
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Emergency Escalation & Distress Spike Alerts
            </h2>

            <div className="space-y-3">
              {alerts.map((alt) => (
                <div
                  key={alt.id}
                  className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-red-100 text-red-800 text-xs font-black rounded-full">
                          {alt.priority}
                        </span>
                        <h3 className="text-base font-bold text-slate-900">{alt.title}</h3>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-mono rounded">
                          {alt.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Beneficiary: <strong>{alt.victimName}</strong> ({alt.victimCode}) • Location: {alt.victimVillage} • Language: {alt.preferredLanguage}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {alt.status === 'PENDING' && (
                        <button
                          onClick={() => handleAlertAction(alt.id, 'ACKNOWLEDGE')}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl cursor-pointer"
                        >
                          Acknowledge
                        </button>
                      )}
                      {alt.status !== 'RESOLVED' && (
                        <button
                          onClick={() => handleAlertAction(alt.id, 'RESOLVE', 'Followed up via supportive check-in call.')}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-xl cursor-pointer"
                        >
                          Resolve Alert
                        </button>
                      )}
                      <button
                        onClick={() => loadEnrichedVictim(alt.victimId)}
                        className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl cursor-pointer"
                      >
                        Open Dossier
                      </button>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-700 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900">Recommended Clinical Action:</div>
                      {alt.dangerDetails?.threatDetected && (
                        <span className="px-2 py-0.5 bg-red-600 text-white font-bold text-[10px] rounded-md tracking-wider">
                          THREAT DETECTED • PATIENT AUTHORIZED DISPATCH
                        </span>
                      )}
                    </div>
                    <p>{alt.recommendedAction}</p>

                    {alt.location && (
                      <div className="pt-2 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-slate-800">
                        <div className="flex items-center gap-1.5 font-medium">
                          <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                          <span>
                            <strong>Shared Location:</strong> {alt.location.address || `${alt.location.village}, ${alt.location.district}`}
                            {alt.location.latitude && (
                              <span className="text-slate-500 font-mono text-[11px] ml-1.5">
                                ({alt.location.latitude.toFixed(4)}, {alt.location.longitude.toFixed(4)})
                              </span>
                            )}
                          </span>
                        </div>

                        {alt.location.mapsUrl && (
                          <a
                            href={alt.location.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-[11px] rounded-lg border border-red-200 transition-colors"
                          >
                            <span>Open in Google Maps</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'FOLLOWUPS' ? (
          /* VIEW 5: FOLLOW-UPS */
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Scheduled Care Follow-Ups</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {followUps.map((flw) => (
                <div key={flw.id} className="p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-900">{flw.victimName} ({flw.victimCode})</span>
                      <p className="text-[11px] text-slate-500">
                        Due: {new Date(flw.dueDate).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                        flw.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : flw.isOverdue
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {flw.isOverdue && flw.status === 'PENDING' ? 'OVERDUE' : flw.status}
                    </span>
                  </div>

                  {flw.notes && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">{flw.notes}</p>
                  )}

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => loadEnrichedVictim(flw.victimId)}
                      className="px-3 py-1 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg"
                    >
                      View
                    </button>
                    {flw.status === 'PENDING' && (
                      <button
                        onClick={async () => {
                          await apiRequest(`/api/counselor/followups/${flw.id}`, {
                            method: 'PATCH',
                            body: JSON.stringify({ status: 'COMPLETED', outcomeNotes: 'Call completed successfully.' }),
                          });
                          loadAllData();
                        }}
                        className="px-3 py-1 bg-emerald-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                      >
                        Mark Completed
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'REFERRALS' ? (
          /* VIEW 6: REFERRALS */
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Healthcare Facility Referrals (PHC / CHC / District Hospitals)</h2>
            <div className="space-y-3">
              {referrals.map((r) => (
                <div key={r.id} className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-xs">{r.facilityName} ({r.facilityType})</span>
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded">
                        {r.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Beneficiary: <strong>{r.victimName}</strong> ({r.victimCode}) • Clinical Reason: {r.reason}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => loadEnrichedVictim(r.victimId)}
                      className="px-3 py-1.5 bg-slate-900 text-white text-xs font-bold rounded-lg"
                    >
                      Patient Dossier
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* VIEW 7: AUDIT LOGS */
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-3 p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Immutable Compliance & Clinical Audit Trail</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Resource</th>
                    <th className="p-3">User</th>
                    <th className="p-3">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="p-3 text-slate-500">{new Date(log.createdAt).toLocaleString()}</td>
                      <td className="p-3 font-bold text-teal-800">{log.action}</td>
                      <td className="p-3 text-slate-600">{log.resourceType} ({log.resourceId || 'N/A'})</td>
                      <td className="p-3 text-slate-700">{log.userName}</td>
                      <td className="p-3 text-slate-400 font-mono text-[10px]">{log.ipAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
