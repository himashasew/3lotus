import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Sidebar from './Sidebar';

export default function Layout() {
  const { i18n } = useTranslation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');

  const languages = [
    { code: 'en', label: 'EN' },
    { code: 'si', label: 'සි' },
    { code: 'ta', label: 'த' },
  ];

  return (
    <div className="app-layout">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-content">
        <header className="top-bar">
          <div className="top-bar-left">
            <button className="hamburger" onClick={() => setSidebarOpen(true)}>
              ☰
            </button>
          </div>

          <div className="top-bar-right">
            <div className="lang-switcher">
              {languages.map((lang) => (
                <button
                  key={lang.code}
                  className={`lang-btn ${i18n.language === lang.code ? 'active' : ''}`}
                  onClick={() => i18n.changeLanguage(lang.code)}
                >
                  {lang.label}
                </button>
              ))}
            </div>
            <button className="theme-toggle" onClick={toggleTheme}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </header>

        <div className="page-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
