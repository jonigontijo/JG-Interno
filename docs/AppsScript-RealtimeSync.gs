/**
 * ============================================================
 * JG Interno — Sync em TEMPO REAL da planilha → sistema
 * ------------------------------------------------------------
 * Dispara no instante que QUALQUER célula é editada na planilha
 * e avisa o JG Interno na hora (sem atraso).
 *
 * COMO INSTALAR (uma vez):
 *  1) Na planilha: menu  Extensões → Apps Script
 *  2) Apague o conteúdo e cole TODO este arquivo
 *  3) Salve (ícone de disquete)
 *  4) No topo, selecione a função  setupTrigger  e clique em ▶ Executar
 *  5) Autorize o acesso quando o Google pedir (é a sua conta)
 *  6) Pronto! A partir de agora toda edição reflete no sistema na hora.
 * ============================================================
 */

// ⚙️ Configuração (já preenchida para o seu projeto)
const JG_WEBHOOK_URL = "https://igmwcdeuqoudrwsmwgpl.supabase.co/functions/v1/google-sheets-edit-hook";
// ⚠️ Cole aqui o "Segredo (x-jg-secret)" de: Sistema → Integração IA & Webhooks
const JG_SECRET = "COLE_O_CALLBACK_SECRET_AQUI";

/**
 * Cria o gatilho instalável onEdit (rode UMA vez, manualmente).
 */
function setupTrigger() {
  // remove gatilhos antigos desta função para não duplicar
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "jgOnEdit") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("jgOnEdit")
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  Logger.log("Gatilho de sync em tempo real instalado com sucesso!");
}

/**
 * Disparada automaticamente a cada edição. Envia a mudança ao JG Interno.
 */
function jgOnEdit(e) {
  try {
    if (!e || !e.range) return;
    var range = e.range;
    var sheet = range.getSheet();

    // lê os valores editados (suporta edição de uma célula ou de um bloco/colar)
    var raw = range.getValues();
    var values = raw.map(function (row) {
      return row.map(function (v) {
        if (v === null || v === undefined) return "";
        if (Object.prototype.toString.call(v) === "[object Date]") {
          return Utilities.formatDate(v, Session.getScriptTimeZone(), "dd/MM/yyyy");
        }
        return String(v);
      });
    });

    var payload = {
      secret: JG_SECRET,
      tab: sheet.getName(),
      startRow: range.getRow(),     // 1-based
      startCol: range.getColumn(),  // 1-based
      values: values
    };

    UrlFetchApp.fetch(JG_WEBHOOK_URL, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (err) {
    Logger.log("Erro no jgOnEdit: " + err);
  }
}

/**
 * (Opcional) Testa a conexão manualmente — rode e veja o Log (Ctrl+Enter).
 */
function testarConexao() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var resp = UrlFetchApp.fetch(JG_WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify({
      secret: JG_SECRET,
      tab: sheet.getName(),
      startRow: 1,
      startCol: 1,
      values: [[sheet.getRange(1, 1).getValue() || ""]]
    }),
    muteHttpExceptions: true
  });
  Logger.log("Status: " + resp.getResponseCode() + " | Resposta: " + resp.getContentText());
}
