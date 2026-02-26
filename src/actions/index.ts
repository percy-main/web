import { admin } from "./admin";
import { charges } from "./charges";
import { createContactSubmission } from "./create-contact-submission";
import { createEventSubscriber } from "./create-event-subscriber";
import { gameScore } from "./game-score";
import { join } from "./join";
import { addDependents, dependents } from "./junior";
import { juniorManager } from "./junior-manager";
import { leaderboard } from "./leaderboard";
import { getMemberDetails, updateMemberDetails } from "./member-details";
import { membership } from "./membership";
import { playCricket } from "./play-cricket";
import { playCricketAdmin } from "./play-cricket-admin";
import { purchase } from "./purchase";
import { sponsorship } from "./sponsorship";
import { subscribe } from "./subscribe";
import { subscriptions } from "./subscriptions";

export const server = {
  admin,
  charges,
  createContactSubmission,
  getMemberDetails,
  join,
  addDependents,
  dependents,
  juniorManager,
  purchase,
  sponsorship,
  subscribe,
  subscriptions,
  playCricket,
  playCricketAdmin,
  membership,
  createEventSubscriber,
  gameScore,
  leaderboard,
  updateMemberDetails,
};
