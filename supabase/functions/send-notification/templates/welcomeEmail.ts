import { wrapEmail } from "./layout.ts";

export function welcomeEmail({ tenantName }: { tenantName: string }) {
  const subject = `Welcome, ${tenantName}!`;
  const html = wrapEmail(subject, `
    <h2 style="margin:0 0 16px; color:#111827; font-size:20px;">Welcome, ${tenantName}!</h2>
    <p style="margin:0 0 12px; color:#374151; font-size:14px; line-height:1.6;">
      You've been added as a tenant in our records. We'll keep you informed here about your
      property assignment, rent due dates, and payment receipts.
    </p>
    <p style="margin:0; color:#374151; font-size:14px; line-height:1.6;">
      If anything looks incorrect, please reach out to your property manager.
    </p>
  `);
  return { subject, html };
}
