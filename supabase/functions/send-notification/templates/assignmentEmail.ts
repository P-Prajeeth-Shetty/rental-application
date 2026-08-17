import { wrapEmail, formatCurrency, formatDate, detailRow } from "./layout.ts";

export function assignmentEmail({ tenantName, propertyName, propertyAddress, unitNumber, rent, leaseStart }: {
  tenantName: string;
  propertyName: string;
  propertyAddress: string;
  unitNumber: string;
  rent: number;
  leaseStart: string;
}) {
  const subject = `You've been assigned to ${propertyName}`;
  const html = wrapEmail(subject, `
    <h2 style="margin:0 0 16px; color:#111827; font-size:20px;">Property Assignment Confirmed</h2>
    <p style="margin:0 0 16px; color:#374151; font-size:14px; line-height:1.6;">
      Hi ${tenantName}, you've been assigned to the following property:
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      ${detailRow('Property', propertyName)}
      ${detailRow('Address', propertyAddress)}
      ${detailRow('Unit', unitNumber)}
      ${detailRow('Monthly Rent', formatCurrency(rent))}
      ${detailRow('Lease Start', formatDate(leaseStart))}
    </table>
  `);
  return { subject, html };
}
