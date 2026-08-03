import React from 'react';

interface Transaction {
  id: string;
  tenant: string;
  property: string;
  type: 'Residential' | 'Commercial';
  amount: number;
  date: string;
  status: 'Completed' | 'Pending' | 'Overdue';
}

const transactions: Transaction[] = [
  { id: 'TRX-1092', tenant: 'Sarah Jenkins', property: 'Sunset Apartments, 4B', type: 'Residential', amount: 1200, date: 'Oct 24, 2023', status: 'Completed' },
  { id: 'TRX-1093', tenant: 'TechNova Solutions', property: 'Downtown Office, Floor 3', type: 'Commercial', amount: 4500, date: 'Oct 24, 2023', status: 'Completed' },
  { id: 'TRX-1094', tenant: 'Michael Chang', property: 'Oakwood Residence, 12A', type: 'Residential', amount: 1550, date: 'Oct 23, 2023', status: 'Pending' },
  { id: 'TRX-1095', tenant: 'Fresh Foods Market', property: 'Retail Plaza, Unit B', type: 'Commercial', amount: 3200, date: 'Oct 21, 2023', status: 'Overdue' },
  { id: 'TRX-1096', tenant: 'Emma Watson', property: 'Riverside Condos, 8C', type: 'Residential', amount: 1100, date: 'Oct 20, 2023', status: 'Completed' },
];

export const RecentTransactions: React.FC = () => {
  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Completed': return <span className="badge success">Completed</span>;
      case 'Pending': return <span className="badge warning">Pending</span>;
      case 'Overdue': return <span className="badge danger">Overdue</span>;
      default: return null;
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <div className="surface-card">
      <div className="flex justify-between items-center mb-md">
        <h2>Recent Rent Payments</h2>
        <button className="btn btn-primary" style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-primary)', boxShadow: 'none', border: '1px solid var(--border-color)' }}>
          View All
        </button>
      </div>
      
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Tenant</th>
              <th>Property</th>
              <th>Type</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((trx) => (
              <tr key={trx.id}>
                <td>
                  <div className="tenant-cell">
                    <div className="tenant-avatar">{getInitials(trx.tenant)}</div>
                    <span style={{ fontWeight: 500 }}>{trx.tenant}</span>
                  </div>
                </td>
                <td><span style={{ color: 'var(--text-secondary)' }}>{trx.property}</span></td>
                <td>{trx.type}</td>
                <td>{trx.date}</td>
                <td style={{ fontWeight: 600 }}>${trx.amount.toLocaleString()}</td>
                <td>{getStatusBadge(trx.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
