/**
 * Enriquecimiento simulado tipo Microsoft Dynamics 365 para llamadas entrantes.
 * En producción se sustituiría por búsqueda real (teléfono → contacto/cuenta).
 */

export type DynamicsCallerProfile = {
  matchedInCrm: boolean;
  contactName: string;
  phoneDisplay: string;
  accountName: string;
  patientOrContactId: string;
  segment: string;
  lastActivity: string;
  caseOwner: string;
  priorityLabel: string;
  notes: string;
};

function digitsOnly(raw: string): string {
  return (raw ?? '').replace(/\D/g, '');
}

function formatEsPhone(digits: string): string {
  if (digits.length >= 11 && digits.startsWith('34')) {
    const rest = digits.slice(2);
    if (rest.length === 9) {
      return `+34 ${rest.slice(0, 3)} ${rest.slice(3, 5)} ${rest.slice(5, 7)} ${rest.slice(7)}`;
    }
  }
  return digits ? `+${digits}` : '—';
}

type RegistryEntry = {
  /** Coincide si el número normalizado termina por este sufijo o lo contiene. */
  suffix: string;
  profile: Omit<DynamicsCallerProfile, 'matchedInCrm' | 'phoneDisplay'>;
};

const DEMO_REGISTRY: RegistryEntry[] = [
  {
    suffix: '34607894301',
    profile: {
      contactName: 'María López García',
      accountName: 'Tech Solutions SL · Paciente HD',
      patientOrContactId: 'NHC-884921 · Contacto CRM #C-120441',
      segment: 'Hemodiálisis · Centro Norte',
      lastActivity: 'Última cita: hace 6 días · Seguimiento enfermería',
      caseOwner: 'Laura Martínez (Dynamics)',
      priorityLabel: 'Media',
      notes: 'Paciente activo en plan de tratamiento. Último caso abierto: consulta telefónica.',
    },
  },
  {
    suffix: '34912345678',
    profile: {
      contactName: 'Ana Martínez Pérez',
      accountName: 'Consultoría Global',
      patientOrContactId: 'NHC-771102 · Contacto CRM #C-882301',
      segment: 'Información general',
      lastActivity: 'Última interacción: ayer · Email confirmado',
      caseOwner: 'Pedro Castro (Dynamics)',
      priorityLabel: 'Normal',
      notes: 'Contacto con varios números registrados. Preferencia canal teléfono mañanas.',
    },
  },
  {
    suffix: '34983660555',
    profile: {
      contactName: 'Juan Torres Ruiz',
      accountName: 'Industrias Martínez',
      patientOrContactId: 'NHC-552901 · Contacto CRM #C-440912',
      segment: 'Administración / citación',
      lastActivity: 'Llamada perdida registrada hace 2 días',
      caseOwner: 'Equipo recepción (Dynamics)',
      priorityLabel: 'Alta',
      notes: 'Solicitó devolución de llamada. Motivo indicado: revisión de agenda.',
    },
  },
];

function lookup(digits: string): RegistryEntry['profile'] | null {
  for (const row of DEMO_REGISTRY) {
    if (digits.endsWith(row.suffix) || digits.includes(row.suffix)) {
      return row.profile;
    }
  }
  return null;
}

export function resolveDynamicsCallerProfile(fromRaw: string, callerNameRaw?: string): DynamicsCallerProfile {
  const digits = digitsOnly(fromRaw);
  const phoneDisplay = formatEsPhone(digits);
  const twilioName = (callerNameRaw ?? '').trim();
  const hit = lookup(digits);

  if (hit) {
    return {
      matchedInCrm: true,
      phoneDisplay,
      contactName: hit.contactName,
      accountName: hit.accountName,
      patientOrContactId: hit.patientOrContactId,
      segment: hit.segment,
      lastActivity: hit.lastActivity,
      caseOwner: hit.caseOwner,
      priorityLabel: hit.priorityLabel,
      notes: hit.notes,
    };
  }

  const derivedName =
    twilioName ||
    (digits.length >= 4 ? `Contacto (${digits.slice(-4)}…)` : 'Contacto no identificado');

  return {
    matchedInCrm: false,
    phoneDisplay,
    contactName: derivedName,
    accountName: 'Sin cuenta vinculada en Dynamics (demo)',
    patientOrContactId: 'Buscar por teléfono en CRM',
    segment: '—',
    lastActivity: 'Sin actividad reciente indexada (simulación)',
    caseOwner: 'Sin propietario asignado',
    priorityLabel: 'Normal',
    notes:
      'No hay coincidencia exacta con el directorio simulado. En producción aquí iría la respuesta del conector Dynamics (Web API / Dataverse) por número E.164.',
  };
}
