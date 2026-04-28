export type AnalyticsRange = 'today' | 'week' | 'month';
export type AnalyticsView = 'supervisor' | 'agent';
export type AnalyticsChannel = 'global' | 'inbound' | 'outbound' | 'ai';

export type VoiceCallRecord = {
  twilio_call_sid: string;
  parent_call_sid: string | null;
  direction: string;
  call_status: string;
  duration_seconds: number | null;
  agent_user_id: string | null;
  created_at: string;
  from_number: string | null;
  to_number: string | null;
};

export type AgentRow = {
  user_id: string;
  display_name: string;
  operational_status: string | null;
  presence_status: string | null;
};
