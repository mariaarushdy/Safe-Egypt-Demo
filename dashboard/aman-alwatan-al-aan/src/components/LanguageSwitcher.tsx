import { Button } from "@/components/ui/button";
import { Languages } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

export const LanguageSwitcher = () => {
  const { language, setLanguage, t } = useLanguage();

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  const currentLanguageLabel = language === 'ar' ? t('common.arabic') : t('common.english');

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLanguage}
      className="gap-2 text-muted-foreground hover:text-foreground transition-all duration-200"
      title={`${t('common.language')}: ${currentLanguageLabel}`}
    >
      <Languages className="h-4 w-4" />
      <span className="hidden md:inline">
        {t('common.language')}: {currentLanguageLabel}
      </span>
      <span className="md:hidden">
        {language.toUpperCase()}
      </span>
    </Button>
  );
};