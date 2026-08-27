import { Textarea } from '@kiyora/ui/textarea';
import { type ChangeEvent, type RefObject, useCallback } from 'react';

export type CodePanelProps = {
	/**
	 * Optional ref pointing at the rendered `<textarea>`. The host uses this to
	 * scroll the textarea to a line when the canvas selection changes.
	 */
	textareaRef?: RefObject<HTMLTextAreaElement | null>;
	onSourceChange: (source: string) => void;
	source: string;
};

/** The plain-text Kiyora Source editor for the editor shell. */
export function CodePanel({
	onSourceChange,
	source,
	textareaRef,
}: CodePanelProps) {
	const handleChange = useCallback(
		(event: ChangeEvent<HTMLTextAreaElement>) =>
			onSourceChange(event.currentTarget.value),
		[onSourceChange]
	);

	return (
		<section
			aria-label='Kiyora Source'
			className='flex h-full min-h-0 flex-col bg-background'
		>
			<div className='border-border border-b px-4 py-3'>
				<h1 className='font-medium text-sm'>Source</h1>
			</div>
			<Textarea
				aria-label='Kiyora Source'
				className='min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent font-mono text-sm leading-6 shadow-none focus-visible:ring-0'
				onChange={handleChange}
				ref={textareaRef}
				spellCheck={false}
				value={source}
			/>
		</section>
	);
}
