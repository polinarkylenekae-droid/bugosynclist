#!/usr/bin/env pwsh
# Quick Development Server Runner - Automatically navigates to correct directory

Write-Host "🚀 Starting Barangay Bugo Development Server..." -ForegroundColor Green
Write-Host "📍 Server will be available at: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""

Set-Location -Path "BugoSyncList2026-main"
npm run dev
