#!/usr/bin/env node
import { readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_BASE_URL = "https://app-frota-pwa.vercel.app";
const APP_BASE_URL = process.env.APP_BASE_URL || DEFAULT_BASE_URL;
const SERVICE_ACCOUNT_PATH =
  process.env.SERVICE_ACCOUNT_PATH || path.resolve(__dirname, "serviceAccountKey.json");

const slugify = (value = "") =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]/g, "");

const createAttachmentSlugBase = (plate = "", maintenanceId = "") => {
  const sanitizedPlate = slugify(plate || "");
  if (sanitizedPlate) return `orcamento${sanitizedPlate}`;
  const fallback = slugify(maintenanceId).slice(-6) || "file";
  return `orcamento${fallback}`;
};

const ensureServiceAccount = async () => {
  try {
    const file = await readFile(SERVICE_ACCOUNT_PATH, "utf-8");
    return JSON.parse(file);
  } catch (error) {
    console.error("❌ Não foi possível ler o serviceAccountKey.json:", error.message);
    console.error(
      "Informe o caminho via variável SERVICE_ACCOUNT_PATH ou coloque o arquivo na pasta scripts/."
    );
    process.exit(1);
  }
};

const loadVehiclesMap = async (db) => {
  const snap = await db.collection("vehicles").get();
  const map = new Map();
  snap.forEach((doc) => {
    const data = doc.data() || {};
    const plate =
      data.plate ||
      data.placa ||
      data.licensePlate ||
      data.vehiclePlate ||
      data.identificador ||
      "";
    map.set(doc.id, plate || "");
  });
  return map;
};

const getShortUrl = (slug) => `${APP_BASE_URL}/o/${slug}`;

const processMaintenanceDocs = async (db) => {
  const vehiclesMap = await loadVehiclesMap(db);
  const maintenanceSnap = await db.collection("maintenance").get();

  let processedDocs = 0;
  let updatedDocs = 0;
  let totalLinksCreated = 0;

  console.log(`🔍 Verificando ${maintenanceSnap.size} documentos de manutenção...`);

  for (const doc of maintenanceSnap.docs) {
    processedDocs += 1;
    const data = doc.data() || {};
    const directorApproval = data.directorApproval;
    if (!directorApproval?.attachments?.length) continue;

    const vehicleId = data.vehicleId || "";
    const vehiclePlate = vehiclesMap.get(vehicleId) || vehicleId || doc.id;
    const slugBase = createAttachmentSlugBase(vehiclePlate, doc.id);

    let changed = false;
    const updatedAttachments = [];

    for (let index = 0; index < directorApproval.attachments.length; index += 1) {
      const attachment = directorApproval.attachments[index];
      if (!attachment || typeof attachment !== "object") {
        updatedAttachments.push(attachment);
        continue;
      }

      if (!attachment.url) {
        updatedAttachments.push(attachment);
        continue;
      }

      if (attachment.shortUrl && attachment.slug) {
        updatedAttachments.push(attachment);
        continue;
      }

      const slug = attachment.slug || `${slugBase}-${index + 1}`;
      const shortUrl = getShortUrl(slug);

      await db
        .collection("attachmentLinks")
        .doc(slug)
        .set(
          {
            slug,
            url: attachment.url,
            maintenanceId: doc.id,
            attachmentName: attachment.name || `Anexo ${index + 1}`,
            vehiclePlate: vehiclePlate || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: "rebuild-attachment-links-script",
          },
          { merge: true }
        );

      updatedAttachments.push({
        ...attachment,
        slug,
        shortUrl,
      });

      changed = true;
      totalLinksCreated += 1;
      console.log(`✅ ${doc.id} :: anexo ${index + 1} recebeu slug ${slug}`);
    }

    if (changed) {
      await doc.ref.update({
        "directorApproval.attachments": updatedAttachments,
      });
      updatedDocs += 1;
    }
  }

  console.log("\n📊 Resultado:");
  console.log(`   • Documentos verificados: ${processedDocs}`);
  console.log(`   • Documentos atualizados: ${updatedDocs}`);
  console.log(`   • Novos links curtos gerados: ${totalLinksCreated}`);
};

const main = async () => {
  const serviceAccount = await ensureServiceAccount();
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const db = admin.firestore();

  try {
    await processMaintenanceDocs(db);
    console.log("\n🎉 Reprocessamento concluído!");
  } catch (error) {
    console.error("❌ Erro no reprocessamento:", error);
    process.exitCode = 1;
  } finally {
    await admin.app().delete();
  }
};

main();
