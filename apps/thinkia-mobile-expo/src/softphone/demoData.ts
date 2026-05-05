import type { CallLogEntry } from './twilioTypes';

export type DemoContact = {
  id: string;
  name: string;
  phone: string;
  initials: string;
  company: string;
};

export const COMPANY_LABEL = 'Fresenius Medical Care';

/** Número E.164 de prueba para David Alejano — cámbialo por su móvil real antes de llamar. */
export const DAVID_ALEJANO_PHONE = '+34600000000';

export const DEMO_CONTACTS: DemoContact[] = [
  { id: 'da', name: 'David Alejano', phone: DAVID_ALEJANO_PHONE, initials: 'DA', company: COMPANY_LABEL },
  { id: '1', name: 'María López García', phone: '+34 607 89 43 01', initials: 'ML', company: COMPANY_LABEL },
  { id: '2', name: 'Laura Sánchez', phone: '+34 612 34 56 78', initials: 'LS', company: COMPANY_LABEL },
  { id: '3', name: 'Juan Torres Ruiz', phone: '+34 655 11 22 33', initials: 'JT', company: COMPANY_LABEL },
  { id: '4', name: 'Pedro Ramírez', phone: '+34 644 00 11 22', initials: 'PR', company: COMPANY_LABEL },
  { id: '5', name: 'Elena Fernández', phone: '+34 699 88 77 66', initials: 'EF', company: COMPANY_LABEL },
];

export const SEED_CALL_LOG: CallLogEntry[] = [
  {
    id: 's1',
    direction: 'outgoing',
    name: 'María López García',
    phone: '+34 607 89 43 01',
    time: '03:03 pm',
    durationSec: 204,
  },
  {
    id: 's2',
    direction: 'incoming',
    name: 'Juan Torres Ruiz',
    phone: '+34 655 11 22 33',
    time: '02:41 pm',
    durationSec: 45,
  },
  {
    id: 's3',
    direction: 'missed',
    name: 'Laura Sánchez',
    phone: '+34 612 34 56 78',
    time: '01:12 pm',
  },
];
