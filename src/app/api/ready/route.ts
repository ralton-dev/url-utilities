import { client } from '@/clients/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await client`SELECT 1`;
    return Response.json({ status: 'ok' });
  } catch {
    return Response.json({ status: 'unavailable' }, { status: 503 });
  }
}
