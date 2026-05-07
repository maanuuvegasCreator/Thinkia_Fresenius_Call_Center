import { createBrowserRouter } from 'react-router';
import { Login } from './pages/Login';
import { CallCenter } from './pages/CallCenter';
import { TeamDirectory } from './pages/TeamDirectory';
import { Activity } from './pages/Activity';
import { Teams } from './pages/Teams';
import CallHistory from './pages/CallHistory';
import LiveMonitoring from './pages/LiveMonitoring';
import Analytics from './pages/Analytics';
import { Numbers } from './pages/settings/Numbers';
import { SettingsPlaceholder } from './pages/settings/SettingsPlaceholder';
import { CallSettings } from './pages/settings/CallSettings';
import { Integrations } from './pages/settings/Integrations';
import { AudioDevices } from './pages/settings/AudioDevices';
import { MainLayout } from './components/MainLayout';
import { PortalRouteGuard } from './components/PortalRouteGuard';
import { Contacts } from './pages/Contacts';

export const router = createBrowserRouter(
  [
  {
    path: '/',
    Component: Login,
  },
  {
    path: '/dashboard',
    element: (
      <MainLayout>
        <CallCenter />
      </MainLayout>
    ),
  },
  {
    path: '/contacts',
    element: (
      <MainLayout>
        <Contacts />
      </MainLayout>
    ),
  },
  {
    path: '/numbers',
    element: (
      <MainLayout>
        <PortalRouteGuard>
          <Numbers />
        </PortalRouteGuard>
      </MainLayout>
    ),
  },
  {
    path: '/teams',
    element: (
      <MainLayout>
        <PortalRouteGuard>
          <Teams />
        </PortalRouteGuard>
      </MainLayout>
    ),
  },
  {
    path: '/monitoring',
    element: (
      <MainLayout>
        <PortalRouteGuard>
          <LiveMonitoring />
        </PortalRouteGuard>
      </MainLayout>
    ),
  },
  {
    path: '/analytics',
    element: (
      <MainLayout>
        <Analytics />
      </MainLayout>
    ),
  },
  {
    path: '/team-directory',
    element: (
      <MainLayout>
        <PortalRouteGuard>
          <TeamDirectory />
        </PortalRouteGuard>
      </MainLayout>
    ),
  },
  {
    path: '/call-history',
    element: (
      <MainLayout>
        <CallHistory />
      </MainLayout>
    ),
  },
  {
    path: '/activity',
    element: (
      <MainLayout>
        <PortalRouteGuard>
          <Activity />
        </PortalRouteGuard>
      </MainLayout>
    ),
  },
  {
    path: '/settings',
    element: (
      <MainLayout>
        <PortalRouteGuard>
          <CallSettings />
        </PortalRouteGuard>
      </MainLayout>
    ),
  },
  {
    path: '/settings/call-settings',
    element: (
      <MainLayout>
        <PortalRouteGuard>
          <CallSettings />
        </PortalRouteGuard>
      </MainLayout>
    ),
  },
  {
    path: '/settings/integrations',
    element: (
      <MainLayout>
        <PortalRouteGuard>
          <Integrations />
        </PortalRouteGuard>
      </MainLayout>
    ),
  },
  {
    path: '/settings/audio-devices',
    element: (
      <MainLayout>
        <PortalRouteGuard>
          <AudioDevices />
        </PortalRouteGuard>
      </MainLayout>
    ),
  },
  ],
  {
    basename: (import.meta.env.BASE_URL ?? '/portal/').replace(/\/$/, '') || '/portal',
  }
);