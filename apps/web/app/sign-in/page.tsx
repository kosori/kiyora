import { SignInForm } from '~/components/auth/sign-in-form';
import { readAuthEnv } from '~/lib/auth/env';

const localPath = (value: string | string[] | undefined): string => {
  const candidate = Array.isArray(value) ? value[0] : value;

  if (
    candidate === undefined ||
    !candidate.startsWith('/') ||
    candidate.startsWith('//')
  ) {
    return '/';
  }

  return candidate;
};

const Page = async ({ searchParams }: PageProps<'/sign-in'>) => {
  const { next } = await searchParams;
  const config = readAuthEnv();

  return (
    <main className='mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center gap-6 p-6'>
      <header className='flex flex-col gap-1'>
        <h1 className='font-semibold text-xl'>Sign in</h1>
        <p className='text-muted-foreground text-sm'>
          An account is optional. Your boards stay in this browser either way.
        </p>
      </header>
      {config === null ? (
        <p className='text-destructive text-sm' role='alert'>
          Accounts are not configured on this server.
        </p>
      ) : (
        <SignInForm
          devCredentials={config.devCredentials}
          next={localPath(next)}
        />
      )}
    </main>
  );
};

export default Page;
