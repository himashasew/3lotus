import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from 'react-i18next';
import '../styles/login.css';

export default function Login() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(
        err.code === 'auth/invalid-credential'
          ? 'Invalid email or password'
          : err.message
      );
    }
    setLoading(false);
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <img src="/3 lotus.svg" alt="3 Lotus Logo" />
          <h1>3 Lotus CRM</h1>
          <p>{t('welcome')}</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          {error && <div className="login-error">{error}</div>}

          <div className="form-group">
            <label>{t('email')}</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>{t('password')}</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? '...' : t('login')}
          </button>
        </form>

        <p className="login-footer-text">{t('contactAdmin')}</p>
      </div>
    </div>
  );
}
