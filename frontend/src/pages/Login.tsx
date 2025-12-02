import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Building2, Eye, EyeOff, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authService } from '@/services/auth';
import { useAuthStore } from '@/store/auth';

const loginSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginForm) => {
    try {
      setError('');
      const response = await authService.login(data);
      login(response.user, response.accessToken, response.refreshToken);
      
      const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      setError(error.response?.data?.message || 'فشل تسجيل الدخول');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* TNC Brand Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1E3A5F] via-[#2C4A6B] to-[#1E3A5F]" />
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-0 w-96 h-96 bg-[#C4A052] rounded-full filter blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#C4A052] rounded-full filter blur-3xl translate-x-1/2 translate-y-1/2" />
      </div>
      {/* Diagonal accent stripe inspired by logo */}
      <div className="absolute top-0 left-0 w-32 h-screen bg-gradient-to-b from-[#C4A052] to-[#B8860B] transform -skew-x-12 -translate-x-16 opacity-80" />
      
      <div className="w-full max-w-md relative z-10 p-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white shadow-2xl mb-4 relative overflow-hidden">
            {/* TNC-style logo icon */}
            <div className="absolute top-0 left-0 w-3 h-full bg-gradient-to-b from-[#C4A052] to-[#B8860B] transform -skew-x-12" />
            <Building2 className="h-10 w-10 text-[#1E3A5F] relative z-10" />
          </div>
          <h1 className="text-2xl font-bold text-center text-white">شركة تبراك نجد للمقاولات</h1>
          <p className="text-[#C4A052] mt-1 font-medium">نظام إدارة طلبات الصيانة</p>
          <p className="text-white/60 text-sm mt-1">نبني بلا حدود...</p>
        </div>

        <Card className="border-0 shadow-2xl bg-white/95 backdrop-blur-sm">
          <CardHeader className="space-y-1 text-center pb-4">
            <CardTitle className="text-2xl text-[#1E3A5F]">تسجيل الدخول</CardTitle>
            <CardDescription>
              أدخل بيانات حسابك للوصول إلى النظام
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-[#1E3A5F]">البريد الإلكتروني</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="example@company.com"
                  {...register('email')}
                  className={`border-gray-300 focus:border-[#1E3A5F] focus:ring-[#1E3A5F] ${errors.email ? 'border-destructive' : ''}`}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-[#1E3A5F]">كلمة المرور</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...register('password')}
                    className={`border-gray-300 focus:border-[#1E3A5F] focus:ring-[#1E3A5F] ${errors.password ? 'border-destructive pl-10' : 'pl-10'}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-[#1E3A5F]"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-[#1E3A5F] hover:bg-[#2C4A6B] text-white font-medium py-2.5"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري تسجيل الدخول...
                  </>
                ) : (
                  'تسجيل الدخول'
                )}
              </Button>
            </form>

            {/* Demo credentials */}
            <div className="mt-6 rounded-lg bg-gradient-to-r from-[#1E3A5F]/5 to-[#C4A052]/10 border border-[#C4A052]/20 p-4">
              <p className="text-sm font-medium mb-2 text-[#1E3A5F]">بيانات تجريبية:</p>
              <div className="text-xs text-muted-foreground space-y-1">
                <p><span className="text-[#C4A052]">●</span> مدير: admin@maintenance.com</p>
                <p><span className="text-[#C4A052]">●</span> استشاري: consultant1@maintenance.com</p>
                <p><span className="text-[#C4A052]">●</span> مهندس: engineer1@maintenance.com</p>
                <p className="mt-2 pt-2 border-t border-[#C4A052]/20">كلمة المرور: <span className="font-mono bg-[#1E3A5F]/10 px-1.5 py-0.5 rounded">123456</span></p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Footer */}
        <p className="text-center text-white/50 text-xs mt-6">
          © 2024 شركة تبراك نجد للمقاولات - جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}




