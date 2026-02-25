import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/services/firebase';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const { slug } = params;

  if (!slug) {
    return NextResponse.json({ error: 'Slug inválido' }, { status: 400 });
  }

  // Normalizar slug (remover caracteres especiais, converter para minúsculas)
  const normalizedSlug = slug
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!normalizedSlug) {
    return NextResponse.json({ error: 'Slug inválido' }, { status: 400 });
  }

  try {
    // Buscar o link no Firestore
    const docRef = adminDb.collection('attachmentLinks').doc(normalizedSlug);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: 'Link não encontrado' }, { status: 404 });
    }

    const data = doc.data();
    const url = data?.url;

    if (!url) {
      return NextResponse.json({ error: 'URL não configurada' }, { status: 404 });
    }

    // Redirecionar para a URL original
    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.error('Erro no redirect API:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
