import React from 'react';
import { Home, User, FileText, ClipboardList, PenLine, ShieldCheck, Printer, X } from 'lucide-react';
import './agreement-slip.css';

interface AgreementSlipModalProps {
  isOpen: boolean;
  onClose: () => void;
  lessorName: string;
  lessorPhone?: string | null;
  lesseeName: string;
  lesseePhone?: string | null;
  propertyLabel: string;
  effectiveDate: string;
  leaseEndDate: string | null;
  monthlyRent: number;
  securityDeposit: number;
}

function formatSlipDate(date: string) {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export const AgreementSlipModal: React.FC<AgreementSlipModalProps> = ({
  isOpen, onClose, lessorName, lessorPhone, lesseeName, lesseePhone,
  propertyLabel, effectiveDate, leaseEndDate, monthlyRent, securityDeposit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="agreement-slip-backdrop" onClick={onClose}>
      <div className="agreement-slip-shell" onClick={e => e.stopPropagation()}>
        <div className="agreement-slip-toolbar no-print">
          <button type="button" className="agreement-slip-btn agreement-slip-btn-primary" onClick={() => window.print()}>
            <Printer size={16} /> Print
          </button>
          <button type="button" className="agreement-slip-btn" onClick={onClose}>
            <X size={16} /> Close
          </button>
        </div>

        <div id="agreement-slip-printable" className="agreement-slip">
          <header className="agreement-slip-header">
            <div className="agreement-slip-brand">
              <span className="agreement-slip-brand-icon"><Home size={20} /></span>
              <span>RENT BOOK</span>
            </div>
          </header>

          <div className="agreement-slip-body">
            <div className="agreement-slip-parties">
              <div className="agreement-slip-party">
                <div className="agreement-slip-avatar"><User size={18} /></div>
                <div>
                  <div className="agreement-slip-party-label">Lessor (Owner)</div>
                  <div className="agreement-slip-party-name">{lessorName}</div>
                  {lessorPhone && <div className="agreement-slip-party-phone">{lessorPhone}</div>}
                </div>
              </div>
              <div className="agreement-slip-party agreement-slip-party-right">
                <div>
                  <div className="agreement-slip-party-label">Lessee (Tenant)</div>
                  <div className="agreement-slip-party-name">{lesseeName}</div>
                  {lesseePhone && <div className="agreement-slip-party-phone">{lesseePhone}</div>}
                </div>
                <div className="agreement-slip-avatar agreement-slip-avatar-gold"><User size={18} /></div>
              </div>
            </div>

            <div className="agreement-slip-title-block">
              <div className="agreement-slip-divider" />
              <h1>AGREEMENT SLIP</h1>
              <p className="agreement-slip-subtitle">Memorandum of Lease Agreement</p>
            </div>

            <section className="agreement-slip-section">
              <h2><FileText size={16} /> I. Introduction</h2>
              <p>
                This Memorandum of Lease Agreement serves as a formal notice of the lease agreement between{' '}
                <strong>{lessorName}</strong> (the "Owner/Lessor") and <strong>{lesseeName}</strong> (the "Tenant/Lessee").
                The purpose of this document is to summarize the essential terms of the lease executed on{' '}
                <strong>{formatSlipDate(effectiveDate)}</strong>.
              </p>
            </section>

            <section className="agreement-slip-section">
              <h2><ClipboardList size={16} /> II. Lease Agreement Summary</h2>
              <table className="agreement-slip-table">
                <tbody>
                  <tr><td>Lessor</td><td>{lessorName}</td></tr>
                  <tr><td>Lessee</td><td>{lesseeName}</td></tr>
                  <tr><td>Leased Property</td><td>{propertyLabel}</td></tr>
                  <tr><td>Effective Date</td><td>{formatSlipDate(effectiveDate)}</td></tr>
                  <tr><td>Lease End Date</td><td>{leaseEndDate ? formatSlipDate(leaseEndDate) : 'Ongoing'}</td></tr>
                  <tr><td>Monthly Rent</td><td>₹{Number(monthlyRent).toLocaleString('en-IN')}</td></tr>
                  <tr><td>Security Deposit</td><td>₹{Number(securityDeposit).toLocaleString('en-IN')}</td></tr>
                </tbody>
              </table>
            </section>

            <div className="agreement-slip-signatures">
              <div className="agreement-slip-sign">
                <div className="agreement-slip-avatar"><PenLine size={16} /></div>
                <div className="agreement-slip-sign-line" />
                <div className="agreement-slip-sign-name">{lessorName}</div>
                <div className="agreement-slip-sign-label">Lessor Signature</div>
                <div className="agreement-slip-sign-date">Date: ______________</div>
              </div>
              <div className="agreement-slip-sign">
                <div className="agreement-slip-avatar agreement-slip-avatar-gold"><PenLine size={16} /></div>
                <div className="agreement-slip-sign-line" />
                <div className="agreement-slip-sign-name">{lesseeName}</div>
                <div className="agreement-slip-sign-label">Lessee Signature</div>
                <div className="agreement-slip-sign-date">Date: ______________</div>
              </div>
            </div>
          </div>

          <footer className="agreement-slip-footer">
            <span><ShieldCheck size={14} /> Legally Valid · Confidential · Secure</span>
            <span>Generated via <strong>RENT BOOK</strong></span>
          </footer>
        </div>
      </div>
    </div>
  );
};
