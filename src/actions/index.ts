import { checkout } from "./checkout";
import { createEventSubscriber } from "./create-event-subscriber";
import { join } from "./join";
import { membership } from "./membership";
import { payments } from "./payments";
import { playCricket } from "./play-cricket";
import { subscriptions } from "./subscriptions";

export const server = {
  checkout,
  join,
  payments,
  subscriptions,
  playCricket,
  membership,
  createEventSubscriber,
};
