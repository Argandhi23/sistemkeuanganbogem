import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'ADMIN' | 'CATERING' | 'USER';
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: 'ADMIN' | 'CATERING' | 'USER';
    name?: string | null;
    email?: string | null;
    isActive?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'ADMIN' | 'CATERING' | 'USER';
  }
}
