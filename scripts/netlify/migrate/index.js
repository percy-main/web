/* eslint-disable */

export const onPostBuild = async ({ utils: { run } }) => {
  await run.command("CLI=true tsx scripts/migrate-up");
};
