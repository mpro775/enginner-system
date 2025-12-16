import { NestFactory } from "@nestjs/core";
import { Model } from "mongoose";
import * as bcrypt from "bcryptjs";
import { AppModule } from "../app.module";
import { getModelToken } from "@nestjs/mongoose";
import { User } from "../modules/users/schemas/user.schema";
import { Location } from "../modules/locations/schemas/location.schema";
import { Department } from "../modules/departments/schemas/department.schema";
import { System } from "../modules/systems/schemas/system.schema";
import { Machine } from "../modules/machines/schemas/machine.schema";
import { MaintenanceRequest } from "../modules/maintenance-requests/schemas/maintenance-request.schema";
import { Role, RequestStatus, MaintenanceType } from "../common/enums";

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const userModel = app.get<Model<User>>(getModelToken(User.name));
  const locationModel = app.get<Model<Location>>(getModelToken(Location.name));
  const departmentModel = app.get<Model<Department>>(
    getModelToken(Department.name)
  );
  const systemModel = app.get<Model<System>>(getModelToken(System.name));
  const machineModel = app.get<Model<Machine>>(getModelToken(Machine.name));
  const requestModel = app.get<Model<MaintenanceRequest>>(
    getModelToken(MaintenanceRequest.name)
  );

  console.log("🌱 Starting seed...");

  // Clear existing data
  await Promise.all([
    userModel.deleteMany({}),
    locationModel.deleteMany({}),
    departmentModel.deleteMany({}),
    systemModel.deleteMany({}),
    machineModel.deleteMany({}),
    requestModel.deleteMany({}),
  ]);
  console.log("✓ Cleared existing data");

  // Create Departments
  const departments = await departmentModel.insertMany([
    { name: "ميكانيك", isActive: true },
    { name: "كهرباء", isActive: true },
  ]);
  console.log(`✓ Created ${departments.length} departments`);

  // Create Locations
  const locations = await locationModel.insertMany([
    {
      name: "كلية الحاسوب",
      description: "مبنى كلية الحاسوب وتقنية المعلومات",
      isActive: true,
    },
    { name: "كلية الهندسة", description: "مبنى كلية الهندسة", isActive: true },
    { name: "الورش", description: "ورش الصيانة والتصنيع", isActive: true },
    { name: "الإسكان", description: "مباني السكن الجامعي", isActive: true },
    {
      name: "المكتبة المركزية",
      description: "المكتبة المركزية للجامعة",
      isActive: true,
    },
    {
      name: "مبنى الإدارة",
      description: "مبنى الإدارة العامة",
      isActive: true,
    },
  ]);
  console.log(`✓ Created ${locations.length} locations`);

  // Create Systems
  const systems = await systemModel.insertMany([
    { name: "تكييف", description: "أنظمة التكييف والتبريد", isActive: true },
    {
      name: "حريق",
      description: "أنظمة إطفاء الحريق والإنذار",
      isActive: true,
    },
    { name: "مياه", description: "أنظمة المياه والصرف الصحي", isActive: true },
    { name: "كهرباء", description: "أنظمة الكهرباء والطاقة", isActive: true },
    { name: "مصاعد", description: "أنظمة المصاعد الكهربائية", isActive: true },
  ]);
  console.log(`✓ Created ${systems.length} systems`);

  // Create Machines for each System
  const acSystem = systems.find((s) => s.name === "تكييف");
  const fireSystem = systems.find((s) => s.name === "حريق");
  const waterSystem = systems.find((s) => s.name === "مياه");
  const electricSystem = systems.find((s) => s.name === "كهرباء");
  const elevatorSystem = systems.find((s) => s.name === "مصاعد");

  const machines = await machineModel.insertMany([
    // AC Machines
    {
      name: "تشيلر",
      systemId: acSystem!._id,
      description: "وحدة تبريد المياه",
      isActive: true,
    },
    {
      name: "AHU",
      systemId: acSystem!._id,
      description: "وحدة معالجة الهواء",
      isActive: true,
    },
    {
      name: "FCU",
      systemId: acSystem!._id,
      description: "وحدة ملف المروحة",
      isActive: true,
    },
    {
      name: "سبليت",
      systemId: acSystem!._id,
      description: "مكيف سبليت",
      isActive: true,
    },
    {
      name: "مكيف شباك",
      systemId: acSystem!._id,
      description: "مكيف شباك",
      isActive: true,
    },
    // Fire Machines
    {
      name: "مضخة حريق",
      systemId: fireSystem!._id,
      description: "مضخة إطفاء الحريق",
      isActive: true,
    },
    {
      name: "لوحة إنذار",
      systemId: fireSystem!._id,
      description: "لوحة الإنذار المركزية",
      isActive: true,
    },
    {
      name: "كاشف دخان",
      systemId: fireSystem!._id,
      description: "كاشف الدخان",
      isActive: true,
    },
    {
      name: "طفاية حريق",
      systemId: fireSystem!._id,
      description: "طفاية الحريق اليدوية",
      isActive: true,
    },
    // Water Machines
    {
      name: "مضخة مياه",
      systemId: waterSystem!._id,
      description: "مضخة رفع المياه",
      isActive: true,
    },
    {
      name: "خزان مياه",
      systemId: waterSystem!._id,
      description: "خزان تخزين المياه",
      isActive: true,
    },
    {
      name: "سخان مركزي",
      systemId: waterSystem!._id,
      description: "سخان المياه المركزي",
      isActive: true,
    },
    // Electric Machines
    {
      name: "مولد كهربائي",
      systemId: electricSystem!._id,
      description: "مولد الطاقة الاحتياطي",
      isActive: true,
    },
    {
      name: "UPS",
      systemId: electricSystem!._id,
      description: "وحدة الطاقة اللامنقطعة",
      isActive: true,
    },
    {
      name: "محول كهربائي",
      systemId: electricSystem!._id,
      description: "محول الجهد الكهربائي",
      isActive: true,
    },
    {
      name: "لوحة توزيع",
      systemId: electricSystem!._id,
      description: "لوحة التوزيع الكهربائية",
      isActive: true,
    },
    // Elevator Machines
    {
      name: "مصعد ركاب",
      systemId: elevatorSystem!._id,
      description: "مصعد نقل الركاب",
      isActive: true,
    },
    {
      name: "مصعد بضائع",
      systemId: elevatorSystem!._id,
      description: "مصعد نقل البضائع",
      isActive: true,
    },
  ]);
  console.log(`✓ Created ${machines.length} machines`);

  // Create Users
  const hashedPassword = await bcrypt.hash("123456", 12);

  const users = await userModel.insertMany([
    // Admin
    {
      name: "مدير النظام",
      email: "admin@maintenance.com",
      password: hashedPassword,
      role: Role.ADMIN,
      isActive: true,
    },
    // Consultants
    {
      name: "أحمد المستشار",
      email: "consultant1@maintenance.com",
      password: hashedPassword,
      role: Role.CONSULTANT,
      isActive: true,
    },
    {
      name: "محمد المستشار",
      email: "consultant2@maintenance.com",
      password: hashedPassword,
      role: Role.CONSULTANT,
      isActive: true,
    },
    // Engineers - Mechanical
    {
      name: "خالد المهندس",
      email: "engineer1@maintenance.com",
      password: hashedPassword,
      role: Role.ENGINEER,
      departmentId: departments[0]._id, // ميكانيك
      isActive: true,
    },
    {
      name: "عمر المهندس",
      email: "engineer2@maintenance.com",
      password: hashedPassword,
      role: Role.ENGINEER,
      departmentId: departments[0]._id, // ميكانيك
      isActive: true,
    },
    // Engineers - Electrical
    {
      name: "سعد المهندس",
      email: "engineer3@maintenance.com",
      password: hashedPassword,
      role: Role.ENGINEER,
      departmentId: departments[1]._id, // كهرباء
      isActive: true,
    },
    {
      name: "فهد المهندس",
      email: "engineer4@maintenance.com",
      password: hashedPassword,
      role: Role.ENGINEER,
      departmentId: departments[1]._id, // كهرباء
      isActive: true,
    },
    // Health Safety Supervisor
    {
      name: "علي مشرف الصحة والسلامة",
      email: "safety@maintenance.com",
      password: hashedPassword,
      role: Role.HEALTH_SAFETY_SUPERVISOR,
      isActive: true,
    },
  ]);
  console.log(`✓ Created ${users.length} users`);

  // Get users for requests
  const engineer1 = users.find((u) => u.email === "engineer1@maintenance.com");
  const engineer2 = users.find((u) => u.email === "engineer2@maintenance.com");
  const engineer3 = users.find((u) => u.email === "engineer3@maintenance.com");
  const consultant1 = users.find(
    (u) => u.email === "consultant1@maintenance.com"
  );

  // Get machines for requests
  const chiller = machines.find((m) => m.name === "تشيلر");
  const ahu = machines.find((m) => m.name === "AHU");
  const firePump = machines.find((m) => m.name === "مضخة حريق");
  const generator = machines.find((m) => m.name === "مولد كهربائي");
  const elevator = machines.find((m) => m.name === "مصعد ركاب");
  const waterPump = machines.find((m) => m.name === "مضخة مياه");

  // Create Maintenance Requests with different statuses
  const now = new Date();
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000);

  const requests = await requestModel.insertMany([
    // In Progress requests
    {
      requestCode: "EM-202412-0001",
      engineerId: engineer1!._id,
      maintenanceType: MaintenanceType.EMERGENCY,
      locationId: locations[0]._id, // كلية الحاسوب
      departmentId: departments[0]._id, // ميكانيك
      systemId: acSystem!._id,
      machineId: chiller!._id,
      reasonText: "توقف التشيلر عن العمل بشكل مفاجئ - يحتاج فحص عاجل",
      machineNumber: "CH-001",
      status: RequestStatus.IN_PROGRESS,
      engineerNotes: "تم الكشف المبدئي، يحتاج قطع غيار",
      openedAt: twoDaysAgo,
    },
    {
      requestCode: "PM-202412-0001",
      engineerId: engineer2!._id,
      maintenanceType: MaintenanceType.PREVENTIVE,
      locationId: locations[1]._id, // كلية الهندسة
      departmentId: departments[0]._id, // ميكانيك
      systemId: acSystem!._id,
      machineId: ahu!._id,
      reasonText: "صيانة دورية لوحدة معالجة الهواء",
      status: RequestStatus.IN_PROGRESS,
      openedAt: oneDayAgo,
    },
    {
      requestCode: "EM-202412-0002",
      engineerId: engineer3!._id,
      maintenanceType: MaintenanceType.EMERGENCY,
      locationId: locations[2]._id, // الورش
      departmentId: departments[1]._id, // كهرباء
      systemId: electricSystem!._id,
      machineId: generator!._id,
      reasonText: "المولد لا يعمل - انقطاع الكهرباء",
      machineNumber: "GEN-001",
      status: RequestStatus.IN_PROGRESS,
      consultantId: consultant1!._id,
      consultantNotes: "يرجى التأكد من مستوى الوقود والزيت قبل التشغيل",
      openedAt: now,
    },
    // Completed requests
    {
      requestCode: "PM-202412-0002",
      engineerId: engineer1!._id,
      maintenanceType: MaintenanceType.PREVENTIVE,
      locationId: locations[3]._id, // الإسكان
      departmentId: departments[0]._id, // ميكانيك
      systemId: waterSystem!._id,
      machineId: waterPump!._id,
      reasonText: "صيانة دورية لمضخة المياه",
      status: RequestStatus.COMPLETED,
      engineerNotes: "تم تغيير الفلاتر وتنظيف المضخة",
      openedAt: oneWeekAgo,
      closedAt: twoDaysAgo,
    },
    {
      requestCode: "EM-202412-0003",
      engineerId: engineer2!._id,
      maintenanceType: MaintenanceType.EMERGENCY,
      locationId: locations[4]._id, // المكتبة
      departmentId: departments[1]._id, // كهرباء
      systemId: fireSystem!._id,
      machineId: firePump!._id,
      reasonText: "عطل في مضخة الحريق - إنذار خاطئ",
      status: RequestStatus.COMPLETED,
      consultantId: consultant1!._id,
      consultantNotes: "تم الإصلاح بنجاح",
      openedAt: oneWeekAgo,
      closedAt: oneDayAgo,
    },
    // Stopped request
    {
      requestCode: "PM-202412-0003",
      engineerId: engineer3!._id,
      maintenanceType: MaintenanceType.PREVENTIVE,
      locationId: locations[5]._id, // مبنى الإدارة
      departmentId: departments[0]._id, // ميكانيك
      systemId: elevatorSystem!._id,
      machineId: elevator!._id,
      reasonText: "صيانة دورية للمصعد",
      status: RequestStatus.STOPPED,
      stopReason: "تم تأجيل الصيانة بسبب عدم توفر قطع الغيار المطلوبة",
      engineerNotes: "بانتظار وصول القطع من المورد",
      openedAt: twoDaysAgo,
      stoppedAt: oneDayAgo,
    },
  ]);
  console.log(`✓ Created ${requests.length} maintenance requests`);

  console.log("\n📋 Login Credentials:");
  console.log("─".repeat(50));
  console.log("Admin:      admin@maintenance.com / 123456");
  console.log("Consultant: consultant1@maintenance.com / 123456");
  console.log("Engineer:   engineer1@maintenance.com / 123456");
  console.log("─".repeat(50));

  console.log("\n✅ Seed completed successfully!");

  await app.close();
}

seed().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
