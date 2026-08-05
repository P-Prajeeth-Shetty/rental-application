import React, { useState } from 'react';
import './login.css';
import { Share2, Globe, MessageSquare, Camera, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const LoginView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to login');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        
        {/* Left Side: Visual / Slanted Image */}
        <div className="login-left">
          <div className="login-left-skewed">
            <div className="login-left-image"></div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="login-right">
          <div className="login-form-content">
            <div className="brand-logo">
              <img src="/cac9d6c4-f595-40f8-8b4f-61c2bf168679.png" alt="Login Logo" style={{ height: '220px', width: 'auto', objectFit: 'contain' }} />
            </div>
            
            <h2>Hi Manager</h2>
            <p>Welcome to RentalApp Platform</p>

            {error && (
              <div style={{ backgroundColor: 'rgba(255, 0, 0, 0.1)', color: '#ff4d4d', padding: '10px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem', textAlign: 'center' }}>
                {error}
              </div>
            )}

            <form className="login-form" onSubmit={handleSubmit}>
              <input 
                type="email" 
                className="dribbble-input" 
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              
              <div style={{ position: 'relative', width: '100%' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  className="dribbble-input" 
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ paddingRight: '44px' }}
                  required
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ 
                    position: 'absolute', 
                    right: '14px', 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    background: 'none', 
                    border: 'none', 
                    color: '#9ca3af', 
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button type="submit" className="btn-continue" disabled={isLoading}>
                {isLoading ? 'Signing In...' : 'Login'}
              </button>
            </form>
          </div>

          <div className="social-footer">
            <div className="social-icon"><Globe size={18} /></div>
            <div className="social-icon"><Share2 size={18} /></div>
            <div className="social-icon"><MessageSquare size={18} /></div>
            <div className="social-icon"><Camera size={18} /></div>
          </div>
        </div>

      </div>
    </div>
  );
};
