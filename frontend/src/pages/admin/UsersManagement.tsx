import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Edit, Trash2, UserCheck, UserX, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { usersService } from "@/services/users";
import { departmentsService } from "@/services/reference-data";
import { getRoleLabel } from "@/lib/utils";
import { Role, User } from "@/types";

const userSchema = z.object({
  name: z.string().min(2, "الاسم يجب أن يكون 2 أحرف على الأقل"),
  email: z.string().email("البريد الإلكتروني غير صحيح"),
  password: z
    .string()
    .refine((val) => !val || val.length >= 6, {
      message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",
    })
    .optional(),
  role: z.nativeEnum(Role),
  departmentId: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

export default function UsersManagement() {
  const queryClient = useQueryClient();
  const [showDialog, setShowDialog] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    watch,
    formState: { errors },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  const watchRole = watch("role");

  const { data, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => usersService.getAll({ limit: 100 }),
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: () => departmentsService.getAll(),
  });

  const createMutation = useMutation({
    mutationFn: usersService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UserFormData> }) =>
      usersService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      closeDialog();
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: usersService.toggleStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: usersService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const openCreateDialog = () => {
    setEditingUser(null);
    reset({ role: Role.ENGINEER });
    setShowDialog(true);
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    reset({
      name: user.name,
      email: user.email,
      role: user.role,
      departmentId:
        typeof user.departmentId === "object"
          ? user.departmentId?.id
          : undefined,
    });
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingUser(null);
    reset();
  };

  const onSubmit = (data: UserFormData) => {
    if (editingUser) {
      const updateData: Partial<UserFormData> = { ...data };
      if (!updateData.password) {
        delete updateData.password;
      }
      updateMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      createMutation.mutate(data as Required<UserFormData>);
    }
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="space-y-4 sm:space-y-6 animate-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            إدارة المستخدمين
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            إضافة وتعديل حسابات المستخدمين
          </p>
        </div>
        <Button onClick={openCreateDialog} className="w-full sm:w-auto">
          <Plus className="ml-2 h-4 w-4" />
          مستخدم جديد
        </Button>
      </div>

      {/* Mobile Cards View */}
      <div className="block lg:hidden space-y-3">
        {!data || !data.data || data.data.length === 0 ? (
          <Card className="dark:border-border/50">
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                <UserX className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>لا يوجد مستخدمين</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          data.data.map((user) => (
            <Card
              key={user.id}
              className="dark:border-border/50 hover:shadow-md dark:hover:shadow-primary/5 transition-all duration-200"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-base truncate">
                      {user.name}
                    </h3>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {user.email}
                    </p>
                  </div>
                  <Badge variant={user.isActive ? "success" : "destructive"}>
                    {user.isActive ? "نشط" : "معطل"}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Badge variant="secondary" className="text-xs">
                      {getRoleLabel(user.role)}
                    </Badge>
                  </div>
                  {typeof user.departmentId === "object" &&
                    user.departmentId?.name && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span className="text-xs">
                          القسم: {user.departmentId.name}
                        </span>
                      </div>
                    )}
                </div>

                <div className="flex items-center gap-2 pt-3 border-t border-border/50">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => openEditDialog(user)}
                  >
                    <Edit className="h-4 w-4 ml-2" />
                    تعديل
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1"
                    onClick={() => toggleStatusMutation.mutate(user.id)}
                  >
                    {user.isActive ? (
                      <>
                        <UserX className="h-4 w-4 ml-2 text-destructive" />
                        تعطيل
                      </>
                    ) : (
                      <>
                        <UserCheck className="h-4 w-4 ml-2 text-green-600" />
                        تفعيل
                      </>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if (confirm("هل أنت متأكد من حذف هذا المستخدم؟")) {
                        deleteMutation.mutate(user.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <Card className="hidden lg:block dark:border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>البريد الإلكتروني</th>
                  <th>الدور</th>
                  <th>القسم</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {!data || !data.data || data.data.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="text-center py-12 text-muted-foreground"
                    >
                      <UserX className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>لا يوجد مستخدمين</p>
                    </td>
                  </tr>
                ) : (
                  data.data.map((user) => (
                    <tr key={user.id}>
                      <td className="font-medium">{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        <Badge variant="secondary">
                          {getRoleLabel(user.role)}
                        </Badge>
                      </td>
                      <td>
                        {typeof user.departmentId === "object"
                          ? user.departmentId?.name
                          : "-"}
                      </td>
                      <td>
                        <Badge
                          variant={user.isActive ? "success" : "destructive"}
                        >
                          {user.isActive ? "نشط" : "معطل"}
                        </Badge>
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleStatusMutation.mutate(user.id)}
                          >
                            {user.isActive ? (
                              <UserX className="h-4 w-4 text-destructive" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (
                                confirm("هل أنت متأكد من حذف هذا المستخدم؟")
                              ) {
                                deleteMutation.mutate(user.id);
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* User Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "تعديل المستخدم" : "إضافة مستخدم جديد"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>الاسم *</Label>
              <Input
                {...register("name")}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>البريد الإلكتروني *</Label>
              <Input
                type="email"
                {...register("email")}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                {editingUser ? "كلمة المرور الجديدة" : "كلمة المرور *"}
              </Label>
              <Input
                type="password"
                {...register("password")}
                placeholder={
                  editingUser
                    ? "اتركه فارغاً للإبقاء على كلمة المرور الحالية"
                    : ""
                }
                className={errors.password ? "border-destructive" : ""}
              />
              {errors.password && (
                <p className="text-xs text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>الدور *</Label>
              <Select
                value={watch("role")}
                onValueChange={(value) => setValue("role", value as Role)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الدور" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={Role.ADMIN}>مدير النظام</SelectItem>
                  <SelectItem value={Role.CONSULTANT}>استشاري</SelectItem>
                  <SelectItem value={Role.MAINTENANCE_MANAGER}>
                    مدير الصيانة
                  </SelectItem>
                    <SelectItem value={Role.ENGINEER}>مهندس</SelectItem>
                    <SelectItem value={Role.HEALTH_SAFETY_SUPERVISOR}>مشرف الصحة والسلامة المهنية</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {watchRole === Role.ENGINEER && (
              <div className="space-y-2">
                <Label>القسم</Label>
                <Select
                  onValueChange={(value) => setValue("departmentId", value)}
                >
                  <SelectTrigger>
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
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                إلغاء
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                )}
                {editingUser ? "حفظ التغييرات" : "إضافة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
