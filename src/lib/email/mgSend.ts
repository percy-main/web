import formData from "form-data";
import { htmlToText } from "html-to-text";
import Mailgun from "mailgun.js";
import { cliSafeEnv } from "../util/cliSafeEnv";
import type { Email } from "./types";

const domain = cliSafeEnv((env) => env.MAILGUN_DOMAIN);
const key = cliSafeEnv((env) => env.MAILGUN_API_KEY);
const url = cliSafeEnv((env) => env.MAILGUN_URL);

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key,
  url,
});

export const mgSend = async ({ to, subject, html }: Email) => {
  return await mg.messages.create(domain, {
    from: "Percy Main CSC Support <support@notifications.percymain.org>",
    to: [to],
    subject,
    text: htmlToText(html),
    html: html,
  });
};
