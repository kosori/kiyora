import type { Diagnostic, Position } from '@kiyora/dsl';
import { cn } from '@kiyora/ui';

export type DiagnosticsListProps = {
	diagnostics: readonly Diagnostic[];
};

/** The list of Kiyora DSL parse diagnostics rendered under the code panel. */
export function DiagnosticsList({ diagnostics }: DiagnosticsListProps) {
	const state = diagnosticsState(diagnostics);

	if (diagnostics.length === 0) {
		return (
			<div
				aria-live='polite'
				className='border-border border-t bg-background px-4 py-2 font-mono text-muted-foreground text-xs'
				data-diagnostics
				data-state='ok'
			>
				OK — no diagnostics
			</div>
		);
	}

	return (
		<ul
			aria-live='polite'
			className='max-h-48 list-none overflow-y-auto border-border border-t bg-background'
			data-diagnostics
			data-state={state}
		>
			{diagnostics.map((diagnostic) => (
				<DiagnosticRow
					diagnostic={diagnostic}
					key={diagnosticKey(diagnostic)}
				/>
			))}
		</ul>
	);
}

type DiagnosticRowProps = { diagnostic: Diagnostic };

function diagnosticKey(diagnostic: Diagnostic): string {
	const { code, span } = diagnostic;
	return `${code}-${span.start.line}-${span.start.column}`;
}

function DiagnosticRow({ diagnostic }: DiagnosticRowProps) {
	const { severity, span, code, message } = diagnostic;
	const location = formatPosition(span.start);
	const severityClass =
		severity === 'error'
			? 'text-destructive'
			: 'text-amber-600 dark:text-amber-400';

	return (
		<li
			className={cn(
				'flex items-start gap-3 border-border/60 border-b px-4 py-2 font-mono text-xs last:border-b-0',
				severityClass
			)}
			data-diagnostic
			data-severity={severity}
		>
			<span className='shrink-0 tabular-nums'>{location}</span>
			<span className='shrink-0 font-medium'>{code}</span>
			<span className='wrap-break-word min-w-0 flex-1'>{message}</span>
		</li>
	);
}

/** Reduce a list of diagnostics to a single UI state token. */
function diagnosticsState(
	diagnostics: readonly Diagnostic[]
): 'ok' | 'error' | 'warning' {
	if (diagnostics.length === 0) {
		return 'ok';
	}
	if (diagnostics.some((d) => d.severity === 'error')) {
		return 'error';
	}
	return 'warning';
}

function formatPosition(position: Position): string {
	return `${position.line}:${position.column}`;
}
