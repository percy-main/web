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
    <div className="person mx-4 h-full max-w-2xl rounded-lg bg-white pb-2 text-gray-900 shadow-xl sm:mx-auto sm:max-w-sm md:mx-auto md:max-w-sm lg:mx-auto lg:max-w-sm xl:mx-auto xl:max-w-sm">
      <div className="h-32 overflow-hidden rounded-t-lg">
        <img
          className="w-full object-cover object-top"
          src="/images/pitch.png"
          alt="Percy Main Outfield"
        />
      </div>
      <div className="relative mx-auto -mt-16 h-32 w-32 overflow-hidden rounded-full border-4 border-white">
        <img
          className="h-32 object-cover object-center"
          src={person.photo?.url ?? "/images/anon.jpg"}
          alt={person.photo?.title ?? person.name}
        />
      </div>
      <div className="mt-2 text-center">
        <h5 className="pb-2 font-semibold">{person.name}</h5>

        {pageDescription && <p className="prose">{pageDescription}</p>}

        {children && <p className="prose">{children}</p>}

        <a
          className="px-2 text-sm text-blue-900 underline"
          href={`/person/${person.slug}`}
        >
          Profile
        </a>
      </div>
    </div>
  );
};
