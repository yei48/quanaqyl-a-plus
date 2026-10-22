'use client';
import { useEffect, useState } from 'react';
import AuthForm from './auth-form';
import { type Lang } from '@/lib/catalog';
export default function ResetPassword() {
  const [lang, setLang] = useState<Lang>('ru');
  useEffect(() => { try { const value = localStorage.getItem('quanaqyl-language'); if (value === 'ru' || value === 'en' || value === 'kk') setLang(value); } catch {} }, []);
  return <main className="login-page"><section className="card login-card">
    <img className="login-logo" src="/assets/logo.png" alt="QuanAQYL A+" />
    <h1>{{ ru: 'Новый пароль', en: 'New password', kk: 'Жаңа құпиясөз' }[lang]}</h1>
    <label className="field"><span>{{ ru: 'Язык', en: 'Language', kk: 'Тіл' }[lang]}</span><select value={lang} onChange={event => setLang(event.target.value as Lang)}><option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option></select></label>
    <AuthForm lang={lang} reset />
    <a className="auth-link" href="/">{{ ru: 'На главную', en: 'Home', kk: 'Басты бет' }[lang]}</a>
  </section></main>;
}
