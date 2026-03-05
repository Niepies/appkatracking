/**
 * Testy walidatorów Zod – lib/validators.ts
 *
 * Testujemy subscription_schema:
 * - poprawne dane przechodzą walidację
 * - brakujące pola są odrzucane
 * - edge cases (kwoty, daty, trial)
 */
import { describe, it, expect } from "vitest";
import { subscription_schema } from "@/lib/validators";

const VALID_DATA = {
  name: "Netflix",
  amount: "49.99",
  payment_cycle: "monthly" as const,
  next_payment_date: "2026-06-01",
  category: "entertainment" as const,
  description: "",
  has_trial: false,
};

describe("subscription_schema – poprawne dane", () => {
  it("akceptuje minimalne poprawne dane", () => {
    const result = subscription_schema.safeParse(VALID_DATA);
    expect(result.success).toBe(true);
  });

  it("akceptuje cykl roczny", () => {
    const result = subscription_schema.safeParse({
      ...VALID_DATA,
      payment_cycle: "yearly",
      amount: "599",
    });
    expect(result.success).toBe(true);
  });

  it("akceptuje wszystkie kategorie", () => {
    const categories = [
      "entertainment",
      "utilities",
      "technology",
      "health",
      "food",
      "other",
    ] as const;
    for (const category of categories) {
      const result = subscription_schema.safeParse({ ...VALID_DATA, category });
      expect(result.success, `Kategoria '${category}' powinna być poprawna`).toBe(true);
    }
  });

  it("akceptuje trial z poprawną datą końca", () => {
    const result = subscription_schema.safeParse({
      ...VALID_DATA,
      has_trial: true,
      trial_end_date: "2026-07-01",
      next_payment_date: "2026-06-01",
    });
    expect(result.success).toBe(true);
  });

  it("akceptuje opis max 250 znaków", () => {
    const result = subscription_schema.safeParse({
      ...VALID_DATA,
      description: "a".repeat(250),
    });
    expect(result.success).toBe(true);
  });
});

describe("subscription_schema – walidacja nazwy", () => {
  it("odrzuca pustą nazwę", () => {
    const result = subscription_schema.safeParse({ ...VALID_DATA, name: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("name");
    }
  });

  it("odrzuca nazwę powyżej 100 znaków", () => {
    const result = subscription_schema.safeParse({
      ...VALID_DATA,
      name: "a".repeat(101),
    });
    expect(result.success).toBe(false);
  });
});

describe("subscription_schema – walidacja kwoty", () => {
  it("odrzuca pustą kwotę", () => {
    const result = subscription_schema.safeParse({ ...VALID_DATA, amount: "" });
    expect(result.success).toBe(false);
  });

  it("odrzuca tekst zamiast liczby", () => {
    const result = subscription_schema.safeParse({ ...VALID_DATA, amount: "abc" });
    expect(result.success).toBe(false);
  });

  it("odrzuca zero", () => {
    const result = subscription_schema.safeParse({ ...VALID_DATA, amount: "0" });
    expect(result.success).toBe(false);
  });

  it("odrzuca wartość ujemną", () => {
    const result = subscription_schema.safeParse({ ...VALID_DATA, amount: "-10" });
    expect(result.success).toBe(false);
  });

  it("odrzuca kwotę powyżej 100 000", () => {
    const result = subscription_schema.safeParse({ ...VALID_DATA, amount: "100001" });
    expect(result.success).toBe(false);
  });

  it("akceptuje kwotę 100 000", () => {
    const result = subscription_schema.safeParse({ ...VALID_DATA, amount: "100000" });
    expect(result.success).toBe(true);
  });
});

describe("subscription_schema – walidacja cyklu płatności", () => {
  it("odrzuca nieznany cykl", () => {
    const result = subscription_schema.safeParse({
      ...VALID_DATA,
      payment_cycle: "weekly",
    });
    expect(result.success).toBe(false);
  });
});

describe("subscription_schema – walidacja daty", () => {
  it("odrzuca brak daty", () => {
    const result = subscription_schema.safeParse({
      ...VALID_DATA,
      next_payment_date: "",
    });
    expect(result.success).toBe(false);
  });

  it("odrzuca nieprawidłowy format", () => {
    const result = subscription_schema.safeParse({
      ...VALID_DATA,
      next_payment_date: "nie-data",
    });
    expect(result.success).toBe(false);
  });
});

describe("subscription_schema – walidacja trial", () => {
  it("odrzuca trial bez daty końca", () => {
    const result = subscription_schema.safeParse({
      ...VALID_DATA,
      has_trial: true,
      trial_end_date: undefined,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain("trial_end_date");
    }
  });

  it("odrzuca trial_end_date <= next_payment_date", () => {
    const result = subscription_schema.safeParse({
      ...VALID_DATA,
      has_trial: true,
      next_payment_date: "2026-06-15",
      trial_end_date: "2026-06-15", // ten sam dzień
    });
    expect(result.success).toBe(false);
  });

  it("odrzuca trial_end_date przed next_payment_date", () => {
    const result = subscription_schema.safeParse({
      ...VALID_DATA,
      has_trial: true,
      next_payment_date: "2026-06-20",
      trial_end_date: "2026-06-15",
    });
    expect(result.success).toBe(false);
  });

  it("odrzuca złą kategorię", () => {
    const result = subscription_schema.safeParse({
      ...VALID_DATA,
      category: "gaming",
    });
    expect(result.success).toBe(false);
  });
});

describe("subscription_schema – walidacja opisu", () => {
  it("odrzuca opis powyżej 250 znaków", () => {
    const result = subscription_schema.safeParse({
      ...VALID_DATA,
      description: "x".repeat(251),
    });
    expect(result.success).toBe(false);
  });
});
