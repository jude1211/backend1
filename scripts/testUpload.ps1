$ErrorActionPreference = 'Stop'

$filePath = Join-Path $PSScriptRoot '..' '..' 'frontend' 'public' 'vite.svg'
if (-not (Test-Path $filePath)) {
  Write-Error "Test file not found: $filePath"
}

$form = @{
  folder = 'booknview/test'
  type = 'image'
  file = Get-Item -Path $filePath
}

$res = Invoke-WebRequest -Uri 'http://localhost:5000/api/v1/upload/public/single' -Method Post -InFile $filePath -ContentType 'multipart/form-data'
Write-Output $res.Content

