import { handle } from '../../src/handler.js';

export default (request) => handle(request);

export const config = {
  path: ['/robots.txt', '/humans.txt', '/security.txt', '/.well-known/security.txt'],
  method: ['GET', 'HEAD']
};
