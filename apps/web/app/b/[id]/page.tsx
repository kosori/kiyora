import { SessionFault } from '~/components/auth/session-fault';
import { BoardRoute } from '~/components/editor/board-route';
import { currentSession } from '~/lib/auth/session';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ conflict?: string }>;
};

const Page = async ({ params, searchParams }: Props) => {
  const { id } = await params;
  const { conflict } = await searchParams;
  const { account, fault } = await currentSession();

  return (
    <>
      <SessionFault fault={fault} />
      <BoardRoute
        boardId={id}
        conflictOpen={conflict === '1'}
        key={id}
        signedIn={account !== null}
      />
    </>
  );
};

export default Page;
