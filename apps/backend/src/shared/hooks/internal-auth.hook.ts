import type { FastifyReply, FastifyRequest } from 'fastify';
import { getInternalApiKey } from '@metrixify/config';
import { ApiError } from '../errors/api-error.js';

const HEADER = 'x-metrixify-internal-key';

export async function verifyInternalApiKey(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const provided = request.headers[HEADER];
  const key = typeof provided === 'string' ? provided : undefined;

  if (!key || key !== getInternalApiKey()) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid internal API key');
  }
}
