import { SessionFault } from '~/components/auth/session-fault';
import { Library } from '~/components/library/library';
import { currentSession } from '~/lib/auth/session';

const Page = async () => {
  const { account, fault } = await currentSession();

  return (
    <>
      <SessionFault fault={fault} />
      <Library account={account} />
    </>
  );
};

export default Page;
