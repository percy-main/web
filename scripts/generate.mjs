/* eslint-disable  */
import babelPresetReact from "@babel/preset-react";
import babelPresetTypescript from "@babel/preset-typescript";
import { logger } from "better-auth";
import { getAdapter, getMigrations } from "better-auth/db";
import { loadConfig } from "c12";
import chalk from "chalk";
import fss from "fs";
import fs from "fs/promises";
import path from "path";
import prompts from "prompts";
import yoctoSpinner from "yocto-spinner";
import { z } from "zod";

function stripJsonComments(jsonString) {
  return jsonString
    .replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) =>
      g ? "" : m,
    )
    .replace(/,(?=\s*[}\]])/g, "");
}

function getPathAliases(cwd) {
  const tsConfigPath = path.join(cwd, "tsconfig.json");
  if (!fss.existsSync(tsConfigPath)) {
    return null;
  }
  try {
    const tsConfigContent = fss.readFileSync(tsConfigPath, "utf8");
    const strippedTsConfigContent = stripJsonComments(tsConfigContent);
    const tsConfig = JSON.parse(strippedTsConfigContent);
    const { paths = {}, baseUrl = "." } = tsConfig.compilerOptions || {};

    const result = {};
    const obj = Object.entries(paths);
    for (const [alias, aliasPaths] of obj) {
      for (const aliasedPath of aliasPaths) {
        const resolvedBaseUrl = path.join(cwd, baseUrl);
        const finalAlias = alias.slice(-1) === "*" ? alias.slice(0, -1) : alias;
        const finalAliasedPath =
          aliasedPath.slice(-1) === "*"
            ? aliasedPath.slice(0, -1)
            : aliasedPath;

        result[finalAlias || ""] = path.join(resolvedBaseUrl, finalAliasedPath);
      }
    }
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

const jitiOptions = (cwd) => {
  const alias = getPathAliases(cwd) || {};
  return {
    transformOptions: {
      babel: {
        presets: [
          [
            babelPresetTypescript,
            {
              isTSX: true,
              allExtensions: true,
            },
          ],
          [babelPresetReact, { runtime: "automatic" }],
        ],
      },
    },
    extensions: [".ts", ".tsx", ".js", ".jsx"],
    alias,
  };
};

const generator = async ({ options }) => {
  const { compileMigrations } = await getMigrations(options);
  const migrations = await compileMigrations();
  return {
    code: migrations,
    fileName: `./better-auth_migrations/${new Date()
      .toISOString()
      .replace(/:/g, "-")}.sql`,
  };
};

async function getConfig({ cwd, configPath }) {
  try {
    let configFile = null;
    if (configPath) {
      const resolvedPath = path.join(cwd, configPath);
      const { config } = await loadConfig({
        configFile: resolvedPath,
        dotenv: true,
        jitiOptions: jitiOptions(cwd),
      });
      if (!config.auth && !config.default) {
        logger.error(
          `[#better-auth]: Couldn't read your auth config in ${resolvedPath}. Make sure to default export your auth instance or to export as a variable named auth.`,
        );
        process.exit(1);
      }
      configFile = config.auth?.options || config.default?.options || null;
    }

    if (!configFile) {
      for (const possiblePath of possiblePaths) {
        try {
          const { config } = await loadConfig({
            configFile: possiblePath,
            jitiOptions: jitiOptions(cwd),
          });
          const hasConfig = Object.keys(config).length > 0;
          if (hasConfig) {
            configFile =
              config.auth?.options || config.default?.options || null;
            if (!configFile) {
              logger.error("[#better-auth]: Couldn't read your auth config.");
              console.log("");
              logger.info(
                "[#better-auth]: Make sure to default export your auth instance or to export as a variable named auth.",
              );
              process.exit(1);
            }
            break;
          }
        } catch (e) {
          if (
            typeof e === "object" &&
            e &&
            "message" in e &&
            typeof e.message === "string" &&
            e.message.includes(
              "This module cannot be imported from a Client Component module",
            )
          ) {
            logger.error(
              `Please remove import 'server-only' from your auth config file temporarily. The CLI cannot resolve the configuration with it included. You can re-add it after running the CLI.`,
            );
            process.exit(1);
          }
          logger.error("[#better-auth]: Couldn't read your auth config.", e);
          process.exit(1);
        }
      }
    }
    return configFile;
  } catch (e) {
    if (
      typeof e === "object" &&
      e &&
      "message" in e &&
      typeof e.message === "string" &&
      e.message.includes(
        "This module cannot be imported from a Client Component module",
      )
    ) {
      logger.error(
        `Please remove import 'server-only' from your auth config file temporarily. The CLI cannot resolve the configuration with it included. You can re-add it after running the CLI.`,
      );
      process.exit(1);
    }
    logger.error("Couldn't read your auth config.", e);
    process.exit(1);
  }
}

export async function generateAction(opts) {
  const options = z
    .object({
      cwd: z.string(),
      config: z.string().optional(),
      output: z.string().optional(),
      y: z.boolean().optional(),
    })
    .parse(opts);

  const cwd = path.resolve(options.cwd);
  if (!fss.existsSync(cwd)) {
    logger.error(`The directory "${cwd}" does not exist.`);
    process.exit(1);
  }
  const config = await getConfig({
    cwd,
    configPath: options.config,
  });
  if (!config) {
    logger.error(
      "No configuration file found. Add a `auth.ts` file to your project or pass the path to the configuration file using the `--config` flag.",
    );
    return;
  }

  const adapter = await getAdapter(config).catch((e) => {
    logger.error(e.message);
    process.exit(1);
  });

  const spinner = yoctoSpinner({ text: "preparing schema..." }).start();

  const schema = await generator({
    adapter,
    file: options.output,
    options: config,
  });

  spinner.stop();
  if (!schema.code) {
    logger.info("Your schema is already up to date.");
    process.exit(0);
  }
  if (schema.append || schema.overwrite) {
    let confirm = options.y;
    if (!confirm) {
      const response = await prompts({
        type: "confirm",
        name: "confirm",
        message: `The file ${
          schema.fileName
        } already exists. Do you want to ${chalk.yellow(
          `${schema.overwrite ? "overwrite" : "append"}`,
        )} the schema to the file?`,
      });
      confirm = response.confirm;
    }

    if (confirm) {
      const exist = fss.existsSync(path.join(cwd, schema.fileName));
      if (!exist) {
        await fs.mkdir(path.dirname(path.join(cwd, schema.fileName)), {
          recursive: true,
        });
      }
      if (schema.overwrite) {
        await fs.writeFile(path.join(cwd, schema.fileName), schema.code);
      } else {
        await fs.appendFile(path.join(cwd, schema.fileName), schema.code);
      }
      logger.success(
        `🚀 Schema was ${
          schema.overwrite ? "overwritten" : "appended"
        } successfully!`,
      );
    } else {
      logger.error("Schema generation aborted.");
      process.exit(1);
    }
  }

  let confirm = options.y;

  if (!confirm) {
    const response = await prompts({
      type: "confirm",
      name: "confirm",
      message: `Do you want to generate the schema to ${chalk.yellow(
        schema.fileName,
      )}?`,
    });
    confirm = response.confirm;
  }

  if (!confirm) {
    logger.error("Schema generation aborted.");
    process.exit(1);
  }

  if (!options.output) {
    const dirExist = fss.existsSync(
      path.dirname(path.join(cwd, schema.fileName)),
    );
    if (!dirExist) {
      await fs.mkdir(path.dirname(path.join(cwd, schema.fileName)), {
        recursive: true,
      });
    }
  }
  await fs.writeFile(
    options.output || path.join(cwd, schema.fileName),
    schema.code,
  );
  logger.success(`🚀 Schema was generated successfully!`);
}
