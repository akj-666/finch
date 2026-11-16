import React, { useState, useEffect } from 'react';
import { Lock, Shield, ShieldAlert, Eye, EyeOff, KeyRound, AlertTriangle, ArrowRight } from 'lucide-react';
import { setupMasterPassword, loginWithMasterPassword } from '../utils/apiSync';
import finchIconLightPng from '../assets/finch-icon-light.png';

interface LockScreenProps {
  isFirstTimeSetup: boolean;
  onAuthenticated: () => void;
}

export const LockScreen: React.FC<LockScreenProps> = ({
  isFirstTimeSetup,
  onAuthenticated,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  // Countdown timer for brute force cooldown
  useEffect(() => {
    if (cooldownRemaining <= 0) return;
    const timer = setInterval(() => {
      setCooldownRemaining((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownRemaining]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim() || cooldownRemaining > 0) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await loginWithMasterPassword(password);
      if (res.success) {
        onAuthenticated();
      } else {
        setErrorMessage(res.error || 'Incorrect master password. Access denied.');
        if (res.cooldownSeconds && res.cooldownSeconds > 0) {
          setCooldownRemaining(res.cooldownSeconds);
        }
      }
    } catch (err) {
      setErrorMessage('Connection failed. Please check your network and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) {
      setErrorMessage('Please fill in both password fields.');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Master password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match. Please re-enter your master password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await setupMasterPassword(password);
      if (res.success) {
        onAuthenticated();
      } else {
        setErrorMessage(res.error || 'Failed to configure master password.');
      }
    } catch (err) {
      setErrorMessage('Connection failed. Please check your network and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8EE] flex flex-col justify-center items-center p-4 sm:p-6 selection:bg-[#C89B3C] selection:text-[#0F3B2E]">
      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-300">
        {/* Brand Header & Lock Card */}
        <div className="bg-[#0F3B2E] rounded-3xl p-6 sm:p-8 text-[#FFF8EE] shadow-2xl border border-[#185241] relative overflow-hidden">
          {/* Subtle gold accent circle */}
          <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-[#C89B3C]/10 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-36 h-36 rounded-full bg-[#C89B3C]/10 blur-2xl pointer-events-none" />

          {/* Top Lock Badge */}
          <div className="flex flex-col items-center text-center space-y-3 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-white/10 border border-[#C89B3C]/30 flex items-center justify-center shadow-inner relative">
              <img
                src={finchIconLightPng}
                alt="Etchr mark"
                className="w-8 h-8 object-contain absolute opacity-25"
              />
              <Lock className="w-7 h-7 text-[#C89B3C] relative z-10" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase bg-[#C89B3C]/20 text-[#C89B3C] border border-[#C89B3C]/40 mb-2">
                <Shield className="w-3 h-3" />
                <span>{isFirstTimeSetup ? 'First-Time Setup' : 'Protected Spend Ledger'}</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#FFF8EE]">
                {isFirstTimeSetup ? 'Set Master Access Password' : 'Etchr — Restricted Access'}
              </h1>
              <p className="text-xs sm:text-sm text-[#d8cfbe] mt-1 max-w-xs mx-auto">
                {isFirstTimeSetup
                  ? 'Configure permanent master access protection for this expense tracker.'
                  : 'Enter your master password to unlock this expense ledger.'}
              </p>
            </div>
          </div>

          {/* First-time setup permanent warning */}
          {isFirstTimeSetup && (
            <div className="mb-6 p-3.5 rounded-xl bg-[#0A261E] border border-[#C89B3C]/50 text-xs text-[#FFF8EE] space-y-1.5">
              <div className="flex items-center space-x-2 text-[#C89B3C] font-bold">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>Permanent Security Lock</span>
              </div>
              <p className="text-[11px] text-[#d8cfbe] leading-relaxed">
                Once set, this password is <strong>permanent and cannot be changed or reset from the website</strong>. Please record it in a safe place.
              </p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={isFirstTimeSetup ? handleSetup : handleUnlock} className="space-y-4">
            {/* Primary Password Input */}
            <div>
              <label className="block text-xs font-semibold text-[#d8cfbe] mb-1.5">
                {isFirstTimeSetup ? 'Create Master Password' : 'Master Password'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={isFirstTimeSetup ? 'Min. 6 characters' : 'Enter master password'}
                  autoFocus
                  disabled={isLoading || cooldownRemaining > 0}
                  className="w-full bg-[#0A261E] border border-[#2b7760] rounded-xl px-4 py-3 text-sm text-[#FFF8EE] placeholder:text-[#6e8a7e] focus:outline-none focus:border-[#C89B3C] focus:ring-1 focus:ring-[#C89B3C] transition-all pr-11 disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#a2beb2] hover:text-[#FFF8EE] p-1 cursor-pointer transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password (Setup mode only) */}
            {isFirstTimeSetup && (
              <div>
                <label className="block text-xs font-semibold text-[#d8cfbe] mb-1.5">
                  Confirm Master Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter master password"
                    disabled={isLoading}
                    className="w-full bg-[#0A261E] border border-[#2b7760] rounded-xl px-4 py-3 text-sm text-[#FFF8EE] placeholder:text-[#6e8a7e] focus:outline-none focus:border-[#C89B3C] focus:ring-1 focus:ring-[#C89B3C] transition-all pr-11 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#a2beb2] hover:text-[#FFF8EE] p-1 cursor-pointer transition-colors"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs flex items-start space-x-2 animate-in fade-in duration-200">
                <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Cooldown Timer */}
            {cooldownRemaining > 0 && (
              <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-500/50 text-amber-200 text-xs flex items-center space-x-2 animate-in fade-in duration-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                <span>Too many attempts. Cooldown active: retry in <strong>{cooldownRemaining}s</strong>.</span>
              </div>
            )}

            {/* Submit Action */}
            <button
              type="submit"
              disabled={isLoading || !password.trim() || cooldownRemaining > 0 || (isFirstTimeSetup && !confirmPassword.trim())}
              className="w-full py-3 px-4 rounded-xl bg-[#C89B3C] hover:bg-[#d6a948] text-[#0A261E] font-bold text-sm transition-all shadow-md flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer mt-2"
            >
              {isLoading ? (
                <span>Verifying...</span>
              ) : isFirstTimeSetup ? (
                <>
                  <span>Lock Tracker Permanently</span>
                  <KeyRound className="w-4 h-4 text-[#0A261E]" />
                </>
              ) : (
                <>
                  <span>Unlock Tracker</span>
                  <ArrowRight className="w-4 h-4 text-[#0A261E]" />
                </>
              )}
            </button>
          </form>

          {/* Footer note */}
          <div className="mt-6 pt-4 border-t border-[#185241] text-center">
            <p className="text-[11px] text-[#86a699]">
              Strict Server-Side Cryptographic Scrypt Salted Hash • Zero Client Plaintext
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
