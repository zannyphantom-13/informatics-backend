$uri = "http://localhost:3000/api/health"
Write-Host "Testing server health at $uri..."
try {
    $response = Invoke-WebRequest -Uri $uri -Method GET -UseBasicParsing
    Write-Host "Server is responding!"
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Content: $($response.Content)"
} catch {
    Write-Host "Server is not responding: $($_.Exception.Message)"
}
