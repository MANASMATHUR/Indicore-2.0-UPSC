# PYQ Cleanup Script for VS Code Terminal
# This script helps you run PYQ cleanup operations

param(
    [Parameter(Mandatory=$false)]
    [string]$Action = "cleanup",  # cleanup, comprehensive, validate, clear
    
    [Parameter(Mandatory=$false)]
    [switch]$DryRun = $true,
    
    [Parameter(Mandatory=$false)]
    [switch]$Apply = $false,
    
    [Parameter(Mandatory=$false)]
    [string]$BaseUrl = "http://localhost:3000",
    
    [Parameter(Mandatory=$false)]
    [string]$AdminKey = ""
)

# If Apply is specified, set DryRun to false
if ($Apply) {
    $DryRun = $false
}

# Determine the endpoint based on action
$endpoint = switch ($Action.ToLower()) {
    "cleanup" { "/api/pyq/cleanup" }
    "comprehensive" { "/api/pyq/comprehensive-cleanup" }
    "validate" { "/api/pyq/validate" }
    "clear" { "/api/pyq/clear-database" }
    default { "/api/pyq/cleanup" }
}

# Build request body based on action
$body = @{
    dryRun = $DryRun
}

# Add action-specific parameters
if ($Action.ToLower() -eq "comprehensive") {
    $body["aggressive"] = $false
    $body["batchSize"] = 100
}

if ($Action.ToLower() -eq "clear") {
    if (-not $DryRun) {
        $body["confirmDelete"] = $true
    }
    $body["invalidOnly"] = $false
}

$bodyJson = $body | ConvertTo-Json

# Add admin key if provided
$headers = @{
    "Content-Type" = "application/json"
}
if ($AdminKey) {
    $headers["X-Admin-Key"] = $AdminKey
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "PYQ Cleanup Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Action: $Action" -ForegroundColor Yellow
Write-Host "Endpoint: $BaseUrl$endpoint" -ForegroundColor Yellow
Write-Host "Dry Run: $DryRun" -ForegroundColor $(if ($DryRun) { "Green" } else { "Red" })
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

try {
    if ($Action.ToLower() -eq "validate") {
        # Validate is a GET request
        Write-Host "Sending GET request..." -ForegroundColor Gray
        $response = Invoke-RestMethod -Uri "$BaseUrl$endpoint" -Method GET -Headers $headers -ErrorAction Stop
    } else {
        # Others are POST requests
        Write-Host "Sending POST request..." -ForegroundColor Gray
        $response = Invoke-RestMethod -Uri "$BaseUrl$endpoint" -Method POST -Headers $headers -Body $bodyJson -ErrorAction Stop
    }
    
    Write-Host ""
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Write-Host
    
} catch {
    Write-Host ""
    Write-Host "❌ ERROR!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error Message: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.ErrorDetails.Message) {
        Write-Host "Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "1. The dev server is running (npm run dev)" -ForegroundColor Yellow
    Write-Host "2. You are logged in (for session auth) OR provide AdminKey" -ForegroundColor Yellow
    Write-Host "3. The endpoint is correct" -ForegroundColor Yellow
}
