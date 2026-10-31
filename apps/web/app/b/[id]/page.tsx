import { BoardRoute } from '~/components/editor/board-route';
import { currentAccount } from '~/lib/auth/session';

type Props = {
  params: Promise<{ id: string }>;
};

const Page = async ({ params }: Props) => {
  const { id } = await params;
  const account = await currentAccount();

  return <BoardRoute boardId={id} key={id} signedIn={account !== null} />;
};

export default Page;
