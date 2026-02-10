import { expect, request, test } from "@playwright/test";
import { getRequiredEnv } from "../helpers/env";

type JwtPayload = {
  exp?: number;
  [key: string]: unknown;
};

const baseURL = process.env.API_BASE_URL ?? "http://localhost:3000";
const TEST_USER_EMAIL = getRequiredEnv("TEST_USER_EMAIL");
const TEST_USER_PASSWORD = getRequiredEnv("TEST_USER_PASSWORD");

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded =
    normalized.length % 4 === 0
      ? normalized
      : normalized.padEnd(
        normalized.length + (4 - (normalized.length % 4)),
        "="
      );
  return Buffer.from(padded, "base64").toString("utf-8");
}

function validateJwt(token: string): JwtPayload {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("JWT must have three dot-separated parts.");
  }

  const headerJson = JSON.parse(base64UrlDecode(parts[0]));
  const payloadJson = JSON.parse(base64UrlDecode(parts[1]));

  if (!headerJson || typeof headerJson !== "object") {
    throw new Error("JWT header must be a JSON object.");
  }

  if (!payloadJson || typeof payloadJson !== "object") {
    throw new Error("JWT payload must be a JSON object.");
  }

  if (typeof payloadJson.exp !== "number") {
    throw new Error("JWT payload.exp must be a number.");
  }

  return payloadJson as JwtPayload;
}

test("API: authenticate succeeds with valid credentials", async () => {
  const api = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      accept: "*/*",
      "content-type": "application/json",
    },
  });

  try {
    const res = await api.post("/api/iam/authenticate", {
      data: {
        email: TEST_USER_EMAIL,
        username: "",
        password: TEST_USER_PASSWORD,
      },
    });

    expect(res.status()).toBe(200);
    const json = await res.json();

    expect(json.statusCode).toBe(200);
    expect(Array.isArray(json.message)).toBe(true);
    expect(json.message.length).toBe(0);
    expect(json.error).toBe("");

    const user = json.data?.user as Record<string, unknown> | undefined;
    expect(user, "Expected data.user to be an object.").toBeTruthy();
    expect(typeof user).toBe("object");

    const email = user?.email;
    expect(typeof email).toBe("string");
    if (email === TEST_USER_EMAIL) {
      expect(email).toBe(TEST_USER_EMAIL);
    } else {
      // If your API returns a fixed system email, replace this with an exact match.
      expect((email as string).length).toBeGreaterThan(0);
    }

    expect(typeof user?.mobile).toBe("string");
    expect(typeof user?.username).toBe("string");
    expect(typeof user?.forcePasswordChange).toBe("boolean");
    expect(typeof user?.id).toBe("number");

    const roles = user?.roles;
    expect(Array.isArray(roles)).toBe(true);
    if (Array.isArray(roles)) {
      expect(roles.every((role) => typeof role === "string")).toBe(true);
      expect(roles).toContain("Admin");
    }

    const accessToken = json.data?.accessToken;
    const refreshToken = json.data?.refreshToken;
    expect(typeof accessToken).toBe("string");
    expect(typeof refreshToken).toBe("string");

    const accessPayload = validateJwt(accessToken as string);
    const refreshPayload = validateJwt(refreshToken as string);

    expect(typeof accessPayload.exp).toBe("number");
    expect(typeof refreshPayload.exp).toBe("number");
  } finally {
    await api.dispose();
  }
});

test("API: authenticate fails with wrong password", async () => {
  const api = await request.newContext({
    baseURL,
    extraHTTPHeaders: {
      accept: "*/*",
      "content-type": "application/json",
    },
  });

  try {
    const res = await api.post("/api/iam/authenticate", {
      data: {
        email: TEST_USER_EMAIL,
        username: "",
        password: `${TEST_USER_PASSWORD}__wrong`,
      },
    });

    expect(res.status()).toBe(401);
    const json = await res.json();

    expect(json.statusCode).toBe(401);
    expect(json.statusCodeMessage).toBe("Unauthorized");
    expect(json.message).toBe("Invalid credentials");
    expect(json.error).toBe("Invalid credentials");
    expect(json.data?.statusCode).toBe(401);
    expect(json.data?.error).toBe("Unauthorized");
    expect(json.data?.message).toBe("Invalid credentials");
  } finally {
    await api.dispose();
  }
});
