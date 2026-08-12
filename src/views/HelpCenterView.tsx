import React from 'react';
import './views.css';
import { BookOpen, LifeBuoy, MessageCircle, FileText, Phone, Mail } from 'lucide-react';

export const HelpCenterView: React.FC = () => {
  return (
    <div className="view-container" style={{ paddingBottom: '40px' }}>
      
      {/* Hero Section */}
      <div className="surface-card glass-card" style={{ padding: '40px', textAlign: 'center', marginBottom: '24px', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)' }}>
        <LifeBuoy size={48} color="var(--primary)" style={{ marginBottom: '16px' }} />
        <h2 style={{ fontSize: '2rem', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>How can we help you today?</h2>
        <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto' }}>
          Browse our documentation, read FAQs, or get in touch with our dedicated support team to resolve your issues quickly.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        {/* Quick Guide */}
        <div className="surface-card glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '1px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} color="#3b82f6" />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Quick Start Guide</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '16px' }}>
            Learn the basics of setting up your properties, adding tenants, and tracking leases in under 5 minutes.
          </p>
          <button className="btn-secondary" style={{ width: '100%' }}>Read Guide</button>
        </div>

        {/* Documentation */}
        <div className="surface-card glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '1px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={20} color="#10b981" />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Full Documentation</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '16px' }}>
            Detailed articles covering every feature in the application, including financial reports and maintenance billing.
          </p>
          <button className="btn-secondary" style={{ width: '100%' }}>Browse Docs</button>
        </div>

        {/* Community Forum */}
        <div className="surface-card glass-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '1px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageCircle size={20} color="#f59e0b" />
            </div>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Community Forum</h3>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '16px' }}>
            Connect with other property managers, ask questions, and share your best practices and tips.
          </p>
          <button className="btn-secondary" style={{ width: '100%' }}>Join Discussion</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
        {/* FAQs */}
        <div className="surface-card glass-card" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '1.3rem', margin: '0 0 24px 0' }}>Frequently Asked Questions</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '1px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>How do I add a new property?</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Navigate to the "Properties" tab and click the "Add Property" button in the top right. Fill out the property details, including address, type, and size, and click save.
              </p>
            </div>
            
            <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '1px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>Can I export my financial reports?</h4>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5 }}>
                Yes! On the "Reports" page, use the "Export CSV" button to download a spreadsheet of your revenue, expenses, and tenant payment statuses.
              </p>
            </div>
            
            <div style={{ padding: '16px', background: 'var(--bg-surface)', borderRadius: '1px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '1rem' }}>How does maintenance billing work?</h4>
              <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                The "Maintenance" tab allows you to bill tenants for property maintenance costs. You can record a total expense for a property and either divide it equally among all units or assign custom amounts per unit. Tenants will then receive an invoice which you can mark as Paid once they pay it.
              </p>
            </div>
          </div>
        </div>

        {/* Contact Support */}
        <div className="surface-card glass-card" style={{ padding: '32px', background: 'var(--primary-accent)', color: 'white' }}>
          <h3 style={{ fontSize: '1.3rem', margin: '0 0 24px 0', color: 'white' }}>Still need help?</h3>
          <p style={{ margin: '0 0 24px 0', fontSize: '0.95rem', lineHeight: 1.5, opacity: 0.9 }}>
            Our support team is available 24/7 to assist you with any technical issues or billing inquiries.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Phone size={20} style={{ opacity: 0.8 }} />
              <span style={{ fontSize: '1rem', fontWeight: 500 }}>+1 (800) 555-0199</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Mail size={20} style={{ opacity: 0.8 }} />
              <span style={{ fontSize: '1rem', fontWeight: 500 }}>support@rentalapp.com</span>
            </div>
          </div>

          <button style={{ 
            width: '100%', 
            padding: '14px', 
            background: 'white', 
            color: 'var(--primary-accent)', 
            border: 'none', 
            borderRadius: '2px', 
            fontWeight: 600, 
            fontSize: '1rem',
            cursor: 'pointer' 
          }}>
            Contact Support
          </button>
        </div>
      </div>

    </div>
  );
};
