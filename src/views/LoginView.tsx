import React, { useState } from 'react';
import './login.css';
import { Eye, EyeOff, Home } from 'lucide-react';
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
    <div className="login-white-saffron-bg">
      {/* Low-Poly Triangle Vector Mesh Background in White & Saffron Tints */}
      <svg className="poly-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="1440" height="900" fill="#FFFBF7" />
        
        {/* Low-poly triangle facets */}
        <polygon points="0,0 480,0 240,320" fill="#FFEDD5" opacity="0.6" />
        <polygon points="480,0 960,0 720,360" fill="#FED7AA" opacity="0.55" />
        <polygon points="960,0 1440,0 1200,300" fill="#FFEDD5" opacity="0.75" />
        <polygon points="1440,0 1440,480 1200,300" fill="#FDBA74" opacity="0.4" />
        
        <polygon points="0,0 240,320 0,550" fill="#FF7700" opacity="0.1" />
        <polygon points="240,320 720,360 460,660" fill="#FFEDD5" opacity="0.85" />
        <polygon points="720,360 1200,300 960,620" fill="#FED7AA" opacity="0.45" />
        <polygon points="1200,300 1440,480 1440,900" fill="#FFD8A8" opacity="0.55" />
        
        <polygon points="0,550 240,320 460,660" fill="#FED7AA" opacity="0.65" />
        <polygon points="0,550 460,660 0,900" fill="#FFEDD5" opacity="0.75" />
        <polygon points="460,660 960,620 720,900" fill="#FF7700" opacity="0.15" />
        <polygon points="0,900 460,660 720,900" fill="#FED7AA" opacity="0.45" />
        
        <polygon points="960,620 1440,480 1440,900" fill="#FDBA74" opacity="0.35" />
        <polygon points="720,900 960,620 1440,900" fill="#FFEDD5" opacity="0.65" />
      </svg>

      <div className="login-poly-container">
        
        {/* Left Side: Brand Section */}
        <div className="login-poly-left">
          <div className="rentbook-logo-wrap">
            <div className="home-badge-light">
              <Home size={38} strokeWidth={2.5} color="#FF7700" />
            </div>
            <h1 className="rentbook-brand-title-light">
              rent<span className="saffron-highlight">book</span>
            </h1>
          </div>
          <p className="rentbook-brand-desc-light">
            RentBook helps you manage properties, track leases, connect with tenants, and monitor rental revenue all in one place.
          </p>
        </div>

        {/* Center Vertical Divider Line */}
        <div className="login-poly-divider-light"></div>

        {/* Right Side: Form Section */}
        <div className="login-poly-right">
          {/* Hello Message */}
          <div className="hello-message-box">
            <h2 className="hello-title">Hello!</h2>
            <p className="hello-subtitle">Sign in to get started</p>
          </div>

          {error && (
            <div className="login-error-badge-light">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-poly-form">
            {/* Username / Email Input */}
            <div className="poly-input-group">
              <input 
                type="email" 
                className="poly-input-clean" 
                placeholder="Username or Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Password Input */}
            <div className="poly-input-group">
              <input 
                type={showPassword ? "text" : "password"} 
                className="poly-input-clean" 
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button 
                type="button" 
                className="poly-pwd-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label="Toggle password view"
              >
                {showPassword ? <EyeOff size={18} color="#6B7280" /> : <Eye size={18} color="#6B7280" />}
              </button>
            </div>

            {/* LOGIN Button */}
            <button 
              type="submit" 
              className="btn-poly-login-saffron" 
              disabled={isLoading}
            >
              {isLoading ? 'LOGGING IN...' : 'LOGIN'}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
};





