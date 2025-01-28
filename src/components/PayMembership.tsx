import { useState, type FC } from "react";
import { match } from "ts-pattern";
import type { Price } from "../collections/price";
import { BankDetails } from "./BankDetails";

type Props = {
  monthly: Price;
  annually: Price;
};

export const PayMembership: FC<Props> = ({ monthly, annually }) => {
  const [schedule, setSchedule] = useState<"annually" | "monthly">();
  const [payment, setPayment] = useState<"online" | "bank">();

  return (
    <>
      <div className="mt-8">
        <p>You can choose to pay annually or monthly.</p>
        <ul className="mt-4 grid gap-6 md:grid-cols-2">
          <li>
            <input
              type="radio"
              id="annually"
              name="schedule"
              value="annually"
              onChange={() => setSchedule("annually")}
              checked={schedule === "annually"}
              className="peer hidden"
            />
            <label
              htmlFor="annually"
              className="inline-flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-200 bg-white p-5 text-gray-500 peer-checked:border-blue-600 peer-checked:text-blue-600 hover:bg-gray-100 hover:text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:peer-checked:text-blue-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <div className="block">
                <div className="w-full text-lg font-semibold">Annually</div>
                <div className="w-full">{annually.formattedPrice}/year</div>
              </div>
            </label>
          </li>
          <li>
            <input
              type="radio"
              id="monthly"
              name="schedule"
              value="monthly"
              onChange={() => setSchedule("monthly")}
              checked={schedule === "monthly"}
              className="peer hidden"
            />
            <label
              htmlFor="monthly"
              className="inline-flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-200 bg-white p-5 text-gray-500 peer-checked:border-blue-600 peer-checked:text-blue-600 hover:bg-gray-100 hover:text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:peer-checked:text-blue-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <div className="block">
                <div className="w-full text-lg font-semibold">Monthly</div>
                <div className="w-full">{monthly.formattedPrice}/month</div>
              </div>
            </label>
          </li>
        </ul>
      </div>
      <div className="mt-8">
        <p>How would you like to pay?</p>
        <ul className="mt-4 grid justify-stretch gap-6 md:grid-cols-2">
          <li>
            <input
              type="radio"
              id="online"
              name="pay_method"
              value="online"
              onChange={() => setPayment("online")}
              checked={payment === "online"}
              className="peer hidden"
              required
            />
            <label
              htmlFor="online"
              className="inline-flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-200 bg-white p-5 text-gray-500 peer-checked:border-blue-600 peer-checked:text-blue-600 hover:bg-gray-100 hover:text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:peer-checked:text-blue-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <div className="block">
                <div className="w-full text-lg font-semibold">Pay online</div>
                <div className="w-full">Use our secure online checkout</div>
              </div>
            </label>
          </li>
          <li>
            <input
              type="radio"
              id="bank"
              name="pay_method"
              value="bank"
              onChange={() => setPayment("bank")}
              checked={payment === "bank"}
              className="peer hidden"
            />
            <label
              htmlFor="bank"
              className="inline-flex h-full w-full cursor-pointer items-center justify-between rounded-lg border border-gray-200 bg-white p-5 text-gray-500 peer-checked:border-blue-600 peer-checked:text-blue-600 hover:bg-gray-100 hover:text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:peer-checked:text-blue-500 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <div className="block">
                <div className="w-full text-lg font-semibold">
                  Bank Transfer
                </div>
                <div className="w-full">Transfer directly to the club</div>
              </div>
            </label>
          </li>
        </ul>
      </div>
      <div className="mt-8">
        {match({ payment, schedule })
          .with({ payment: "bank", schedule: "monthly" }, () => (
            <>
              <p>
                Please setup a monthly standing order for{" "}
                {monthly.formattedPrice} to the following bank details:
              </p>
              <BankDetails />
            </>
          ))
          .with({ payment: "bank", schedule: "annually" }, () => (
            <>
              <p>
                Please make a payment of {annually.formattedPrice} to the
                following bank details:
              </p>
              <BankDetails />
            </>
          ))
          .with({ payment: "online", schedule: "annually" }, () => (
            <a
              href={`/purchase/${annually.id}`}
              className="w-full rounded-lg bg-blue-700 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 focus:outline-hidden sm:w-auto dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
            >
              Pay Online
            </a>
          ))
          .with({ payment: "online", schedule: "monthly" }, () => (
            <a
              href={`/purchase/${monthly.id}`}
              className="w-full rounded-lg bg-blue-700 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 focus:outline-hidden sm:w-auto dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
            >
              Pay Online
            </a>
          ))
          .otherwise(() => (
            <></>
          ))}
      </div>
    </>
  );
};
