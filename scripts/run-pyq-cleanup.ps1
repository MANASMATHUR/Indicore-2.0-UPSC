# PYQ Database Cleanup Script
# This script runs the PYQ cleanup endpoint

param(
    [switch]$DryRun = $true,
    [string]$BaseUrl = "http://localhost:3000",
    [string]$AdminKey = ""
)

Write-Host "=== PYQ Database Cleanup ===" -ForegroundColor Cyan
Write-Host ""

# Check if server is running
try {
    $healthCheck = Invoke-RestMethod -Uri "$BaseUrl/api/system/health-check" -Method GET -ErrorAction Stop
    Write-Host "Server is running" -ForegroundColor Green
} catch {
    Write-Host "Server is not running. Please start the dev server first (npm run dev)" -ForegroundColor Red
    exit 1
}

# Prepare request body
$body = @{
    dryRun = $DryRun
    batchSize = 100
} | ConvertTo-Json

Write-Host "Configuration:" -ForegroundColor Yellow
Write-Host "  Dry Run: $DryRun" -ForegroundColor White
Write-Host "  Base URL: $BaseUrl" -ForegroundColor White
if ($AdminKey) {
    Write-Host "  Admin Key: Provided" -ForegroundColor White
} else {
    Write-Host "  Admin Key: Not provided (will try without auth)" -ForegroundColor Yellow
}
Write-Host ""

if ($DryRun) {
    Write-Host "This is a DRY RUN - no changes will be made" -ForegroundColor Yellow
    Write-Host ""
}

# Make the request
try {
    Write-Host "Running cleanup..." -ForegroundColor Cyan
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    if ($AdminKey) {
        $headers["X-Admin-Key"] = $AdminKey
    }
    
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/pyq/cleanup" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -ErrorAction Stop
    
    Write-Host ""
    Write-Host "=== Results ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "Status: $($response.success)" -ForegroundColor $(if ($response.success) { "Green" } else { "Red" })
    Write-Host "Message: $($response.message)" -ForegroundColor White
    Write-Host ""
    
    if ($response.stats) {
        Write-Host "Statistics:" -ForegroundColor Yellow
        Write-Host "  Total PYQs: $($response.stats.total)" -ForegroundColor White
        Write-Host "  Updated: $($response.stats.updated)" -ForegroundColor White
        Write-Host "  Invalid (flagged): $($response.stats.invalid)" -ForegroundColor White
        Write-Host "  Duplicates removed: $($response.stats.duplicates)" -ForegroundColor White
        Write-Host "  Errors: $($response.stats.errors)" -ForegroundColor $(if ($response.stats.errors -gt 0) { "Red" } else { "Green" })
        Write-Host ""
        
        if ($response.stats.fixed) {
            Write-Host "Fixed Fields:" -ForegroundColor Yellow
            Write-Host "  Exam: $($response.stats.fixed.exam)" -ForegroundColor White
            Write-Host "  Level: $($response.stats.fixed.level)" -ForegroundColor White
            Write-Host "  Paper: $($response.stats.fixed.paper)" -ForegroundColor White
            Write-Host "  Year: $($response.stats.fixed.year)" -ForegroundColor White
            Write-Host "  Question: $($response.stats.fixed.question)" -ForegroundColor White
            Write-Host "  Mixed Language: $($response.stats.fixed.mixedLanguage)" -ForegroundColor White
            Write-Host "  Language: $($response.stats.fixed.lang)" -ForegroundColor White
            Write-Host "  Topic Tags: $($response.stats.fixed.topicTags)" -ForegroundColor White
            Write-Host "  Keywords: $($response.stats.fixed.keywords)" -ForegroundColor White
            Write-Host "  Analysis: $($response.stats.fixed.analysis)" -ForegroundColor White
            Write-Host ""
        }
    }
    
    if ($response.warning) {
        Write-Host "Warning: $($response.warning)" -ForegroundColor Yellow
        Write-Host ""
    }
    
    if ($DryRun -and $response.stats.updated -gt 0) {
        Write-Host "=== Next Steps ===" -ForegroundColor Cyan
        Write-Host "To apply these changes, run:" -ForegroundColor White
        Write-Host "  .\scripts\run-pyq-cleanup.ps1 -DryRun:`$false" -ForegroundColor Green
        Write-Host ""
    }
    
} catch {
    Write-Host ""
    Write-Host "Error running cleanup:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        try {
            $errorDetails = $_.ErrorDetails.Message | ConvertFrom-Json
            Write-Host "Details: $($errorDetails.error)" -ForegroundColor Red
        } catch {
            Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
        }
    }
    
    exit 1
}

Write-Host "Done!" -ForegroundColor Green
