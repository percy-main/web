export class NoMemberWithEmailError extends Error {
  protected readonly email: string;

  constructor({ email }: { email: string }) {
    super(`No member with email`);
    this.email = email;
  }
}
