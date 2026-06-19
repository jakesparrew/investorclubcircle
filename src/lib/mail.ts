import { Resend } from "resend";

const KEY = process.env.AUTH_RESEND_KEY;
const FROM = process.env.EMAIL_FROM ?? "InvestorClub <noreply@investorclub.be>";

/**
 * Send a transactional email via Resend. No-ops (logs only) when no real key is
 * configured, so it is safe to call from anywhere during development.
 */
export async function sendEmail(opts: { to: string; subject: string; html: string }): Promise<boolean> {
  if (!KEY || KEY.startsWith("dev-")) {
    console.log(`[mail] (no key) would send to ${opts.to}: "${opts.subject}"`);
    return false;
  }
  try {
    const resend = new Resend(KEY);
    await resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html });
    return true;
  } catch (err) {
    console.error("[mail] send failed:", err);
    return false;
  }
}

/** Minimal branded HTML wrapper for transactional emails. */
export function emailLayout(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
    <h2 style="color:#1f7a4d">${title}</h2>
    <div style="color:#333;line-height:1.5">${bodyHtml}</div>
    ${cta ? `<p style="margin-top:24px"><a href="${cta.url}" style="background:#1f7a4d;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${cta.label}</a></p>` : ""}
    <p style="margin-top:24px;color:#999;font-size:12px">InvestorClub</p>
  </div>`;
}
