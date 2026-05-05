import type { Session } from '@supabase/supabase-js';
import { SoftphoneShell } from '../softphone/SoftphoneShell';
import { TwilioVoiceProvider } from '../softphone/TwilioVoiceProvider';

type Props = { session: Session };

export function SoftphoneScreen({ session }: Props) {
  return (
    <TwilioVoiceProvider session={session}>
      <SoftphoneShell />
    </TwilioVoiceProvider>
  );
}
