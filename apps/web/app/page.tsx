import { Button } from '~/components/ui/button';

const Page = () => (
  <main className='flex min-h-svh flex-col items-center justify-center gap-6 p-6'>
    <h1 className='font-semibold text-2xl tracking-tight'>Kiyora</h1>
    <div className='flex flex-wrap items-center justify-center gap-2'>
      <Button>Default</Button>
      <Button variant='secondary'>Secondary</Button>
      <Button variant='outline'>Outline</Button>
      <Button variant='ghost'>Ghost</Button>
      <Button variant='destructive'>Destructive</Button>
      <Button variant='link'>Link</Button>
    </div>
  </main>
);

export default Page;
