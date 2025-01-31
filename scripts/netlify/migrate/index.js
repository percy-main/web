/* eslint-disable */

export const onPostBuild = async ({ utils: { run } }) => {
  await run.command("tsx scripts/migrate-up", { env: { CLI: true } });
};
