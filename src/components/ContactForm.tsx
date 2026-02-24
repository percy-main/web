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
    <div className="mx-auto max-w-md rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold tracking-tight text-gray-900">
        {title}
      </h2>
      {mutation.isSuccess ? (
        <p className="mt-3 text-sm text-gray-600">
          Thanks for getting in touch! We'll get back to you soon.
        </p>
      ) : (
        <>
          {description ? (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          ) : null}
          <form
            className="mt-4 flex flex-col gap-3"
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
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
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
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
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
              className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              placeholder="Your message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-md border border-gray-800 bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Sending..." : "Send Message"}
            </button>
          </form>
          {mutation.isError ? (
            <p className="mt-3 text-sm text-red-600">
              Sorry, something went wrong. Please try again.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};
