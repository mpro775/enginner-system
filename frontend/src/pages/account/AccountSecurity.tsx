import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { authService } from '@/services/auth';
import { useAuthStore } from '@/store/auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

function errorMessage(error: unknown): string {
  const candidate = error as { response?: { data?: { message?: string } } };
  return candidate.response?.data?.message || 'تعذر تغيير كلمة المرور. حاول مرة أخرى.';
}

export default function AccountSecurity() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (newPassword.length < 8) {
      setError('كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل.');
      return;
    }
    if (newPassword !== confirmation) {
      setError('تأكيد كلمة المرور الجديدة غير مطابق.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('يجب أن تكون كلمة المرور الجديدة مختلفة عن الحالية.');
      return;
    }

    setLoading(true);
    try {
      await authService.changePassword({ currentPassword, newPassword });
      toast({
        title: 'تم تغيير كلمة المرور',
        description: 'سجّل الدخول مجدداً باستخدام كلمة المرور الجديدة.',
      });
      logout();
      navigate('/login', { replace: true });
    } catch (changeError) {
      setError(errorMessage(changeError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6" dir="rtl">
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-foreground">
          <ShieldCheck className="h-7 w-7 text-primary" />
          أمان الحساب
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">حدّث كلمة المرور لحماية حسابك. سيتم إنهاء جميع الجلسات بعد الحفظ.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5" /> تغيير كلمة المرور</CardTitle>
          <CardDescription>استخدم كلمة مرور جديدة لا تقل عن 8 أحرف.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-5">
            {error && <div role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

            <div className="space-y-2">
              <Label htmlFor="current-password">كلمة المرور الحالية</Label>
              <div className="relative">
                <Input id="current-password" type={showCurrent ? 'text' : 'password'} autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="pl-10" required />
                <button type="button" onClick={() => setShowCurrent((value) => !value)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showCurrent ? 'إخفاء كلمة المرور الحالية' : 'إظهار كلمة المرور الحالية'}>
                  {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-new-password">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Input id="account-new-password" type={showNew ? 'text' : 'password'} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="pl-10" required minLength={8} />
                <button type="button" onClick={() => setShowNew((value) => !value)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={showNew ? 'إخفاء كلمة المرور الجديدة' : 'إظهار كلمة المرور الجديدة'}>
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="account-confirm-password">تأكيد كلمة المرور الجديدة</Label>
              <Input id="account-confirm-password" type={showNew ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} />
            </div>

            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              حفظ كلمة المرور
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
