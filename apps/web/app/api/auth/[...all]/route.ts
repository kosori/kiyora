import { toNextJsHandler } from 'better-auth/next-js';
import { AuthConfigurationError } from '~/lib/auth/env';
import { getAuth } from '~/lib/auth/server';

const handler = async (request: Request): Promise<Response> => {
  try {
    return await getAuth().handler(request);
  } catch (error) {
    if (error instanceof AuthConfigurationError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
};

export const { DELETE, GET, PATCH, POST, PUT } = toNextJsHandler(handler);
