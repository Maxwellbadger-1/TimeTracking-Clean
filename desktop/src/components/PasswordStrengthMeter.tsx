interface PasswordStrengthMeterProps {
  password: string;
}

type StrengthLevel = 'weak' | 'medium' | 'strong';

interface StrengthResult {
  level: StrengthLevel;
  score: number; // 0-100
  text: string;
  color: string;
  bgColor: string;
}

/**
 * Calculate password strength based on various criteria
 * Returns score from 0-100
 */
function calculatePasswordStrength(password: string): StrengthResult {
  if (!password) {
    return {
      level: 'weak',
      score: 0,
      text: 'Enter a password',
      color: 'text-gray-400 dark:text-gray-500',
      bgColor: 'bg-gray-200 dark:bg-gray-700',
    };
  }

  let score = 0;

  // Length scoring (0-40 points)
  if (password.length >= 10) score += 20;
  if (password.length >= 12) score += 10;
  if (password.length >= 16) score += 10;

  // Character variety (0-40 points)
  const hasLowerCase = /[a-z]/.test(password);
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (hasLowerCase) score += 10;
  if (hasUpperCase) score += 10;
  if (hasNumbers) score += 10;
  if (hasSpecialChars) score += 10;

  // Complexity bonus (0-20 points)
  const charTypeCount = [hasLowerCase, hasUpperCase, hasNumbers, hasSpecialChars].filter(Boolean).length;
  if (charTypeCount >= 3) score += 10;
  if (charTypeCount === 4) score += 10;

  // Penalties
  // Repeating characters (e.g., "aaa", "111")
  if (/(.)\1{2,}/.test(password)) score -= 10;

  // Common patterns
  if (/123|abc|qwerty|password/i.test(password)) score -= 15;

  // Ensure score is within bounds
  score = Math.max(0, Math.min(100, score));

  // Determine level and styling
  let level: StrengthLevel;
  let text: string;
  let color: string;
  let bgColor: string;

  if (score < 40) {
    level = 'weak';
    text = password.length < 10 ? 'Too short (min. 10 characters)' : 'Weak';
    color = 'text-red-600 dark:text-red-400';
    bgColor = 'bg-red-500';
  } else if (score < 70) {
    level = 'medium';
    text = 'Medium';
    color = 'text-yellow-600 dark:text-yellow-400';
    bgColor = 'bg-yellow-500';
  } else {
    level = 'strong';
    text = 'Strong';
    color = 'text-green-600 dark:text-green-400';
    bgColor = 'bg-green-500';
  }

  return { level, score, text, color, bgColor };
}

/**
 * Password Strength Meter Component
 * Shows visual feedback on password strength (Weak/Medium/Strong)
 */
export default function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const strength = calculatePasswordStrength(password);

  return (
    <div className="space-y-2">
      {/* Strength bar */}
      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${strength.bgColor} transition-all duration-300`}
          style={{ width: `${strength.score}%` }}
        />
      </div>

      {/* Strength text */}
      <div className="flex items-center justify-between text-sm">
        <span className={`font-medium ${strength.color}`}>{strength.text}</span>
        <span className="text-gray-500 dark:text-gray-400 text-xs">{strength.score}/100</span>
      </div>

      {/* Password requirements */}
      {password && (
        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-1 mt-2">
          <div className="flex items-center gap-2">
            <span className={password.length >= 10 ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>
              {password.length >= 10 ? '✓' : '○'}
            </span>
            <span>At least 10 characters</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={/[a-z]/.test(password) && /[A-Z]/.test(password) ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>
              {/[a-z]/.test(password) && /[A-Z]/.test(password) ? '✓' : '○'}
            </span>
            <span>Uppercase and lowercase letters</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={/\d/.test(password) ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>
              {/\d/.test(password) ? '✓' : '○'}
            </span>
            <span>At least one number</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}>
              {/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password) ? '✓' : '○'}
            </span>
            <span>At least one special character</span>
          </div>
        </div>
      )}
    </div>
  );
}
