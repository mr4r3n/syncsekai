import { BadRequestException } from '@nestjs/common';

/** Same characters social sign-in already keeps; 3 to 32 of them. */
export const USERNAME_PATTERN = /^[a-zA-Z0-9_-]{3,32}$/;
export const USERNAME_RULE = 'The username must be 3 to 32 letters, numbers, "_" or "-".';

export function assertValidUsername(username: string) {
  if (!USERNAME_PATTERN.test(username)) {
    throw new BadRequestException(USERNAME_RULE);
  }
}
