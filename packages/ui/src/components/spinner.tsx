import { cn } from '@kiyora/ui';
import { IconLoader } from '@tabler/icons-react';

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
	return (
		<IconLoader
			aria-label='Loading'
			className={cn('size-4 animate-spin', className)}
			data-slot='spinner'
			role='status'
			{...props}
		/>
	);
}

export { Spinner };
