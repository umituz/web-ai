
export const AUTHENTICATION_MESSAGE = 'Authentication failed. Please check your API key.';

export class AuthenticationError extends Error {
  constructor(message: string = AUTHENTICATION_MESSAGE) {
    super(message);
    this.name = 'AuthenticationError';
  }
}
