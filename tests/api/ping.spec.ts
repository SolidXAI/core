import { expect, request, test } from "@playwright/test";

test("GET /api/ping returns pong", async () => {
  const baseURL = process.env.BASE_URL || "http://localhost:3000";
  if (!baseURL) {
    throw new Error("baseURL is not configured. Set API_BASE_URL or use the default.");
  }
  const api = await request.newContext({ baseURL });

  const res = await api.get("/api/ping");

  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body).toEqual({
    statusCode: 200,
    message: [],
    error: "",
    data: { pong: "v1.0.2" },
  });

  await api.dispose();
});
