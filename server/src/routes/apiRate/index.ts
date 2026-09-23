import { app } from "$src/app";
import { prisma } from "$src/prisma";
import { anilistParamValidator } from "$src/validators/anilistId";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getAnimeDetails } from "../apiDetails/getAnimeDetails";
import { getAuthenticatedUser } from "$src/auth";

export const ratingEnumSchema = z.enum(["LIKE", "NEUTRAL", "DISLIKE"]);

export const apiRateAnilistIdGetRoute = app.get(
  "/api/rate/:anilistId",
  anilistParamValidator,
  async (c) => {
    const params = c.req.valid("param");

    try {
      const user = await getAuthenticatedUser(c);
      const userRating = await prisma.userAnimeRating.findUnique({
        where: {
          userId_anilistId: {
            userId: user.id,
            anilistId: params.anilistId,
          },
        },
      });

      if (userRating) {
        return c.json({ rating: userRating.rating });
      }

      const details = await getAnimeDetails(params.anilistId);
      return c.json({ rating: details.rating ?? "NEUTRAL" });
    } catch (error) {
      return c.json(
        {
          error: "Failed to get rating",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);

export const apiRateAnilistIdPutRoute = app.put(
  "/api/rate/:anilistId",
  anilistParamValidator,
  zValidator(
    "json",
    z.object({
      rating: ratingEnumSchema,
    }),
  ),
  async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");

    try {
      const user = await getAuthenticatedUser(c);
      await getAnimeDetails(params.anilistId);

      const updated = await prisma.userAnimeRating.upsert({
        where: {
          userId_anilistId: {
            userId: user.id,
            anilistId: params.anilistId,
          },
        },
        create: {
          userId: user.id,
          anilistId: params.anilistId,
          rating: body.rating,
        },
        update: {
          rating: body.rating,
        },
      });

      return c.json({ rating: updated.rating });
    } catch (error) {
      return c.json(
        {
          error: "Failed to update rating",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);

// Backward compatibility alias for client code calling POST /api/details/:anilistId/rating
export const apiDetailsRatingPostRoute = app.post(
  "/api/details/:anilistId/rating",
  anilistParamValidator,
  zValidator(
    "json",
    z.object({
      rating: ratingEnumSchema,
    }),
  ),
  async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");

    try {
      const user = await getAuthenticatedUser(c);
      await getAnimeDetails(params.anilistId);

      const updated = await prisma.userAnimeRating.upsert({
        where: {
          userId_anilistId: {
            userId: user.id,
            anilistId: params.anilistId,
          },
        },
        create: {
          userId: user.id,
          anilistId: params.anilistId,
          rating: body.rating,
        },
        update: {
          rating: body.rating,
        },
      });

      return c.json({ rating: updated.rating });
    } catch (error) {
      return c.json(
        {
          error: "Failed to update rating",
          reason: error instanceof Error ? error.message : String(error),
        },
        500,
      );
    }
  },
);
