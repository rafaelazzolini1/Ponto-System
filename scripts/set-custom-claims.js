// scripts/set-custom-claims.js
// Rode com: node scripts/set-custom-claims.js
//
// Dependências: npm install firebase-admin dotenv

const admin = require("firebase-admin");
require("dotenv").config({ path: ".env.local" });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();
const auth = admin.auth();

async function setCustomClaims() {
  console.log("🔄 Buscando usuários na coleção 'users'...");

  const snapshot = await db.collection("users").get();

  if (snapshot.empty) {
    console.log("❌ Nenhum usuário encontrado.");
    return;
  }

  let sucesso = 0;
  let falha = 0;

  for (const doc of snapshot.docs) {
    const userData = doc.data();
    const { uid, role, nome } = userData;

    if (!uid) {
      console.warn(`⚠️  CPF ${doc.id} (${nome}) — sem campo 'uid', pulando.`);
      falha++;
      continue;
    }

    if (!role) {
      console.warn(`⚠️  CPF ${doc.id} (${nome}) — sem campo 'role', pulando.`);
      falha++;
      continue;
    }

    try {
      // Seta o custom claim com a role do usuário
      await auth.setCustomUserClaims(uid, { role });
      console.log(`✅ ${nome} (${doc.id}) → role: "${role}"`);
      sucesso++;
    } catch (err) {
      console.error(`❌ Erro ao setar claim para ${nome} (${doc.id}):`, err.message);
      falha++;
    }
  }

  console.log(`\n📊 Resultado: ${sucesso} atualizados, ${falha} com falha.`);
  console.log("⚠️  Os usuários precisam fazer login novamente para o novo token ser emitido.");
  process.exit(0);
}

setCustomClaims().catch((err) => {
  console.error("Erro fatal:", err);
  process.exit(1);
});