import { urls } from '../db/schema.js';
import { customAlphabet } from 'nanoid';
import { db } from '../clients/db.js';
import { eq } from 'drizzle-orm';

const alphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const nanoid = customAlphabet(alphabet, 10);

export const upsertUrl = async (url: string): Promise<string> => {
  const result = await db
    .select({
      alias: urls.alias,
    })
    .from(urls)
    .where(eq(urls.url, url))
    .limit(1);

  if (result.length > 0 && result[0].alias) {
    const { alias } = result[0];
    return alias;
  }

  const alias = nanoid();
  await db.insert(urls).values([
    {
      url,
      alias,
    },
  ]);

  return alias;
};
