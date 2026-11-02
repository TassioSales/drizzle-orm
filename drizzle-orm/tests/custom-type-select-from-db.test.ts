import { expect, test } from 'vitest';
import { customType as pgCustomType, pgTable, PgDialect } from '~/pg-core/index.ts';
import { customType as mysqlCustomType, mysqlTable, MySqlDialect } from '~/mysql-core/index.ts';
import { customType as sqliteCustomType, sqliteTable, SQLiteSyncDialect } from '~/sqlite-core/index.ts';
import { sql } from '~/sql/sql.ts';

test('customType selectFromDb wraps column in SELECT query (PostgreSQL)', () => {
	const postgis = pgCustomType<{ data: string }>({
		dataType: () => 'geometry(Point, 4326)',
		selectFromDb: (col) => sql`ST_AsGeoJSON(${col})`,
	});

	const places = pgTable('places', {
		location: postgis('location'),
	});

	const dialect = new PgDialect();
	const q = dialect.buildSelectQuery({
		table: places,
		fields: { location: places.location },
		fieldsList: [{ path: ['location'], field: places.location }],
		setOperators: [],
	});
	const query = dialect.sqlToQuery(q);
	expect(query.sql).toBe('select ST_AsGeoJSON("location") as "location" from "places"');
});

test('customType fromDb alias works identically to selectFromDb (PostgreSQL)', () => {
	const customCol = pgCustomType<{ data: string }>({
		dataType: () => 'text',
		fromDb: (col) => sql`LOWER(${col})`,
	});

	const users = pgTable('users', {
		name: customCol('name'),
	});

	const dialect = new PgDialect();
	const q = dialect.buildSelectQuery({
		table: users,
		fields: { name: users.name },
		fieldsList: [{ path: ['name'], field: users.name }],
		setOperators: [],
	});
	const query = dialect.sqlToQuery(q);
	expect(query.sql).toBe('select LOWER("name") as "name" from "users"');
});

test('customType selectFromDb wraps column in SELECT query (MySQL)', () => {
	const geo = mysqlCustomType<{ data: string }>({
		dataType: () => 'point',
		selectFromDb: (col) => sql`ST_AsText(${col})`,
	});

	const venues = mysqlTable('venues', {
		loc: geo('loc'),
	});

	const dialect = new MySqlDialect();
	const q = dialect.buildSelectQuery({
		table: venues,
		fields: { loc: venues.loc },
		fieldsList: [{ path: ['loc'], field: venues.loc }],
		setOperators: [],
	});
	const query = dialect.sqlToQuery(q);
	expect(query.sql).toBe('select ST_AsText(`loc`) as `loc` from `venues`');
});

test('customType selectFromDb wraps column in SELECT query (SQLite)', () => {
	const customText = sqliteCustomType<{ data: string }>({
		dataType: () => 'text',
		selectFromDb: (col) => sql`HEX(${col})`,
	});

	const items = sqliteTable('items', {
		raw: customText('raw'),
	});

	const dialect = new SQLiteSyncDialect();
	const q = dialect.buildSelectQuery({
		table: items,
		fields: { raw: items.raw },
		fieldsList: [{ path: ['raw'], field: items.raw }],
		setOperators: [],
	});
	const query = dialect.sqlToQuery(q);
	expect(query.sql).toBe('select HEX("raw") as "raw" from "items"');
});
