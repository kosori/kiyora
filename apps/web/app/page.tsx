import { Library } from '~/components/library/library';
import { currentAccount } from '~/lib/auth/session';

const Page = async () => {
  const account = await currentAccount();

  return <Library account={account} />;
};

export default Page;
