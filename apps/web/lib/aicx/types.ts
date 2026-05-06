/**
 * Subset of ACE / AICX tables for API typing (canonical model v1.0).
 */

export type AceAgentRole = 'AGENT' | 'SUPERVISOR' | 'ADMIN';
export type AceAgentStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';

export type AceContactType = 'PATIENT' | 'HOSPITAL' | 'OTHER';
export type AceSyncStatus = 'SYNCED' | 'PENDING' | 'ERROR';

export type AicxCallProvider = 'TWILIO';
export type AicxCallDirection = 'INBOUND' | 'OUTBOUND' | 'UNKNOWN';
export type AicxCallLifecycleStatus =
  | 'INITIATED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'FAILED'
  | 'CALLBACK_CREATED';

/** Documento ACE: reconciliation revisa PENDING + ERROR; mantenemos FAILED por compatibilidad. */
export type AicxCrmSyncStatus = 'PENDING' | 'SENT' | 'CONFIRMED' | 'FAILED' | 'ERROR';

export type AicxCallAuditEvent =
  | 'SESSION_CREATED'
  | 'LOOKUP_DONE'
  | 'TRANSCRIPTION_STARTED'
  | 'SUMMARY_GENERATED'
  | 'DOCUMENT_CREATED'
  | 'CRM_SENT'
  | 'CRM_CONFIRMED'
  | 'CRM_FAILED'
  | 'RETRY_TRIGGERED';

export type AicxOrderStatus =
  | 'PENDING_REVIEW'
  | 'CONFIRMED'
  | 'CORRECTED'
  | 'ESCALATED'
  | 'FAILED';
