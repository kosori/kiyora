import { BoardRoute } from '~/components/editor/board-route';
import { currentAccount } from '~/lib/auth/session';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conflict?: string }>;
};

const Page = async ({ params, searchParams }: Props) => {
  const { id } = await params;
  const { conflict } = await searchParams;
  const account = await currentAccount();

  return (
    <BoardRoute
      boardId={id}
      conflictOpen={conflict === '1'}
      key={id}
      signedIn={account !== null}
    />
  );
};

export default Page;
