import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, type ComponentProps } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { DEMO_CONTACTS } from './demoData';
import { useTwilioVoice } from './TwilioVoiceProvider';
import type { CallLogEntry } from './twilioTypes';
import { formatMmSs } from './twilioFormat';
import type { SoftphoneTab } from './twilioTypes';

const C = {
  bg: '#ffffff',
  pageBg: '#f4f6f8',
  text: '#0f172a',
  muted: '#64748b',
  light: '#94a3b8',
  blue: '#2563eb',
  green: '#16a34a',
  red: '#dc2626',
  pillOn: '#0f172a',
  pillOff: '#e2e8f0',
  line: '#e2e8f0',
  avatar: '#e0f2fe',
  avatarText: '#0369a1',
  callBg: '#f0f4f8',
};

function topInset(): number {
  return Platform.OS === 'android' ? 12 : 52;
}

function HeaderSoftphone(props: {
  showBack?: boolean;
  onBack?: () => void;
  badge?: boolean;
  title?: string;
}) {
  const pad = topInset();
  const title = props.title ?? 'Softphone';
  return (
    <View style={[styles.headerRow, { paddingTop: pad }]}>
      {props.showBack ? (
        <TouchableOpacity onPress={props.onBack} style={styles.headerIcon} hitSlop={12}>
          <Ionicons name="chevron-back" size={26} color={C.text} />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerIcon} />
      )}
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>{title}</Text>
        {props.badge ? (
          <View style={styles.badgeDot}>
            <Ionicons name="alert" size={14} color="#fff" />
          </View>
        ) : null}
      </View>
      <View style={styles.headerIcon} />
    </View>
  );
}

