import type { TestContext } from "../contracts/runtime-context.types";

export type SolidTestSpecArgs = {
  ctx: TestContext;
  input: Record<string, any>;
};

export type SolidTestSpecAttachment = {
  name: string;
  contentType: string;
  data: string;
  encoding?: "utf8" | "base64";
};

export type SolidTestSpecResult = {
  ok: boolean;
  name?: string;
  details?: Record<string, any>;
  attachments?: SolidTestSpecAttachment[];
};

export interface ISolidTestSpec {
  run(args: SolidTestSpecArgs): Promise<SolidTestSpecResult>;
}
