import { wrapEmail, formatCurrency, formatDate, detailRow } from "./layout.ts";

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function receiptEmail({ tenantName, amount, paymentMethod, paymentDate, periodMonth, periodYear, propertyName, unitNumber }: {
  tenantName: string;
  amount: number;
  paymentMethod: string | null;
  paymentDate: string;
  periodMonth: number;
  periodYear: number;
  propertyName: string;
  unitNumber: string;
}) {
  const period = `${MONTH_NAMES[periodMonth - 1]} ${periodYear}`;
  const subject = `Payment received: ${formatCurrency(amount)} for ${period}`;
  const html = wrapEmail(subject, `
    <h2 style="margin:0 0 16px; color:#111827; font-size:20px;">Payment Receipt</h2>
    <p style="margin:0 0 16px; color:#374151; font-size:14px; line-height:1.6;">
      Hi ${tenantName}, we've recorded your payment for ${propertyName} (Unit ${unitNumber}).
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      ${detailRow('Amount', formatCurrency(amount))}
      ${detailRow('Period', period)}
      ${detailRow('Payment Date', formatDate(paymentDate))}
      ${detailRow('Method', paymentMethod ?? '—')}
    </table>
  `);
  return { subject, html };
}
