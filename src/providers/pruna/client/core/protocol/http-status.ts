
import { AUTH_FAILURE_STATUSES } from '../constants/network';

export function isAuthFailureStatus(status: number): boolean {
  return (AUTH_FAILURE_STATUSES as readonly number[]).includes(status);
}

export function isTransientServerError(status: number): boolean {
  return status >= 500 && status < 600;
}

export function isClientError(status: number): boolean {
  return status >= 400 && status < 500 && !isAuthFailureStatus(status);
}
