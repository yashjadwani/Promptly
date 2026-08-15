import type { VercelRequest, VercelResponse } from "@vercel/node";
import { loadCatalog, toPublic } from "./_lib/catalog.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "METHOD_NOT_ALLOWED", message: "Use GET." });
  }

  try {
    const catalog = loadCatalog()
      .map(toPublic)
      .sort((a, b) => a.category.localeCompare(b.category) || a.title.localeCompare(b.title));

    res.setHeader("cache-control", "public, max-age=0, s-maxage=3600");
    return res.status(200).json(catalog);
  } catch (error) {
    console.error("catalog load failed", error);
    return res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Templates are unavailable right now." });
  }
}
