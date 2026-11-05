const MAILPIT = "http://127.0.0.1:54324/api/v1";

type Summary = { ID: string; Subject: string; Created: string };

/** Wait for the newest email to `email` whose subject contains `subject`, and return its first link. */
export async function latestLinkFor(email: string, subject: string, timeoutMs = 15_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${email}"`)}`);
    const { messages } = (await res.json()) as { messages: Summary[] };
    const match = messages.find((m) => m.Subject.includes(subject));
    if (match) {
      const msg = (await (await fetch(`${MAILPIT}/message/${match.ID}`)).json()) as { HTML: string };
      const href = /href="([^"]+)"/.exec(msg.HTML)?.[1];
      if (href) return href.replaceAll("&amp;", "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No "${subject}" email for ${email} within ${timeoutMs}ms`);
}

/** Delete every message for this address, so a later wait sees only new mail. */
export async function clearInbox(email: string): Promise<void> {
  await fetch(`${MAILPIT}/search?query=${encodeURIComponent(`to:"${email}"`)}`, { method: "DELETE" });
}
