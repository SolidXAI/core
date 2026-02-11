import type { ISolidTestSpec, SolidTestSpecArgs } from "../../contracts/test-spec.types";

export class CustomHealthSpec implements ISolidTestSpec {
  async run({ ctx, input }: SolidTestSpecArgs) {
    if (!ctx.api) {
      throw new Error("Missing API adapter on context for CustomHealthSpec");
    }
    const url = input?.url as string | undefined;
    if (!url) {
      throw new Error('Missing "url" in input for CustomHealthSpec');
    }

    const response = await ctx.api.http({ method: "GET", url });

    return {
      ok: response.status === 200,
      name: "Custom API health spec",
      details: { status: response.status },
      attachments: [
        {
          name: "health-response",
          contentType: "application/json",
          data: JSON.stringify(response, null, 2),
          encoding: "utf8" as const,
        },
      ],
    };
  }
}
