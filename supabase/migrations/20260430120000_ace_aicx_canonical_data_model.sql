-- AI Contact Experience (ACE) — modelo de datos canónico (ACE_ contactos, AICX_ operativa).
-- Alineado con "AI Contact Experience" v1.0 2026 (Thinkia · Fresenius).
-- Notas: NHC / NATIONAL_ID cifrado en capa de aplicación; aquí se almacenan como text.
-- Orden de creación: sección 13 del documento.

-- ---------------------------------------------------------------------------
-- SCHEMAS: ACE y AICX (tal cual documento)
-- ---------------------------------------------------------------------------
create schema if not exists ace;
create schema if not exists aicx;

-- ---------------------------------------------------------------------------
-- ACE_AGENT
-- ---------------------------------------------------------------------------
create table if not exists ace.agent (
  id uuid primary key default gen_random_uuid(),
  d365_user_id text,
  name text not null,
  email text,
  phone_extension text,
  role text not null default 'AGENT',
  business_unit text,
  status text not null default 'ACTIVE',
  supabase_user_id uuid unique references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ace_agent_role_check check (role in ('AGENT', 'SUPERVISOR', 'ADMIN')),
  constraint ace_agent_status_check check (status in ('ACTIVE', 'INACTIVE', 'ON_LEAVE')),
  constraint ace_agent_business_unit_check check (
    business_unit is null or business_unit in ('ES', 'PT', 'DE', 'FR')
  )
);

create index if not exists ace_agent_d365_user_id_idx on ace.agent (d365_user_id);
create index if not exists ace_agent_email_lower_idx on ace.agent (lower(email));

comment on table ace.agent is
  'Agentes CRM / enrutamiento; opcionalmente enlazados a auth.users (supabase_user_id).';

