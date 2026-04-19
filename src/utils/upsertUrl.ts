import { urls } from '@/db/schema';
import { customAlphabet } from 'nanoid';
import { db } from '@/clients/db';
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

  // If the url already exists, return the existing alias
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
