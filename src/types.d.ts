declare namespace App {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Locals {
    user: import("better-auth").User | null;
    session: import("better-auth").Session | null;
  }
}
