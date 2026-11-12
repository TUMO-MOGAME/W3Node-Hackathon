# Starts Heirloom on this laptop in chain mode (Solana devnet): every send, claim, vote and car sale is a real
# devnet transaction with an Explorer link. Test USD₮ and devnet SOL only; never real money.
#
#   powershell -ExecutionPolicy Bypass -File scripts\demo-devnet.ps1
#   then open http://localhost:3000
#
# Reads, in order (later files win): .env.local (repo root), app\.env.local, scripts\.env.devnet.
# Nothing is written to disk and no value is printed.
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent

function Import-EnvFile([string]$file) {
  if (-not (Test-Path $file)) { return }
  foreach ($line in Get-Content $file) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
      $value = $matches[2].Trim()
      if ($value.Length -ge 2 -and (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'")))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      [Environment]::SetEnvironmentVariable($matches[1], $value, "Process")
    }
  }
}

Import-EnvFile (Join-Path $root ".env.local")
Import-EnvFile (Join-Path $root "app\.env.local")
Import-EnvFile (Join-Path $PSScriptRoot ".env.devnet")

if (-not $env:AGENT_SEED_PHRASE) { throw "scripts\.env.devnet is missing (it holds the devnet agent wallet)." }
$env:NEXT_PUBLIC_DATA_MODE = "chain"
# The Heirloom voice agent (public id, not a secret). Overrides an older id left in .env.local.
$env:ELEVENLABS_AGENT_ID = "agent_1601m77rrhfse7pb04ct3wztkew8"

Write-Host "Heirloom on Solana devnet: http://localhost:3000  (Ctrl+C to stop)"
Set-Location (Join-Path $root "app")
npm run dev
