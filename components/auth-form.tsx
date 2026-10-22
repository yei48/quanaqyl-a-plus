'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { browserClient } from '@/lib/supabase/client';
import { authConfigured } from '@/lib/supabase/config';
import { L, type Lang } from '@/lib/catalog';

const labels = {
  login: L('Sign in', 'Войти', 'Кіру'), signup: L('Create account', 'Создать аккаунт', 'Тіркелу'),
  email: L('E-mail', 'E-mail', 'E-mail'), name: L('Your name', 'Твоё имя', 'Атың'),
  password: L('Password', 'Пароль', 'Құпиясөз'), confirm: L('Repeat password', 'Повтори пароль', 'Құпиясөзді қайтала'),
  forgot: L('Forgot password?', 'Забыла пароль?', 'Құпиясөзді ұмыттың ба?'),
  recover: L('Send reset link', 'Отправить ссылку', 'Сілтеме жіберу'),
  reset: L('Set a new password', 'Установить новый пароль', 'Жаңа құпиясөз орнату'),
  back: L('Back to sign in', 'Назад ко входу', 'Кіруге оралу'),
  wait: L('Please wait…', 'Подожди…', 'Күте тұр…'),
  check: L('Check your e-mail and follow the link. You may need to check Spam.', 'Проверь почту и перейди по ссылке. Загляни также в «Спам».', 'Поштаңды тексеріп, сілтемені аш. «Спам» қалтасын да тексер.'),
  recoverySent: L('If this address has an account, a reset link will arrive by e-mail.', 'Если для этого адреса есть аккаунт, на почту придёт ссылка для смены пароля.', 'Бұл мекенжайда аккаунт болса, құпиясөзді өзгерту сілтемесі поштаға келеді.'),
  invalid: L('Check your e-mail and password, and confirm your e-mail if you just registered.', 'Проверь e-mail и пароль. Если ты только зарегистрировалась, подтверди почту.', 'E-mail мен құпиясөзді тексер. Жаңа тіркелсең, поштаңды раста.'),
  short: L('Use at least 8 characters for your password.', 'Пароль должен содержать минимум 8 символов.', 'Құпиясөз кемінде 8 таңбадан тұруы керек.'),
  mismatch: L('Passwords do not match.', 'Пароли не совпадают.', 'Құпиясөздер сәйкес келмейді.'),
  failed: L('Could not complete the request. Please try again later.', 'Не удалось выполнить запрос. Попробуй немного позже.', 'Сұрауды орындау мүмкін болмады. Кейінірек қайтала.'),
  limit: L('Too many attempts. Please wait a little and try again.', 'Слишком много попыток. Немного подожди и повтори.', 'Тым көп әрекет. Біраз күтіп, қайтала.'),
  expired: L('The e-mail link has expired or could not be verified. Sign in or request a new link.', 'Ссылка из письма истекла или не подтвердилась. Войди или запроси новую ссылку.', 'Хаттағы сілтеменің мерзімі өткен немесе расталмады. Кір немесе жаңа сілтеме сұра.'),
  unavailable: L('Sign-in is being set up. Please come back a little later.', 'Вход ещё настраивается. Попробуй немного позже.', 'Кіру мүмкіндігі бапталып жатыр. Кейінірек қайталап көр.'),
};

export default function AuthForm({ lang, reset = false }: { lang: Lang; reset?: boolean }) {
  const [mode, setMode] = useState<'login' | 'signup' | 'recover'>('login');
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<keyof typeof labels | ''>('');
  const [error, setError] = useState<keyof typeof labels | ''>('');
  const t = (key: keyof typeof labels) => labels[key][lang];
  useEffect(() => { if (new URLSearchParams(window.location.search).has('auth_error')) setError('expired'); }, []);
  function change(next: typeof mode) { setMode(next); setMessage(''); setError(''); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setMessage('');
    const values = new FormData(event.currentTarget);
    const email = String(values.get('email') || '').trim(), password = String(values.get('password') || '');
    if ((reset || mode === 'signup') && password.length < 8) { setError('short'); return; }
    if ((reset || mode === 'signup') && password !== values.get('confirm')) { setError('mismatch'); return; }
    setBusy(true);
    try {
      const supabase = browserClient();
      if (reset) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        window.location.assign('/');
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.assign('/');
      } else if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({ email, password, options: {
          data: { display_name: String(values.get('name') || '').trim().slice(0, 100) },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        } });
        if (error) throw error;
        if (data.session) window.location.assign('/'); else setMessage('check');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset` });
        if (error) throw error;
        setMessage('recoverySent');
      }
    } catch (error) {
      const code = (error as { code?: string }).code;
      setError(code?.includes('rate_limit') ? 'limit' : code === 'weak_password' ? 'short' : mode === 'login' && !reset ? 'invalid' : 'failed');
    } finally { setBusy(false); }
  }
  if (!authConfigured()) return <p className="notice" role="status">{t('unavailable')}</p>;
  return <div className="auth-panel">
    {!reset && mode !== 'recover' && <div className="auth-switch" role="group" aria-label={t('login')}>
      {(['login', 'signup'] as const).map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => change(value)} disabled={busy}>{t(value)}</button>)}
    </div>}
    <form onSubmit={submit} className="auth-form">
      <fieldset disabled={busy}>
        {!reset && mode === 'signup' && <label className="field"><span>{t('name')}</span><input name="name" autoComplete="name" maxLength={100} required /></label>}
        {!reset && <label className="field"><span>{t('email')}</span><input name="email" type="email" autoComplete="email" maxLength={254} required /></label>}
        {(reset || mode !== 'recover') && <label className="field"><span>{t('password')}</span><input name="password" type="password" autoComplete={reset || mode === 'signup' ? 'new-password' : 'current-password'} minLength={reset || mode === 'signup' ? 8 : 1} maxLength={128} required /></label>}
        {(reset || mode === 'signup') && <label className="field"><span>{t('confirm')}</span><input name="confirm" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>}
        <button type="submit" className="primary">{busy ? t('wait') : t(reset ? 'reset' : mode)}</button>
      </fieldset>
      {error && <p className="error-text" role="alert">{t(error)}</p>}
      {message && <p className="notice" role="status">{t(message)}</p>}
    </form>
    {!reset && <button type="button" className="auth-link" disabled={busy} onClick={() => change(mode === 'recover' ? 'login' : 'recover')}>{t(mode === 'recover' ? 'back' : 'forgot')}</button>}
  </div>;
}