function BottomNav(props: { tab: SoftphoneTab; onChange: (t: SoftphoneTab) => void }) {
  const items: { id: SoftphoneTab; label: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
    { id: 'calls', label: 'Llamadas', icon: 'call-outline' },
    { id: 'dialer', label: 'Teclado', icon: 'apps-outline' },
    { id: 'contacts', label: 'Contactos', icon: 'people-outline' },
    { id: 'profile', label: 'Mi perfil', icon: 'person-outline' },
  ];
  return (
    <View style={styles.bottomNav}>
      {items.map((it) => {
        const on = props.tab === it.id;
        return (
          <TouchableOpacity key={it.id} style={styles.navItem} onPress={() => props.onChange(it.id)}>
            <Ionicons name={it.icon} size={22} color={on ? C.blue : C.text} />
            <Text style={[styles.navLabel, on && styles.navLabelOn]}>{it.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function DialerTab() {
  const v = useTwilioVoice();
  const rows = [
    ['1', '', '2', 'ABC', '3', 'DEF'],
    ['4', 'GHI', '5', 'JKL', '6', 'MNO'],
    ['7', 'PQRS', '8', 'TUV', '9', 'WXYZ'],
    ['*', '', '0', '+', '#', ''],
  ];
  return (
    <View style={styles.tabPage}>
      <HeaderSoftphone badge={v.hasTwilioError} />
      {v.registering ? (
        <View style={styles.regRow}>
          <ActivityIndicator />
          <Text style={styles.regHint}>Registrando en Twilio…</Text>
        </View>
      ) : null}
      <Text style={styles.dialerPrompt}>Introduce un número</Text>
      <Text style={styles.digitsDisplay}>{v.digits || ' '}</Text>
      <View style={styles.keypad}>
        {rows.map((row, ri) => (
          <View key={ri} style={styles.keypadRow}>
            {Array.from({ length: 3 }).map((_, ci) => {
              const d = row[ci * 2];
              const sub = row[ci * 2 + 1];
              return (
                <Pressable
                  key={`${ri}-${ci}`}
                  style={styles.keyCell}
                  onPress={() => (d ? v.dialKey(d) : undefined)}
                >
                  <Text style={styles.keyMain}>{d || ' '}</Text>
                  {sub ? <Text style={styles.keySub}>{sub}</Text> : <Text style={styles.keySub}> </Text>}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <View style={styles.dialActions}>
        <TouchableOpacity style={styles.keyGhost} onPress={v.backspace}>
          <Ionicons name="backspace-outline" size={26} color={C.muted} />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.callFab, (!v.registered || v.outgoingBusy) && styles.callFabOff]}
          onPress={() => void v.placeCall()}
          disabled={!v.registered || v.outgoingBusy}
        >
          {v.outgoingBusy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Ionicons name="call" size={28} color="#fff" />
          )}
        </TouchableOpacity>
        <View style={{ width: 48 }} />
      </View>
    </View>
  );
}

function callIconWrap(dir: CallLogEntry['direction']): 'out' | 'in' | 'miss' {
  if (dir === 'outgoing') return 'out';
  if (dir === 'incoming') return 'in';
  return 'miss';
}

function CallsTab(props: { onBack: () => void }) {
  const v = useTwilioVoice();
  const missedCount = useMemo(() => v.callLog.filter((c) => c.direction === 'missed').length, [v.callLog]);
  const list = useMemo(() => {
    if (v.callsFilter === 'missed') return v.callLog.filter((c) => c.direction === 'missed');
    return v.callLog;
  }, [v.callLog, v.callsFilter]);

  const subtitle = (item: CallLogEntry) => {
    if (item.direction === 'missed') return item.phone;
    const dur =
      item.durationSec !== undefined && item.durationSec > 0 ? formatMmSs(item.durationSec) : '—';
    return `${item.phone} • ${dur}`;
  };

  return (
    <View style={styles.tabPage}>
      <HeaderSoftphone showBack onBack={props.onBack} badge={v.hasTwilioError} />
      <Text style={styles.sectionTitle}>Llamadas</Text>
      <View style={styles.pillRow}>
        <TouchableOpacity
          style={[styles.pill, v.callsFilter === 'all' && styles.pillOn]}
          onPress={() => v.setCallsFilter('all')}
        >
          <Text style={[styles.pillTxt, v.callsFilter === 'all' && styles.pillTxtOn]}>Todas</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.pill, v.callsFilter === 'missed' && styles.pillOn]}
          onPress={() => v.setCallsFilter('missed')}
        >
          <Text style={[styles.pillTxt, v.callsFilter === 'missed' && styles.pillTxtOn]}>Perdidas</Text>
          {missedCount > 0 ? (
            <View style={styles.pillBadge}>
              <Text style={styles.pillBadgeTxt}>{missedCount > 9 ? '9+' : missedCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>
      <FlatList
        data={list}
        keyExtractor={(i) => i.id}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => {
          const w = callIconWrap(item.direction);
          const col = w === 'out' ? C.green : w === 'in' ? C.blue : C.red;
          return (
            <View style={styles.callRow}>
              <View
                style={[
                  styles.callIconWrap,
                  w === 'out' && styles.callIconOut,
                  w === 'in' && styles.callIconIn,
                  w === 'miss' && styles.callIconMiss,
                ]}
              >
                <Ionicons name="call" size={18} color={col} />
                {item.direction === 'missed' ? (
                  <Ionicons name="close" size={10} color={C.red} style={styles.miniX} />
                ) : null}
              </View>
              <View style={styles.callMid}>
                <Text style={styles.callName}>{item.name}</Text>
                <Text style={styles.callSub}>{subtitle(item)}</Text>
              </View>
              <Text style={styles.callTime}>{item.time}</Text>
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>No hay llamadas</Text>}
        contentContainerStyle={styles.listPad}
      />
    </View>
  );
}

function ContactsTab(props: { onBack: () => void }) {
  const v = useTwilioVoice();
  const [sel, setSel] = useState<string | null>(DEMO_CONTACTS[0]?.id ?? null);
  return (
    <View style={styles.tabPage}>
      <HeaderSoftphone showBack onBack={props.onBack} badge={v.hasTwilioError} />
      <Text style={styles.sectionTitle}>Contactos</Text>
      <FlatList
        data={DEMO_CONTACTS}
        keyExtractor={(c) => c.id}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.contactRow, sel === item.id && styles.contactRowOn]}
            onPress={() => setSel(item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>{item.initials}</Text>
            </View>
            <View style={styles.contactMid}>
              <Text style={styles.callName}>{item.name}</Text>
              <Text style={styles.callSub}>{item.phone}</Text>
              <Text style={styles.company}>{item.company}</Text>
            </View>
            <TouchableOpacity
              style={styles.greenRound}
              onPress={() => void v.callContact(item.phone, item.name)}
              disabled={!v.registered || v.outgoingBusy}
            >
              <Ionicons name="call" size={20} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.listPad}
      />
    </View>
  );
}

function ProfileTab() {
  const v = useTwilioVoice();
  const meta = v.session.user.user_metadata as Record<string, string | undefined> | undefined;
  const name =
    (meta?.full_name as string | undefined) ??
    (meta?.name as string | undefined) ??
    v.session.user.email?.split('@')[0] ??
    'Agente';
  const email = v.session.user.email ?? '—';
  const phone = (meta?.phone as string | undefined) ?? '+34 607 89 43 01';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <View style={[styles.tabPage, { backgroundColor: C.pageBg }]}>
      <Text style={[styles.sectionTitle, { marginTop: topInset() + 8, paddingHorizontal: 20 }]}>Mi perfil</Text>
      <View style={styles.profileRule} />
      <ScrollView contentContainerStyle={styles.profileScroll}>
        <View style={styles.avatarLg}>
          <Text style={styles.avatarLgTxt}>{initials || 'PC'}</Text>
        </View>
        <Text style={styles.profileName}>{name}</Text>
        <Text style={styles.profileEmail}>{email}</Text>
        <Text style={styles.profilePhone}>{phone}</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Estado</Text>
          <Text style={styles.cardVal}>Disponible</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Departamento</Text>
          <Text style={styles.cardVal}>Atención al Cliente</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Rol</Text>
          <Text style={styles.cardVal}>Agente Principal</Text>
        </View>
        <TouchableOpacity onPress={() => void v.signOut()} style={styles.signOutBtn}>
          <Text style={styles.signOutTxt}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function ActiveCallModal() {
  const v = useTwilioVoice();
  const open = Boolean(v.active);
  const phaseLabel =
    v.callUiPhase === 'connected'
      ? formatMmSs(v.callElapsedSec)
      : v.callUiPhase === 'ringing'
        ? 'Sonando…'
        : 'Marcando…';

  return (
    <Modal visible={open} animationType="slide" onRequestClose={v.hangup}>
      <View style={[styles.modalRoot, { backgroundColor: C.callBg }]}>
        <View style={[styles.headerRow, { paddingTop: topInset() }]}>
          <TouchableOpacity onPress={v.hangup} style={styles.headerIcon}>
            <Ionicons name="chevron-back" size={26} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitleCenter}>En llamada</Text>
          <View style={styles.headerIcon} />
        </View>
        <View style={styles.activeBody}>
          <View style={styles.avatarXL}>
            <Text style={styles.avatarXLTxt}>
              {v.activeCallLabel
                .split(/\s+/)
                .map((x) => x[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </Text>
          </View>
          <Text style={styles.activeName}>{v.activeCallLabel}</Text>
          <Text style={styles.activeNum}>{v.activeCallNumber}</Text>
          <Text style={styles.company}>{v.activeCallCompany}</Text>
          <View style={styles.timerRow}>
            <View style={styles.dot} />
            <Text style={styles.timerTxt}>{phaseLabel}</Text>
          </View>
          <View style={styles.grid2}>
            <TouchableOpacity style={styles.roundBtn} onPress={v.toggleMute}>
              <Ionicons name={v.muted ? 'mic-off-outline' : 'mic-outline'} size={22} color={C.text} />
              <Text style={styles.roundLbl}>Mute</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.roundBtn} onPress={() => undefined}>
              <Ionicons name="pause-outline" size={22} color={C.text} />
              <Text style={styles.roundLbl}>Hold</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.roundBtn} onPress={() => undefined}>
              <Ionicons name="keypad-outline" size={22} color={C.text} />
              <Text style={styles.roundLbl}>Teclado</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.roundBtn} onPress={() => undefined}>
              <Ionicons name="radio-button-off" size={22} color={C.text} />
              <Text style={styles.roundLbl}>Recording</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.roundBtn, styles.hangRed]} onPress={v.hangup}>
              <Ionicons name="call" size={22} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              <Text style={[styles.roundLbl, { color: C.red }]}>Colgar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.roundBtn} onPress={() => undefined}>
              <Ionicons name="arrow-forward-outline" size={22} color={C.text} />
              <Text style={styles.roundLbl}>Transferir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function IncomingModal() {
  const v = useTwilioVoice();
  const open = Boolean(v.incoming);
  return (
    <Modal visible={open} transparent animationType="fade">
      <View style={styles.incomingDim}>
        <View style={styles.incomingCard}>
          <Text style={styles.incomingTitle}>Llamada entrante</Text>
          <Text style={styles.activeName}>{v.activeCallLabel}</Text>
          <Text style={styles.activeNum}>{v.activeCallNumber}</Text>
          <View style={styles.incomingRow}>
            <TouchableOpacity style={styles.declineBtn} onPress={v.decline}>
              <Text style={styles.btnLightTxt}>Rechazar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.answerBtn} onPress={() => void v.answer()}>
              <Text style={styles.btnLightTxt}>Contestar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function SoftphoneShell() {
  const [tab, setTab] = useState<SoftphoneTab>('dialer');

  const body =
    tab === 'calls' ? (
      <CallsTab onBack={() => setTab('dialer')} />
    ) : tab === 'dialer' ? (
      <DialerTab />
    ) : tab === 'contacts' ? (
      <ContactsTab onBack={() => setTab('dialer')} />
    ) : (
      <ProfileTab />
    );

  return (
    <View style={styles.root}>
      <View style={styles.body}>{body}</View>
      {tab !== 'profile' ? <BottomNav tab={tab} onChange={setTab} /> : <BottomNav tab={tab} onChange={setTab} />}
      <ActiveCallModal />
      <IncomingModal />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  body: { flex: 1 },
  tabPage: { flex: 1, backgroundColor: C.bg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerIcon: { width: 44, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: C.text },
  headerTitleCenter: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '600', color: C.text },
  badgeDot: {
    position: 'absolute',
    right: '28%',
    top: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontSize: 26, fontWeight: '700', color: C.text, paddingHorizontal: 20, marginTop: 4 },
  regRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginBottom: 8 },
  regHint: { fontSize: 13, color: C.muted },
  dialerPrompt: {
    fontSize: 22,
    fontWeight: '200',
    color: C.light,
    textAlign: 'center',
    marginTop: 12,
  },
  digitsDisplay: {
    fontSize: 28,
    fontWeight: '300',
    color: C.text,
    textAlign: 'center',
    marginVertical: 16,
    letterSpacing: 2,
  },
  keypad: { paddingHorizontal: 24, gap: 6 },
  keypadRow: { flexDirection: 'row', justifyContent: 'space-between' },
  keyCell: { width: '30%', paddingVertical: 14, alignItems: 'center' },
  keyMain: { fontSize: 30, fontWeight: '200', color: C.text },
  keySub: { fontSize: 11, color: C.muted, marginTop: 2, letterSpacing: 1 },
  dialActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 24,
    paddingHorizontal: 40,
  },
  keyGhost: { padding: 12 },
  callFab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callFabOff: { opacity: 0.45 },
  bottomNav: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    paddingTop: 8,
    backgroundColor: C.bg,
  },
  navItem: { flex: 1, alignItems: 'center', gap: 4 },
  navLabel: { fontSize: 11, color: C.text },
  navLabelOn: { color: C.blue, fontWeight: '600' },
  pillRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginTop: 16, marginBottom: 8 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: C.pillOff,
  },
  pillOn: { backgroundColor: C.pillOn },
  pillTxt: { fontSize: 14, fontWeight: '600', color: C.text },
  pillTxtOn: { color: '#fff' },
  pillBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  pillBadgeTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  sep: { height: 1, backgroundColor: C.line, marginLeft: 72 },
  callRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 16 },
  callIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  callIconOut: { backgroundColor: '#dcfce7' },
  callIconIn: { backgroundColor: '#dbeafe' },
  callIconMiss: { backgroundColor: '#fee2e2' },
  miniX: { position: 'absolute', right: 4, bottom: 4 },
  callMid: { flex: 1 },
  callName: { fontSize: 16, fontWeight: '700', color: C.text },
  callSub: { fontSize: 13, color: C.muted, marginTop: 2 },
  callTime: { fontSize: 13, color: C.muted },
  listPad: { paddingBottom: 24 },
  empty: { textAlign: 'center', color: C.muted, marginTop: 40 },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  contactRowOn: { backgroundColor: '#f1f5f9' },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.avatar,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarTxt: { fontSize: 16, fontWeight: '700', color: C.avatarText },
  contactMid: { flex: 1 },
  company: { fontSize: 12, color: C.light, marginTop: 2 },
  greenRound: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.green,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileRule: { height: 1, backgroundColor: C.line, marginHorizontal: 20, marginTop: 8 },
  profileScroll: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  avatarLg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: C.avatar,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLgTxt: { fontSize: 28, fontWeight: '700', color: C.avatarText },
  profileName: { fontSize: 22, fontWeight: '700', color: C.text, marginTop: 16 },
  profileEmail: { fontSize: 14, color: C.muted, marginTop: 6 },
  profilePhone: { fontSize: 14, color: C.muted, marginTop: 4 },
  card: {
    width: '100%',
    backgroundColor: C.bg,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: C.line,
  },
  cardLabel: { fontSize: 14, color: '#334155', marginBottom: 4 },
  cardVal: { fontSize: 16, fontWeight: '600', color: C.text },
  signOutBtn: { marginTop: 28, padding: 12 },
  signOutTxt: { color: C.muted, fontSize: 15 },
  modalRoot: { flex: 1 },
  activeBody: { flex: 1, alignItems: 'center', paddingTop: 20 },
  avatarXL: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: C.avatar,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  avatarXLTxt: { fontSize: 36, fontWeight: '700', color: C.avatarText },
  activeName: { fontSize: 22, fontWeight: '700', color: '#1e3a5f', marginTop: 20 },
  activeNum: { fontSize: 16, color: '#334155', marginTop: 6 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.green },
  timerTxt: { fontSize: 16, color: C.text, fontVariant: ['tabular-nums'] },
  grid2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    marginTop: 36,
    paddingHorizontal: 16,
    maxWidth: 400,
    alignSelf: 'center',
  },
  roundBtn: {
    width: '28%',
    minWidth: 96,
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  hangRed: {
    backgroundColor: C.red,
    borderRadius: 999,
    width: 72,
    height: 72,
    minWidth: 72,
    justifyContent: 'center',
    alignSelf: 'center',
  },
  roundLbl: { fontSize: 12, color: C.muted, textAlign: 'center' },
  incomingDim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  incomingCard: {
    backgroundColor: C.bg,
    borderRadius: 16,
    padding: 24,
    gap: 12,
  },
  incomingTitle: { fontSize: 14, color: C.muted, textAlign: 'center' },
  incomingRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  declineBtn: {
    flex: 1,
    backgroundColor: C.red,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  answerBtn: {
    flex: 1,
    backgroundColor: C.green,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnLightTxt: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
