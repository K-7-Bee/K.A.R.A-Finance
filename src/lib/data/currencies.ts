import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Currency = { code: string; minorUnit: number };

/** Supported currencies and their minor units (KRW 0, USD 2, ...). Cached per request. */
export const getCurrencies = cache(async (): Promise<Currency[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("currencies").select("code, minor_unit").order("code");
  if (error) throw new Error("Could not load currencies.");
  return data.map((c) => ({ code: c.code, minorUnit: c.minor_unit }));
});

export function findCurrency(currencies: Currency[], code: unknown): Currency | undefined {
  return typeof code === "string" ? currencies.find((c) => c.code === code) : undefined;
}
