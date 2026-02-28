import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
            <Input
              id="contact-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label htmlFor="contact-email" className="sr-only">
              Email address
            </label>
            <Input
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="contact-message" className="sr-only">
              Message
            </label>
            <Textarea
              id="contact-message"
              name="message"
              required
              rows={4}
              placeholder="Your message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
            <Button
              type="submit"
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Sending..." : "Send Message"}
            </Button>
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
