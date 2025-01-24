import { expect, test } from "vitest";
import * as join from "../join";

test("adds 1 + 2 to equal 3", async () => {
  const result = await join.handler({
    title: "Mr",
    name: "John Doe",
    address: "123 Fake Street",
    postcode: "AB1 2CD",
    dob: "2000-01-01",
    telephone: "01234567890",
    email: "a@b.com",
    emerg_name: "Jane Doe",
    emerg_phone: "09876543210",
  });

  expect(result).toEqual(expect.objectContaining({ id: expect.any(String) }));
});
