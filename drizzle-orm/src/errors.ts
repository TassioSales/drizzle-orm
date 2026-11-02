import { entityKind } from '~/entity.ts';

export class DrizzleError extends Error {
	static readonly [entityKind]: string = 'DrizzleError';

	constructor({ message, cause }: { message?: string; cause?: unknown }) {
		super(message);
		this.name = 'DrizzleError';
		this.cause = cause;
	}
}

export class DrizzleQueryError extends Error {
	constructor(
		public query: string,
		public params: any[],
		public override cause?: Error,
	) {
		super(`Failed query: ${query}\nparams: ${params}`);
		Error.captureStackTrace(this, DrizzleQueryError);

		// ES2022+: preserves original error on `.cause`
		if (cause) (this as any).cause = cause;
	}
}

export class TransactionRollbackError extends DrizzleError {
	static override readonly [entityKind]: string = 'TransactionRollbackError';

	constructor() {
		super({ message: 'Rollback' });
	}
}

export type ConstraintType = 'unique' | 'foreign_key' | 'not_null' | 'check' | 'unknown';

export class DatabaseConstraintError extends DrizzleError {
	static override readonly [entityKind]: string = 'DatabaseConstraintError';
	readonly constraintType: ConstraintType;
	readonly table?: string;
	readonly column?: string;
	readonly constraint?: string;

	constructor({
		message,
		cause,
		constraintType,
		table,
		column,
		constraint,
	}: {
		message: string;
		cause?: unknown;
		constraintType: ConstraintType;
		table?: string;
		column?: string;
		constraint?: string;
	}) {
		super({ message, cause });
		this.name = 'DatabaseConstraintError';
		this.constraintType = constraintType;
		this.table = table;
		this.column = column;
		this.constraint = constraint;
	}
}

export class UniqueConstraintError extends DatabaseConstraintError {
	static override readonly [entityKind]: string = 'UniqueConstraintError';
	constructor(params: { message?: string; cause?: unknown; table?: string; column?: string; constraint?: string }) {
		super({
			message: params.message ?? `Unique constraint violated${params.constraint ? `: ${params.constraint}` : ''}`,
			cause: params.cause,
			constraintType: 'unique',
			table: params.table,
			column: params.column,
			constraint: params.constraint,
		});
		this.name = 'UniqueConstraintError';
	}
}

export class ForeignKeyConstraintError extends DatabaseConstraintError {
	static override readonly [entityKind]: string = 'ForeignKeyConstraintError';
	constructor(params: { message?: string; cause?: unknown; table?: string; column?: string; constraint?: string }) {
		super({
			message: params.message ?? `Foreign key constraint violated${params.constraint ? `: ${params.constraint}` : ''}`,
			cause: params.cause,
			constraintType: 'foreign_key',
			table: params.table,
			column: params.column,
			constraint: params.constraint,
		});
		this.name = 'ForeignKeyConstraintError';
	}
}

export class NotNullConstraintError extends DatabaseConstraintError {
	static override readonly [entityKind]: string = 'NotNullConstraintError';
	constructor(params: { message?: string; cause?: unknown; table?: string; column?: string }) {
		super({
			message: params.message ?? `Not null constraint violated${params.column ? ` on column ${params.column}` : ''}`,
			cause: params.cause,
			constraintType: 'not_null',
			table: params.table,
			column: params.column,
		});
		this.name = 'NotNullConstraintError';
	}
}

export class CheckConstraintError extends DatabaseConstraintError {
	static override readonly [entityKind]: string = 'CheckConstraintError';
	constructor(params: { message?: string; cause?: unknown; table?: string; constraint?: string }) {
		super({
			message: params.message ?? `Check constraint violated${params.constraint ? `: ${params.constraint}` : ''}`,
			cause: params.cause,
			constraintType: 'check',
			table: params.table,
			constraint: params.constraint,
		});
		this.name = 'CheckConstraintError';
	}
}

export function wrapDriverError(error: unknown, query?: string, params?: any[]): Error {
	if (!error || typeof error !== 'object') {
		return error instanceof Error ? error : new Error(String(error));
	}
	const err = error as Record<string, any>;
	const code = String(err.code ?? err.errno ?? '');
	const message = String(err.message ?? '');

	if (
		code === '23505'
		|| code === '1062'
		|| code === 'ER_DUP_ENTRY'
		|| message.includes('UNIQUE constraint failed')
		|| message.includes('duplicate key value')
	) {
		return new UniqueConstraintError({ message, cause: error, table: err.table, constraint: err.constraint, column: err.column });
	}
	if (
		code === '23503'
		|| code === '1452'
		|| code === '1451'
		|| code === 'ER_NO_REFERENCED_ROW'
		|| message.includes('FOREIGN KEY constraint failed')
	) {
		return new ForeignKeyConstraintError({ message, cause: error, table: err.table, constraint: err.constraint });
	}
	if (
		code === '23502'
		|| code === '1048'
		|| code === 'ER_BAD_NULL_ERROR'
		|| message.includes('NOT NULL constraint failed')
	) {
		return new NotNullConstraintError({ message, cause: error, table: err.table, column: err.column });
	}
	if (
		code === '23514'
		|| code === '3819'
		|| code === 'ER_CHECK_CONSTRAINT_VIOLATED'
		|| message.includes('CHECK constraint failed')
	) {
		return new CheckConstraintError({ message, cause: error, table: err.table, constraint: err.constraint });
	}

	if (query) {
		return new DrizzleQueryError(query, params ?? [], error instanceof Error ? error : undefined);
	}
	return error instanceof Error ? error : new Error(message);
}
