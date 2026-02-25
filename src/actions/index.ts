import { checkout } from "./checkout";
import { createContactSubmission } from "./create-contact-submission";
import { createEventSubscriber } from "./create-event-subscriber";
import { gameScore } from "./game-score";
import { join } from "./join";
import { leaderboard } from "./leaderboard";
import { getMemberDetails, updateMemberDetails } from "./member-details";
import { membership } from "./membership";
import { payments } from "./payments";
import { playCricket } from "./play-cricket";
import { subscriptions } from "./subscriptions";

export const server = {
  checkout,
  createContactSubmission,
  getMemberDetails,
  join,
  payments,
  subscriptions,
  playCricket,
  membership,
  createEventSubscriber,
  gameScore,
  leaderboard,
  updateMemberDetails,
};
