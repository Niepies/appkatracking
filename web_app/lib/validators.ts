// Schematy walidacji formularzy z użyciem Zod

import { z } from "zod";

const today = new Date();
today.setHours(0, 0, 0, 0);

const CURRENCIES = ["PLN", "USD", "EUR", "GBP", "CHF", "CZK", "NOK", "SEK", "DKK", "JPY", "CAD", "AUD"] as const;

/**
 * Schema dla formularza dodawania/edycji subskrypcji
 */
export const subscription_schema = z
  .object({
    name: z
      .string()
      .min(1, "Nazwa jest wymagana")
      .max(100, "Nazwa może mieć max 100 znaków"),

    amount: z
      .string()
      .min(1, "Kwota jest wymagana")
      .refine((val) => !isNaN(Number(val)), "Kwota musi być liczbą")
      .refine((val) => Number(val) > 0, "Kwota musi być większa od 0")
      .refine((val) => Number(val) <= 100000, "Kwota wydaje się zbyt duża"),

    currency: z.enum(CURRENCIES, { message: "Wybierz walutę" }),

    payment_cycle: z.enum(["monthly", "yearly"] as const, {
      message: "Wybierz cykl płatności",
    }),

    next_payment_date: z
      .string()
      .min(1, "Data następnej płatności jest wymagana")
      .refine((val) => {
        const date = new Date(val);
        return !isNaN(date.getTime());
      }, "Nieprawidłowy format daty"),

    category: z.enum(
      ["entertainment", "utilities", "technology", "health", "food", "other"] as const,
      { message: "Wybierz kategorię" }
    ),

    description: z.string().max(250, "Opis może mieć max 250 znaków").optional(),

    /** Czy bieżący cykl to okres próbny (trial). */
    has_trial: z.boolean().optional(),

    /**
     * Data końca okresu próbnego – wymagana gdy has_trial = true.
     * Musi być późniejsza niż next_payment_date.
     */
    trial_end_date: z
      .string()
      .optional()
      .refine((val) => {
        if (!val) return true;
        const date = new Date(val);
        return !isNaN(date.getTime());
      }, "Nieprawidłowy format daty końca trial"),
  })
  .superRefine((data, ctx) => {
    if (data.has_trial && !data.trial_end_date) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Podaj datę końca okresu próbnego",
        path: ["trial_end_date"],
      });
    }
    if (data.has_trial && data.trial_end_date && data.next_payment_date) {
      if (data.trial_end_date <= data.next_payment_date) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Koniec trial musi być późniejszy niż data startu",
          path: ["trial_end_date"],
        });
      }
    }
  });

export type SubscriptionSchemaType = z.infer<typeof subscription_schema>;
