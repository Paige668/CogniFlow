import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Lets a route through without a signed-in user. Every other route requires one. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
