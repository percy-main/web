/**
 * This file was generated by kysely-codegen.
 * Please do not edit it manually.
 */

import type { ColumnType } from "kysely";

export type Generated<T> =
  T extends ColumnType<infer S, infer I, infer U>
    ? ColumnType<S, I | undefined, U>
    : ColumnType<T, T | undefined, T>;

export interface Account {
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  accountId: string;
  createdAt: string;
  id: string;
  idToken: string | null;
  password: string | null;
  providerId: string;
  refreshToken: string | null;
  refreshTokenExpiresAt: string | null;
  scope: string | null;
  updatedAt: string;
  userId: string;
}

export interface Member {
  address: string;
  dob: string;
  email: string;
  emergency_contact_name: string;
  emergency_contact_telephone: string;
  id: string;
  name: string;
  postcode: string;
  telephone: string;
  title: string;
}

export interface Membership {
  created_at: Generated<string | null>;
  id: string;
  member_id: string;
  paid_until: string;
  type: string | null;
}

export interface Session {
  createdAt: string;
  expiresAt: string;
  id: string;
  ipAddress: string | null;
  token: string;
  updatedAt: string;
  userAgent: string | null;
  userId: string;
}

export interface User {
  createdAt: string;
  email: string;
  emailVerified: number;
  id: string;
  image: string | null;
  name: string;
  updatedAt: string;
}

export interface Verification {
  createdAt: string | null;
  expiresAt: string;
  id: string;
  identifier: string;
  updatedAt: string | null;
  value: string;
}

export interface DB {
  account: Account;
  member: Member;
  membership: Membership;
  session: Session;
  user: User;
  verification: Verification;
}
