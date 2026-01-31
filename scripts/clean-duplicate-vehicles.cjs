// Script para limpar veículos duplicados no Firestore
// Execute com: node scripts/clean-duplicate-vehicles.js

const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs, query, orderBy, deleteDoc, doc } = require('firebase/firestore');

// Configuração do Firebase - usando as mesmas credenciais do app
const firebaseConfig = {
  apiKey: "AIzaSyBV8uxPwRqfI-1wFCA2Me1jWcdvpLVL-CQ",
  authDomain: "app-frota-1ce38.firebaseapp.com",
  projectId: "app-frota-1ce38",
  storageBucket: "app-frota-1ce38.firebasestorage.app",
  messagingSenderId: "251084236580",
  appId: "1:251084236580:web:68bbeca5a23f59ad99b5b1"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function cleanDuplicateVehicles() {
  console.log('🔍 Buscando todos os veículos...');
  
  const vehiclesRef = collection(db, 'vehicles');
  const q = query(vehiclesRef, orderBy('plate'));
  const snapshot = await getDocs(q);
  
  const vehicles = [];
  snapshot.forEach(doc => {
    vehicles.push({
      id: doc.id,
      ...doc.data()
    });
  });
  
  console.log(`📊 Encontrados ${vehicles.length} veículos no total`);
  
  // Agrupar por placa
  const plateGroups = {};
  vehicles.forEach(vehicle => {
    const plate = vehicle.plate;
    if (!plateGroups[plate]) {
      plateGroups[plate] = [];
    }
    plateGroups[plate].push(vehicle);
  });
  
  // Encontrar duplicatas
  const duplicates = [];
  Object.keys(plateGroups).forEach(plate => {
    if (plateGroups[plate].length > 1) {
      duplicates.push(plateGroups[plate]);
    }
  });
  
  console.log(`🚨 Encontrados ${duplicates.length} grupos de veículos duplicados`);
  
  if (duplicates.length === 0) {
    console.log('✅ Nenhuma duplicata encontrada!');
    return;
  }
  
  // Para cada grupo de duplicatas, manter o mais recente e excluir os outros
  for (const duplicateGroup of duplicates) {
    console.log(`\n📍 Processando placa: ${duplicateGroup[0].plate}`);
    
    // Ordenar por createdAt (mais recente primeiro)
    duplicateGroup.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
      return dateB - dateA;
    });
    
    // Manter o primeiro (mais recente) e excluir os outros
    const toKeep = duplicateGroup[0];
    const toDelete = duplicateGroup.slice(1);
    
    console.log(`   ✅ Manter: ${toKeep.id} (${toKeep.createdAt?.toDate ? toKeep.createdAt.toDate().toLocaleString() : 'sem data'})`);
    
    // Verificar se o veículo a manter tem referências antes de excluir outros
    for (const vehicle of toDelete) {
      console.log(`   🗑️  Excluir: ${vehicle.id} (${vehicle.createdAt?.toDate ? vehicle.createdAt.toDate().toLocaleString() : 'sem data'})`);
      
      try {
        await deleteDoc(doc(db, 'vehicles', vehicle.id));
        console.log(`      ✅ Excluído com sucesso`);
      } catch (error) {
        console.error(`      ❌ Erro ao excluir:`, error);
      }
    }
  }
  
  console.log('\n🎉 Limpeza concluída!');
  console.log('📋 Resumo:');
  console.log(`   - Veículos totais: ${vehicles.length}`);
  console.log(`   - Grupos duplicados: ${duplicates.length}`);
  console.log(`   - Veículos excluídos: ${duplicates.reduce((sum, group) => sum + group.length - 1, 0)}`);
}

cleanDuplicateVehicles().catch(console.error);
