import { createContext, useContext, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// Toast alerts and a styled confirm dialog, replacing the browser's alert()/confirm() popups.
//   const { toast, confirm } = useUI();
//   toast.success('Saved');  toast.error(err.message);
//   if (await confirm('Delete this?')) { ... }

const UIContext = createContext(null);
const ICONS = { success: '✓', error: '✕', warning: '!', info: 'i' };
const DURATION = { success: 4000, info: 5000, warning: 7000, error: 8000 };

let nextId = 1;

export function UIProvider({ children }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);

  const schedule = useCallback((id, ms) => {
    clearTimeout(timers.current.get(id));
    timers.current.set(id, setTimeout(() => dismiss(id), ms));
  }, [dismiss]);

  const toast = useMemo(() => {
    const add = (type) => (message, opts = {}) => {
      if (!message) return null;
      const id = nextId++;
      setToasts((list) => [...list.slice(-3), { id, type, message: String(message), title: opts.title }]);
      schedule(id, opts.duration ?? DURATION[type]);
      return id;
    };
    return { success: add('success'), error: add('error'), warning: add('warning'), info: add('info'), dismiss };
  }, [dismiss, schedule]);

  const confirm = useCallback((message, opts = {}) => new Promise((resolve) => {
    setDialog({ message, title: opts.title, confirmLabel: opts.confirmLabel, cancelLabel: opts.cancelLabel, danger: opts.danger !== false, resolve });
  }), []);

  const answer = (value) => {
    if (dialog) dialog.resolve(value);
    setDialog(null);
  };

  // Esc cancels the dialog
  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') { dialog.resolve(false); setDialog(null); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialog]);

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <UIContext.Provider value={value}>
      {children}

      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((x) => (
          <div
            key={x.id}
            className={`toast toast-${x.type}`}
            role={x.type === 'error' || x.type === 'warning' ? 'alert' : 'status'}
            onMouseEnter={() => clearTimeout(timers.current.get(x.id))}
            onMouseLeave={() => schedule(x.id, 2500)}
          >
            <span className="toast-icon" aria-hidden="true">{ICONS[x.type]}</span>
            <div className="toast-body">
              {x.title && <div className="toast-title">{x.title}</div>}
              <div className="toast-message">{x.message}</div>
            </div>
            <button className="toast-close" onClick={() => dismiss(x.id)} aria-label={t('Close')}>✕</button>
          </div>
        ))}
      </div>

      {dialog && (
        <div className="confirm-overlay" onClick={() => answer(false)}>
          <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" onClick={(e) => e.stopPropagation()}>
            <div className={`confirm-icon ${dialog.danger ? 'danger' : ''}`} aria-hidden="true">{dialog.danger ? '!' : '?'}</div>
            <h2 id="confirm-title">{dialog.title || t('Are you sure?')}</h2>
            <p>{dialog.message}</p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => answer(false)} autoFocus>{dialog.cancelLabel || t('Cancel')}</button>
              <button className={dialog.danger ? 'btn-danger' : 'btn-save'} onClick={() => answer(true)}>{dialog.confirmLabel || t('Confirm')}</button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
}

export function useUI() {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI must be used within UIProvider');
  return ctx;
}
