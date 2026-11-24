#!/usr/bin/env pwsh
# Quick Test Runner - Automatically navigates to correct directory and runs tests

Write-Host "🧪 Running Barangay Bugo Test Suite..." -ForegroundColor Cyan
Write-Host ""

Set-Location -Path "BugoSyncList2026-main"
npm test

Set-Location -Path ".."
