import { useMutation } from "@tanstack/react-query";
import { actions } from "astro:actions";
import { useCallback, useState, type FC } from "react";

type Props = {
  title: string;
  description?: string;
  page: string;
};

export const ContactForm: FC<Props> = ({ title, description, page }) => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  const mutation = useMutation({
    mutationFn: actions.createContactSubmission,
  });

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      mutation.mutate({ name, email, message, page });
    },
    [name, email, message, page, mutation],
  );

  return (
    <div className="flex w-full flex-col items-center justify-center rounded-lg bg-gray-900 p-8">
      <h2 className="text-center text-2xl font-semibold tracking-tight text-white">
        {title}
      </h2>
      {mutation.isSuccess ? (
        <p className="mt-4 text-lg text-gray-300">
          Thanks for getting in touch! We'll get back to you soon.
        </p>
      ) : (
        <>
          {description ? (
            <p className="mt-4 text-lg text-gray-300">{description}</p>
          ) : null}
          <form
            className="mt-6 flex w-full max-w-md flex-col gap-4"
            onSubmit={handleSubmit}
          >
            <label htmlFor="contact-name" className="sr-only">
              Name
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              className="min-w-0 flex-auto rounded-md bg-white/5 px-3.5 py-2 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label htmlFor="contact-email" className="sr-only">
              Email address
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="min-w-0 flex-auto rounded-md bg-white/5 px-3.5 py-2 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="contact-message" className="sr-only">
              Message
            </label>
            <textarea
              id="contact-message"
              name="message"
              required
              rows={4}
              className="min-w-0 flex-auto rounded-md bg-white/5 px-3.5 py-2 text-base text-white outline-1 -outline-offset-1 outline-white/10 placeholder:text-gray-500 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-500 sm:text-sm/6"
              placeholder="Your message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button
              type="submit"
              className="flex-none rounded-md bg-indigo-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Sending..." : "Send Message"}
            </button>
          </form>
          {mutation.isError ? (
            <p className="mt-4 text-red-500">
              Sorry, something went wrong. Please try again.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};
