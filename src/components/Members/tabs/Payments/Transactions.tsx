import { useQuery } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { formatDate } from "date-fns";

export const Transactions = () => {
  const query = useQuery({
    queryKey: ["transactions"],
    queryFn: actions.payments,
  });

  if (!query.data?.data) {
    return null;
  }

  const currencyFormatter = new Intl.NumberFormat("en-GB", {
    currency: "GBP",
    currencySign: "standard",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <>
      <h2 className="text-h4 mb-0">Transaction History</h2>
      <div className="w-full">
        {query.data.data.charges.length === 0 && (
          <p>You are yet to make any purchases.</p>
        )}
        {query.data.data.charges.map((purchase) => (
          <>
            <div className="flex flex-wrap items-center gap-y-4">
              <dl className="w-1/2 sm:w-1/4 lg:w-auto lg:flex-1">
                <dt className="text-base font-medium text-gray-500 dark:text-gray-400">
                  Product
                </dt>
                <dd className="mt-1.5 text-base font-semibold text-gray-900 dark:text-white">
                  {purchase.price?.product.name}
                </dd>
              </dl>

              <dl className="w-1/2 sm:w-1/4 lg:w-auto lg:flex-1">
                <dt className="text-base font-medium text-gray-500 dark:text-gray-400">
                  Date
                </dt>
                <dd className="mt-1.5 text-base font-semibold text-gray-900 dark:text-white">
                  {formatDate(purchase.created, "dd/MM/yyyy hh:mm")}
                </dd>
              </dl>

              <dl className="w-1/2 sm:w-1/4 lg:w-auto lg:flex-1">
                <dt className="text-base font-medium text-gray-500 dark:text-gray-400">
                  Price
                </dt>
                <dd className="mt-1.5 text-base font-semibold text-gray-900 dark:text-white">
                  £{currencyFormatter.format(purchase.amount / 100)}
                </dd>
              </dl>

              <dl className="w-1/2 sm:w-1/4 lg:w-auto lg:flex-1">
                <dt className="text-base font-medium text-gray-500 dark:text-gray-400">
                  Status
                </dt>
                <dd className="me-2 mt-1.5 inline-flex items-center rounded-sm bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-300">
                  <svg
                    className="me-1 h-3 w-3"
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke="currentColor"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M5 11.917 9.724 16.5 19 7.5"
                    />
                  </svg>
                  Confirmed
                </dd>
              </dl>
            </div>
          </>
        ))}
      </div>
    </>
  );
};
