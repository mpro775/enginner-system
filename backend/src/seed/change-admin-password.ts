import { NestFactory } from "@nestjs/core";
import { Model } from "mongoose";
import * as bcrypt from "bcryptjs";
import { AppModule } from "../app.module";
import { getModelToken } from "@nestjs/mongoose";
import { User } from "../modules/users/schemas/user.schema";

async function changeAdminPassword() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>(getModelToken(User.name));

  // كلمة المرور الجديدة - قم بتغييرها حسب رغبتك
  const NEW_PASSWORD = "Admin@2025";

  console.log("🔐 جاري تغيير كلمة مرور المدير...");

  // البحث عن المدير
  const admin = await userModel.findOne({ email: "admin@maintenance.com" });

  if (!admin) {
    console.log("❌ لم يتم العثور على حساب المدير (admin@maintenance.com)");
    await app.close();
    return;
  }

  // تشفير كلمة المرور الجديدة
  const hashedPassword = await bcrypt.hash(NEW_PASSWORD, 12);

  // تحديث كلمة المرور
  await userModel.updateOne(
    { email: "admin@maintenance.com" },
    {
      $set: { password: hashedPassword, refreshToken: null },
      $inc: { authVersion: 1 },
    }
  );

  console.log("✅ تم تغيير كلمة مرور المدير بنجاح!");
  console.log("📧 البريد الإلكتروني: admin@maintenance.com");

  await app.close();
}

changeAdminPassword().catch((error) => {
  console.error("❌ خطأ:", error);
  process.exit(1);
});
