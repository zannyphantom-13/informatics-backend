$uri = "http://localhost:3000/register"
$body = @{
    full_name = "John Doe"
    email = "john@example.com"
    password = "SecurePass123!"
    phone_number = "+1234567890"
    date_of_birth = "1995-05-15"
    country = "USA"
    bio = "Testing security questions"
    security_question = "childhood_pet"
    security_answer = "Fluffy"
} | ConvertTo-Json

$headers = @{
    "Content-Type" = "application/json"
}

Write-Host "Sending registration request..."
Write-Host $body

try {
    $response = Invoke-WebRequest -Uri $uri -Method POST -Body $body -Headers $headers -UseBasicParsing
    Write-Host ""
    Write-Host "Registration successful!"
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Response: $($response.Content)"
} catch {
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)"
}
