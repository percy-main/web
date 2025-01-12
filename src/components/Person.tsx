import type { FC } from "react";
import type { TypeTrusteeSkeleton } from "../__generated__";
import type { Person as TPerson } from "../collections/person";

type Props = {
  person: TPerson;
  pageDescription?: string;
};

export const Person: FC<Props> = ({ person, pageDescription }) => {
  return (
    <div className="person max-w-2xl mx-4 sm:max-w-sm md:max-w-sm lg:max-w-sm xl:max-w-sm sm:mx-auto md:mx-auto lg:mx-auto xl:mx-auto bg-white shadow-xl rounded-lg text-gray-900">
      <div className="rounded-t-lg h-32 overflow-hidden">
        <img
          className="object-cover object-top w-full"
          src="https://images.unsplash.com/photo-1549880338-65ddcdfd017b?ixlib=rb-1.2.1&q=80&fm=jpg&crop=entropy&cs=tinysrgb&w=400&fit=max&ixid=eyJhcHBfaWQiOjE0NTg5fQ"
          alt="Mountain"
        />
      </div>
      <div className="mx-auto w-32 h-32 relative -mt-16 border-4 border-white rounded-full overflow-hidden">
        <img
          className="object-cover object-center h-32"
          src={person.photo?.url ?? "/images/anon.jpg"}
          alt={person.photo?.title ?? person.name}
        />
      </div>
      <div className="text-center mt-2">
        <h5 className="font-semibold pb-2">{person.name}</h5>

        {pageDescription && <p className="prose">{pageDescription}</p>}

        {person.profile}
      </div>
    </div>
  );
};
