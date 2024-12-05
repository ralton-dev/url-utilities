import { urlSchema } from '@/validation/url';
import { env } from '@/env.mjs';
import { upsertUrl } from '@/utils/upsertUrl';

const redirectPage = `${env.APP_URL}/r`;

export async function POST(request: Request) {
  if (request.headers.get('x-api-key') !== env.API_KEY) {
    return Response.json(
      {
        success: false,
        errors: ['Unauthorized'],
      },
      { status: 401 }
    );
  }

  const body = await request.json();

  const validated = urlSchema.safeParse(body);
  if (!validated.success) {
    return Response.json(
      {
        success: false,
        errors: validated.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }

  const {
    data: { url },
  } = validated;

  try {
    const alias = await upsertUrl(url);

    return Response.json({
      success: true,
      url: `${redirectPage}/${alias}`,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        errors: ['Error creating url'],
      },
      { status: 422 }
    );
  }
}
