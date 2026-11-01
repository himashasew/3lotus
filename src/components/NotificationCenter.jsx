import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { collection, getDocs, updateDoc, doc, query, where, orderBy, limit, db } from '../services/data';
import { useAuth } from '../context/AuthContext';
import { today } from '../lib/payroll';
import { lowStockAlerts, invoiceAlerts, hrAlerts, sortAlerts, previousMonth } from '../lib/alerts';
import NotificationPanel from './NotificationPanel';

const POLL_MS = 60000;

const readDismissed = (uid) => {
  try { return JSON.parse(localStorage.getItem(`lotus-dismissed:${uid}`)) || {}; } catch { return {}; }
};
const writeDismissed = (uid, map) => {
  try { localStorage.setItem(`lotus-dismissed:${uid}`, JSON.stringify(map)); } catch { /* storage blocked */ }
};

/** Bell in the top bar + panel. Pulls alert data for whatever the signed-in role may see. */
export default function NotificationCenter() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, hasAccess } = useAuth();
  const canStock = hasAccess('KITCHEN');
  const canInvoices = hasAccess('SALES');
  const canHr = hasAccess('MANAGER');
  const canActivity = hasAccess('ADMIN');

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState('alerts');
  const [loading, setLoading] = useState(true);
  const [rawAlerts, setRawAlerts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [dismissed, setDismissed] = useState({});
  const wrapRef = useRef(null);
  const uid = user?.uid;

  useEffect(() => { if (uid) setDismissed(readDismissed(uid)); }, [uid]);

  const load = useCallback(async () => {
    const todayIso = today();
    const jobs = [];
    if (canStock) jobs.push(getDocs(collection(db, 'products')).then((s) => lowStockAlerts(s.docs.map((d) => ({ id: d.id, ...d.data() })))));
    if (canInvoices) jobs.push(getDocs(collection(db, 'invoices')).then((s) => invoiceAlerts(s.docs.map((d) => ({ id: d.id, ...d.data() })), todayIso)));
    if (canHr) {
      jobs.push(Promise.all([
        getDocs(collection(db, 'employees')),
        getDocs(query(collection(db, 'attendance'), where('date', '==', todayIso))),
        getDocs(query(collection(db, 'payroll'), where('month', '==', previousMonth(todayIso)))),
      ]).then(([emp, att, pay]) => hrAlerts({
        employees: emp.docs.map((d) => d.data()),
        attendanceToday: att.docs.map((d) => d.data()),
        payrollPrev: pay.docs.map((d) => d.data()),
        todayIso,
      })));
    }
    // a source the role cannot read (or a table not created yet) is skipped, never breaks the bell
    const results = await Promise.allSettled(jobs);
    setRawAlerts(sortAlerts(results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))));

    if (canActivity) {
      try {
        const snap = await getDocs(query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(25)));
        setActivity(snap.docs.map((d) => {
          const n = d.data();
          return { id: d.id, kind: 'activity', type: 'activity', severity: 'info', title: n.title, message: n.message, time: n.timestamp, read: !!n.read, link: '/stock' };
        }));
      } catch { setActivity([]); }
    }
    setLoading(false);
  }, [canStock, canInvoices, canHr, canActivity]);

  useEffect(() => {
    load();
    const timer = setInterval(load, POLL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [load]);

  // forget dismissals for alerts that no longer exist, so they can come back if the problem returns
  useEffect(() => {
    if (!uid || loading) return;
    const live = new Set(rawAlerts.map((a) => a.id));
    const pruned = Object.fromEntries(Object.entries(dismissed).filter(([id]) => live.has(id)));
    if (Object.keys(pruned).length !== Object.keys(dismissed).length) { setDismissed(pruned); writeDismissed(uid, pruned); }
  }, [rawAlerts, loading, uid, dismissed]);

  const alerts = useMemo(() => rawAlerts.filter((a) => !dismissed[a.id]), [rawAlerts, dismissed]);
  const unreadActivity = activity.filter((a) => !a.read).length;
  const badge = alerts.length + unreadActivity;
  const hasDanger = alerts.some((a) => a.severity === 'danger');

  // close on Esc and on clicks outside the panel
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  const dismiss = (id) => {
    const next = { ...dismissed, [id]: Date.now() };
    setDismissed(next);
    if (uid) writeDismissed(uid, next);
  };
  const dismissAll = () => {
    const next = { ...dismissed };
    alerts.forEach((a) => { next[a.id] = Date.now(); });
    setDismissed(next);
    if (uid) writeDismissed(uid, next);
  };

  const markRead = async (id) => {
    setActivity((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try { await updateDoc(doc(db, 'notifications', id), { read: true }); } catch { /* shown as read until next refresh */ }
  };
  const markAllRead = async () => {
    const ids = activity.filter((n) => !n.read).map((n) => n.id);
    setActivity((list) => list.map((n) => ({ ...n, read: true })));
    await Promise.allSettled(ids.map((id) => updateDoc(doc(db, 'notifications', id), { read: true })));
  };

  const openItem = (item) => {
    if (item.kind === 'activity') markRead(item.id);
    setOpen(false);
    if (item.link) navigate(item.link);
  };

  const toggle = () => { if (!open) load(); setOpen(!open); };

  if (!canStock) return null;   // roles below Kitchen have nothing to be notified about

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button className={`notif-bell ${hasDanger ? 'has-danger' : ''}`} onClick={toggle} aria-haspopup="dialog" aria-expanded={open}
        aria-label={badge ? t('Notifications') + ` (${badge})` : t('Notifications')}>
        <span aria-hidden="true">🔔</span>
        {badge > 0 && <span className="notif-badge">{badge > 9 ? '9+' : badge}</span>}
      </button>

      {open && (
        <>
          <div className="notif-backdrop" onClick={() => setOpen(false)} />
          <NotificationPanel
            alerts={alerts} activity={activity} canSeeActivity={canActivity} tab={canActivity ? tab : 'alerts'} onTab={setTab}
            loading={loading} onClose={() => setOpen(false)} onOpenItem={openItem}
            onDismiss={dismiss} onDismissAll={dismissAll} onMarkAllRead={markAllRead}
          />
        </>
      )}
    </div>
  );
}
