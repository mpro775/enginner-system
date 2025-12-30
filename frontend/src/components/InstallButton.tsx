import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // التحقق من دعم PWA
    const checkSupport = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const isAndroid = /Android/.test(navigator.userAgent);
      
      setIsSupported(!isStandalone && (isAndroid || isIOS || 'serviceWorker' in navigator));
    };

    checkSupport();

    // التحقق من التثبيت
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    if (localStorage.getItem('pwa-installed') === 'true') {
      setIsInstalled(true);
      return;
    }

    // الاستماع لحدث beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log('beforeinstallprompt event fired');
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // الاستماع لحدث التثبيت
    window.addEventListener('appinstalled', () => {
      console.log('App installed');
      setIsInstalled(true);
      setDeferredPrompt(null);
      localStorage.setItem('pwa-installed', 'true');
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      console.log('No deferred prompt available');
      return;
    }

    try {
      // عرض نافذة التثبيت
      await deferredPrompt.prompt();

      // انتظار رد المستخدم
      const { outcome } = await deferredPrompt.userChoice;

      console.log('User choice:', outcome);

      if (outcome === 'accepted') {
        setIsInstalled(true);
        localStorage.setItem('pwa-installed', 'true');
      }

      // مسح الـ prompt
      setDeferredPrompt(null);
    } catch (error) {
      console.error('Error showing install prompt:', error);
    }
  };

  // عدم إظهار الزر إذا كان التطبيق مثبتاً أو غير مدعوم
  if (isInstalled || !isSupported) {
    return null;
  }

  // إظهار الزر حتى لو لم يكن هناك prompt (للمستخدمين على Android)
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-9 w-9 sm:h-10 sm:w-10 text-muted-foreground hover:text-foreground"
      onClick={handleInstallClick}
      title="تثبيت التطبيق"
      disabled={!deferredPrompt}
    >
      <Download className="h-5 w-5" />
      <span className="sr-only">تثبيت التطبيق</span>
    </Button>
  );
}


