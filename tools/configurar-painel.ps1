# Configura a senha do painel e o token do GitHub na Vercel. Nada do que voce digita aparece na tela.
Set-Location (Join-Path $PSScriptRoot "..")

function Read-Secret($prompt) {
  $s = Read-Host $prompt -AsSecureString
  [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)).Trim()
}

function Set-VercelEnv($name, $value) {
  cmd /c "npx -y vercel@latest env rm $name production --yes >nul 2>&1"
  $value | npx -y vercel@latest env add $name production *> $null
}

Write-Host ""
Write-Host "1/2  Senha do painel" -ForegroundColor Yellow
while ($true) {
  $pw = Read-Secret "Crie a senha do painel (minimo 8 caracteres)"
  if ($pw.Length -lt 8) { Write-Host "Muito curta, tente de novo." -ForegroundColor Red; continue }
  $pw2 = Read-Secret "Digite a mesma senha de novo"
  if ($pw -ne $pw2) { Write-Host "As senhas nao bateram, tente de novo." -ForegroundColor Red; continue }
  break
}

Write-Host ""
Write-Host "2/2  Token do GitHub" -ForegroundColor Yellow
while ($true) {
  $token = Read-Secret "Cole o token do GitHub (comeca com github_pat_)"
  try {
    Invoke-RestMethod -Uri "https://api.github.com/repos/arthurfranze/portfolio/contents/content.json" -Headers @{ Authorization = "Bearer $token"; "User-Agent" = "portfolio-setup" } | Out-Null
    break
  } catch {
    Write-Host "Esse token nao conseguiu acessar o repositorio portfolio. Confira e cole de novo." -ForegroundColor Red
  }
}

Write-Host ""
Write-Host "Salvando na Vercel..." -ForegroundColor Yellow
Set-VercelEnv "ADMIN_PASSWORD" $pw
Set-VercelEnv "GITHUB_TOKEN" $token
Write-Host ""
Write-Host "Pronto! Pode voltar pro Claude e mandar um 'foi'." -ForegroundColor Green
