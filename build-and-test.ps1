#!/usr/bin/env pwsh

# Script para build e teste do PWA offline
Write-Host "🚀 Construindo App Frota PWA..." -ForegroundColor Yellow

# Limpa build anterior
if (Test-Path "dist") {
    Remove-Item "dist" -Recurse -Force
    Write-Host "🧹 Limpando build anterior..." -ForegroundColor Green
}

# Build do projeto
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Falha no build" -ForegroundColor Red
    exit 1
}

Write-Host "✅ Build concluído com sucesso!" -ForegroundColor Green

# Verifica se service worker foi gerado
$swPath = "dist\sw.js"
if (Test-Path $swPath) {
    Write-Host "✅ Service Worker gerado em $swPath" -ForegroundColor Green
    
    # Verifica conteúdo do service worker
    $swContent = Get-Content $swPath -Raw
    if ($swContent -match "workbox") {
        Write-Host "✅ Service Worker usa Workbox" -ForegroundColor Green
    } else {
        Write-Host "⚠️ Service Worker não contém Workbox" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ Service Worker não encontrado" -ForegroundColor Red
    exit 1
}

# Verifica manifest
$manifestPath = "dist\manifest.webmanifest"
if (Test-Path $manifestPath) {
    Write-Host "✅ Manifest gerado em $manifestPath" -ForegroundColor Green
} else {
    Write-Host "❌ Manifest não encontrado" -ForegroundColor Red
    exit 1
}

Write-Host "🌐 Iniciando servidor de teste..." -ForegroundColor Yellow
Write-Host "Acesse http://localhost:4173 para testar" -ForegroundColor Cyan
Write-Host "Use as ferramentas de desenvolvedor para testar modo offline" -ForegroundColor Cyan

# Inicia servidor de preview
npm run preview
