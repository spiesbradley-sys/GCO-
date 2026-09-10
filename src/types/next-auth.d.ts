import type { Role, OrgType } from '@prisma/client';
import type { DefaultSession } from 'next-auth';

export type SessionMembership = {
  orgId: string;
  orgName: string;
  orgType: OrgType;
  role: Role;
};

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: Role;
      memberships: SessionMembership[];
    } & DefaultSession['user'];
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: string;
    role?: Role;
    memberships?: SessionMembership[];
  }
}
