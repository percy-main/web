import { SLACK_TRUSTEES_HOOK } from "astro:env/server";

export const sendMessage = async (text: string) => {
  return await fetch(SLACK_TRUSTEES_HOOK, {
    method: "POST",
    body: JSON.stringify({
      text,
    }),
  });
};
