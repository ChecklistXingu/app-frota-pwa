#!/usr/bin/env pwsh

# Script de deploy para App Frota PWA
Write-Host "Iniciando deploy do App Frota PWA..." -ForegroundColor Yellow

# Verifica se esta na pasta correta
if (-not (Test-Path "package.json")) {
    Write-Host "Execute este script na raiz do projeto" -ForegroundColor Red
    exit 1
}

# Build do projeto
Write-Host "Build do projeto..." -ForegroundColor Blue
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "Falha no build" -ForegroundColor Red
    exit 1
}

Write-Host "Build concluido!" -ForegroundColor Green

# Verifica arquivos gerados
if (-not (Test-Path "dist\sw.js")) {
    Write-Host "Service Worker nao gerado" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "dist\manifest.webmanifest")) {
    Write-Host "Manifest nao gerado" -ForegroundColor Red
    exit 1
}

Write-Host "Arquivos PWA gerados:" -ForegroundColor Green
Write-Host "  - Service Worker: dist/sw.js" -ForegroundColor Cyan
Write-Host "  - Manifest: dist/manifest.webmanifest" -ForegroundColor Cyan

# Deploy para Vercel (se tiver CLI instalado)
if (Get-Command vercel -ErrorAction SilentlyContinue) {
    Write-Host "Fazendo deploy para Vercel..." -ForegroundColor Blue
    vercel --prod
} else {
    Write-Host "Vercel CLI nao encontrado. Faca deploy manual:" -ForegroundColor Yellow
    Write-Host "  1. Envie a pasta 'dist' para seu hosting" -ForegroundColor Cyan
    Write-Host "  2. Configure rewrites para SPA" -ForegroundColor Cyan
}

Write-Host "Deploy concluido!" -ForegroundColor Green
Write-Host "URL: https://app-frota-pwa.vercel.app" -ForegroundColor Cyan
Write-Host "Teste offline usando DevTools Application Service Workers" -ForegroundColor Cyan
