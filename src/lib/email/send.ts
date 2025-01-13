import { MAILGUN_API_KEY, MAILGUN_DOMAIN, MAILGUN_URL } from "astro:env/server";

import formData from "form-data";
import { htmlToText } from "html-to-text";
import Mailgun from "mailgun.js";

const mailgun = new Mailgun(formData);
const mg = mailgun.client({
  username: "api",
  key: MAILGUN_API_KEY,
  url: MAILGUN_URL,
});

type Email = {
  to: string;
  subject: string;
  html: string;
};

export const send = async ({ to, subject, html }: Email) => {
  return await mg.messages.create(MAILGUN_DOMAIN, {
    from: "Percy Main CSC Support <support@notifications.percymain.org>",
    to: [to],
    subject,
    text: htmlToText(html),
    html: html,
  });
};
