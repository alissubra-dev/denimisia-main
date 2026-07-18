import { Header, applyDecorators } from '@nestjs/common';

/**
 * Disables caching on endpoints. Use this for data that should always be fresh.
 */
export const NoCache = (): MethodDecorator =>
  applyDecorators(
    Header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0'),
    Header('Pragma', 'no-cache'),
  );