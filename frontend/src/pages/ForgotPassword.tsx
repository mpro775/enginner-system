import { ClipboardEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  RotateCcw,
} from 'lucide-react';
import { authService } from '@/services/auth';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = 'email' | 'otp' | 'password' | 'done';

const CHALLENGE_TERMINAL_CODES = new Set([
  'PASSWORD_RESET_CHALLENGE_INVALID',
  'PASSWORD_RESET_CHALLENGE_EXPIRED',
  'PASSWORD_RESET_ATTEMPTS_EXCEEDED',
]);
const TOKEN_TERMINAL_CODES = new Set([
  'PASSWORD_RESET_TOKEN_INVALID',
]);

function getErrorMessage(error: unknown, fallback: string): string {
  const candidate = error as { response?: { data?: { message?: string } } };
  return candidate.response?.data?.message || fallback;
}

function getRetryAfterSeconds(error: unknown): number | undefined {
  const candidate = error as {
    response?: { data?: { details?: { retryAfterSeconds?: number } } };
  };
  return candidate.response?.data?.details?.retryAfterSeconds;
}

function getErrorCode(error: unknown): string | undefined {
  const candidate = error as { response?: { data?: { code?: string } } };
  return candidate.response?.data?.code;
}

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  if (!name || !domain) return email;
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(2, name.length - 2))}@${domain}`;
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  const restartRecovery = (message = '') => {
    setChallengeId('');
    setOtp(Array(6).fill(''));
    setResetToken('');
    setNewPassword('');
    setConfirmation('');
    setCountdown(0);
    setError(message);
    setStep('email');
  };

  useEffect(() => {
    if (step !== 'otp' || countdown <= 0) return;
    const timer = window.setInterval(
      () => setCountdown((value) => Math.max(0, value - 1)),
      1_000,
    );
    return () => window.clearInterval(timer);
  }, [step, countdown]);

  const requestOtp = async () => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError('أدخل بريداً إلكترونياً صحيحاً.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await authService.requestPasswordReset(email.trim());
      setChallengeId(response.challengeId);
      setCountdown(response.resendAfterSeconds ?? 60);
      setStep('otp');
      window.setTimeout(() => otpRefs.current[0]?.focus(), 0);
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          'تعذر بدء استعادة كلمة المرور. حاول مرة أخرى لاحقاً.',
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const updateOtpDigit = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setOtp((current) => {
      const next = [...current];
      next[index] = digit;
      return next;
    });
    setError('');
    if (digit && index < 5) otpRefs.current[index + 1]?.focus();
  };

  const handleOtpKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index < 5) otpRefs.current[index + 1]?.focus();
    if (event.key === 'ArrowRight' && index > 0) otpRefs.current[index - 1]?.focus();
  };

  const handleOtpPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!digits) return;
    event.preventDefault();
    const next = Array(6).fill('');
    digits.split('').forEach((digit, index) => (next[index] = digit));
    setOtp(next);
    otpRefs.current[Math.min(digits.length, 6) - 1]?.focus();
  };

  const verifyOtp = async () => {
    const code = otp.join('');
    if (code.length !== 6) {
      setError('أدخل رمز التحقق المكوّن من 6 أرقام.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await authService.verifyPasswordResetOtp(challengeId, code);
      setResetToken(response.resetToken);
      setStep('password');
    } catch (verifyError) {
      const message = getErrorMessage(
        verifyError,
        'رمز التحقق غير صحيح أو انتهت صلاحيته.',
      );
      if (CHALLENGE_TERMINAL_CODES.has(getErrorCode(verifyError) ?? '')) {
        restartRecovery(`${message} ابدأ عملية الاستعادة من جديد.`);
        return;
      }
      setError(message);
      setOtp(Array(6).fill(''));
      window.setTimeout(() => otpRefs.current[0]?.focus(), 0);
    } finally {
      setLoading(false);
    }
  };

  const resendOtp = async () => {
    if (countdown > 0 || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await authService.resendPasswordResetOtp(challengeId);
      setChallengeId(response.challengeId);
      setOtp(Array(6).fill(''));
      setCountdown(response.resendAfterSeconds ?? 60);
      window.setTimeout(() => otpRefs.current[0]?.focus(), 0);
    } catch (resendError) {
      if (CHALLENGE_TERMINAL_CODES.has(getErrorCode(resendError) ?? '')) {
        restartRecovery(
          'انتهت جلسة الاستعادة. ابدأ عملية الاستعادة من جديد.',
        );
        return;
      }
      const retryAfterSeconds = getRetryAfterSeconds(resendError);
      if (retryAfterSeconds) setCountdown(retryAfterSeconds);
      setError(getErrorMessage(resendError, 'تعذر إعادة إرسال الرمز.'));
    } finally {
      setLoading(false);
    }
  };

  const savePassword = async () => {
    if (newPassword.length < 8) {
      setError('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('تأكيد كلمة المرور غير مطابق.');
      return;
    }
    if (new TextEncoder().encode(newPassword).length > 72) {
      setError('يجب ألا تتجاوز كلمة المرور 72 بايت بترميز UTF-8.');
      return;
    }
    if (!resetToken) {
      restartRecovery('انتهت جلسة الاستعادة. ابدأ العملية من جديد.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await authService.resetPassword(resetToken, newPassword);
      // The backend has already invalidated all sessions. Clear the matching
      // local auth state without calling the authenticated logout endpoint.
      useAuthStore.getState().logout();
      setChallengeId('');
      setOtp(Array(6).fill(''));
      setResetToken('');
      setNewPassword('');
      setConfirmation('');
      setCountdown(0);
      setStep('done');
    } catch (resetError) {
      const message = getErrorMessage(
        resetError,
        'تعذر تعيين كلمة المرور الجديدة.',
      );
      if (TOKEN_TERMINAL_CODES.has(getErrorCode(resetError) ?? '')) {
        restartRecovery(`${message} ابدأ عملية الاستعادة من جديد.`);
        return;
      }
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const submitOnEnter = (event: KeyboardEvent<HTMLFormElement>, action: () => void) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      action();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary/90 to-primary dark:from-background dark:via-background/95 dark:to-background flex items-center justify-center p-4" dir="rtl">
      <Button
        variant="ghost"
        className="absolute right-4 top-4 gap-2 text-white hover:bg-white/10 hover:text-white"
        onClick={() => navigate('/login')}
      >
        <ArrowRight className="h-4 w-4" />
        تسجيل الدخول
      </Button>

      <Card className="w-full max-w-lg border-0 bg-card/95 shadow-2xl backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <KeyRound className="h-6 w-6" />
          </div>
          <CardTitle>استعادة كلمة المرور</CardTitle>
          <CardDescription>
            {step === 'email' && 'سنرسل رمز تحقق إلى بريد الحساب الفعّال.'}
            {step === 'otp' && `أدخل الرمز المرسل إلى ${maskEmail(email)}.`}
            {step === 'password' && 'اختر كلمة مرور جديدة لحسابك.'}
            {step === 'done' && 'تم تحديث كلمة المرور بأمان.'}
          </CardDescription>
          <div className="mx-auto mt-4 flex w-full max-w-xs gap-2" aria-label="مراحل الاستعادة">
            {[0, 1, 2].map((index) => {
              const activeIndex = step === 'email' ? 0 : step === 'otp' ? 1 : 2;
              return <span key={index} className={`h-1.5 flex-1 rounded-full ${index <= activeIndex ? 'bg-primary' : 'bg-muted'}`} />;
            })}
          </div>
        </CardHeader>

        <CardContent>
          {error && <div role="alert" className="mb-4 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

          {step === 'email' && (
            <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void requestOtp(); }}>
              <div className="space-y-2">
                <Label htmlFor="recovery-email">البريد الإلكتروني</Label>
                <div className="relative">
                  <Input
                    id="recovery-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="example@ksu.edu.sa"
                    className="pl-10"
                    autoFocus
                  />
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                إرسال رمز التحقق
              </Button>
            </form>
          )}

          {step === 'otp' && (
            <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void verifyOtp(); }} onKeyDown={(event) => submitOnEnter(event, () => void verifyOtp())}>
              <div className="space-y-3">
                <Label>رمز التحقق</Label>
                <div className="flex justify-center gap-2" dir="ltr" onPaste={handleOtpPaste}>
                  {otp.map((digit, index) => (
                    <Input
                      key={index}
                      ref={(element) => { otpRefs.current[index] = element; }}
                      value={digit}
                      onChange={(event) => updateOtpDigit(index, event.target.value)}
                      onKeyDown={(event) => handleOtpKeyDown(index, event)}
                      inputMode="numeric"
                      autoComplete={index === 0 ? 'one-time-code' : 'off'}
                      aria-label={`رقم ${index + 1} من رمز التحقق`}
                      className="h-12 w-11 p-0 text-center text-xl font-bold sm:h-14 sm:w-12"
                      maxLength={1}
                    />
                  ))}
                </div>
              </div>
              <Button className="w-full" type="submit" disabled={loading || otp.join('').length !== 6}>
                {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                تحقق من الرمز
              </Button>
              <Button className="w-full gap-2" type="button" variant="ghost" disabled={loading || countdown > 0} onClick={() => void resendOtp()}>
                <RotateCcw className="h-4 w-4" />
                {countdown > 0 ? `إعادة الإرسال بعد ${formatCountdown(countdown)}` : 'إعادة إرسال الرمز'}
              </Button>
              <Button className="w-full" type="button" variant="outline" disabled={loading} onClick={() => restartRecovery()}>
                ابدأ من جديد
              </Button>
            </form>
          )}

          {step === 'password' && (
            <form className="space-y-5" onSubmit={(event) => { event.preventDefault(); void savePassword(); }}>
              <div className="space-y-2">
                <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
                <div className="relative">
                  <Input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="pl-10" autoFocus />
                  <button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}>
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">8 أحرف على الأقل.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">تأكيد كلمة المرور</Label>
                <Input id="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} />
              </div>
              <Button className="w-full" type="submit" disabled={loading}>
                {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                حفظ كلمة المرور
              </Button>
              <Button className="w-full" type="button" variant="outline" disabled={loading} onClick={() => restartRecovery()}>
                ابدأ من جديد
              </Button>
            </form>
          )}

          {step === 'done' && (
            <div className="space-y-5 text-center">
              <CheckCircle2 className="mx-auto h-16 w-16 text-green-600 dark:text-green-400" />
              <p className="text-sm text-muted-foreground">يمكنك الآن تسجيل الدخول باستخدام كلمة المرور الجديدة. تم إبطال الجلسات السابقة.</p>
              <Button className="w-full" onClick={() => navigate('/login', { replace: true })}>الانتقال إلى تسجيل الدخول</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
