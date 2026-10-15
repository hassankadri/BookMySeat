
$ErrorActionPreference = "Stop"

$target = [System.IO.Path]::GetFullPath(
  (Join-Path $PSScriptRoot "..\public\images\cinemas")
)

New-Item -ItemType Directory -Force -Path $target |
  Out-Null

$photos = @(
  @{ Name = "lower-parel.jpg"; Id = "7081167" },
  @{ Name = "kurla.jpg"; Id = "8261819" },
  @{ Name = "malad.jpg"; Id = "7991139" },
  @{ Name = "ghatkopar.jpg"; Id = "7991381" },
  @{ Name = "thane.jpg"; Id = "32716872" }
)

foreach ($photo in $photos) {
  $path = Join-Path $target $photo.Name

  if (
    (Test-Path $path) -and
    ((Get-Item $path).Length -gt 20000)
  ) {
    Write-Host "Already present: $($photo.Name)" `
      -ForegroundColor Green
    continue
  }

  $url = "https://images.pexels.com/photos/$($photo.Id)/pexels-photo-$($photo.Id).jpeg?auto=compress&cs=tinysrgb&w=1600"

  try {
    Invoke-WebRequest `
      -Uri $url `
      -OutFile $path `
      -UseBasicParsing `
      -TimeoutSec 45

    if ((Get-Item $path).Length -lt 20000) {
      throw "Download unexpectedly small"
    }

    Write-Host "Saved: $($photo.Name)" `
      -ForegroundColor Green
  }
  catch {
    Remove-Item $path -ErrorAction SilentlyContinue

    Write-Warning "Couldn't download $($photo.Name): $($_.Exception.Message)"
  }
}

Write-Host "Cinema images folder: $target" `
  -ForegroundColor Cyan
