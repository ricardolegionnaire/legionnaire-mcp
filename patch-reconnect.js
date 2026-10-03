const fs = require("fs");

const file =
  "/usr/local/lib/node_modules/xiaozhi-client/node_modules/@xiaozhi-client/endpoint/dist/index.js";

console.log("======================================");
console.log("LEGIONNAIRE - AUTO RECONNECT PATCH");
console.log("======================================");

if (!fs.existsSync(file)) {
  console.error("ERRO: endpoint index.js não encontrado");
  process.exit(1);
}

let code = fs.readFileSync(file, "utf8");

if (code.includes("LEGIONNAIRE_AUTO_RECONNECT")) {
  console.log("Patch de reconexão já aplicado.");
  process.exit(0);
}

const original = `  handleConnectionClose(code, reason) {
    this.connectionStatus = false;
    this.serverInitialized = false;
    this.connectionState = "disconnected" /* DISCONNECTED */;
    console.info(\`\\\\u5C0F\\\\u667A\\\\u8FDE\\\\u63A5\\\\u5DF2\\\\u5173\\\\u95ED (\\\\u4EE3\\\\u7801: \${code}, \\\\u539F\\\\u56E0: \${reason})\`);
  }`;

const replacement = `  handleConnectionClose(code, reason) {
    this.connectionStatus = false;
    this.serverInitialized = false;
    this.connectionState = "disconnected" /* DISCONNECTED */;
    console.info(\`\\\\u5C0F\\\\u667A\\\\u8FDE\\\\u63A5\\\\u5DF2\\\\u5173\\\\u95ED (\\\\u4EE3\\\\u7801: \${code}, \\\\u539F\\\\u56E0: \${reason})\`);

    // LEGIONNAIRE_AUTO_RECONNECT
    if (code !== 1000) {
      console.info("[LEGIONNAIRE] Ligação Xiaozhi perdida. Reconexão automática em 5 segundos...");

      setTimeout(() => {
        if (!this.connectionStatus) {
          console.info("[LEGIONNAIRE] A tentar reconectar ao Xiaozhi...");

          this.reconnect()
            .then(() => {
              console.info("[LEGIONNAIRE] Reconexão Xiaozhi concluída.");
            })
            .catch((error) => {
              console.error("[LEGIONNAIRE] Falha na reconexão automática:", error);
            });
        }
      }, 5000);
    }
  }`;

if (!code.includes(original)) {
  console.error("ERRO: bloco handleConnectionClose não encontrado.");
  console.error("O xiaozhi-client pode ter mudado de versão.");
  process.exit(1);
}

code = code.replace(original, replacement);

fs.writeFileSync(file, code, "utf8");

console.log("Patch de reconexão aplicado com sucesso.");
console.log("Erro WebSocket != 1000 -> reconnect automático.");
console.log("Espera inicial: 5 segundos.");
console.log("======================================");
