import { db } from '@/clients/db'
import { urls } from '@/db/schema'
import { eq } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ alias: string[] }> }
) {
  const { alias: aliasSegments } = await params
  const alias = aliasSegments.join('/')

  const result = await db
    .select({
      url: urls.url,
      count: urls.count,
    })
    .from(urls)
    .where(eq(urls.alias, alias))
    .limit(1)

  if (result.length > 0) {
    const { url, count } = result[0]
    await db
      .update(urls)
      .set({ count: count! + 1 })
      .where(eq(urls.alias, alias))

    return Response.redirect(url!, 301)
  } else {
    return new Response('Not found', { status: 404 })
  }
}
