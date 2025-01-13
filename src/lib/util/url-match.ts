import { match, P } from "ts-pattern";

export type Match = { start: string } | "exact" | "never";

export type MenuItem = {
  url: string;
  match: Match | Match[];
};

export const urlMatch = (pathname: string, item: MenuItem): boolean => {
  return match({ pathname, item })
    .with({ item: { match: P.array(P.any) } }, ({ item: { match } }) =>
      match.some((m) => urlMatch(pathname, { ...item, match: m })),
    )
    .with(
      {
        item: { match: "never" },
      },
      () => false,
    )
    .with(
      { item: { match: "exact" } },
      () => pathname === `${item.url}/` || pathname === item.url,
    )
    .with(
      { item: { match: { start: P.string } } },
      ({
        item: {
          match: { start },
        },
      }) => pathname.startsWith(start),
    )
    .exhaustive();
};
