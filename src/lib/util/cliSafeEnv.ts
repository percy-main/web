export const cliSafeEnv = async <K extends string, T>(
  getter: (env: Record<K, string>) => T,
  cliValue?: T,
) => {
  if (process.env.CLI === "true") {
    return cliValue ?? getter(process.env as Record<K, string>);
  } else {
    return getter(import.meta.env as Record<K, string>);
  }
};
