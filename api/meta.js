import { handle } from '../src/handler.js';

export function GET(request) {
  return handle(request);
}

export function HEAD(request) {
  return handle(request);
}
