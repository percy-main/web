import type { FC, PropsWithChildren } from "react";
import type { Person as TPerson } from "../collections/person";

type Props = {
  person: Pick<TPerson, "name" | "slug"> & {
    photo?: { url: string; title: string };
  };
  pageDescription?: React.ReactNode;
};

export const Person: FC<PropsWithChildren<Props>> = ({
  person,
  pageDescription,
  children,
}) => {
  return (
    <div className="person mx-4 h-full max-w-2xl rounded-lg bg-white pb-4 text-gray-900 shadow-md sm:mx-auto sm:max-w-sm md:mx-auto md:max-w-sm lg:mx-auto lg:max-w-sm xl:mx-auto xl:max-w-sm">
      <div className="h-2 rounded-t-lg bg-gradient-to-r from-primary to-orange-400" />
      <div className="mx-auto mt-4 h-24 w-24 overflow-hidden rounded-full border-4 border-gray-100">
        <img
          className="h-24 w-24 object-cover object-center"
          src={person.photo?.url ?? "/images/anon.jpg"}
          alt={person.photo?.title ?? person.name}
        />
      </div>
      <div className="mt-3 text-center">
        <h5 className="pb-1 font-semibold">{person.name}</h5>

        {pageDescription && <p className="text-sm text-gray-600">{pageDescription}</p>}

        {children && <div className="text-sm text-gray-600">{children}</div>}

        <a
          className="mt-2 inline-block px-2 text-sm text-primary font-medium hover:underline"
          href={`/person/${person.slug}`}
        >
          Profile
        </a>
      </div>
    </div>
  );
};
