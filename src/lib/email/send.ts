import { devSend } from "./devSend";
import { mgSend } from "./mgSend";

export const send = import.meta.env.DEV ? devSend : mgSend;
