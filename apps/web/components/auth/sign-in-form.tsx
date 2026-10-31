'use client';

import { useRouter } from 'next/navigation';
import { type ChangeEvent, type FormEvent, useState } from 'react';
import { Button } from '~/components/ui/button';
import { authClient } from '~/lib/auth/client';

type Props = {
  devCredentials: boolean;
  next: string;
};

const messageOf = (error: { message?: string }): string =>
  error.message?.trim() === undefined || error.message.trim() === ''
    ? 'Signing in failed'
    : error.message;

/**
 * The two ways into an account: an existing Google or GitHub identity, and — on
 * a non-production server with the flag set — an email and password created for
 * testing the same flow.
 */
export const SignInForm = ({ devCredentials, next }: Props) => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWith = async (provider: 'google' | 'github'): Promise<void> => {
    setBusy(true);
    setError(null);

    const result = await authClient.signIn.social({
      callbackURL: next,
      provider,
    });

    if (result.error) {
      setError(messageOf(result.error));
      setBusy(false);
    }
  };

  const startSocial = (provider: 'google' | 'github') => (): void => {
    signInWith(provider).catch(() => {
      setError('Signing in failed');
      setBusy(false);
    });
  };

  const submit = async (create: boolean): Promise<void> => {
    setBusy(true);
    setError(null);

    const name = email.split('@')[0] ?? email;
    const result = create
      ? await authClient.signUp.email({ email, name, password })
      : await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(messageOf(result.error));
      setBusy(false);
      return;
    }

    router.push(next);
    router.refresh();
  };

  const startSubmit = (create: boolean) => (): void => {
    submit(create).catch(() => {
      setError('Signing in failed');
      setBusy(false);
    });
  };

  const onEmailChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setEmail(event.target.value);
  };

  const onPasswordChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setPassword(event.target.value);
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    startSubmit(false)();
  };

  return (
    <div className='flex flex-col gap-4'>
      <Button
        data-testid='sign-in-google'
        disabled={busy}
        onClick={startSocial('google')}
        size='lg'
        variant='outline'
      >
        Continue with Google
      </Button>
      <Button
        data-testid='sign-in-github'
        disabled={busy}
        onClick={startSocial('github')}
        size='lg'
        variant='outline'
      >
        Continue with GitHub
      </Button>
      {devCredentials ? (
        <form
          className='flex flex-col gap-3 border-border border-t pt-4'
          onSubmit={onSubmit}
        >
          <label className='flex flex-col gap-1 text-sm'>
            Email
            <input
              autoComplete='email'
              className='rounded-md border border-border bg-background px-3 py-2'
              data-testid='dev-email'
              onChange={onEmailChange}
              required
              type='email'
              value={email}
            />
          </label>
          <label className='flex flex-col gap-1 text-sm'>
            Password
            <input
              autoComplete='current-password'
              className='rounded-md border border-border bg-background px-3 py-2'
              data-testid='dev-password'
              minLength={8}
              onChange={onPasswordChange}
              required
              type='password'
              value={password}
            />
          </label>
          <div className='flex gap-2'>
            <Button data-testid='dev-sign-in' disabled={busy} type='submit'>
              Sign in
            </Button>
            <Button
              data-testid='dev-sign-up'
              disabled={busy}
              onClick={startSubmit(true)}
              type='button'
              variant='outline'
            >
              Create account
            </Button>
          </div>
        </form>
      ) : null}
      {error === null ? null : (
        <p className='text-destructive text-sm' role='alert'>
          {error}
        </p>
      )}
    </div>
  );
};
