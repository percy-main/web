import { useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { formatDate } from "date-fns";
import type { FC } from "react";
import { match } from "ts-pattern";

type Props = {
  email: string;
};

export const Membership: FC<Props> = ({ email }) => {
  const query = useQuery({
    queryKey: ["membership"],
    queryFn: actions.membership,
  });

  const dependentsQuery = useQuery({
    queryKey: ["dependents"],
    queryFn: actions.dependents,
  });

  if (!query.data?.data) {
    return null;
  }

  const { membership } = query.data.data;
  const deps = dependentsQuery.data?.data?.dependents ?? [];

  return (
    <section>
      <h2 className="text-h4">Your Membership</h2>
      <div className="max-w-max rounded-2xl border border-gray-500 bg-blue-100 p-4">
        {membership ? (
          <>
            <div className="mb-2 font-semibold">
              {match(membership.type)
                .with("senior_player", () => "Playing Member (Senior)")
                .with("social", () => "Social Member")
                .with("junior", () => "Junior Member")
                .otherwise(() => "Unknown membership type")}
            </div>
            <p className="text-sm">
              <span className="font-semibold">Member Since: </span>
              {formatDate(membership.created_at, "dd/MM/yyyy")}
            </p>
            <p className="text-sm">
              <span className="font-semibold">Paid Until: </span>
              {formatDate(membership.paid_until, "dd/MM/yyyy")}
            </p>
          </>
        ) : (
          <>
            <div className="mb-2 font-semibold">No Membership</div>
            <a
              className="hover:underline"
              href={`/membership/pay?email=${encodeURIComponent(email)}`}
            >
              Join Now
            </a>
          </>
        )}
      </div>

      {deps.length > 0 && (
        <div className="mt-6">
          <h3 className="text-h5 mb-2">Junior Members</h3>
          <div className="flex flex-col gap-3">
            {deps.map((dep) => (
              <div
                key={dep.id}
                className="max-w-max rounded-2xl border border-gray-500 bg-green-50 p-4"
              >
                <div className="mb-1 font-semibold">{dep.name}</div>
                <p className="text-sm">
                  <span className="font-semibold">Date of Birth: </span>
                  {formatDate(dep.dob, "dd/MM/yyyy")}
                </p>
                {dep.school_year && (
                  <p className="text-sm">
                    <span className="font-semibold">School Year: </span>
                    {dep.school_year}
                  </p>
                )}
                {dep.paid_until ? (
                  <p className="text-sm">
                    <span className="font-semibold">Paid Until: </span>
                    {formatDate(dep.paid_until, "dd/MM/yyyy")}
                  </p>
                ) : (
                  <p className="text-sm text-amber-600">Awaiting payment</p>
                )}
                {dep.photo_consent !== null && (
                  <p className="text-sm">
                    <span className="font-semibold">Photo Consent: </span>
                    {dep.photo_consent ? "Yes" : "No"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <a
          className="inline-block rounded-lg border border-blue-700 bg-white px-5 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50 focus:ring-4 focus:ring-blue-300 focus:outline-none"
          href="/membership/junior"
        >
          Register Junior Members
        </a>
      </div>
    </section>
  );
};
