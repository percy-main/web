import { useState, type FC } from "react";
import { match } from "ts-pattern";
import type { Price } from "../collections/price";
import { RadioButtons } from "./form/RadioButtons";
import { PaymentLink } from "./PaymentLink";

type Props = {
  options: {
    senior_player: {
      monthly: Price;
      annually: Price;
    };
    social: {
      monthly: Price;
      annually: Price;
    };
  };
};

export const PayMembership: FC<Props> = ({ options }) => {
  const [membership, setMembership] = useState<"senior_player" | "social">();
  const [schedule, setSchedule] = useState<"annually" | "monthly">();
  const [payment, setPayment] = useState<"online" | "bank">();

  const price = membership ? options[membership] : null;

  return (
    <>
      <div className="mt-8">
        <section className="mb-12">
          <h5>Your Membership</h5>
          <p>
            Choose the category of membership for which you would like to apply.
          </p>
          <RadioButtons
            id="membership"
            onChange={setMembership}
            value={membership}
            options={[
              {
                title: "Senior Player",
                description: "For all senior playing members.",
                value: "senior_player",
              },
              {
                title: "Social",
                description: "For supporters and friends of the club.",
                value: "social",
              },
            ]}
          />
        </section>
      </div>

      {price && membership && (
        <>
          <section className="mb-12">
            <h5>You can choose to pay annually or monthly.</h5>
            <RadioButtons
              id="schedule"
              onChange={setSchedule}
              value={schedule}
              options={[
                {
                  title: "Annually",
                  description: `${price.annually.formattedPrice}/annum`,
                  value: "annually",
                },
                {
                  title: "Monthly",
                  description: `${price.monthly.formattedPrice}/month`,
                  value: "monthly",
                },
              ]}
            />
          </section>
          {schedule && (
            <>
              <section className="mb-12">
                <h5>How would you like to pay?</h5>

                <RadioButtons
                  id="payment"
                  onChange={setPayment}
                  value={payment}
                  options={[
                    {
                      title: "Online",
                      description: `Pay online through our secure payment processor.`,
                      value: "online",
                    },
                    {
                      title: "Bank Transfer",
                      description: `Set up through your own bank.`,
                      value: "bank",
                    },
                  ]}
                />
              </section>
              {payment && (
                <section className="mb-12">
                  {match({ payment, schedule })
                    .with({ payment: "bank", schedule: "monthly" }, () => (
                      <>
                        <p>
                          Please setup a monthly standing order for{" "}
                          {price.monthly.formattedPrice} to the following bank
                          details:
                        </p>
                        <BankDetails />
                      </>
                    ))
                    .with({ payment: "bank", schedule: "annually" }, () => (
                      <>
                        <p>
                          Please make a payment of{" "}
                          {price.annually.formattedPrice} to the following bank
                          details:
                        </p>
                        <BankDetails />
                      </>
                    ))
                    .with({ payment: "online", schedule: "annually" }, () => (
                      <PaymentLink
                        priceId={price.annually.id}
                        metadata={{ type: "membership", membership }}
                        className="w-full rounded-lg bg-blue-700 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 focus:outline-none sm:w-auto dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
                      >
                        Pay Online
                      </PaymentLink>
                    ))
                    .with({ payment: "online", schedule: "monthly" }, () => (
                      <PaymentLink
                        priceId={price.monthly.id}
                        metadata={{ type: "membership", membership }}
                        className="w-full rounded-lg bg-blue-700 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 focus:outline-none sm:w-auto dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800"
                      >
                        Pay Online
                      </PaymentLink>
                    ))
                    .otherwise(() => (
                      <></>
                    ))}
                </section>
              )}
            </>
          )}
        </>
      )}
    </>
  );
};
