import { RequestUserPayload } from '../auth/types/request-user-payload';

declare global {
  namespace Express {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- khớp Passport: User = payload JWT
    interface User extends RequestUserPayload {}
  }
}

export {};
