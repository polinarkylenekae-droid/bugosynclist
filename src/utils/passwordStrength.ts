export interface PasswordRequirement {
  id: string;
  label: string;
  met: boolean;
}

export interface PasswordStrengthResult {
  isValid: boolean;
  score: number; // 0 to 5
  strengthLabel: 'Too Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong';
  strengthColor: string;
  strengthWidth: string;
  requirements: PasswordRequirement[];
  errorMessage?: string;
}

/**
 * Validates and measures password strength according to Barangay Bugo Citizen Portal security policies.
 * Requirements:
 * 1. Minimum 8 characters
 * 2. At least 1 uppercase letter (A-Z)
 * 3. At least 1 lowercase letter (a-z)
 * 4. At least 1 digit (0-9)
 * 5. At least 1 special character (!@#$%^&* etc.)
 */
export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const hasLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?~`]/.test(password);

  const requirements: PasswordRequirement[] = [
    { id: 'length', label: 'At least 8 characters long', met: hasLength },
    { id: 'upper', label: 'At least 1 uppercase letter (A-Z)', met: hasUpper },
    { id: 'lower', label: 'At least 1 lowercase letter (a-z)', met: hasLower },
    { id: 'number', label: 'At least 1 numerical digit (0-9)', met: hasNumber },
    { id: 'special', label: 'At least 1 special symbol (!@#$%^&* etc.)', met: hasSpecial },
  ];

  const metCount = requirements.filter(r => r.met).length;
  const isValid = metCount === 5;

  let strengthLabel: 'Too Weak' | 'Weak' | 'Fair' | 'Good' | 'Strong' = 'Too Weak';
  let strengthColor = 'bg-rose-500';
  let strengthWidth = '20%';

  if (!password) {
    strengthLabel = 'Too Weak';
    strengthColor = 'bg-gray-300';
    strengthWidth = '0%';
  } else if (metCount <= 1) {
    strengthLabel = 'Too Weak';
    strengthColor = 'bg-rose-500';
    strengthWidth = '20%';
  } else if (metCount === 2) {
    strengthLabel = 'Weak';
    strengthColor = 'bg-amber-500';
    strengthWidth = '40%';
  } else if (metCount === 3) {
    strengthLabel = 'Fair';
    strengthColor = 'bg-yellow-500';
    strengthWidth = '60%';
  } else if (metCount === 4) {
    strengthLabel = 'Good';
    strengthColor = 'bg-blue-500';
    strengthWidth = '80%';
  } else {
    strengthLabel = 'Strong';
    strengthColor = 'bg-emerald-600';
    strengthWidth = '100%';
  }

  let errorMessage: string | undefined;
  if (!password) {
    errorMessage = 'Password is required.';
  } else if (!hasLength) {
    errorMessage = 'Password must be at least 8 characters long.';
  } else if (!hasUpper) {
    errorMessage = 'Password must contain at least one uppercase letter (A-Z).';
  } else if (!hasLower) {
    errorMessage = 'Password must contain at least one lowercase letter (a-z).';
  } else if (!hasNumber) {
    errorMessage = 'Password must contain at least one numerical digit (0-9).';
  } else if (!hasSpecial) {
    errorMessage = 'Password must contain at least one special character (!@#$%^&* etc.).';
  }

  return {
    isValid,
    score: metCount,
    strengthLabel,
    strengthColor,
    strengthWidth,
    requirements,
    errorMessage
  };
}
