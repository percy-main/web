import { useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { formatDate } from "date-fns";

export const Subscriptions = () => {
  const query = useQuery({
    queryKey: ["subscriptions"],
    queryFn: async () => {
      const result = await actions.subscriptions();
      if (result.error) throw result.error;
      return result.data;
    },
  });

  if (!query.data) {
    return null;
  }

  return (
    <>
      <h2 className="text-h4 mb-0">Your Subscriptions</h2>
      <div className="w-full">
        {query.data.subscriptions.length === 0 && (
          <p>You have no subscriptions.</p>
        )}
        {query.data.subscriptions.map((subscription) => (
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
    </>
  );
};
