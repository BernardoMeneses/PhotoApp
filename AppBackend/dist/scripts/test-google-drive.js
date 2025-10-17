"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const google_drive_1 = require("../config/google-drive");
async function testGoogleDriveSetup() {
    console.log("🔍 Iniciando teste do Google Drive...\n");
    try {
        console.log("1️⃣ Testando autenticação...");
        const aboutResponse = await google_drive_1.drive.about.get({
            fields: "user(displayName, emailAddress), storageQuota",
        });
        console.log("   ✅ Autenticação bem-sucedida!");
        console.log(`   👤 Conta: ${aboutResponse.data.user?.emailAddress}`);
        console.log(`   📛 Nome: ${aboutResponse.data.user?.displayName}\n`);
        console.log("2️⃣ Verificando pasta da aplicação...");
        const searchResponse = await google_drive_1.drive.files.list({
            q: `name='${google_drive_1.APP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
            fields: "files(id, name, webViewLink)",
            spaces: "drive",
        });
        let folderId;
        let folderLink;
        if (searchResponse.data.files && searchResponse.data.files.length > 0) {
            folderId = searchResponse.data.files[0].id;
            folderLink = searchResponse.data.files[0].webViewLink;
            console.log(`   ✅ Pasta "${google_drive_1.APP_FOLDER_NAME}" já existe!`);
        }
        else {
            console.log(`   📁 Criando pasta "${google_drive_1.APP_FOLDER_NAME}"...`);
            const folderMetadata = {
                name: google_drive_1.APP_FOLDER_NAME,
                mimeType: "application/vnd.google-apps.folder",
            };
            const folder = await google_drive_1.drive.files.create({
                requestBody: folderMetadata,
                fields: "id, webViewLink",
            });
            folderId = folder.data.id;
            folderLink = folder.data.webViewLink;
            console.log(`   ✅ Pasta "${google_drive_1.APP_FOLDER_NAME}" criada com sucesso!`);
        }
        console.log(`   🔗 Link: ${folderLink}`);
        console.log(`   🆔 ID: ${folderId}\n`);
        console.log("3️⃣ Listando conteúdo da pasta...");
        const filesResponse = await google_drive_1.drive.files.list({
            q: `'${folderId}' in parents and trashed=false`,
            fields: "files(id, name, mimeType, createdTime)",
            spaces: "drive",
        });
        if (filesResponse.data.files && filesResponse.data.files.length > 0) {
            console.log(`   📂 Encontrados ${filesResponse.data.files.length} itens:`);
            filesResponse.data.files.forEach((file) => {
                const type = file.mimeType?.includes("folder") ? "📁" : "📄";
                console.log(`      ${type} ${file.name}`);
            });
        }
        else {
            console.log(`   📂 Pasta vazia (nenhum utilizador ainda)`);
        }
        console.log("\n✅ Todos os testes passaram!");
        console.log("🎉 O Google Drive está configurado corretamente!\n");
    }
    catch (error) {
        console.error("\n❌ Erro durante o teste:");
        if (error.code === 403) {
            console.error("   🔒 Erro de permissões - Google Drive API pode não estar ativa");
            console.error("   📝 Solução: Ativa a API em:");
            console.error("   🔗 https://console.cloud.google.com/apis/library/drive.googleapis.com");
        }
        else if (error.code === 401) {
            console.error("   🔑 Erro de autenticação - Verifica as credenciais");
            console.error("   📝 Verifica o ficheiro: GOOGLE_APPLICATION_CREDENTIALS");
        }
        else {
            console.error(`   💥 ${error.message}`);
        }
        console.error("\n📚 Stack trace:", error);
        process.exit(1);
    }
}
testGoogleDriveSetup()
    .then(() => process.exit(0))
    .catch((err) => {
    console.error("💥 Erro fatal:", err);
    process.exit(1);
});
//# sourceMappingURL=test-google-drive.js.map