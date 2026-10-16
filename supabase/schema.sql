-- TrustLend database schema.
-- Run once in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
-- The script is safe to run again.
--
-- The columns match what the app reads and writes in:
--   src/lib/supabase.js, src/pages/Onboarding.jsx, src/pages/LoanFlow.jsx

create extension if not exists pgcrypto;

/* Helpers */

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Tier bands match LendingPool.getBorrowLimit (40 / 60 / 80).
create or replace function public.score_to_tier(p_score int)
returns text language sql immutable as $$
  select case
    when p_score >= 80 then 'Gold'
    when p_score >= 60 then 'Silver'
    when p_score >= 40 then 'Bronze'
    else 'Entry'
  end;
$$;

/* Tables */

create table if not exists public.users (
  id                  uuid primary key default gen_random_uuid(),
  wallet_address      text not null unique check (wallet_address = lower(wallet_address)),
  uid                 text unique default ('TL-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6))),
  did                 text generated always as ('did:ethr:' || wallet_address) stored,
  display_name        text,
  kyc_status          text not null default 'pending'
                      check (kyc_status in ('pending', 'submitted', 'verified', 'rejected')),
  role                text check (role in ('borrower', 'lender', 'both')),
  trust_score         int  not null default 30 check (trust_score between 0 and 100),
  tier                text not null default 'Entry',
  wallet_snapshot     jsonb,
  onboarding_done     boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- The app collects no phone, email, address, income or ID numbers. Re-running this file on an
-- older database removes those columns and any data in them.
alter table public.users
  drop column if exists residential_address,
  drop column if exists phone,
  drop column if exists email,
  drop column if exists monthly_income,
  drop column if exists kyc_aadhar,
  drop column if exists kyc_pan;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

create table if not exists public.loans (
  id             uuid primary key default gen_random_uuid(),
  wallet_address text not null references public.users (wallet_address) on delete cascade,
  amount         numeric not null check (amount > 0),
  path           text not null default 'trust',
  loan_status    text not null default 'pending'
                 check (loan_status in ('pending', 'active', 'repaid', 'defaulted', 'cancelled')),
  due_date       timestamptz,
  tx_hash        text,
  created_at     timestamptz not null default now()
);
create index if not exists loans_wallet_idx on public.loans (wallet_address, created_at desc);
create index if not exists loans_status_idx on public.loans (loan_status);

create table if not exists public.lender_positions (
  id            uuid primary key default gen_random_uuid(),
  lender_wallet text not null references public.users (wallet_address) on delete cascade,
  loan_id       uuid not null references public.loans (id) on delete cascade,
  funded_amount numeric not null check (funded_amount > 0),
  apy           numeric,
  status        text not null default 'active',
  tx_hash       text,
  created_at    timestamptz not null default now()
);
create index if not exists lender_positions_wallet_idx on public.lender_positions (lender_wallet, created_at desc);

create table if not exists public.vouches (
  id              uuid primary key default gen_random_uuid(),
  borrower_wallet text not null,
  voucher_wallet  text not null,
  stake_amount    numeric not null default 5 check (stake_amount > 0),
  status          text not null default 'pending'
                  check (status in ('pending', 'active', 'released', 'slashed', 'declined')),
  tx_hash         text,
  accepted_at     timestamptz,
  created_at      timestamptz not null default now(),
  check (borrower_wallet <> voucher_wallet)
);
create index if not exists vouches_borrower_idx on public.vouches (borrower_wallet, created_at desc);

create table if not exists public.score_events (
  id             uuid primary key default gen_random_uuid(),
  wallet_address text not null references public.users (wallet_address) on delete cascade,
  event_type     text not null,
  delta          int  not null,
  reason         text,
  loan_id        uuid references public.loans (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists score_events_wallet_idx on public.score_events (wallet_address, created_at desc);

/* Score function */

-- Starting rule: 30 points plus the sum of logged score events, kept in 0..100.
-- This is a placeholder rule, not a measured risk model. See docs/risk-model.md (planned).
create or replace function public.recalculate_trust_score(p_wallet text)
returns int language sql stable as $$
  select greatest(0, least(100, 30 + coalesce(sum(delta), 0)))::int
  from public.score_events
  where wallet_address = lower(p_wallet);
$$;

/* Row-level security */
-- PROTOTYPE POLICIES. The app signs in with a wallet and does not use Supabase Auth,
-- so the database cannot tell which wallet a browser request comes from. These
-- policies therefore allow the publishable (anon) key to read, insert and update.
-- Deletes stay blocked.
--
-- The app stores no personal data: only a wallet address, a display name, a role, loan records
-- and public chain data. Do not add personal data columns while these policies are open.
-- Before any real personal data is stored:
--   1. Verify the SIWE signature in a Supabase Edge Function.
--   2. Return a JWT that carries the wallet address.
--   3. Replace "using (true)" below with a check on that wallet claim.

do $$
declare t text;
begin
  foreach t in array array['users', 'loans', 'lender_positions', 'vouches', 'score_events']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "prototype read"   on public.%I', t);
    execute format('drop policy if exists "prototype insert" on public.%I', t);
    execute format('drop policy if exists "prototype update" on public.%I', t);
    execute format('create policy "prototype read"   on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "prototype insert" on public.%I for insert to anon, authenticated with check (true)', t);
    execute format('create policy "prototype update" on public.%I for update to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

/* KYC status guard */
-- The app limits loans above $10 to users with kyc_status = 'verified'. The browser must not
-- be able to set that value, so only the database owner or the service role can.
-- Verify a user in the SQL Editor (it runs as the owner), for example:
--   update public.users set kyc_status = 'verified' where wallet_address = '0xabc...';
-- A browser request (role anon) cannot change kyc_status, trust_score or tier.

create or replace function public.guard_kyc_status()
returns trigger language plpgsql as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    if tg_op = 'INSERT' then
      new.kyc_status := 'pending';
      new.trust_score := 30;           -- the contract holds the real score
      new.tier := 'Entry';
    else
      -- A browser request cannot change these. Only the database owner can.
      new.kyc_status := old.kyc_status;
      new.trust_score := old.trust_score;
      new.tier := old.tier;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists users_guard_kyc on public.users;
create trigger users_guard_kyc
  before insert or update on public.users
  for each row execute function public.guard_kyc_status();
