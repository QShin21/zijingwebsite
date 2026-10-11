import type { SignupForm } from "./signup-schema";
export type AILogic = boolean | "auto";
export type GenerationRequest = {
  description: string;
  audience: string;
  logic: AILogic;
  draft?: SignupForm;
  refinement?: string;
};
export type GenerationProgress = {
  stage: "generating" | "checking" | "repairing";
  message: string;
};
export type GenerationEvent =
  | ({ type: "progress" } & GenerationProgress)
  | { type: "result"; form: SignupForm; model: string }
  | { type: "error"; error: string };
