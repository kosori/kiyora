import type { Metadata } from 'next';
import Link from 'next/link';
import { ShareViewer } from '~/components/share/share-viewer';
import { resolveShareLink } from '~/lib/db/share-store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: 'Shared board',
};

const Page = async ({ params }: PageProps<'/s/[token]'>) => {
  const { token } = await params;
  const board = await resolveShareLink(token);

  if (board === null) {
    return (
      <main
        className='mx-auto flex h-svh max-w-md flex-col items-start justify-center gap-4 p-6'
        data-testid='share-unavailable'
      >
        <h1 className='font-semibold text-xl'>This link is not available</h1>
        <p className='text-muted-foreground text-sm'>
          The link may have been revoked, or it may never have existed.
        </p>
        <Link className='underline underline-offset-4' href='/'>
          Open Kiyora
        </Link>
      </main>
    );
  }

  return <ShareViewer board={board} />;
};

export default Page;
