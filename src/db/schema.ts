import { pgTable, serial, text, varchar, integer } from 'drizzle-orm/pg-core'
export const urls = pgTable('urls', {
  id: serial('id').primaryKey(),
  url: text('url'),
  alias: varchar('alias', { length: 10 }),
  count: integer('count').default(0),
})

export const qrCodes = pgTable('qr_codes', {
  id: serial('id').primaryKey(),
  urlId: integer('url_id').references(() => urls.id),
  qrCode: text('qr_code'),
})
