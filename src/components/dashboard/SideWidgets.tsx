import React, { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { supabase } from '../../lib/supabase';
import './dashboard.css';

interface SideWidgetsProps {
  onNavigate?: (view: string) => void;
}

export const SideWidgets: React.FC<SideWidgetsProps> = ({ onNavigate }) => {
  const [occupancyPct, setOccupancyPct] = useState(0);
  const [collectionRate, setCollectionRate] = useState(0);
  const [collected, setCollected] = useState(0);
  const [pending, setPending] = useState(0);
  const [occupancyByType, setOccupancyByType] = useState<Record<string, { total: number, occupied: number }>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data: paymentData, error: paymentError }, { data: properties }, { data: assignments }] = await Promise.all([
          supabase.functions.invoke('payment-stats', {
            body: { action: 'dashboard' },
          }),
          supabase.from('properties').select('id, total_units, property_type'),
          supabase.from('tenant_assignments').select('id, status, property_id, properties(property_type)').eq('status', 'active')
        ]);
        
        if (paymentError) throw paymentError;
        if (paymentData) {
          setOccupancyPct(paymentData.occupancyPct || 0);
          setCollectionRate(paymentData.collectionRate || 0);
          setCollected(paymentData.collected || 0);
          setPending(paymentData.pending || 0);
        }

        const statsByType: Record<string, { total: number, occupied: number }> = {
          Residential: { total: 0, occupied: 0 },
          Commercial: { total: 0, occupied: 0 },
          Mixed: { total: 0, occupied: 0 }
        };

        (properties || []).forEach(p => {
          const type = p.property_type || 'Residential';
          if (!statsByType[type]) statsByType[type] = { total: 0, occupied: 0 };
          statsByType[type].total += (p.total_units || 0);
        });

        (assignments || []).forEach(a => {
          const props: any = Array.isArray(a.properties) ? a.properties[0] : a.properties;
          const type = props?.property_type || 'Residential';
          if (statsByType[type]) {
            statsByType[type].occupied += 1;
          }
        });

        setOccupancyByType(statsByType);
      } catch (err) {
        console.error('SideWidgets error:', err);
      }
    };
    fetchData();
  }, []);

  const segCount = 15;
  const filledSegs = Math.round((collectionRate / 100) * segCount);
  const gaugeData = Array.from({ length: segCount }).map((_, i) => ({
    name: `segment-${i}`,
    value: 1,
    fill: i < filledSegs ? '#0f766e' : 'rgba(255, 255, 255, 0.8)'
  }));

  return (
    <>
      {/* Collection Rate Widget */}
      <div className="surface-card widget-card glass-card">
        <div className="widget-header">
          <h3>Collection Rate</h3>
          <button className="arrow-link-btn" onClick={() => onNavigate?.('leases')}>
            <ArrowUpRight size={18} />
          </button>
        </div>
        <p className="widget-subtitle">Rent collection efficiency</p>
        
        <div className="radial-chart-container">
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={gaugeData} cx="50%" cy="85%" startAngle={180} endAngle={0} innerRadius={65} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none" cornerRadius={10}>
                {gaugeData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="radial-center-text" style={{ bottom: '20px' }}>
            <h2>{collectionRate}%</h2>
          </div>
        </div>

        <div className="success-stats-grid">
          <div>
            <span>Collected</span>
            <strong>₹{collected.toLocaleString('en-IN')}</strong>
          </div>
          <div>
            <span>Pending</span>
            <strong>₹{pending.toLocaleString('en-IN')}</strong>
          </div>
        </div>
      </div>

      {/* Occupancy Status Widget */}
      <div className="surface-card widget-card glass-card">
        <div className="widget-header">
          <h3>Occupancy Status</h3>
          <button className="arrow-link-btn" onClick={() => onNavigate?.('properties')}>
            <ArrowUpRight size={18} />
          </button>
        </div>
        <p className="widget-subtitle">Real-time property breakdown</p>
        
        <div className="occupancy-breakdown" style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {['Residential', 'Commercial', 'Mixed'].map(type => {
            const stats = occupancyByType[type] || { total: 0, occupied: 0 };
            const pct = stats.total > 0 ? Math.round((stats.occupied / stats.total) * 100) : 0;
            const barColor = type === 'Commercial' ? '#3b82f6' : type === 'Mixed' ? '#8b5cf6' : '#0f766e';
            return (
              <div key={type}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{type}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{pct}% ({stats.occupied}/{stats.total})</span>
                </div>
                <div className="progress-bar-container" style={{ height: '6px', background: 'rgba(0,0,0,0.05)' }}>
                  <div className="progress-bar-fill" style={{ width: `${pct}%`, background: barColor, height: '100%', borderRadius: '4px' }}></div>
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="widget-details" style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(0,0,0,0.05)' }}>
          <h4 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{occupancyPct}% Overall</h4>
          <p>Based on active tenant assignments</p>
        </div>
      </div>
    </>
  );
};
