# PowerShell script to test PYQ cleanup endpoint (DRY RUN)
# Make sure your Next.js server is running (npm run dev)

param(
    [switch]$Apply = $false  # Use -Apply to actually run cleanup (default is dry run)
)

$baseUrl = "http://localhost:3000"
$endpoint = "/api/pyq/cleanup"

$dryRun = -not $Apply

Write-Host "Testing PYQ Cleanup Endpoint..." -ForegroundColor Cyan
Write-Host "Mode: $(if ($dryRun) { 'DRY RUN (Safe - No Changes)' } else { 'APPLY CHANGES (Will Modify Data!)' })" -ForegroundColor $(if ($dryRun) { "Green" } else { "Red" })
Write-Host "Make sure your Next.js dev server is running!" -ForegroundColor Yellow
Write-Host ""

if (-not $dryRun) {
    Write-Host "⚠️  WARNING: You are about to modify your database!" -ForegroundColor Red
    $confirm = Read-Host "Type 'YES' to continue"
    if ($confirm -ne "YES") {
        Write-Host "Cancelled." -ForegroundColor Yellow
        exit
    }
}

try {
    $body = @{
        dryRun = $dryRun
        batchSize = 100
    } | ConvertTo-Json

    # Make the request
    $response = Invoke-WebRequest -Uri "$baseUrl$endpoint" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing
    
    # Parse JSON response
    $data = $response.Content | ConvertFrom-Json
    
    if ($data.success) {
        Write-Host "✅ Cleanup Complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Statistics:" -ForegroundColor Cyan
        Write-Host "  Total Questions: $($data.stats.total)" -ForegroundColor White
        Write-Host "  Would Update: $($data.stats.updated)" -ForegroundColor Yellow
        Write-Host "  Invalid (flagged): $($data.stats.invalid)" -ForegroundColor $(if ($data.stats.invalid -gt 0) { "Red" } else { "Green" })
        Write-Host "  Duplicates (removed): $($data.stats.duplicates)" -ForegroundColor $(if ($data.stats.duplicates -gt 0) { "Yellow" } else { "Green" })
        Write-Host "  Errors: $($data.stats.errors)" -ForegroundColor $(if ($data.stats.errors -gt 0) { "Red" } else { "Green" })
        Write-Host ""
        Write-Host $data.message -ForegroundColor Cyan
        if ($data.warning) {
            Write-Host ""
            Write-Host $data.warning -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ Cleanup Failed: $($data.error)" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "1. Your Next.js server is running (npm run dev)" -ForegroundColor White
    Write-Host "2. You're logged in (the endpoint requires authentication)" -ForegroundColor White
    Write-Host "3. The server is running on port 3000" -ForegroundColor White
}

