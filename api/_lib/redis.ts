import { Redis } from "@upstash/redis";
import { upstash } from "./env.js";

let client: Redis | null = null;

/** One lazily-created client shared by the quota counter and telemetry. */
export function redis(): Redis {
  if (!client) {
    const { url, token } = upstash();
    client = new Redis({ url, token });
  }
  return client;
}
