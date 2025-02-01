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

  if (!query.data?.data) {
    return null;
  }

  const { membership } = query.data.data;

  return (
    <div className="rounded-2xl border border-gray-500 bg-blue-100 p-4">
      {membership ? (
        <>
          <div className="mb-2 font-semibold">
            {match(membership.type)
              .with("senior_player", () => "Playing Member (Senior)")
              .with("social", () => "Social Member")
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
          <a href={`/membership/pay?email=${encodeURIComponent(email)}`}>
            Join Now
          </a>
        </>
      )}
    </div>
  );
};
