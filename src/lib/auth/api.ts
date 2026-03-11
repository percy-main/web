import { auth } from "@/lib/auth/server";
import type { APIRoute } from "astro";
import type { z } from "astro/zod";
import {
  ActionError,
  defineAction,
  type ActionAPIContext,
} from "astro:actions";
import { type Session, type User } from "better-auth";

type MaybePromise<T> = T | Promise<T>;

export const authedApi =
  (route: (session: { user: User; session: Session }) => APIRoute): APIRoute =>
  async (context) => {
    const isAuthed = await auth.api.getSession({
      headers: context.request.headers,
    });

    if (!isAuthed) {
      return new Response(null, { status: 401 });
    }

    return await route(isAuthed)(context);
  };

type AuthActionHandler<TInputSchema, TOutput> = TInputSchema extends z.ZodType
  ? (
      input: z.output<TInputSchema>,
      session: { user: User; session: Session },
      context: ActionAPIContext,
    ) => MaybePromise<TOutput>
  : (
      input: unknown,
      session: { user: User; session: Session },
      context: ActionAPIContext,
    ) => MaybePromise<TOutput>;

export function defineAuthAction<
  TOutput,
  TAccept extends "form" | "json" | undefined = undefined,
  TInputSchema extends z.ZodType | undefined = TAccept extends "form"
    ? z.ZodType<FormData>
    : undefined,
>({
  accept,
  input,
  handler,
  requireVerifiedEmail,
  roles,
}: {
  input?: TInputSchema;
  accept?: TAccept;
  handler: AuthActionHandler<TInputSchema, TOutput>;
  requireVerifiedEmail?: boolean;
  roles?: string[];
}) {
  const wrappedHandler = async (
    data: TInputSchema extends z.ZodType ? z.output<TInputSchema> : unknown,
    context: ActionAPIContext,
  ) => {
    const isAuthed = await auth.api.getSession({
      headers: context.request.headers,
    });

    if (!isAuthed) {
      throw new ActionError({ code: "UNAUTHORIZED" });
    }

    if (requireVerifiedEmail && !isAuthed.user.emailVerified) {
      throw new ActionError({ code: "UNAUTHORIZED" });
    }

    if (roles && !roles.includes(isAuthed.user.role ?? "user")) {
      throw new ActionError({ code: "UNAUTHORIZED" });
    }

    return await handler(
      data as Parameters<typeof handler>[0],
      isAuthed,
      context,
    );
  };

  return defineAction({
    accept,
    input,
    // @ts-expect-error — our handler signature is compatible but uses z.ZodType vs Astro's internal z.$ZodType
    handler: wrappedHandler,
  });
}
