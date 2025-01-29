import { auth } from "@/lib/auth/server";
import type { APIRoute } from "astro";
import type { MaybePromise } from "astro/actions/runtime/utils.js";
import type { z } from "astro/zod";
import {
  ActionError,
  defineAction,
  type ActionAccept,
  type ActionAPIContext,
  type ActionHandler,
} from "astro:actions";
import { type Session, type User } from "better-auth";

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
      input: z.infer<TInputSchema>,
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
  TAccept extends ActionAccept | undefined = undefined,
  TInputSchema extends z.ZodType | undefined = TAccept extends "form"
    ? z.ZodType<FormData>
    : undefined,
>({
  accept,
  input,
  handler,
  requireVerifiedEmail,
}: {
  input?: TInputSchema;
  accept?: TAccept;
  handler: AuthActionHandler<TInputSchema, TOutput>;
  requireVerifiedEmail?: boolean;
}) {
  return defineAction({
    accept,
    input,
    handler: (async (data: TInputSchema, context: ActionAPIContext) => {
      const isAuthed = await auth.api.getSession({
        headers: context.request.headers,
      });

      if (!isAuthed) {
        throw new ActionError({ code: "UNAUTHORIZED" });
      }

      if (requireVerifiedEmail && !isAuthed.user.emailVerified) {
        throw new ActionError({ code: "UNAUTHORIZED" });
      }

      return await handler(data, isAuthed, context);
    }) as ActionHandler<TInputSchema, TOutput>,
  });
}
