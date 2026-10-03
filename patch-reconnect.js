const fs = require("fs");

const file =
  "/usr/local/lib/node_modules/xiaozhi-client/node_modules/@xiaozhi-client/endpoint/dist/index.js";

console.log("======================================");
console.log("LEGIONNAIRE - AUTO RECONNECT PATCH");
console.log("======================================");

if (!fs.existsSync(file)) {
  console.error("ERRO: endpoint index.js não encontrado.");
  process.exit(1);
}

let code = fs.readFileSync(file, "utf8");

if (code.includes("LEGIONNAIRE_AUTO_RECONNECT")) {
  console.log("Patch de reconexão já aplicado.");
  process.exit(0);
}

/*
 * Procuramos a função real sem depender do texto chinês
 * nem de escapes Unicode.
 */
const pattern =
  /  handleConnectionClose\(code, reason\) \{\n    this\.connectionStatus = false;\n    this\.serverInitialized = false;\n    this\.connectionState = "disconnected" \/\* DISCONNECTED \*\/;\n    console\.info\([^\n]+\);\n  \}/;

const replacement = `  handleConnectionClose(code, reason) {
    this.connectionStatus = false;
    this.serverInitialized = false;
    this.connectionState = "disconnected" /* DISCONNECTED */;
    console.info(\`小智连接已关闭 (代码: \${code}, 原因: \${reason})\`);

    // LEGIONNAIRE_AUTO_RECONNECT
    if (code !== 1000 && !this.__legionnaireReconnectTimer) {
      const scheduleReconnect = () => {
        console.info("[LEGIONNAIRE] Reconexão automática agendada para 5 segundos...");

        this.__legionnaireReconnectTimer = setTimeout(async () => {
          this.__legionnaireReconnectTimer = null;

          if (this.connectionStatus) {
            console.info("[LEGIONNAIRE] Ligação já recuperada. Reconexão cancelada.");
            return;
          }

          console.info("[LEGIONNAIRE] A tentar reconectar ao Xiaozhi...");

          try {
            await this.reconnect();
            console.info("[LEGIONNAIRE] Reconexão Xiaozhi concluída.");
          } catch (error) {
            console.error("[LEGIONNAIRE] Falha na reconexão:", error);

            if (!this.connectionStatus) {
              scheduleReconnect();
            }
          }
        }, 5000);
      };

      scheduleReconnect();
    }
  }`;

if (!pattern.test(code)) {
  console.error("ERRO: handleConnectionClose não encontrado no formato esperado.");
  process.exit(1);
}

code = code.replace(pattern, replacement);

fs.writeFileSync(file, code, "utf8");

console.log("Patch de reconexão aplicado com sucesso.");
console.log("Quedas WebSocket anormais serão recuperadas automaticamente.");
console.log("Intervalo entre tentativas: 5 segundos.");
console.log("======================================");
