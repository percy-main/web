import formData from "form-data";
import { htmlToText } from "html-to-text";
import Mailgun from "mailgun.js";
import { cliSafeEnv } from "../util/cliSafeEnv";

const domain = await cliSafeEnv((env) => env.MAILGUN_DOMAIN);
const key = await cliSafeEnv((env) => env.MAILGUN_API_KEY);
const url = await cliSafeEnv((env) => env.MAILGUN_URL);

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key,
  url,
});

type Email = {
  to: string;
  subject: string;
  html: string;
};

export const send = async ({ to, subject, html }: Email) => {
  return await mg.messages.create(domain, {
    from: "Percy Main CSC Support <support@notifications.percymain.org>",
    to: [to],
    subject,
    text: htmlToText(html),
    html: html,
  });
};
