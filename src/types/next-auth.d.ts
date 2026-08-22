import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'USER' | 'ADMIN';
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: 'USER' | 'ADMIN';
    name?: string | null;
    email?: string | null;
    isActive?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'USER' | 'ADMIN';
  }
}
