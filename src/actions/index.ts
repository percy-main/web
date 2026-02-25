import { admin } from "./admin";
import { charges } from "./charges";
import { checkout } from "./checkout";
import { createContactSubmission } from "./create-contact-submission";
import { createEventSubscriber } from "./create-event-subscriber";
import { gameScore } from "./game-score";
import { join } from "./join";
import {
  addDependents,
  dependents,
  juniorCheckout,
} from "./junior";
import { leaderboard } from "./leaderboard";
import { membership } from "./membership";
import { payments } from "./payments";
import { playCricket } from "./play-cricket";
import { subscriptions } from "./subscriptions";

export const server = {
  admin,
  addDependents,
  charges,
  checkout,
  createContactSubmission,
  dependents,
  join,
  juniorCheckout,
  payments,
  subscriptions,
  playCricket,
  membership,
  createEventSubscriber,
  gameScore,
  leaderboard,
};
