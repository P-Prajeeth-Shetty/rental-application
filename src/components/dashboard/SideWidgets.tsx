import React, { useEffect, useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { supabase } from '../../lib/supabase';
import './dashboard.css';

export const SideWidgets: React.FC = () => {
  const [occupancyPct, setOccupancyPct] = useState(0);
  const [collectionRate, setCollectionRate] = useState(0);
  const [collected, setCollected] = useState(0);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('payment-stats', {
          body: { action: 'dashboard' },
        });
        if (error) throw error;
        if (data) {
          setOccupancyPct(data.occupancyPct || 0);
          setCollectionRate(data.collectionRate || 0);
          setCollected(data.collected || 0);
          setPending(data.pending || 0);
        }
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
    fill: i < filledSegs ? '#dea389' : 'rgba(255, 255, 255, 0.8)'
  }));

  return (
    <>
      {/* Occupancy Status Widget */}
      <div className="surface-card widget-card glass-card">
        <div className="widget-header">
          <h3>Occupancy Status</h3>
          <button className="arrow-link-btn">
            <ArrowUpRight size={18} />
          </button>
        </div>
        <p className="widget-subtitle">Current Month</p>
        
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${occupancyPct}%` }}></div>
        </div>
        
        <div className="widget-details">
          <h4>{occupancyPct}% Occupied</h4>
          <p>Based on active tenant assignments</p>
        </div>
      </div>

      {/* Collection Rate Widget */}
      <div className="surface-card widget-card glass-card">
        <div className="widget-header">
          <h3>Collection Rate</h3>
          <button className="arrow-link-btn">
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
    </>
  );
};
