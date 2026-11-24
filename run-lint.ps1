#!/usr/bin/env pwsh
# Quick TypeScript Type Checker - Automatically navigates to correct directory

Write-Host "🔍 Running TypeScript Type Check..." -ForegroundColor Magenta
Write-Host ""

Set-Location -Path "BugoSyncList2026-main"
npm run lint

Set-Location -Path ".."
