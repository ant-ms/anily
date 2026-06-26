import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

export const anilistParamValidator = zValidator(
  "param",
  z.object({
    anilistId: z.int(),
  }),
);
