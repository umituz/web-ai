
export const TIMEOUT_MESSAGE = 'Generation timed out. Maximum polling attempts reached.';

export class TimeoutError extends Error {
  constructor(message: string = TIMEOUT_MESSAGE) {
    super(message);
    this.name = 'TimeoutError';
  }
}
