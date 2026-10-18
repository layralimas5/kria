// Postgres de verdade (pglite) com os stubs mínimos do Supabase e todas as
// migrations aplicadas. Usado pelos testes de banco que rodam sem Docker.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'

const MIGRATIONS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../migrations')

const SUPABASE_STUBS = [
  `create role anon nologin`,
  `create role authenticated nologin`,
  `create role service_role nologin bypassrls`,
  `grant usage on schema public to anon, authenticated, service_role`,
  `alter default privileges in schema public grant all on tables to anon, authenticated, service_role`,
  `alter default privileges in schema public grant all on functions to anon, authenticated, service_role`,
  `create schema auth`,
  `create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb)`,
  `create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$`,
  `grant usage on schema auth to anon, authenticated, service_role`,
  `create schema storage`,
  `create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[])`,
  `create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid)`,
  `create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$`,
  `grant usage on schema storage to authenticated, service_role`,
  `grant select on storage.objects to authenticated`,
]

export async function boot() {
  const db = new PGlite({ extensions: { pgcrypto } })
  for (const statement of SUPABASE_STUBS) await db.exec(statement)
  for (const file of fs.readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(fs.readFileSync(path.join(MIGRATIONS, file), 'utf8'))
  }
  return db
}

export async function as(db, role, userId, fn) {
  await db.exec(`set role ${role}`)
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [JSON.stringify(userId ? { sub: userId } : {})])
  try {
    return await fn()
  } finally {
    await db.exec(`reset role`)
  }
}

export async function expectError(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.match(error.message, new RegExp(code))
    return true
  })
}

export async function newUser(db, email) {
  const { rows } = await db.query(`insert into auth.users (email) values ($1) returning id`, [email])
  return rows[0].id
}

export const balanceOf = async (db, userId) =>
  (await db.query(`select balance from credit_balances where user_id = $1`, [userId])).rows[0].balance

export function runner() {
  let passed = 0
  return {
    async test(name, fn) {
      const db = await boot()
      await fn(db)
      passed += 1
      console.log(`ok  ${name}`)
    },
    get passed() {
      return passed
    },
  }
}
