import type { Session } from '@supabase/supabase-js';
import type { Call, CallInvite } from '@twilio/voice-react-native-sdk';

export type { Call, CallInvite };

export type SoftphoneTab = 'calls' | 'dialer' | 'contacts' | 'profile';

export type CallLogDirection = 'outgoing' | 'incoming' | 'missed';

export type CallLogEntry = {
  id: string;
  direction: CallLogDirection;
  name: string;
  phone: string;
  time: string;
  durationSec?: number;
};

export type TwilioVoiceContextValue = {
  session: Session;
  registering: boolean;
  registered: boolean;
  statusLine: string;
  hasTwilioError: boolean;
  digits: string;
  setDigits: (v: string) => void;
  incoming: CallInvite | null;
  active: Call | null;
  muted: boolean;
  outgoingBusy: boolean;
  activeCallLabel: string;
  activeCallNumber: string;
  activeCallCompany: string;
  callElapsedSec: number;
  callUiPhase: 'idle' | 'dialing' | 'ringing' | 'connected';
  callLog: CallLogEntry[];
  callsFilter: 'all' | 'missed';
  setCallsFilter: (f: 'all' | 'missed') => void;
  placeCall: () => Promise<void>;
  hangup: () => void;
  toggleMute: () => void;
  answer: () => Promise<void>;
  decline: () => void;
  signOut: () => Promise<void>;
  dialKey: (k: string) => void;
  backspace: () => void;
  callContact: (phone: string, name: string) => Promise<void>;
};
