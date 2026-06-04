export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function formatApiError(error: ApiError) {
  return {
    error: {
      code: error.code,
      message: error.message,
      details: error.details,
    },
  };
}
