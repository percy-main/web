import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { useMutation } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useCallback, useState, type FC } from "react";

type Props = {
  title: string;
  description?: string;
  meta: Record<string, string>;
};

export const CollectEmail: FC<Props> = ({ title, description, meta }) => {
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: actions.createEventSubscriber,
  });

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      mutation.mutate({ meta, email });
    },
    [email, meta, mutation],
  );

  return (
    <div className="flex w-full flex-col items-center justify-center rounded-lg bg-gray-900 p-8">
      <h2 className="text-center text-2xl font-semibold tracking-tight text-white">
        {title}
      </h2>
      {mutation.isSuccess ? (
        <p className="mt-4 text-lg text-gray-300">
          Great, we'll see you there!
        </p>
      ) : (
        <>
          {description ? (
            <p className="mt-4 text-lg text-gray-300">{description}</p>
          ) : null}
          <form
            className="mt-6 flex max-w-md flex-col gap-4 sm:flex-row"
            onSubmit={handleSubmit}
          >
            <label htmlFor="email-address" className="sr-only">
              Email address
            </label>
            <Input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="min-w-0 flex-auto bg-white/5 text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button
              type="submit"
              variant="cta"
              className="flex-none"
              disabled={mutation.isPending}
            >
              Submit
            </Button>
          </form>
          {mutation.isError ? (
            <p className="mt-4 text-red-500">
              Sorry, we didn't quite get that. Please try again.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};
