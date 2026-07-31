import { User, UserRole } from "@prisma/client";

export type AuthenticatedUser = Omit<User, "passwordHash"> & {
  role: UserRole;
};

export function toAuthenticatedUser(user: User): AuthenticatedUser {
  const { passwordHash, ...authenticatedUser } = user;
  void passwordHash;

  return authenticatedUser;
}
