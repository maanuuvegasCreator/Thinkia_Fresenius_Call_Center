import { TwilioSoftphone } from '../components/TwilioSoftphone';
import { LogoutButton } from '../components/LogoutButton';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Softphone — Thinkia',
  description: 'Cliente WebRTC Twilio (C1/C2)',
};

export default function SoftphonePage() {
  return (
    <main className="min-h-screen bg-neutral-100 px-4 py-10">
      <div className="mx-auto mb-4 flex max-w-md justify-end">
        <LogoutButton />
      </div>
      <TwilioSoftphone />
    </main>
  );
}
