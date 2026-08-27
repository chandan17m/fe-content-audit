import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

export type ModulePromptSet = {
  module1: string;
  module2: string;
  module3: string;
};

const promptFiles = {
  module1: "module-1-classification.md",
  module2: "module-2-scoring.md",
  module3: "module-3-action-tag.md",
} satisfies Record<keyof ModulePromptSet, string>;

const promptEnv = {
  module1: "MODULE_1_PROMPT",
  module2: "MODULE_2_PROMPT",
  module3: "MODULE_3_PROMPT",
} satisfies Record<keyof ModulePromptSet, string>;

async function readPrompt(moduleName: keyof ModulePromptSet) {
  const envValue = process.env[promptEnv[moduleName]];

  if (envValue?.trim()) {
    return envValue.trim();
  }

  return readFile(path.join(process.cwd(), "prompts", promptFiles[moduleName]), "utf8");
}

export async function getModulePrompts(): Promise<ModulePromptSet> {
  const [module1, module2, module3] = await Promise.all([
    readPrompt("module1"),
    readPrompt("module2"),
    readPrompt("module3"),
  ]);

  return { module1, module2, module3 };
}
