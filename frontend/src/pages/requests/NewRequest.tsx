import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { requestsService } from '@/services/requests';
import {
  locationsService,
  departmentsService,
  systemsService,
  machinesService,
} from '@/services/reference-data';
import { MaintenanceType } from '@/types';

const requestSchema = z.object({
  maintenanceType: z.nativeEnum(MaintenanceType, {
    errorMap: () => ({ message: 'اختر نوع الصيانة' }),
  }),
  locationId: z.string().min(1, 'اختر الموقع'),
  departmentId: z.string().min(1, 'اختر القسم'),
  systemId: z.string().min(1, 'اختر النظام'),
  machineId: z.string().min(1, 'اختر الآلة'),
  reasonText: z.string().min(10, 'سبب الطلب يجب أن يكون 10 أحرف على الأقل'),
  machineNumber: z.string().optional(),
  engineerNotes: z.string().optional(),
});

type RequestFormData = z.infer<typeof requestSchema>;

export default function NewRequest() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RequestFormData>({
    resolver: zodResolver(requestSchema),
  });

  const watchSystemId = watch('systemId');

  const { data: locations } = useQuery({
    queryKey: ['locations'],
    queryFn: () => locationsService.getAll(),
  });

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsService.getAll(),
  });

  const { data: systems } = useQuery({
    queryKey: ['systems'],
    queryFn: () => systemsService.getAll(),
  });

  const { data: machines, isLoading: isLoadingMachines, isError: isMachinesError } = useQuery({
    queryKey: ['machines', watchSystemId],
    queryFn: () => machinesService.getBySystem(watchSystemId),
    enabled: !!watchSystemId,
  });

  const createMutation = useMutation({
    mutationFn: requestsService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      navigate('/requests');
    },
  });

  const onSubmit = (data: RequestFormData) => {
    createMutation.mutate(data);
  };

  const handleSystemChange = (value: string) => {
    setValue('systemId', value);
    setValue('machineId', '');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-3xl font-bold tracking-tight">طلب صيانة جديد</h2>
          <p className="text-muted-foreground">إنشاء طلب صيانة جديد</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>بيانات الطلب</CardTitle>
          <CardDescription>أدخل تفاصيل طلب الصيانة</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {createMutation.isError && (
              <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                حدث خطأ أثناء إنشاء الطلب
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {/* Maintenance Type */}
              <div className="space-y-2">
                <Label>نوع الصيانة *</Label>
                <Select
                  onValueChange={(value) => setValue('maintenanceType', value as MaintenanceType)}
                >
                  <SelectTrigger className={errors.maintenanceType ? 'border-destructive' : ''}>
                    <SelectValue placeholder="اختر نوع الصيانة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={MaintenanceType.EMERGENCY}>طارئة</SelectItem>
                    <SelectItem value={MaintenanceType.PREVENTIVE}>وقائية</SelectItem>
                  </SelectContent>
                </Select>
                {errors.maintenanceType && (
                  <p className="text-xs text-destructive">{errors.maintenanceType.message}</p>
                )}
              </div>

              {/* Location */}
              <div className="space-y-2">
                <Label>الموقع *</Label>
                <Select onValueChange={(value) => setValue('locationId', value)}>
                  <SelectTrigger className={errors.locationId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="اختر الموقع" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations?.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.locationId && (
                  <p className="text-xs text-destructive">{errors.locationId.message}</p>
                )}
              </div>

              {/* Department */}
              <div className="space-y-2">
                <Label>القسم *</Label>
                <Select onValueChange={(value) => setValue('departmentId', value)}>
                  <SelectTrigger className={errors.departmentId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments?.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.departmentId && (
                  <p className="text-xs text-destructive">{errors.departmentId.message}</p>
                )}
              </div>

              {/* System */}
              <div className="space-y-2">
                <Label>النظام *</Label>
                <Select onValueChange={handleSystemChange}>
                  <SelectTrigger className={errors.systemId ? 'border-destructive' : ''}>
                    <SelectValue placeholder="اختر النظام" />
                  </SelectTrigger>
                  <SelectContent>
                    {systems?.map((system) => (
                      <SelectItem key={system.id} value={system.id}>
                        {system.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.systemId && (
                  <p className="text-xs text-destructive">{errors.systemId.message}</p>
                )}
              </div>

              {/* Machine */}
              <div className="space-y-2">
                <Label>الآلة *</Label>
                <Select
                  disabled={!watchSystemId || isLoadingMachines}
                  onValueChange={(value) => setValue('machineId', value)}
                  value={watch('machineId') || undefined}
                >
                  <SelectTrigger className={errors.machineId ? 'border-destructive' : ''}>
                    <SelectValue 
                      placeholder={
                        !watchSystemId 
                          ? 'اختر النظام أولاً' 
                          : isLoadingMachines 
                          ? 'جاري التحميل...' 
                          : isMachinesError
                          ? 'حدث خطأ في التحميل'
                          : machines && machines.length === 0
                          ? 'لا توجد آلات متاحة'
                          : 'اختر الآلة'
                      } 
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {machines && machines.length > 0 ? (
                      machines.map((machine) => (
                        <SelectItem key={machine.id} value={machine.id}>
                          {machine.name}
                        </SelectItem>
                      ))
                    ) : null}
                  </SelectContent>
                </Select>
                {errors.machineId && (
                  <p className="text-xs text-destructive">{errors.machineId.message}</p>
                )}
                {isMachinesError && (
                  <p className="text-xs text-destructive">حدث خطأ أثناء تحميل الآلات</p>
                )}
              </div>

              {/* Machine Number */}
              <div className="space-y-2">
                <Label>رقم الآلة</Label>
                <Input placeholder="رقم أو كود الآلة" {...register('machineNumber')} />
              </div>
            </div>

            {/* Reason */}
            <div className="space-y-2">
              <Label>سبب طلب الصيانة *</Label>
              <Textarea
                placeholder="وصف تفصيلي للمشكلة أو سبب طلب الصيانة"
                rows={4}
                className={errors.reasonText ? 'border-destructive' : ''}
                {...register('reasonText')}
              />
              {errors.reasonText && (
                <p className="text-xs text-destructive">{errors.reasonText.message}</p>
              )}
            </div>

            {/* Engineer Notes */}
            <div className="space-y-2">
              <Label>ملاحظات المهندس</Label>
              <Textarea
                placeholder="أي ملاحظات إضافية..."
                rows={3}
                {...register('engineerNotes')}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                إلغاء
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  'إرسال الطلب'
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}



