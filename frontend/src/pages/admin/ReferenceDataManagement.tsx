import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Loader2, UserCheck, UserX, MoreVertical, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { TagsInput } from "@/components/ui/tags-input";
import { PageLoader } from "@/components/shared/LoadingSpinner";
import { useAuthStore } from "@/store/auth";
import { Role } from "@/types";

interface ReferenceDataProps {
  title: string;
  description: string;
  service: {
    getAll: (activeOnly?: boolean) => Promise<unknown[]>;
    create: (data: Record<string, unknown>) => Promise<unknown>;
    update: (id: string, data: Record<string, unknown>) => Promise<unknown>;
    delete: (id: string) => Promise<void>;
    toggleStatus?: (id: string, currentStatus: boolean) => Promise<unknown>;
    softDelete?: (id: string) => Promise<void>;
    hardDelete?: (id: string) => Promise<void>;
  };
  queryKey: string;
  fields: {
    name: string;
    label: string;
    type: "text" | "textarea" | "select" | "tags";
    required?: boolean;
    options?: { value: string; label: string }[];
  }[];
  columns: { key: string; label: string }[];
  relatedService?: {
    getAll: () => Promise<{ id: string; name: string }[]>;
    queryKey: string;
    fieldName: string;
  };
}

export default function ReferenceDataManagement({
  title,
  description,
  service,
  queryKey,
  fields,
  columns,
  relatedService,
}: ReferenceDataProps) {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [showDialog, setShowDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<Record<
    string,
    unknown
  > | null>(null);
  const [formData, setFormData] = useState<
    Record<string, string | boolean | string[]>
  >({});
  const [softDeleteDialog, setSoftDeleteDialog] = useState<{ id: string; name: string } | null>(null);
  
  const isAdmin = user?.role === Role.ADMIN;

  const { data, isLoading, refetch } = useQuery({
    queryKey: [queryKey],
    queryFn: () => service.getAll(false),
  });

  const { data: relatedData } = useQuery({
    queryKey: [relatedService?.queryKey],
    queryFn: () => relatedService?.getAll(),
    enabled: !!relatedService,
  });

  const createMutation = useMutation({
    mutationFn: service.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      await refetch();
      closeDialog();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      service.update(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      await refetch();
      closeDialog();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (service.softDelete) {
        return service.softDelete(id);
      }
      return service.delete(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      await refetch();
    },
  });

  const hardDeleteMutation = useMutation({
    mutationFn: (id: string) => {
      if (service.hardDelete) {
        return service.hardDelete(id);
      }
      return service.delete(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      await refetch();
    },
  });

  const [hardDeleteDialog, setHardDeleteDialog] = useState<{ id: string; name: string } | null>(null);

  const toggleStatusMutation = useMutation({
    mutationFn: async ({
      id,
      currentStatus,
    }: {
      id: string;
      currentStatus: boolean;
    }) => {
      if (!service.toggleStatus) {
        throw new Error("Toggle status is not supported");
      }
      return service.toggleStatus(id, currentStatus);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: [queryKey] });
      await refetch();
    },
  });

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormData({});
    setShowDialog(true);
  };

  const openEditDialog = (item: Record<string, unknown>) => {
    setEditingItem(item);
    const initialData: Record<string, string | boolean | string[]> = {};
    fields.forEach((field) => {
      const value = item[field.name];
      if (field.type === "tags") {
        initialData[field.name] = Array.isArray(value) ? value : [];
      } else if (typeof value === "object" && value !== null && "id" in value) {
        initialData[field.name] = (value as { id: string }).id;
      } else {
        initialData[field.name] = String(value || "");
      }
    });
    // Add isActive to form data
    initialData.isActive = item.isActive as boolean;
    setFormData(initialData);
    setShowDialog(true);
  };

  const closeDialog = () => {
    setShowDialog(false);
    setEditingItem(null);
    setFormData({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id as string, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  if (isLoading) {
    return <PageLoader />;
  }

  const items = (data as Record<string, unknown>[]) || [];

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
          <p className="text-muted-foreground">{description}</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="ml-2 h-4 w-4" />
          إضافة جديد
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="data-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.key}>{col.label}</th>
                ))}
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 2}
                    className="text-center py-8 text-muted-foreground"
                  >
                    لا توجد بيانات
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id as string}>
                    {columns.map((col) => (
                      <td key={col.key}>
                        {col.key === "components" &&
                        Array.isArray(item[col.key]) ? (
                          <div className="flex flex-wrap gap-1">
                            {(item[col.key] as string[]).length > 0 ? (
                              (item[col.key] as string[]).map(
                                (component, idx) => (
                                  <Badge
                                    key={idx}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    {component}
                                  </Badge>
                                )
                              )
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </div>
                        ) : typeof item[col.key] === "object" &&
                          item[col.key] !== null ? (
                          (item[col.key] as { name: string }).name
                        ) : (
                          String(item[col.key] || "-")
                        )}
                      </td>
                    ))}
                    <td>
                      <Badge
                        variant={item.isActive ? "success" : "destructive"}
                      >
                        {item.isActive ? "نشط" : "معطل"}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {service.toggleStatus && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              toggleStatusMutation.mutate({
                                id: item.id as string,
                                currentStatus: item.isActive as boolean,
                              })
                            }
                            disabled={toggleStatusMutation.isPending}
                          >
                            {(item.isActive as boolean) ? (
                              <UserX className="h-4 w-4 text-destructive" />
                            ) : (
                              <UserCheck className="h-4 w-4 text-green-600" />
                            )}
                          </Button>
                        )}
                        {isAdmin && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                setSoftDeleteDialog({
                                  id: item.id as string,
                                  name: (item.name as string) || "",
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4 ml-2" />
                              نقل إلى سلة المهملات
                            </DropdownMenuItem>
                              {service.hardDelete && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() =>
                                      setHardDeleteDialog({
                                        id: item.id as string,
                                        name: (item.name as string) || "",
                                      })
                                    }
                                  >
                                    <AlertTriangle className="h-4 w-4 ml-2" />
                                    حذف نهائي
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? "تعديل" : "إضافة جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {fields.map((field) => {
              const fieldValue = formData[field.name];
              const stringValue =
                typeof fieldValue === "string" ? fieldValue : "";

              return (
                <div key={field.name} className="space-y-2">
                  <Label>
                    {field.label} {field.required && "*"}
                  </Label>
                  {field.type === "tags" ? (
                    <TagsInput
                      value={Array.isArray(fieldValue) ? fieldValue : []}
                      onChange={(tags) =>
                        setFormData({
                          ...formData,
                          [field.name]: tags,
                        })
                      }
                      placeholder="أضف مكون واضغط Enter"
                    />
                  ) : field.type === "textarea" ? (
                    <Textarea
                      value={stringValue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          [field.name]: e.target.value,
                        })
                      }
                      required={field.required}
                    />
                  ) : field.type === "select" ? (
                    <Select
                      value={stringValue}
                      onValueChange={(value) =>
                        setFormData({ ...formData, [field.name]: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر..." />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                        {field.name === relatedService?.fieldName &&
                          relatedData?.map((item) => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={stringValue}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          [field.name]: e.target.value,
                        })
                      }
                      required={field.required}
                    />
                  )}
                </div>
              );
            })}
            {editingItem && (
              <div className="flex items-center space-x-2 space-x-reverse">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={
                    typeof formData.isActive === "boolean"
                      ? formData.isActive
                      : false
                  }
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor="isActive" className="cursor-pointer">
                  نشط
                </Label>
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
                {editingItem ? "حفظ" : "إضافة"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Soft Delete Dialog */}
      <Dialog open={!!softDeleteDialog} onOpenChange={() => setSoftDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              تأكيد النقل إلى سلة المهملات
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من نقل "{softDeleteDialog?.name}" إلى سلة المهملات؟ يمكنك استعادته لاحقاً.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSoftDeleteDialog(null)}>
              إلغاء
            </Button>
            <Button
              variant="default"
              onClick={() => {
                if (softDeleteDialog) {
                  deleteMutation.mutate(softDeleteDialog.id);
                  setSoftDeleteDialog(null);
                }
              }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
              نقل إلى سلة المهملات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hard Delete Dialog */}
      <Dialog open={!!hardDeleteDialog} onOpenChange={() => setHardDeleteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              تأكيد الحذف النهائي
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من الحذف النهائي لـ "{hardDeleteDialog?.name}"؟ هذا الإجراء لا يمكن
              التراجع عنه!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHardDeleteDialog(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (hardDeleteDialog && service.hardDelete) {
                  hardDeleteMutation.mutate(hardDeleteDialog.id);
                  setHardDeleteDialog(null);
                }
              }}
              disabled={hardDeleteMutation.isPending}
            >
              {hardDeleteMutation.isPending && (
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              )}
              حذف نهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
