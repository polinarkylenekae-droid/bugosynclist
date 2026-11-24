import React, { useRef, useState } from 'react';
import {
  KeyRound,
  Lock,
  Unlock,
  ShieldCheck,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Check
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { evaluatePasswordStrength } from '../../utils/passwordStrength';

interface ChangePasswordSectionProps {
  onSuccess?: () => void;
  className?: string;
}

export const ChangePasswordSection: React.FC<ChangePasswordSectionProps> = ({
  onSuccess,
  className = ''
}) => {
  const { verifyCurrentPassword, changePassword } = useApp();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const newPasswordInputRef = useRef<HTMLInputElement | null>(null);

  const isUnlocked = Boolean(verificationToken);
  const strength = evaluatePasswordStrength(newPassword);

  const handleVerifyOldPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!currentPassword.trim()) {
      setErrorMsg('Please enter your old password first to unlock.');
      return;
    }

    setIsVerifying(true);
    try {
      const res = await verifyCurrentPassword(currentPassword);
      if (res.success && res.verificationToken) {
        setVerificationToken(res.verificationToken);
        setSuccessMsg('Old password verified. Password fields are now unlocked.');
        setTimeout(() => {
          newPasswordInputRef.current?.focus();
        }, 50);
      } else {
        setVerificationToken(null);
        setErrorMsg(res.message || 'Old password is incorrect.');
      }
    } catch {
      setVerificationToken(null);
      setErrorMsg('Network error while verifying your old password.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResetLock = () => {
    setVerificationToken(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isUnlocked || !verificationToken) {
      setErrorMsg('Please verify your old password first to unlock password changes.');
      return;
    }

    if (!newPassword) {
      setErrorMsg('Please enter a new password.');
      return;
    }

    if (!strength.isValid) {
      setErrorMsg(strength.errorMessage || 'New password must meet all 5 strong security requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMsg('New password must be different from your old password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await changePassword({
        verificationToken,
        currentPassword,
        newPassword
      });

      if (res.success) {
        setSuccessMsg('Password updated successfully.');
        setVerificationToken(null);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowCurrent(false);
        setShowNew(false);
        setShowConfirm(false);
        if (onSuccess) onSuccess();
      } else {
        if (
          res.message?.toLowerCase().includes('authorization required') ||
          res.message?.toLowerCase().includes('incorrect')
        ) {
          setVerificationToken(null);
        }
        setErrorMsg(res.message || 'Verification failed or unable to update password.');
      }
    } catch {
      setErrorMsg('Network error while updating password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    isUnlocked &&
    !isSubmitting &&
    Boolean(newPassword) &&
    Boolean(confirmPassword) &&
    newPassword === confirmPassword &&
    newPassword !== currentPassword &&
    strength.isValid;

  return (
    <div className={`bg-white rounded-2xl p-5 sm:p-6 border border-gray-200 shadow-xs space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center border shrink-0 ${
              isUnlocked
                ? 'bg-emerald-50 text-[#0c532b] border-emerald-200'
                : 'bg-gray-50 text-gray-600 border-gray-200'
            }`}
          >
            {isUnlocked ? <Unlock className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Change Password</h2>
            <p className="text-[11px] text-gray-500">
              {isUnlocked
                ? 'Old password verified — enter and confirm your new password'
                : 'Enter and verify your old password first to unlock password change'}
            </p>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
            isUnlocked
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}
        >
          {isUnlocked ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Unlocked</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5" />
              <span>Locked</span>
            </>
          )}
        </span>
      </div>

      {/* Feedback Alerts */}
      {successMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Step 1: Verify Old Password to Unlock */}
      <form onSubmit={handleVerifyOldPassword} className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <label className="block text-xs font-bold text-gray-700">
            Old / Current Password <span className="text-rose-500">*</span>
          </label>
          {isUnlocked && (
            <button
              type="button"
              onClick={handleResetLock}
              className="text-[11px] font-semibold text-gray-500 hover:text-gray-800 underline cursor-pointer"
            >
              Lock &amp; change old password
            </button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type={showCurrent ? 'text' : 'password'}
              value={currentPassword}
              disabled={isUnlocked || isVerifying}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                setErrorMsg('');
                setSuccessMsg('');
              }}
              placeholder="Enter old password to unlock"
              className={`w-full border rounded-xl pl-9 pr-10 py-2.5 text-xs font-medium outline-none transition ${
                isUnlocked
                  ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900 cursor-not-allowed'
                  : 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#0c532b] focus:border-transparent'
              }`}
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              disabled={isUnlocked}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-40 cursor-pointer"
              title={showCurrent ? 'Hide password' : 'Show password'}
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          {!isUnlocked ? (
            <button
              type="submit"
              disabled={isVerifying || !currentPassword.trim()}
              className="px-4 py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isVerifying ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Unlock className="w-3.5 h-3.5" />
              )}
              <span>{isVerifying ? 'Verifying...' : 'Verify & Unlock'}</span>
            </button>
          ) : (
            <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified</span>
            </div>
          )}
        </div>
      </form>

      {/* Step 2: New Password Fields (Locked until Old Password Verified) */}
      <form onSubmit={handleSubmit} className="space-y-3.5 pt-2 border-t border-gray-100">
        {!isUnlocked && (
          <div className="p-2.5 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-[11px] text-gray-500 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <span>Verify your old password above to unlock New Password and Confirm New Password.</span>
          </div>
        )}

        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${!isUnlocked ? 'opacity-60' : ''}`}>
          {/* New Password */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              New Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={newPasswordInputRef}
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                disabled={!isUnlocked || isSubmitting}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setErrorMsg('');
                }}
                placeholder={isUnlocked ? 'Min 8 chars, A-z, 0-9, symbol' : 'Locked — verify old password first'}
                className={`w-full border rounded-xl pl-9 pr-10 py-2.5 text-xs font-medium outline-none transition ${
                  !isUnlocked
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#0c532b] focus:border-transparent'
                }`}
              />
              <button
                type="button"
                disabled={!isUnlocked}
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title={showNew ? 'Hide password' : 'Show password'}
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {isUnlocked && newPassword && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${strength.strengthColor}`}
                      style={{ width: strength.strengthWidth }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-gray-600">{strength.strengthLabel}</span>
                </div>
                <ul className="space-y-0.5 text-[10px]">
                  {strength.requirements.map(req => (
                    <li
                      key={req.id}
                      className={`flex items-center gap-1 ${req.met ? 'text-emerald-700 font-semibold' : 'text-gray-400'}`}
                    >
                      <Check className={`w-3 h-3 ${req.met ? 'text-emerald-600' : 'text-gray-300'}`} />
                      <span>{req.label}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Confirm New Password <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                disabled={!isUnlocked || isSubmitting}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrorMsg('');
                }}
                placeholder={isUnlocked ? 'Repeat new password' : 'Locked — verify old password first'}
                className={`w-full border rounded-xl pl-9 pr-10 py-2.5 text-xs font-medium outline-none transition ${
                  !isUnlocked
                    ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-50 border-gray-300 text-gray-900 focus:ring-2 focus:ring-[#0c532b] focus:border-transparent'
                }`}
              />
              <button
                type="button"
                disabled={!isUnlocked}
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                title={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {isUnlocked && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[11px] text-rose-600 font-medium mt-1">Passwords do not match</p>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-5 py-2.5 bg-[#0c532b] hover:bg-[#094222] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            {isSubmitting ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            <span>Update Password</span>
          </button>
        </div>
      </form>
    </div>
  );
};
