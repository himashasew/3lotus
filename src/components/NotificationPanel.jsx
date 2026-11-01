import { useTranslation } from 'react-i18next';
import { timeAgo } from '../lib/alerts';

const TYPE_ICON = { stock: '📦', invoice: '🧾', attendance: '🗓️', payroll: '💵', activity: '🔔' };

function Item({ item, onOpen, onDismiss, t }) {
  const isAlert = item.kind === 'alert';
  const title = isAlert ? t(item.title, item.vars) : item.title;
  const message = isAlert ? t(item.message, item.vars) : item.message;
  const ago = item.time ? timeAgo(item.time) : null;
  const agoText = ago ? (ago.key === 'date' ? ago.vars.date : t(ago.key, ago.vars)) : null;

  return (
    <li className={`notif-item sev-${item.severity} ${!isAlert && !item.read ? 'unread' : ''}`}>
      <button className="notif-item-main" onClick={() => onOpen(item)}>
        <span className="notif-item-icon" aria-hidden="true">{TYPE_ICON[item.type] || '🔔'}</span>
        <span className="notif-item-text">
          <span className="notif-item-title">{title}</span>
          <span className="notif-item-message">{message}</span>
          {agoText && <span className="notif-item-time">{agoText}</span>}
        </span>
        {!isAlert && !item.read && <span className="notif-dot" aria-label={t('Unread')} />}
      </button>
      {isAlert && (
        <button className="notif-dismiss" onClick={() => onDismiss(item.id)} aria-label={t('Dismiss')} title={t('Dismiss')}>✕</button>
      )}
    </li>
  );
}

/** Presentational panel: shows alerts and activity, reports clicks upward. */
export default function NotificationPanel({
  alerts, activity, canSeeActivity, tab, onTab, loading, onClose,
  onOpenItem, onDismiss, onDismissAll, onMarkAllRead,
}) {
  const { t } = useTranslation();
  const unread = activity.filter((a) => !a.read).length;
  const list = tab === 'activity' ? activity : alerts;

  return (
    <section className="notif-panel" role="dialog" aria-label={t('Notifications')}>
      <header className="notif-panel-header">
        <h2>{t('Notifications')}</h2>
        <button className="notif-close" onClick={onClose} aria-label={t('Close')}>✕</button>
      </header>

      <div className="notif-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'alerts'} className={tab === 'alerts' ? 'active' : ''} onClick={() => onTab('alerts')}>
          {t('Alerts')}{alerts.length > 0 && <span className="notif-count">{alerts.length}</span>}
        </button>
        {canSeeActivity && (
          <button role="tab" aria-selected={tab === 'activity'} className={tab === 'activity' ? 'active' : ''} onClick={() => onTab('activity')}>
            {t('Activity')}{unread > 0 && <span className="notif-count">{unread}</span>}
          </button>
        )}
      </div>

      <ul className="notif-list">
        {list.map((item) => <Item key={item.id} item={item} onOpen={onOpenItem} onDismiss={onDismiss} t={t} />)}
        {list.length === 0 && (
          <li className="notif-empty">
            <div className="notif-empty-icon" aria-hidden="true">{loading ? '⏳' : '✅'}</div>
            <p>{loading ? t('Loading…') : tab === 'activity' ? t('No recent activity') : t('You’re all caught up — no alerts right now.')}</p>
          </li>
        )}
      </ul>

      {list.length > 0 && (
        <footer className="notif-panel-footer">
          {tab === 'activity'
            ? <button onClick={onMarkAllRead} disabled={unread === 0}>{t('Mark all as read')}</button>
            : <button onClick={onDismissAll}>{t('Dismiss all')}</button>}
        </footer>
      )}
    </section>
  );
}
