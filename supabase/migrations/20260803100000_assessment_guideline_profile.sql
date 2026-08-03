-- Record which guideline set an assessment followed (state-localized
-- inspection guidelines): 'composite', 'us-ca', 'us-ga', ...
-- See src/features/assessment/content/guidelines.
alter table public.assessments
  add column if not exists guideline_profile text;
