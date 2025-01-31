import { useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { formatDate } from "date-fns";

export const Subscriptions = () => {
  const query = useQuery({
    queryKey: ["subscriptions"],
    queryFn: actions.subscriptions,
  });

  if (!query.data?.data) {
    return null;
  }

  if (query.data.data.subscriptions.length === 0) {
    return <p>You have no subscriptions.</p>;
  }

  return (
    <div className="flow-root w-full">
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {query.data.data.subscriptions.map((subscription) => (
          <>
            <div className="flex flex-wrap items-center gap-y-4">
              <dl className="w-1/2 sm:w-1/4 lg:w-auto lg:flex-1">
                <dt className="text-base font-medium text-gray-500 dark:text-gray-400">
                  Name
                </dt>
                <dd className="mt-1.5 text-base font-semibold text-gray-900 dark:text-white">
                  {subscription.name ?? subscription.product.name}
                </dd>
              </dl>

              <dl className="w-1/2 sm:w-1/4 lg:w-auto lg:flex-1">
                <dt className="text-base font-medium text-gray-500 dark:text-gray-400">
                  Created
                </dt>
                <dd className="mt-1.5 text-base font-semibold text-gray-900 dark:text-white">
                  {formatDate(subscription.created, "dd/MM/yyyy hh:mm")}
                </dd>
              </dl>

              <dl className="w-1/2 sm:w-1/4 lg:w-auto lg:flex-1">
                <dt className="text-base font-medium text-gray-500 dark:text-gray-400">
                  Status
                </dt>
                <dd className="mt-1.5 text-base font-semibold text-gray-900 dark:text-white">
                  {subscription.status}
                </dd>
              </dl>

              <dl className="w-1/2 sm:w-1/4 lg:w-auto lg:flex-1">
                <dt className="text-base font-medium text-gray-500 dark:text-gray-400">
                  Paid Until
                </dt>
                <dd className="mt-1.5 text-base font-semibold text-gray-900 dark:text-white">
                  {formatDate(subscription.paidUntil, "dd/MM/yyyy hh:mm")}
                </dd>
              </dl>
            </div>
          </>
        ))}
      </div>
    </div>
  );
};
