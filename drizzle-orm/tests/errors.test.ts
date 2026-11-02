import { describe, expect, it } from 'vitest';
import {
	CheckConstraintError,
	DatabaseConstraintError,
	DrizzleError,
	DrizzleQueryError,
	ForeignKeyConstraintError,
	NotNullConstraintError,
	UniqueConstraintError,
	wrapDriverError,
} from '~/errors.ts';

describe('Error Handling and Wrapping (#376)', () => {
	it('should wrap PostgreSQL unique constraint violation (code 23505)', () => {
		const pgError = {
			code: '23505',
			message: 'duplicate key value violates unique constraint "users_email_key"',
			table: 'users',
			constraint: 'users_email_key',
		};

		const err = wrapDriverError(pgError);
		expect(err).toBeInstanceOf(UniqueConstraintError);
		expect(err).toBeInstanceOf(DatabaseConstraintError);
		expect(err).toBeInstanceOf(DrizzleError);
		expect((err as UniqueConstraintError).constraintType).toBe('unique');
		expect((err as UniqueConstraintError).table).toBe('users');
		expect((err as UniqueConstraintError).constraint).toBe('users_email_key');
	});

	it('should wrap MySQL duplicate entry (ER_DUP_ENTRY / 1062)', () => {
		const mysqlError = {
			code: 'ER_DUP_ENTRY',
			errno: 1062,
			message: "Duplicate entry 'test@example.com' for key 'users.email'",
		};

		const err = wrapDriverError(mysqlError);
		expect(err).toBeInstanceOf(UniqueConstraintError);
	});

	it('should wrap SQLite UNIQUE constraint failure', () => {
		const sqliteError = {
			message: 'UNIQUE constraint failed: users.email',
		};

		const err = wrapDriverError(sqliteError);
		expect(err).toBeInstanceOf(UniqueConstraintError);
	});

	it('should wrap PostgreSQL foreign key constraint violation (code 23503)', () => {
		const pgError = {
			code: '23503',
			message: 'insert or update on table "orders" violates foreign key constraint "orders_user_id_fkey"',
			table: 'orders',
			constraint: 'orders_user_id_fkey',
		};

		const err = wrapDriverError(pgError);
		expect(err).toBeInstanceOf(ForeignKeyConstraintError);
		expect((err as ForeignKeyConstraintError).constraintType).toBe('foreign_key');
		expect((err as ForeignKeyConstraintError).table).toBe('orders');
	});

	it('should wrap not-null constraint violation', () => {
		const pgError = {
			code: '23502',
			message: 'null value in column "name" of relation "users" violates not-null constraint',
			table: 'users',
			column: 'name',
		};

		const err = wrapDriverError(pgError);
		expect(err).toBeInstanceOf(NotNullConstraintError);
		expect((err as NotNullConstraintError).constraintType).toBe('not_null');
		expect((err as NotNullConstraintError).column).toBe('name');
	});

	it('should wrap check constraint violation', () => {
		const pgError = {
			code: '23514',
			message: 'new row for relation "products" violates check constraint "price_positive"',
			table: 'products',
			constraint: 'price_positive',
		};

		const err = wrapDriverError(pgError);
		expect(err).toBeInstanceOf(CheckConstraintError);
		expect((err as CheckConstraintError).constraintType).toBe('check');
	});

	it('should fallback to DrizzleQueryError when query is provided and no constraint matches', () => {
		const genericError = new Error('connection terminated unexpectedly');
		const err = wrapDriverError(genericError, 'SELECT * FROM users WHERE id = $1', [123]);

		expect(err).toBeInstanceOf(DrizzleQueryError);
		expect((err as DrizzleQueryError).query).toBe('SELECT * FROM users WHERE id = $1');
		expect((err as DrizzleQueryError).params).toEqual([123]);
		expect((err as DrizzleQueryError).cause).toBe(genericError);
	});
});
