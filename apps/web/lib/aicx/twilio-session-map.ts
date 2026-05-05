/**
 * Maps Twilio Voice status callbacks into AICX_CALL_SESSION domain values.
 * Aligned with AI Contact Experience data model (phase 6 — call lifecycle).
 */

export type TwilioDirection = 'inbound' | 'outbound' | 'unknown';

export type AicxCallDirection = 'INBOUND' | 'OUTBOUND' | 'UNKNOWN';

export type AicxCallLifecycleStatus =
  | 'INITIATED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'FAILED'
  | 'CALLBACK_CREATED';

export function mapTwilioDirection(dir: TwilioDirection): AicxCallDirection {
  if (dir === 'inbound') return 'INBOUND';
  if (dir === 'outbound') return 'OUTBOUND';
  return 'UNKNOWN';
}

/** Twilio CallStatus values on completed callback — https://www.twilio.com/docs/voice/api/call-resource#call-status-values */
export function mapTwilioCallStatusToLifecycle(callStatus: string): AicxCallLifecycleStatus {
  const s = (callStatus || '').toLowerCase().trim();
  if (s === 'completed') return 'COMPLETED';
  if (
    s === 'failed'
    || s === 'busy'
    || s === 'no-answer'
    || s === 'canceled'
    || s === 'cancelled'
  ) {
    return 'FAILED';
  }
  if (s === 'in-progress' || s === 'ringing' || s === 'answered') return 'ACTIVE';
  if (s === 'queued' || s === 'initiated') return 'INITIATED';
  return 'ACTIVE';
}
