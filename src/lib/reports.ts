import jsPDF from 'jspdf';
import { DistressAssessment, RiskLevel } from '../types';

export interface ReportVictimContext {
  victimCode: string;
  name: string;
  age?: number | null;
  gender?: string | null;
  village?: string | null;
  district?: string | null;
  preferredLanguage?: string;
  assignedCounselorName?: string;
  counselorBadge?: string;
  assessments: DistressAssessment[];
  clinicalNotes?: { content: string; createdAt: string }[];
  referrals?: { facilityName?: string; reason: string; status: string }[];
}

export function generateVictimPdfReport(context: ReportVictimContext) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('GRAMIN CARE - CLINICAL DISTRESS & TRIAGE REPORT', 14, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text('District Mental Health Support & Care-Coordination System', 14, 21);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN', { dateStyle: 'full' })}`, pageWidth - 80, 21);

  // Patient Demographic Section
  let y = 38;
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1. Beneficiary Demographics & Dossier', 14, y);

  y += 6;
  doc.setDrawColor(226, 232, 240);
  doc.line(14, y, pageWidth - 14, y);

  y += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);

  doc.text(`Beneficiary Code: ${context.victimCode}`, 14, y);
  doc.text(`Full Name: ${context.name}`, 80, y);
  doc.text(`Age / Gender: ${context.age || 'N/A'} yrs / ${context.gender || 'N/A'}`, 140, y);

  y += 6;
  doc.text(`Location: ${context.village || 'N/A'}, ${context.district || 'N/A'}`, 14, y);
  doc.text(`Preferred Language: ${context.preferredLanguage || 'English'}`, 80, y);
  doc.text(`Assigned Counselor: ${context.assignedCounselorName || 'Unassigned'}`, 140, y);

  // Latest Assessment & Risk Status
  y += 14;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('2. Current Wellbeing & Distress Risk Status', 14, y);

  y += 6;
  doc.line(14, y, pageWidth - 14, y);

  y += 8;
  const latest = context.assessments[0];
  if (latest) {
    // Risk badge color
    const isHigh = latest.riskLevel === 'HIGH';
    const isElev = latest.riskLevel === 'ELEVATED';

    if (isHigh) doc.setFillColor(254, 226, 226); // red-100
    else if (isElev) doc.setFillColor(254, 243, 199); // amber-100
    else doc.setFillColor(209, 250, 229); // emerald-100

    doc.roundedRect(14, y - 4, pageWidth - 28, 22, 2, 2, 'F');

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    if (isHigh) doc.setTextColor(185, 28, 28);
    else if (isElev) doc.setTextColor(180, 83, 9);
    else doc.setTextColor(4, 120, 87);

    doc.text(`Current Distress Score: ${latest.score} / 100 (${latest.riskLevel} RISK CATEGORY)`, 20, y + 4);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Assessment Date: ${new Date(latest.createdAt).toLocaleString()} | Trend: ${latest.trend} (Baseline: ${latest.previousScore || 'N/A'}) | Confidence: ${latest.confidence}`, 20, y + 11);

    y += 26;
    doc.setTextColor(51, 65, 85);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('Clinical Triage Summary:', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    const splitReason = doc.splitTextToSize(latest.reason || 'Routine supportive check-in.', pageWidth - 28);
    doc.text(splitReason, 14, y);
    y += splitReason.length * 5 + 4;

    doc.setFont('helvetica', 'bold');
    doc.text('Key Contributing Distress Signals:', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    latest.contributingFactors.forEach((factor) => {
      doc.text(`•  ${factor}`, 18, y);
      y += 5;
    });
  } else {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'italic');
    doc.text('No completed distress assessment on record.', 14, y + 5);
    y += 12;
  }

  // Clinical Notes & Referrals
  y += 8;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('3. Healthcare Coordination & Professional Notes', 14, y);
  y += 6;
  doc.line(14, y, pageWidth - 14, y);

  y += 8;
  doc.setFontSize(10);
  if (context.clinicalNotes && context.clinicalNotes.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('Recent Professional Observations:', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    context.clinicalNotes.slice(0, 2).forEach((n) => {
      const splitNote = doc.splitTextToSize(`[${new Date(n.createdAt).toLocaleDateString()}]: ${n.content}`, pageWidth - 28);
      doc.text(splitNote, 14, y);
      y += splitNote.length * 5 + 2;
    });
  }

  if (context.referrals && context.referrals.length > 0) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text('Healthcare Facility Referrals:', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    context.referrals.forEach((r) => {
      doc.text(`•  Facility: ${r.facilityName || 'PHC'} | Status: ${r.status} | Reason: ${r.reason}`, 18, y);
      y += 5;
    });
  }

  // Mandatory Safety & Regulatory Disclaimer
  y = Math.max(y + 10, 260);
  doc.setDrawColor(203, 213, 225);
  doc.line(14, y, pageWidth - 14, y);
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'italic');
  doc.text('Confidentiality Notice: This document contains sensitive healthcare & mental wellbeing coordination information.', 14, y);
  doc.text('The Aarva Health Care platform is a digital support and triage system, not an autonomous medical diagnosis instrument.', 14, y + 4);

  // Save / Download PDF
  doc.save(`AarvaHealthCare_Report_${context.victimCode}_${new Date().toISOString().split('T')[0]}.pdf`);
}
