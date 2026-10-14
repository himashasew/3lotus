// Small data layer over Supabase, keeping the call shape the pages already use
// (collection / doc / query / getDocs / addDoc / updateDoc / deleteDoc / onSnapshot).
//
// Business collections are stored as JSON documents: one table per collection
// with columns (id, data jsonb, created_at). "users" maps onto the profiles table.
import { supabase } from './supabase';

export const db = null; // kept so `collection(db, 'x')` call sites read the same

const USERS = 'users';

const fromProfile = (r) => ({
  email: r.email,
  displayName: r.display_name,
  role: r.role,
  fontSize: r.font_size,
  createdAt: r.created_at,
});

const toProfile = (p) => {
  const out = {};
  if ('displayName' in p) out.display_name = p.displayName;
  if ('fontSize' in p) out.font_size = p.fontSize;
  if ('role' in p) out.role = p.role;
  return out;
};

const fail = ({ error }) => {
  if (error) throw error;
};

export const collection = (_db, name) => ({ kind: 'collection', name, filters: [], order: null, max: null });
export const doc = (_db, name, id) => ({ kind: 'doc', name, id });

export const where = (field, op, value) => ({ type: 'where', field, op, value });
export const orderBy = (field, direction = 'asc') => ({ type: 'orderBy', field, direction });
export const limit = (n) => ({ type: 'limit', n });
export const serverTimestamp = () => new Date().toISOString();

export const query = (col, ...constraints) => {
  const q = { ...col, filters: [...col.filters] };
  for (const c of constraints) {
    if (c.type === 'where') q.filters.push(c);
    if (c.type === 'orderBy') q.order = c;
    if (c.type === 'limit') q.max = c.n;
  }
  return q;
};

const snapshot = (rows) => {
  const docs = rows.map((r) => ({ id: r.id, data: () => r.fields }));
  return { docs, size: docs.length, empty: docs.length === 0, forEach: (fn) => docs.forEach(fn) };
};

export async function getDocs(q) {
  if (q.name === USERS) {
    const res = await supabase.from('profiles').select('*');
    fail(res);
    return snapshot(res.data.map((r) => ({ id: r.id, fields: fromProfile(r) })));
  }

  let req = supabase.from(q.name).select('id, data, created_at');
  for (const f of q.filters) {
    if (f.op !== '==') throw new Error(`Unsupported filter operator ${f.op}`);
    req = req.eq(`data->>${f.field}`, String(f.value));
  }
  if (q.order) req = req.order(`data->>${q.order.field}`, { ascending: q.order.direction !== 'desc' });
  if (q.max) req = req.limit(q.max);

  const res = await req;
  fail(res);
  return snapshot(res.data.map((r) => ({ id: r.id, fields: r.data })));
}

export async function getDoc(ref) {
  const snap = await getDocs({ ...collection(null, ref.name), filters: [] });
  const found = snap.docs.find((d) => d.id === ref.id);
  return { id: ref.id, exists: () => Boolean(found), data: () => found?.data() };
}

export async function addDoc(col, fields) {
  if (col.name === USERS) throw new Error('Create users through the admin API');
  const res = await supabase.from(col.name).insert({ data: fields }).select('id').single();
  fail(res);
  return { id: res.data.id };
}

// Inserts many documents in one request; returns their ids in the same order.
export async function addDocs(col, list) {
  if (col.name === USERS) throw new Error('Create users through the admin API');
  if (list.length === 0) return [];
  const res = await supabase.from(col.name).insert(list.map((data) => ({ data }))).select('id');
  fail(res);
  return res.data.map((r) => ({ id: r.id }));
}

export async function updateDoc(ref, patch) {
  if (ref.name === USERS) {
    fail(await supabase.from('profiles').update(toProfile(patch)).eq('id', ref.id));
    return;
  }
  fail(await supabase.rpc('merge_doc', { tbl: ref.name, doc_id: ref.id, patch }));
}

export async function deleteDoc(ref) {
  if (ref.name === USERS) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch('/api/admin-users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
      body: JSON.stringify({ action: 'delete', userId: ref.id }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Could not delete user');
    return;
  }
  fail(await supabase.from(ref.name).delete().eq('id', ref.id));
}

// Polls instead of a live socket — plenty for the notification bell.
export function onSnapshot(q, callback, intervalMs = 15000) {
  let active = true;
  const run = async () => {
    try {
      const snap = await getDocs(q);
      if (active) callback(snap);
    } catch (err) {
      console.error('Snapshot error:', err);
    }
  };
  run();
  const timer = setInterval(run, intervalMs);
  return () => {
    active = false;
    clearInterval(timer);
  };
}
