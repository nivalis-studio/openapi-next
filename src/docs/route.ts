import { NextResponse } from 'next/server';
import { DEFAULT_ERRORS } from '../errors/http-errors';
import { getConfig } from '../lib/config';
import { getHtmlForDocs } from './docs';
import type { NextRequest } from 'next/server';
import type { BaseQuery } from '../types/operation';
import type { FrameworkConfig } from '../types/config';

export const docsRoute = (_config?: FrameworkConfig) => {
  const config = getConfig(_config);

  const handler = async (
    _req: NextRequest,
    _context: { params: BaseQuery },
    // eslint-disable-next-line @typescript-eslint/require-await
  ) => {
    try {
      const host = _req.clone().headers.get('host') ?? '';
      const html = getHtmlForDocs({ config, host });

      return new NextResponse(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      });
    } catch (error) {
      console.error(error);

      return NextResponse.json(
        { message: DEFAULT_ERRORS.unexpectedError },
        { status: 500 },
      );
    }
  };

  handler._nextRestFrameworkConfig = config;

  return {
    GET: handler,
  };
};
