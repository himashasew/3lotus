// Vercel serverless function: create / delete users on behalf of an Admin or Developer.
// Needs env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server only — never expose to the browser).
import { createClient } from '@supabase/supabase-js';

const LEVELS = { CLIENT: 1, DELIVERY: 2, KITCHEN: 3, SALES: 4, MANAGER: 5, ADMIN: 6, DEVELOPER: 7 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return res.status(500).json({ error: 'Server is missing Supabase credentials' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const { data: caller, error: authError } = await admin.auth.getUser(token);
  if (authError || !caller?.user) return res.status(401).json({ error: 'Not signed in' });

  const { data: callerProfile } = await admin.from('profiles').select('role').eq('id', caller.user.id).single();
  const callerLevel = LEVELS[callerProfile?.role] || 0;
  if (callerLevel < LEVELS.ADMIN) return res.status(403).json({ error: 'Admin access required' });

  const { action, email, password, role, displayName, userId } = req.body || {};

  if (action === 'create') {
    if (!email || !password || !LEVELS[role]) return res.status(400).json({ error: 'email, password and a valid role are required' });
    // Nobody can create an account above their own level (Admins cannot mint Developers).
    if (LEVELS[role] > callerLevel || (role === 'DEVELOPER' && callerLevel < LEVELS.DEVELOPER)) {
      return res.status(403).json({ error: 'You cannot assign that role' });
    }
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role, display_name: displayName || email.split('@')[0] },
    });
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ id: data.user.id });
  }

  if (action === 'delete') {
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    if (userId === caller.user.id) return res.status(400).json({ error: 'You cannot delete your own account' });
    const { data: target } = await admin.from('profiles').select('role').eq('id', userId).single();
    if ((LEVELS[target?.role] || 0) >= callerLevel && callerLevel < LEVELS.DEVELOPER) {
      return res.status(403).json({ error: 'You cannot delete a user of equal or higher role' });
    }
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) return res.status(400).json({ error: error.message });
    return res.status(200).json({ ok: true });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
