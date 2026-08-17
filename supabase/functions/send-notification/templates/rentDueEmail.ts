import { wrapEmail, formatCurrency, formatDate, detailRow } from "./layout.ts";

export function rentDueEmail({ tenantName, propertyName, unitNumber, amount, dueDate }: {
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  amount: number;
  dueDate: string;
}) {
  const subject = `Rent reminder: ${formatCurrency(amount)} due ${formatDate(dueDate)}`;
  const html = wrapEmail(subject, `
    <h2 style="margin:0 0 16px; color:#111827; font-size:20px;">Upcoming Rent Due</h2>
    <p style="margin:0 0 16px; color:#374151; font-size:14px; line-height:1.6;">
      Hi ${tenantName}, this is a reminder that your rent for ${propertyName} (Unit ${unitNumber}) is due soon.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      ${detailRow('Amount Due', formatCurrency(amount))}
      ${detailRow('Due Date', formatDate(dueDate))}
    </table>
  `);
  return { subject, html };
}
