import ReferenceDataManagement from "./ReferenceDataManagement";
import {
  locationsService,
  departmentsService,
  systemsService,
  machinesService,
} from "@/services/reference-data";

export function LocationsPage() {
  return (
    <ReferenceDataManagement
      title="إدارة المواقع"
      description="إضافة وتعديل مواقع العمل"
      service={locationsService as never}
      queryKey="locations"
      fields={[
        { name: "name", label: "اسم الموقع", type: "text", required: true },
        { name: "description", label: "الوصف", type: "textarea" },
      ]}
      columns={[
        { key: "name", label: "الاسم" },
        { key: "description", label: "الوصف" },
      ]}
    />
  );
}

export function DepartmentsPage() {
  return (
    <ReferenceDataManagement
      title="إدارة الأقسام"
      description="إضافة وتعديل أقسام العمل"
      service={departmentsService as never}
      queryKey="departments"
      fields={[
        { name: "name", label: "اسم القسم", type: "text", required: true },
      ]}
      columns={[{ key: "name", label: "الاسم" }]}
    />
  );
}

export function SystemsPage() {
  return (
    <ReferenceDataManagement
      title="إدارة الأنظمة"
      description="إضافة وتعديل الأنظمة الفنية"
      service={systemsService as never}
      queryKey="systems"
      fields={[
        { name: "name", label: "اسم النظام", type: "text", required: true },
        { name: "description", label: "الوصف", type: "textarea" },
      ]}
      columns={[
        { key: "name", label: "الاسم" },
        { key: "description", label: "الوصف" },
      ]}
    />
  );
}

export function MachinesPage() {
  return (
    <ReferenceDataManagement
      title="إدارة الآلات"
      description="إضافة وتعديل الآلات والمعدات"
      service={machinesService as never}
      queryKey="machines"
      fields={[
        { name: "name", label: "اسم الآلة", type: "text", required: true },
        { name: "systemId", label: "النظام", type: "select", required: true },
        { name: "description", label: "الوصف", type: "textarea" },
        { name: "components", label: "مكونات الآلة", type: "tags" },
      ]}
      columns={[
        { key: "name", label: "الاسم" },
        { key: "systemId", label: "النظام" },
        { key: "description", label: "الوصف" },
        { key: "components", label: "المكونات" },
      ]}
      relatedService={{
        getAll: systemsService.getAll,
        queryKey: "systems",
        fieldName: "systemId",
      }}
    />
  );
}

export { default as UsersManagement } from "./UsersManagement";
export { default as AuditLogs } from "./AuditLogs";
