# PowerShell script to test PYQ validation endpoint
# Make sure your Next.js server is running (npm run dev)

$baseUrl = "http://localhost:3000"
$endpoint = "/api/pyq/validate"

Write-Host "Testing PYQ Validation Endpoint..." -ForegroundColor Cyan
Write-Host "Make sure your Next.js dev server is running!" -ForegroundColor Yellow
Write-Host ""

try {
    # Make the request
    $response = Invoke-WebRequest -Uri "$baseUrl$endpoint" -Method GET -UseBasicParsing
    
    # Parse JSON response
    $data = $response.Content | ConvertFrom-Json
    
    Write-Host "✅ Validation Complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Total Questions: $($data.total)" -ForegroundColor White
    Write-Host "Sample Size: $($data.sampleSize)" -ForegroundColor White
    Write-Host ""
    Write-Host "Statistics:" -ForegroundColor Cyan
    Write-Host "  Valid: $($data.stats.valid) ($($data.stats.validPercentage))" -ForegroundColor Green
    Write-Host "  Invalid: $($data.stats.invalid) ($($data.stats.invalidPercentage))" -ForegroundColor Red
    Write-Host ""
    Write-Host "Issues Found:" -ForegroundColor Yellow
    Write-Host "  Invalid Year: $($data.issues.invalidYear.count)" -ForegroundColor $(if ($data.issues.invalidYear.count -gt 0) { "Red" } else { "Green" })
    Write-Host "  Short Questions: $($data.issues.shortQuestion.count)" -ForegroundColor $(if ($data.issues.shortQuestion.count -gt 0) { "Red" } else { "Green" })
    Write-Host "  Missing Exam: $($data.issues.missingExam.count)" -ForegroundColor $(if ($data.issues.missingExam.count -gt 0) { "Red" } else { "Green" })
    Write-Host "  Empty Fields: $($data.issues.emptyFields.count)" -ForegroundColor $(if ($data.issues.emptyFields.count -gt 0) { "Yellow" } else { "Green" })
    Write-Host "  Duplicates: $($data.issues.duplicates.count)" -ForegroundColor $(if ($data.issues.duplicates.count -gt 0) { "Yellow" } else { "Green" })
    Write-Host ""
    Write-Host $data.message -ForegroundColor Cyan
    
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure:" -ForegroundColor Yellow
    Write-Host "1. Your Next.js server is running (npm run dev)" -ForegroundColor White
    Write-Host "2. You're logged in (the endpoint requires authentication)" -ForegroundColor White
    Write-Host "3. The server is running on port 3000" -ForegroundColor White
}

