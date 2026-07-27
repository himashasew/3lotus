import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { updatePassword } from 'firebase/auth';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { user, userProfile } = useAuth();
  const [displayName, setDisplayName] = useState(userProfile?.displayName || '');
  const [fontSize, setFontSize] = useState(userProfile?.fontSize || 'medium');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  const saveProfile = async () => {
    try {
      await updateDoc(doc(db, 'users', user.uid), { displayName, fontSize });
      setMessage({ text: t('profileUpdated'), type: 'success' });
      
      // Update local state temporarily (AuthContext will pick up from DB soon, but good for instant feedback)
      if (userProfile) userProfile.fontSize = fontSize;
      
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      setMessage({ text: 'Error: ' + err.message, type: 'error' });
    }
  };

  const changePassword = async () => {
    try {
      await updatePassword(user, newPassword);
      setNewPassword('');
      setMessage({ text: t('passwordChanged'), type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } catch (err) {
      setMessage({ text: 'Error: ' + err.message, type: 'error' });
    }
  };

  return (
    <div className="fade-in">
      <h1 style={{ marginBottom: '1.5rem' }}>{t('settings')}</h1>

      {message.text && (
        <div className={message.type === 'success' ? 'msg-success' : 'msg-error'}>
          {message.text}
        </div>
      )}

      {/* Profile Section */}
      <div className="data-section">
        <div className="data-section-header">
          <h2>👤 {t('profile')}</h2>
        </div>
        <div className="form-group" style={{ marginBottom: '0.85rem' }}>
          <label>{t('email')}</label>
          <input value={user?.email || ''} disabled />
        </div>
        <div className="form-group" style={{ marginBottom: '0.85rem' }}>
          <label>{t('displayName')}</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: '0.85rem' }}>
          <label>{t('role')}</label>
          <input value={userProfile?.role || ''} disabled />
        </div>
        <button className="btn-add" onClick={saveProfile}>{t('save')}</button>
      </div>

      {/* Display Settings */}
      <div className="data-section">
        <div className="data-section-header">
          <h2>👁️ {t('displaySettings') || 'Display Settings'}</h2>
        </div>
        <div className="form-group" style={{ marginBottom: '0.85rem' }}>
          <label>{t('fontSize') || 'Font Size'}</label>
          <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
            {[{ code: 'small', label: t('fontSmall') || 'Small' }, { code: 'medium', label: t('fontMedium') || 'Medium' }, { code: 'large', label: t('fontLarge') || 'Large' }].map(size => (
              <button
                key={size.code}
                onClick={() => setFontSize(size.code)}
                className={fontSize === size.code ? 'btn-add' : 'btn-cancel'}
                style={{ padding: '0.5rem 1rem' }}
              >
                {size.label}
              </button>
            ))}
          </div>
        </div>
        <button className="btn-add" onClick={saveProfile}>{t('save')}</button>
      </div>

      {/* Language Section */}
      <div className="data-section">
        <div className="data-section-header">
          <h2>🌐 {t('language')}</h2>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
          {[{ code: 'en', label: 'English' }, { code: 'si', label: 'සිංහල' }, { code: 'ta', label: 'தமிழ்' }].map(lang => (
            <button
              key={lang.code}
              onClick={() => i18n.changeLanguage(lang.code)}
              className={i18n.language === lang.code ? 'btn-add' : 'btn-cancel'}
            >
              {lang.label}
            </button>
          ))}
        </div>
      </div>

      {/* Change Password */}
      <div className="data-section">
        <div className="data-section-header">
          <h2>🔒 {t('changePassword')}</h2>
        </div>
        <div className="form-group" style={{ marginBottom: '0.85rem' }}>
          <label>{t('newPassword')}</label>
          <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" minLength={6} />
        </div>
        <button className="btn-add" onClick={changePassword} disabled={newPassword.length < 6}>{t('save')}</button>
      </div>
    </div>
  );
}
