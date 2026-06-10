import PageHeader from "@/components/PageHeader";
import AIIntegrationSettings from "@/components/settings/AIIntegrationSettings";
import GoogleSheetsIntegration from "@/components/settings/GoogleSheetsIntegration";

export default function AIIntegrationPage() {
  return (
    <div>
      <PageHeader
        title="Integração IA & Webhooks"
        description="Configure tokens de IA, a URL de callback, webhooks por evento e a sincronização com Google Sheets"
      />
      <div className="space-y-6">
        <GoogleSheetsIntegration />
        <AIIntegrationSettings />
      </div>
    </div>
  );
}
