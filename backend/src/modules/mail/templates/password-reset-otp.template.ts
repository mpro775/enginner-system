function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };
    return entities[character];
  });
}

export function passwordResetOtpTemplate(input: {
  name?: string;
  otp: string;
  expiresInMinutes: number;
}): string {
  const greeting = input.name
    ? `مرحباً ${escapeHtml(input.name)}،`
    : 'مرحباً،';

  return `<!doctype html>
<html lang="ar" dir="rtl">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
  <body style="margin:0;background:#f4f7fb;font-family:Tahoma,Arial,sans-serif;color:#172033">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:24px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border-radius:16px;border:1px solid #e5eaf1;overflow:hidden">
          <tr><td style="background:#164e63;color:#fff;padding:24px;text-align:center;font-size:20px;font-weight:bold">نظام إدارة طلبات الصيانة</td></tr>
          <tr><td style="padding:28px;line-height:1.8">
            <p style="margin:0 0 16px">${greeting}</p>
            <p>استخدم رمز التحقق التالي لإكمال إعادة تعيين كلمة المرور:</p>
            <div style="direction:ltr;letter-spacing:10px;text-align:center;font-size:34px;font-weight:bold;color:#164e63;background:#ecfeff;border-radius:12px;padding:18px;margin:22px 0">${escapeHtml(input.otp)}</div>
            <p>ينتهي الرمز خلال <strong>${input.expiresInMinutes} دقائق</strong>.</p>
            <p style="color:#9f1239">لا تشارك هذا الرمز مع أي شخص، ولن يطلبه منك فريق النظام.</p>
            <p style="color:#64748b;font-size:13px">إذا لم تطلب إعادة تعيين كلمة المرور، فتجاهل هذه الرسالة.</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
