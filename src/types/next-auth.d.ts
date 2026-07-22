// Placeholder: src/types/next-auth.d.ts
import { Role } from '@prisma/client';
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      role: Role;
      employeeId: string;
      mustChangePassword: boolean;
    };
  }
}