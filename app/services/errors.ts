/**
 * Turns whatever went wrong (a server reply, a dropped connection, a coding slip) into a short
 * sentence a customer can act on. Screens should show `friendlyError(error, 'What we were doing')`
 * rather than `error.message`, so nobody ever sees "Authentication credentials were not provided"
 * or "undefined is not a function".
 */

export class ApiError extends Error {
  status: number;

  constructor(message: string, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export const NETWORK_MESSAGE = 'We could not reach Apsuni. Check your internet connection and try again.';
export const SESSION_MESSAGE = 'Your session has ended. Please sign in again.';
export const SERVER_MESSAGE = 'Something went wrong on our side. Please try again in a moment.';

// Server wording -> plain language. The first rule that matches wins.
const RULES: [RegExp, string][] = [
  [/authentication credentials were not provided|not authenticated|given token|token (is )?(not valid|invalid|expired)|token_not_valid/i, SESSION_MESSAGE],
  [/no active account|unable to log in with provided credentials|invalid credentials|incorrect (email|password)|invalid (email|password)/i, 'That email and password do not match. Please check them and try again.'],
  [/user with this email does not exist|no user with|account with this email does not exist/i, 'We could not find an account with that email address.'],
  [/otp (has )?expired|code (has )?expired|expired otp/i, 'That code has expired. Please request a new one.'],
  [/invalid otp|otp (is )?(invalid|incorrect)|incorrect otp|wrong otp|invalid code/i, 'That code is not correct. Please check it and try again.'],
  [/invalid token or user does not exist/i, 'This reset request is no longer valid. Please start again.'],
  [/user with (that|this) (email|username) already exists|email.*already (exists|registered|in use)|already registered/i, 'An account with these details already exists. Try signing in instead.'],
  [/username.*already (exists|taken)|user with that username already exists/i, 'That username is already taken. Please choose another.'],
  [/insufficient (funds|balance)|not enough (funds|balance|credit)/i, 'You do not have enough funds for this. Please top up your wallet and try again.'],
  [/too many requests|throttled|rate limit/i, 'Too many attempts. Please wait a moment and try again.'],
  [/network request failed|failed to fetch|network error|timed? ?out|timeout|aborted|econn|socket/i, NETWORK_MESSAGE],
  [/cart is empty|your cart is empty/i, 'Your cart is empty. Add a project first.'],
];

// Text that only makes sense to a developer.
const TECHNICAL = /undefined|null is not|is not a function|cannot read|cannot access|json|unexpected (token|end)|syntax ?error|traceback|exception|stack|internal server|errno|invariant|\[object|nativemodule|typeerror|referenceerror|nonetype|has no attribute|matching query|keyerror|attributeerror|valueerror|operationalerror|integrityerror|smtp|connection refused|<html|<!doctype|\bat .*\.(js|tsx?):\d+/i;

/** "Phone: This field is required." -> "Please enter your phone." and similar field-level notes. */
function humanizeFieldMessage(text: string): string {
  return text
    .replace(/^([A-Za-z ]+): This field (?:is required|may not be (?:blank|null))\.?/i, (_m, field: string) => `Please enter your ${field.toLowerCase()}.`)
    .replace(/^([A-Za-z ]+): This field cannot be blank\.?/i, (_m, field: string) => `Please enter your ${field.toLowerCase()}.`)
    .replace(/Enter a valid email address\.?/i, 'Please enter a valid email address.')
    .replace(/Ensure this field has at least (\d+) characters?\.?/i, 'It needs to be at least $1 characters long.')
    .replace(/This password is too (short|common)\.?/i, 'That password is too $1. Choose a stronger one.')
    .replace(/This password is entirely numeric\.?/i, 'A password cannot be only numbers.');
}

/** A server message rewritten for people, or '' when there is nothing useful to say. */
export function humanizeMessage(raw: string): string {
  const text = raw.trim();
  if (!text) return '';
  for (const [pattern, replacement] of RULES) {
    if (pattern.test(text)) return replacement;
  }
  const softened = humanizeFieldMessage(text);
  if (TECHNICAL.test(softened) || softened.length > 220) return '';
  return softened;
}

/** The sentence to show when a request comes back with an error status. */
export function messageForStatus(status: number, serverText: string): string {
  const fromServer = humanizeMessage(serverText);
  if (fromServer) return fromServer;
  if (status === 401) return SESSION_MESSAGE;
  if (status === 403) return 'You do not have permission to do that.';
  if (status === 404) return 'We could not find what you were looking for.';
  if (status === 408 || status === 504) return 'That took too long. Please try again.';
  if (status === 413) return 'That file is too large. Try a smaller one.';
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  if (status >= 500) return SERVER_MESSAGE;
  return 'We could not complete that. Please check your details and try again.';
}

/** Use this everywhere an error is shown. `fallback` says what we were trying to do, in plain words. */
export function friendlyError(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiError) return error.message || fallback;
  const raw = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  return humanizeMessage(raw) || fallback;
}

// expo-router treats every file under app/ as a route and warns when it has no default export.
export default friendlyError;
