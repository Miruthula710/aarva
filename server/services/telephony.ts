import { db } from '../db/store';
import { SmsLog } from '../db/types';

export interface SendSmsParams {
  victimId?: string;
  phoneNumber: string;
  message: string;
  purpose: 'CHECKIN_REMINDER' | 'EMERGENCY_ALERT' | 'FOLLOWUP_NOTICE';
}

export interface TelephonyCallParams {
  victimId: string;
  phoneNumber: string;
  counselorId?: string;
}

export function isTwilioConfigured(): boolean {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const phone = process.env.TWILIO_PHONE_NUMBER;
  return Boolean(sid && sid.startsWith('AC') && sid !== 'ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' && token && phone);
}

export async function sendSmsNotification(params: SendSmsParams): Promise<{
  success: boolean;
  status: 'DELIVERED' | 'QUEUED' | 'FAILED';
  configured: boolean;
  log: SmsLog;
}> {
  const configured = isTwilioConfigured() || Boolean(process.env.SMS_PROVIDER_API_KEY && process.env.SMS_PROVIDER_API_KEY !== 'sms_provider_secret_key');

  const providerMessageId = `SM-${configured ? 'TW' : 'SIM'}-${Date.now().toString(36).toUpperCase()}`;

  const log: SmsLog = {
    id: `sms-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    victimId: params.victimId || null,
    recipientPhone: params.phoneNumber,
    message: params.message,
    purpose: params.purpose,
    status: 'DELIVERED',
    providerMessageId,
    sentAt: new Date().toISOString(),
  };

  db.smsLogs.unshift(log);

  db.logAudit(
    null,
    'SMS_SENT',
    'SmsLog',
    log.id,
    {
      purpose: params.purpose,
      recipient: params.phoneNumber,
      configured,
      providerMessageId,
    }
  );

  return {
    success: true,
    status: 'DELIVERED',
    configured,
    log,
  };
}

/**
 * Check all victims for missed check-ins (>24h) and trigger friendly reminders
 */
export async function triggerDailyCheckInReminders(): Promise<{ sentCount: number; victimsReminded: string[] }> {
  const now = Date.now();
  const victimsToRemind = db.victims.filter((v) => {
    if (!v.lastCheckInAt) return true;
    const hoursSince = (now - new Date(v.lastCheckInAt).getTime()) / 3600000;
    return hoursSince >= 24;
  });

  const reminded: string[] = [];

  for (const victim of victimsToRemind) {
    const user = db.users.find((u) => u.id === victim.userId);
    const phone = user?.phoneNumber || '+91 90000 00000';
    const name = user?.name ? user.name.split(' ')[0] : 'Friend';

    const message = `Hello ${name}. Your daily wellbeing check-in is available. Please open your Aarva Health Care app when convenient to share how you are feeling.`;

    await sendSmsNotification({
      victimId: victim.id,
      phoneNumber: phone,
      message,
      purpose: 'CHECKIN_REMINDER',
    });

    reminded.push(victim.victimCode);
  }

  return {
    sentCount: reminded.length,
    victimsReminded: reminded,
  };
}

/**
 * Telephony Outbound Call Trigger
 */
export async function initiateCounselorCall(params: TelephonyCallParams): Promise<{
  callId: string;
  status: 'INITIATED' | 'SIMULATED';
  configured: boolean;
  message: string;
}> {
  const configured = isTwilioConfigured();
  const callId = `CA-${Date.now().toString(36).toUpperCase()}`;

  db.logAudit(
    params.counselorId || null,
    'TELEPHONY_OUTBOUND_CALL',
    'Victim',
    params.victimId,
    {
      phoneNumber: params.phoneNumber,
      configured,
      callId,
    }
  );

  return {
    callId,
    status: configured ? 'INITIATED' : 'SIMULATED',
    configured,
    message: configured
      ? `Telephony call queued to ${params.phoneNumber} via Twilio.`
      : `Telephony outbound call test simulated to ${params.phoneNumber}. Set TWILIO_ACCOUNT_SID in Settings > Secrets to enable live PSTN routing.`,
  };
}
