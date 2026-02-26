const admin = require('firebase-admin');

// Inicializar Firebase Admin
if (!admin.apps.length) {
  // Usar variáveis de ambiente na Vercel
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT 
    ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    : null;

  admin.initializeApp({
    credential: serviceAccount 
      ? admin.credential.cert(serviceAccount)
      : admin.credential.applicationDefault(),
    projectId: process.env.FIREBASE_PROJECT_ID || 'app-frota-1ce38'
  });
}

const db = admin.firestore();

module.exports = async (req, res) => {
  // Adicionar CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { slug } = req.query;

  if (!slug) {
    res.status(400).json({ error: 'Slug inválido' });
    return;
  }

  // Normalizar slug
  const normalizedSlug = slug
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!normalizedSlug) {
    res.status(400).json({ error: 'Slug inválido' });
    return;
  }

  try {
    // Buscar no Firestore
    const docRef = db.collection('attachmentLinks').doc(normalizedSlug);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      res.status(404).json({ error: 'Link não encontrado' });
      return;
    }

    const data = docSnap.data();
    const url = data?.url;

    if (!url) {
      res.status(404).json({ error: 'URL não configurada' });
      return;
    }

    // Redirecionar
    res.writeHead(302, { Location: url });
    res.end();
  } catch (error) {
    console.error('Erro no redirect:', error);
    res.status(500).json({ error: 'Erro interno' });
  }
};
