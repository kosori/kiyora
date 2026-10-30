'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import type { AccountSummary } from '~/lib/auth/account';
import { authClient } from '~/lib/auth/client';

type Props = {
  account: AccountSummary | null;
};

/**
 * Which account the library is using, with the action that changes it. Signing
 * out only drops the session: every local board stays where it is.
 */
export const AccountControl = ({ account }: Props) => {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async (): Promise<void> => {
    setSigningOut(true);
    setError(null);

    const result = await authClient.signOut();

    if (result.error) {
      setError(result.error.message ?? 'Signing out failed');
      setSigningOut(false);
      return;
    }

    router.refresh();
    setSigningOut(false);
  };

  const startSignOut = (): void => {
    signOut().catch(() => setError('Signing out failed'));
  };

  if (account === null) {
    return (
      <Link
        className='text-sm underline-offset-4 hover:underline'
        data-testid='sign-in'
        href='/sign-in'
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className='flex items-center gap-3'>
      <span className='max-w-48 truncate text-sm' data-testid='account-name'>
        {account.name || account.email}
      </span>
      <Button
        data-testid='sign-out'
        disabled={signingOut}
        onClick={startSignOut}
        size='sm'
        variant='outline'
      >
        Sign out
      </Button>
      {error === null ? null : (
        <p className='text-destructive text-sm' role='alert'>
          {error}
        </p>
      )}
    </div>
  );
};
