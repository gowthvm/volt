import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import Logo from '@/components/Logo';
import Seo from '@/components/Seo';

export default function SignupPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [oauthProvider, setOauthProvider] = useState<string | null>(null);
  const navigate = useNavigate();
  const { signUpWithEmail, signInWithProvider, loading } = useAuth();

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value.trim()) {
      setEmailError('Email is required');
      return false;
    }
    if (!emailRegex.test(value)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError(null);
    return true;
  };

  const validatePassword = (value: string): boolean => {
    if (!value) {
      setPasswordError('Password is required');
      return false;
    }
    if (value.length < 8) {
      setPasswordError('Password must be at least 8 characters');
      return false;
    }
    setPasswordError(null);
    return true;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const isEmailValid = validateEmail(email);
    const isPasswordValid = validatePassword(password);

    if (!isEmailValid || !isPasswordValid) return;

    const error = await signUpWithEmail(email, password);
    if (error) {
      setFormError(error.message);
      return;
    }

    navigate('/editor');
  };

  const handleOAuth = async (provider: 'google' | 'github') => {
    setFormError(null);
    setOauthProvider(provider);
    const { url, error } = await signInWithProvider(provider);
    if (error) {
      setFormError(error.message);
      setOauthProvider(null);
      return;
    }
    if (url) {
      window.location.assign(url);
    }
  };

  return (
    <div className="min-h-screen bg-base text-text-primary">
      <Seo title="Sign up — Volt" description="Create your Volt account and start designing circuits." path="/signup" />
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6 py-12">
        <div className="w-full rounded-xl border border-default bg-surface p-10">
          <header className="mb-8 flex items-center justify-between">
            <Logo />
            <Link className="text-sm text-text-primary transition hover:text-text-secondary" to="/login">
              Log in
            </Link>
          </header>

          <div className="space-y-5">
            <h1 className="text-3xl font-medium text-text-primary">Create your account.</h1>
            <p className="text-sm text-text-secondary">
              Sign up and start designing circuits immediately.
            </p>
          </div>

          <form className="mt-10 space-y-6" onSubmit={handleSubmit}>
            {formError ? (
              <div className="rounded-lg bg-red/10 border border-red/30 px-4 py-3 text-sm text-red">
                {formError}
              </div>
            ) : null}

            <div className="space-y-2">
              <label className="block text-sm text-text-secondary" htmlFor="email">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (emailError) setEmailError(null); }}
                onBlur={() => { if (email) validateEmail(email); }}
                className={`w-full rounded-md border bg-base px-4 py-3 text-text-primary outline-none transition focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${emailError ? 'border-red-500/50' : 'border-default'}`}
                required
              />
              {emailError ? <p className="text-xs text-red">{emailError}</p> : null}
            </div>

            <div className="space-y-2">
              <label className="block text-sm text-text-secondary" htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (passwordError) setPasswordError(null); }}
                onBlur={() => { if (password) validatePassword(password); }}
                className={`w-full rounded-md border bg-base px-4 py-3 text-text-primary outline-none transition focus:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${passwordError ? 'border-red-500/50' : 'border-default'}`}
                required
              />
              {passwordError ? <p className="text-xs text-red">{passwordError}</p> : null}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-medium text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {loading ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black/30 border-t-black" />
              ) : null}
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-sm text-text-secondary">
            <span className="h-px flex-1 bg-border-default" />
            Or continue with
            <span className="h-px flex-1 bg-border-default" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleOAuth('google')}
              disabled={loading && oauthProvider === 'google'}
              className="flex items-center justify-center gap-2 rounded-md border border-default bg-base px-4 py-3 text-sm text-text-primary transition hover:border-default disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && oauthProvider === 'google' ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-text-tertiary/30 border-t-text-tertiary" />
              ) : null}
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => handleOAuth('github')}
              disabled={loading && oauthProvider === 'github'}
              className="flex items-center justify-center gap-2 rounded-md border border-default bg-base px-4 py-3 text-sm text-text-primary transition hover:border-default disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && oauthProvider === 'github' ? (
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-text-tertiary/30 border-t-text-tertiary" />
              ) : null}
              Continue with GitHub
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-text-secondary">
            Already have an account?{' '}
            <Link className="text-text-primary transition hover:text-text-secondary" to="/login">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
