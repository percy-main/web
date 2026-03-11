import { admin } from "./admin";
import { charges } from "./charges";
import { fantasy } from "./fantasy";
import { createContactSubmission } from "./create-contact-submission";
import { createEventSubscriber } from "./create-event-subscriber";
import { gameScore } from "./game-score";
import { join } from "./join";
import { addDependents, dependents } from "./junior";
import { juniorManager } from "./junior-manager";
import { leaderboard } from "./leaderboard";
import { matchday } from "./matchday";
import { getMemberDetails, updateMemberDetails } from "./member-details";
import { membership } from "./membership";
import { playCricket } from "./play-cricket";
import { recordLinking } from "./record-linking";
import { purchase } from "./purchase";
import { playerSponsorship } from "./player-sponsorship";
import { sponsorship } from "./sponsorship";
import { subscribe } from "./subscribe";
import { subscriptions } from "./subscriptions";
import { treasurer } from "./treasurer";

export const server = {
  admin,
  charges,
  fantasy,
  createContactSubmission,
  getMemberDetails,
  join,
  addDependents,
  dependents,
  juniorManager,
  playerSponsorship,
  purchase,
  sponsorship,
  subscribe,
  subscriptions,
  playCricket,
  recordLinking,
  membership,
  createEventSubscriber,
  gameScore,
  leaderboard,
  matchday,
  treasurer,
  updateMemberDetails,
};
