import { ValidationPipe } from '@nestjs/common';

// Registered globally in main.ts; tests build the same pipe so they check the real settings.
export function createValidationPipe() {
  return new ValidationPipe({
    // Properties without a validation decorator are not accepted: the request is rejected
    // with a 400 instead of the extra fields being passed on or silently dropped.
    whitelist: true,
    forbidNonWhitelisted: true,
  });
}
