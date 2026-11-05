import { errorText } from "./styles";

export function FieldError({ id, error }: { id: string; error?: string }) {
  return error ? (
    <p id={id} aria-live="polite" className={errorText}>
      {error}
    </p>
  ) : null;
}

export const describedBy = (...ids: (string | false | undefined)[]) => ids.filter(Boolean).join(" ") || undefined;
