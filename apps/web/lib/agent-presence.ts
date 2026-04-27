/** Misma semántica que el portal (sidebar). */

export type AgentPresenceUi =
  | 'available'
  | 'unavailable'
  | 'do-not-disturb'
  | 'be-right-back'
  | 'appear-away';

type DbPresence =
  | 'available'
  | 'unavailable'
  | 'do_not_disturb'
  | 'be_right_back'
  | 'appear_away';

const UI_VALUES: AgentPresenceUi[] = [
  'available',
  'unavailable',
  'do-not-disturb',
  'be-right-back',
  'appear-away',
];

export function isAgentPresenceUi(v: string): v is AgentPresenceUi {
  return (UI_VALUES as string[]).includes(v);
}

export function agentPresenceUiToDb(ui: AgentPresenceUi): DbPresence {
  switch (ui) {
    case 'do-not-disturb':
      return 'do_not_disturb';
    case 'be-right-back':
      return 'be_right_back';
    case 'appear-away':
      return 'appear_away';
    default:
      return ui;
  }
}

export function agentPresenceDbToUi(db: string): AgentPresenceUi {
  switch (db) {
    case 'available':
      return 'available';
    case 'unavailable':
      return 'unavailable';
    case 'do_not_disturb':
      return 'do-not-disturb';
    case 'be_right_back':
      return 'be-right-back';
    case 'appear_away':
      return 'appear-away';
    default:
      return 'unavailable';
  }
}
