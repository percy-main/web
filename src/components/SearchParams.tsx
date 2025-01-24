import type { ReactNode } from "react";

type Props<T extends string, U extends Record<T, string>> = {
  children: (props: U) => ReactNode;
  params: T[];
};

export const SearchParams = <T extends string, U extends Record<T, string>>({
  params,
  children,
}: Props<T, U>) => {
  const search = new URLSearchParams(window.location.search);

  const props = Object.fromEntries(
    params.map((key) => {
      const value = search.get(key as string) ?? "";
      return [key, value];
    }),
  ) as U;

  console.log({ props });

  return children(props);
};
