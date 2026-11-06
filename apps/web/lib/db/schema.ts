import type { Board } from '@kiyora/model';
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

/** One account holder. Better Auth's user table. */
export const user = pgTable('user', {
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  // Better Auth lowercases email before insert, so this unique is effectively
  // case-insensitive; a functional lower(email) index is deferred until a caller
  // writes the column without the adapter.
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').default(false).notNull(),
  id: text('id').primaryKey(),
  image: text('image'),
  name: text('name').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

/** One signed-in browser. Better Auth's session table. */
export const session = pgTable(
  'session',
  {
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    id: text('id').primaryKey(),
    ipAddress: text('ip_address'),
    token: text('token').notNull().unique(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userAgent: text('user_agent'),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [index('session_user_id_idx').on(table.userId)]
);

/** One credential or OAuth identity attached to a user. */
export const account = pgTable(
  'account',
  {
    accessToken: text('access_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    accountId: text('account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    id: text('id').primaryKey(),
    idToken: text('id_token'),
    password: text('password'),
    providerId: text('provider_id').notNull(),
    refreshToken: text('refresh_token'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
  },
  (table) => [
    index('account_user_id_idx').on(table.userId),
    uniqueIndex('account_provider_id_account_id_idx').on(
      table.providerId,
      table.accountId
    ),
  ]
);

/** A short-lived value Better Auth may need to look up, such as a token. */
export const verification = pgTable(
  'verification',
  {
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    id: text('id').primaryKey(),
    identifier: text('identifier').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    value: text('value').notNull(),
  },
  (table) => [index('verification_identifier_idx').on(table.identifier)]
);

/** The auth tables, keyed as Better Auth's Drizzle adapter expects. */
export const schema = { account, session, user, verification };

/**
 * One board's remote copy. Its id is the client's, minted before any server
 * exists, and `payload` is the document of record. The other columns are a
 * cache the server fills from the payload it just validated, so listing never
 * parses a board.
 */
export const board = pgTable(
  'board',
  {
    bytes: integer('bytes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    id: text('id').primaryKey(),
    ownerId: text('owner_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    payload: jsonb('payload').$type<Board>().notNull(),
    payloadHash: text('payload_hash').notNull(),
    previewSvg: text('preview_svg'),
    revision: integer('revision').notNull(),
    title: text('title').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    index('board_owner_id_updated_at_idx').on(table.ownerId, table.updatedAt),
  ]
);

/**
 * One unlisted address for a board's remote copy. A token is live while its
 * `revoked_at` is null, and the partial unique index keeps at most one live
 * token per board; regenerating revokes the old row before it inserts the new
 * one, so an address that was shared stops resolving.
 */
export const shareLink = pgTable(
  'share_link',
  {
    boardId: text('board_id')
      .notNull()
      .references(() => board.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    token: text('token').primaryKey(),
  },
  (table) => [
    index('share_link_board_id_idx').on(table.boardId),
    uniqueIndex('share_link_live_board_id_idx')
      .on(table.boardId)
      .where(sql`${table.revokedAt} is null`),
  ]
);
