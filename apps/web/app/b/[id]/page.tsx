import { BoardRoute } from '~/components/editor/board-route';

type Props = {
  params: Promise<{ id: string }>;
};

const Page = async ({ params }: Props) => {
  const { id } = await params;

  return <BoardRoute boardId={id} key={id} />;
};

export default Page;