-- ---------------------------------------------------------------------------
-- ACE_CONTACT
-- ---------------------------------------------------------------------------
create table if not exists ace.contact (
  id uuid primary key default gen_random_uuid(),
  crm_id text not null,
  crm_record_url text,
  external_source text not null default 'DYNAMICS365',
  sync_status text not null default 'PENDING',
  last_sync_at timestamptz,
  contact_type text not null,
  business_unit text,
  status text not null default 'ACTIVE',
  display_name text not null,
  main_phone text,
  secondary_phone text,
  email text,
  primary_agent_id uuid references ace.agent (id) on delete set null,
  secondary_agent_id uuid references ace.agent (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint ace_contact_crm_id_key unique (crm_id),
  constraint ace_contact_sync_status_check check (
    sync_status in ('SYNCED', 'PENDING', 'ERROR')
  ),
  constraint ace_contact_type_check check (contact_type in ('PATIENT', 'HOSPITAL', 'OTHER')),
  constraint ace_contact_status_check check (status in ('ACTIVE', 'INACTIVE', 'BLOCKED')),
  constraint ace_contact_business_unit_check check (
    business_unit is null or business_unit in ('ES', 'PT', 'DE', 'FR')
  )
);

create index if not exists ace_contact_main_phone_idx on ace.contact (main_phone);
create index if not exists ace_contact_deleted_at_idx on ace.contact (deleted_at)
  where deleted_at is null;

comment on column ace.contact.deleted_at is 'Borrado lógico; fuente de verdad D365.';

-- ---------------------------------------------------------------------------
-- ACE_CONTACT_PATIENT
-- ---------------------------------------------------------------------------
create table if not exists ace.contact_patient (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references ace.contact (id) on delete cascade,
  d365_patient_id text,
  name text,
  surname text,
  nhc text,
  date_of_birth date,
  gender text,
  national_id text,
  language text,
  reference_hospital_id uuid references ace.contact (id) on delete set null,
  reference_hospital_name text,
  treatment_center text,
  treatment_type text,
  calling_flag boolean not null default false,
  next_call_date date,
  last_order_date date,
  order_interval_days integer,
  delivery_address_regular text,
  delivery_address_holiday text,
  contact_consent boolean not null default false,
  do_not_call boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ace_contact_patient_contact_id_key unique (contact_id),
  constraint ace_contact_patient_gender_check check (
    gender is null or gender in ('M', 'F', 'OTHER')
  ),
  constraint ace_contact_patient_language_check check (
    language is null or language in ('es', 'ca', 'en', 'pt')
  ),
  constraint ace_contact_patient_treatment_type_check check (
    treatment_type is null or treatment_type in ('HD', 'DP', 'HHD', 'CONSULTORIA')
  )
);

create index if not exists ace_contact_patient_d365_id_idx on ace.contact_patient (d365_patient_id);

comment on column ace.contact_patient.nhc is 'Sensitive — cifrado AES-256 en aplicación.';
comment on column ace.contact_patient.national_id is 'Sensitive — cifrado AES-256 en aplicación.';

-- ---------------------------------------------------------------------------
-- ACE_CONTACT_HOSPITAL
-- ---------------------------------------------------------------------------
create table if not exists ace.contact_hospital (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references ace.contact (id) on delete cascade,
  d365_account_id text,
  official_name text not null,
  hospital_type text,
  cif text,
  department text,
  department_phone text,
  department_email text,
  department_schedule text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ace_contact_hospital_contact_id_key unique (contact_id),
  constraint ace_contact_hospital_type_check check (
    hospital_type is null
    or hospital_type in ('PUBLIC', 'PRIVATE', 'CLINIC', 'UNIVERSITY')
  )
);

-- ---------------------------------------------------------------------------
-- ACE_CONTACT_PHONE
-- ---------------------------------------------------------------------------
create table if not exists ace.contact_phone (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references ace.contact (id) on delete cascade,
  phone_number text not null,
  phone_type text not null default 'MAIN',
  priority integer not null default 1,
  is_active boolean not null default true,
  last_call_result text,
  last_call_at timestamptz,
  created_at timestamptz not null default now(),
  constraint ace_contact_phone_type_check check (
    phone_type in ('MAIN', 'SECONDARY', 'MOBILE', 'WORK', 'FAX')
  ),
  constraint ace_contact_phone_last_result_check check (
    last_call_result is null
    or last_call_result in ('ANSWERED', 'BUSY', 'NO_ANSWER', 'INVALID')
  )
);

create index if not exists ace_contact_phone_contact_idx on ace.contact_phone (contact_id);
create index if not exists ace_contact_phone_e164_idx on ace.contact_phone (phone_number);

comment on column ace.contact_phone.phone_number is 'E.164 normalizado (+34...).';

-- ---------------------------------------------------------------------------
-- ACE_CONTACT_EMAIL
-- ---------------------------------------------------------------------------
create table if not exists ace.contact_email (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references ace.contact (id) on delete cascade,
  email text not null,
  email_type text not null default 'MAIN',
  is_primary boolean not null default false,
  opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  constraint ace_contact_email_type_check check (
    email_type in ('MAIN', 'WORK', 'PERSONAL', 'BILLING')
  )
);

create index if not exists ace_contact_email_contact_idx on ace.contact_email (contact_id);

-- ---------------------------------------------------------------------------
-- ACE_CONTACT_SYNC_LOG
-- ---------------------------------------------------------------------------
create table if not exists ace.contact_sync_log (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references ace.contact (id) on delete cascade,
  sync_type text not null,
  source text not null,
  fields_changed text,
  status text not null,
  error_code text,
  error_message text,
  sync_at timestamptz not null default now(),
  triggered_by text,
  constraint ace_contact_sync_log_sync_type_check check (
    sync_type in ('CREATE', 'UPDATE', 'DELETE', 'FULL_REFRESH')
  ),
  constraint ace_contact_sync_log_source_check check (source in ('DYNAMICS365', 'ACE')),
  constraint ace_contact_sync_log_status_check check (
    status in ('SUCCESS', 'FAILED', 'SKIPPED')
  )
);

create index if not exists ace_contact_sync_log_contact_sync_at_idx
  on ace.contact_sync_log (contact_id, sync_at desc);

comment on column ace.contact_sync_log.fields_changed is 'JSON texto: {field:{before,after}}';

-- ---------------------------------------------------------------------------
-- AICX_CALL_SESSION
-- ---------------------------------------------------------------------------
create table if not exists aicx.call_session (
  id uuid primary key default gen_random_uuid(),
  call_provider text not null default 'TWILIO',
  provider_call_id text not null,
  parent_provider_call_id text,
  direction text not null,
  call_status text not null default 'INITIATED',
  call_start_at timestamptz,
  call_end_at timestamptz,
  duration_seconds integer,
  contact_type text,
  patient_crm_id text,
  hospital_crm_id text,
  ace_agent_id uuid references ace.agent (id) on delete set null,
  agent_user_id uuid references auth.users (id) on delete set null,
  phone_number_from text,
  phone_number_to text,
  account_sid text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aicx_call_session_provider_call_unique unique (call_provider, provider_call_id),
  constraint aicx_call_session_direction_check check (
    direction in ('INBOUND', 'OUTBOUND', 'UNKNOWN')
  ),
  constraint aicx_call_session_status_check check (
    call_status in (
      'INITIATED',
      'ACTIVE',
      'COMPLETED',
      'FAILED',
      'CALLBACK_CREATED'
    )
  ),
  constraint aicx_call_session_contact_type_check check (
    contact_type is null or contact_type in ('PATIENT', 'HOSPITAL')
  ),
  constraint aicx_call_session_provider_check check (call_provider in ('TWILIO'))
);

create index if not exists aicx_call_session_created_at_idx on aicx.call_session (created_at desc);
create index if not exists aicx_call_session_agent_user_idx on aicx.call_session (agent_user_id);
create index if not exists aicx_call_session_parent_idx on aicx.call_session (parent_provider_call_id);

comment on column aicx.call_session.agent_user_id is
  'Puente operativo Thinkia (Supabase) hasta sync ACE_AGENT ↔ D365.';

-- ---------------------------------------------------------------------------
-- AICX_CALL_TRANSCRIPTION
-- ---------------------------------------------------------------------------
create table if not exists aicx.call_transcription (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references aicx.call_session (id) on delete cascade,
  patient_crm_id text,
  transcription_text text not null,
  transcription_json text,
  language text,
  speech_provider text not null default 'GCP_STT',
  created_at timestamptz not null default now(),
  constraint aicx_call_transcription_language_check check (
    language is null or language in ('es', 'en', 'pt')
  ),
  constraint aicx_call_transcription_speech_check check (
    speech_provider in ('GCP_STT')
  )
);

create unique index if not exists aicx_call_transcription_session_one_row_uidx
  on aicx.call_transcription (call_session_id);

-- ---------------------------------------------------------------------------
-- AICX_CALL_SUMMARY
-- ---------------------------------------------------------------------------
create table if not exists aicx.call_summary (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references aicx.call_session (id) on delete cascade,
  patient_crm_id text,
  summary_text text not null,
  call_reason text,
  intent text,
  urgency_level text,
  next_action text,
  requires_follow_up boolean not null default false,
  sentiment text,
  generated_by_model text not null default 'gemini-1.5-flash',
  confidence_score numeric(5, 4),
  human_review_flag boolean not null default false,
  created_at timestamptz not null default now(),
  constraint aicx_call_summary_intent_check check (
    intent is null
    or intent in (
      'CONSULTATION',
      'INCIDENT',
      'ORDER',
      'CLAIM',
      'FOLLOW_UP',
      'OTHER'
    )
  ),
  constraint aicx_call_summary_urgency_check check (
    urgency_level is null
    or urgency_level in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')
  ),
  constraint aicx_call_summary_sentiment_check check (
    sentiment is null or sentiment in ('POSITIVE', 'NEUTRAL', 'NEGATIVE')
  )
);

create unique index if not exists aicx_call_summary_session_one_row_uidx
  on aicx.call_summary (call_session_id);

-- ---------------------------------------------------------------------------
-- AICX_CALL_DOCUMENT
-- ---------------------------------------------------------------------------
create table if not exists aicx.call_document (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references aicx.call_session (id) on delete cascade,
  patient_crm_id text,
  document_type text not null,
  document_name text,
  document_url text,
  storage_provider text,
  hash_sha256 text,
  created_at timestamptz not null default now(),
  constraint aicx_call_document_type_check check (document_type in ('JSON', 'PDF')),
  constraint aicx_call_document_storage_check check (
    storage_provider is null or storage_provider in ('GCP_STORAGE', 'SHAREPOINT')
  )
);

create index if not exists aicx_call_document_session_idx on aicx.call_document (call_session_id);

-- ---------------------------------------------------------------------------
-- AICX_CRM_SYNC
-- ---------------------------------------------------------------------------
create table if not exists aicx.crm_sync (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references aicx.call_session (id) on delete cascade,
  patient_crm_id text,
  crm_system text not null default 'DYNAMICS365',
  crm_activity_id text,
  sync_status text not null default 'PENDING',
  payload text not null,
  error_message text,
  retry_count integer not null default 0,
  last_attempt_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aicx_crm_sync_system_check check (crm_system in ('DYNAMICS365')),
  constraint aicx_crm_sync_status_check check (
    sync_status in ('PENDING', 'SENT', 'CONFIRMED', 'FAILED', 'ERROR')
  )
);

create index if not exists aicx_crm_sync_status_idx on aicx.crm_sync (sync_status);

-- ---------------------------------------------------------------------------
-- AICX_CALL_AUDIT
-- ---------------------------------------------------------------------------
create table if not exists aicx.call_audit (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references aicx.call_session (id) on delete cascade,
  event_type text not null,
  previous_status text,
  new_status text,
  actor text,
  source_ip text,
  payload_snapshot text,
  error_detail text,
  created_at timestamptz not null default now(),
  constraint aicx_call_audit_event_check check (
    event_type in (
      'SESSION_CREATED',
      'LOOKUP_DONE',
      'TRANSCRIPTION_STARTED',
      'SUMMARY_GENERATED',
      'DOCUMENT_CREATED',
      'CRM_SENT',
      'CRM_CONFIRMED',
      'CRM_FAILED',
      'RETRY_TRIGGERED'
    )
  )
);

create index if not exists aicx_call_audit_session_created_idx
  on aicx.call_audit (call_session_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Phase II — AICX_ORDER, AICX_ORDER_LINE
-- ---------------------------------------------------------------------------
create table if not exists aicx."order" (
  id uuid primary key default gen_random_uuid(),
  call_session_id uuid not null references aicx.call_session (id) on delete cascade,
  patient_crm_id text,
  order_type text not null default 'ROUTINE',
  order_status text not null default 'PENDING_REVIEW',
  reviewed_by uuid references ace.agent (id) on delete set null,
  reviewed_at timestamptz,
  review_notes text,
  delivery_address_type text,
  delivery_address text,
  crm_order_id text,
  crm_submitted_at timestamptz,
  crm_status text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aicx_order_type_check check (order_type in ('ROUTINE')),
  constraint aicx_order_status_check check (
    order_status in ('PENDING_REVIEW', 'CONFIRMED', 'CORRECTED', 'ESCALATED', 'FAILED')
  ),
  constraint aicx_order_delivery_type_check check (
    delivery_address_type is null or delivery_address_type in ('REGULAR', 'HOLIDAY')
  ),
  constraint aicx_order_crm_status_check check (
    crm_status is null or crm_status in ('PENDING', 'CONFIRMED', 'FAILED')
  )
);

create index if not exists aicx_order_status_idx on aicx."order" (order_status);

create table if not exists aicx.order_line (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references aicx."order" (id) on delete cascade,
  product_name text not null,
  product_reference text,
  boxes_ordered integer not null default 0,
  loose_units integer not null default 0,
  confirmed_by_patient boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists aicx_order_line_order_idx on aicx.order_line (order_id);

-- ---------------------------------------------------------------------------
-- Triggers updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists ace_agent_set_updated_at on ace.agent;
create trigger ace_agent_set_updated_at
  before update on ace.agent
  for each row execute function public.set_updated_at();

drop trigger if exists ace_contact_set_updated_at on ace.contact;
create trigger ace_contact_set_updated_at
  before update on ace.contact
  for each row execute function public.set_updated_at();

drop trigger if exists ace_contact_patient_set_updated_at on ace.contact_patient;
create trigger ace_contact_patient_set_updated_at
  before update on ace.contact_patient
  for each row execute function public.set_updated_at();

drop trigger if exists ace_contact_hospital_set_updated_at on ace.contact_hospital;
create trigger ace_contact_hospital_set_updated_at
  before update on ace.contact_hospital
  for each row execute function public.set_updated_at();

drop trigger if exists aicx_call_session_set_updated_at on aicx.call_session;
create trigger aicx_call_session_set_updated_at
  before update on aicx.call_session
  for each row execute function public.set_updated_at();

drop trigger if exists aicx_crm_sync_set_updated_at on aicx.crm_sync;
create trigger aicx_crm_sync_set_updated_at
  before update on aicx.crm_sync
  for each row execute function public.set_updated_at();

drop trigger if exists aicx_order_set_updated_at on aicx."order";
create trigger aicx_order_set_updated_at
  before update on aicx."order"
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: operativa vía service_role / APIs; sin SELECT directo anon.
-- ---------------------------------------------------------------------------
alter table ace.agent enable row level security;
alter table ace.contact enable row level security;
alter table ace.contact_patient enable row level security;
alter table ace.contact_hospital enable row level security;
alter table ace.contact_phone enable row level security;
alter table ace.contact_email enable row level security;
alter table ace.contact_sync_log enable row level security;
alter table aicx.call_session enable row level security;
alter table aicx.call_transcription enable row level security;
alter table aicx.call_summary enable row level security;
alter table aicx.call_document enable row level security;
alter table aicx.crm_sync enable row level security;
alter table aicx.call_audit enable row level security;
alter table aicx."order" enable row level security;
alter table aicx.order_line enable row level security;

revoke usage on schema ace from anon;
revoke usage on schema aicx from anon;
revoke all on ace.agent from anon;
revoke all on ace.contact from anon;
revoke all on ace.contact_patient from anon;
revoke all on ace.contact_hospital from anon;
revoke all on ace.contact_phone from anon;
revoke all on ace.contact_email from anon;
revoke all on ace.contact_sync_log from anon;
revoke all on aicx.call_session from anon;
revoke all on aicx.call_transcription from anon;
revoke all on aicx.call_summary from anon;
revoke all on aicx.call_document from anon;
revoke all on aicx.crm_sync from anon;
revoke all on aicx.call_audit from anon;
revoke all on aicx."order" from anon;
revoke all on aicx.order_line from anon;

revoke usage on schema ace from authenticated;
revoke usage on schema aicx from authenticated;
revoke all on ace.agent from authenticated;
revoke all on ace.contact from authenticated;
revoke all on ace.contact_patient from authenticated;
revoke all on ace.contact_hospital from authenticated;
revoke all on ace.contact_phone from authenticated;
revoke all on ace.contact_email from authenticated;
revoke all on ace.contact_sync_log from authenticated;
revoke all on aicx.call_session from authenticated;
revoke all on aicx.call_transcription from authenticated;
revoke all on aicx.call_summary from authenticated;
revoke all on aicx.call_document from authenticated;
revoke all on aicx.crm_sync from authenticated;
revoke all on aicx.call_audit from authenticated;
revoke all on aicx."order" from authenticated;
revoke all on aicx.order_line from authenticated;

grant usage on schema ace to service_role;
grant usage on schema aicx to service_role;
grant all on ace.agent to service_role;
grant all on ace.contact to service_role;
grant all on ace.contact_patient to service_role;
grant all on ace.contact_hospital to service_role;
grant all on ace.contact_phone to service_role;
grant all on ace.contact_email to service_role;
grant all on ace.contact_sync_log to service_role;
grant all on aicx.call_session to service_role;
grant all on aicx.call_transcription to service_role;
grant all on aicx.call_summary to service_role;
grant all on aicx.call_document to service_role;
grant all on aicx.crm_sync to service_role;
grant all on aicx.call_audit to service_role;
grant all on aicx."order" to service_role;
grant all on aicx.order_line to service_role;

comment on table aicx.call_session is
  'Sesión de llamada (fase 8 del flujo). Twilio: provider_call_id = CallSid.';
comment on table aicx.call_audit is 'Auditoría append-only; retención según gobierno de datos.';
