import { describe, expect, it } from "vitest";
import { GENERIC_MESSAGE, toUserMessage } from "./db-errors";

describe("toUserMessage", () => {
  it("hides ownership failures behind 'Not found'", () => {
    expect(toUserMessage({ code: "42501", message: "workspace not found" })).toBe("Not found.");
    expect(toUserMessage({ code: "42501", message: "permission denied for table accounts" })).toBe("Not found.");
    expect(toUserMessage({ code: "22P02", message: 'invalid input syntax for type uuid: "x"' })).toBe("Not found.");
  });

  it("passes through our own posting-function messages", () => {
    expect(toUserMessage({ code: "22023", message: 'account "Card" is archived' })).toBe('Account "Card" is archived.');
    expect(toUserMessage({ code: "22023", message: "opening balance is missing or too large" })).toBe(
      "Opening balance is missing or too large.",
    );
  });

  it("explains duplicates, with an optional specific message", () => {
    expect(toUserMessage({ code: "23505", message: 'duplicate key value violates unique constraint "categories_workspace_id_kind_name_key"' })).toBe(
      "That name is already in use.",
    );
    expect(toUserMessage({ code: "23505", message: "dup" }, { duplicate: "A category with that name already exists." })).toBe(
      "A category with that name already exists.",
    );
  });

  it("never returns raw Postgres text for other errors", () => {
    const raw = 'new row for relation "accounts" violates check constraint "accounts_name_check"';
    expect(toUserMessage({ code: "23514", message: raw })).toBe("That value isn't allowed.");
    expect(toUserMessage({ code: "XX000", message: "internal error at /var/lib/postgres" })).toBe(GENERIC_MESSAGE);
    expect(toUserMessage(null)).toBe(GENERIC_MESSAGE);
    expect(toUserMessage({ code: "22023", message: "x".repeat(400) })).toBe(GENERIC_MESSAGE);
  });
});
