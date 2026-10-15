
$ErrorActionPreference = "Stop"

$ffmpeg = Get-Command ffmpeg -ErrorAction SilentlyContinue

if (-not $ffmpeg) {
  Write-Host "FFmpeg is not installed. Run:" -ForegroundColor Yellow
  Write-Host "winget install --id Gyan.FFmpeg -e"
  Write-Host "Reopen PowerShell, then run this script again."
  exit 1
}

$sourceFolder = [System.IO.Path]::GetFullPath(
  (Join-Path $PSScriptRoot "..\public\trailers")
)

$outputFolder = Join-Path $sourceFolder "optimized"
$backupFolder = "D:\BookMySeatTrailerOriginals"

New-Item -ItemType Directory -Force -Path $outputFolder, $backupFolder | Out-Null

$specs = @(
  @{ key = "godzilla-vs-kong"; regex = "godzilla" },
  @{ key = "the-odyssey"; regex = "odyssey" },
  @{ key = "spider-man-brand-new-day"; regex = "brand.new.day" },
  @{ key = "fast-and-furious-9"; regex = "fast.*furious" },
  @{ key = "eternals"; regex = "eternals" },
  @{ key = "star-wars-episode-ix"; regex = "star.wars" },
  @{ key = "captain-marvel"; regex = "captain.marvel" },
  @{ key = "spider-man-no-way-home"; regex = "no.way.home" },
  @{ key = "mortal-kombat"; regex = "mortal.kombat" },
  @{ key = "avatar-fire-and-ash"; regex = "avatar" },
  @{ key = "cruella"; regex = "cruella" },
  @{ key = "x-men-dark-phoenix"; regex = "dark.phoenix|x.men" }
)

$originals = @(
  Get-ChildItem -LiteralPath $sourceFolder -File -Filter "*.mp4"
  Get-ChildItem -LiteralPath $backupFolder -File -Filter "*.mp4"
)

$made = 0

foreach ($spec in $specs) {
  $found = @(
    $originals | Where-Object {
      $_.BaseName -match $spec.regex
    }
  )

  if ($found.Count -ne 1) {
    Write-Warning "Missing or ambiguous source: $($spec.key) (found $($found.Count))."
    continue
  }

  $original = $found[0]
  $clip = Join-Path $outputFolder ($spec.key + ".mp4")
  $poster = Join-Path $outputFolder ($spec.key + ".jpg")

  Write-Host "Processing $($spec.key)..." -ForegroundColor Cyan

  # An 18-second segment starting 15 seconds into the original.
  & ffmpeg -hide_banner -loglevel error -y `
    -ss 00:00:15 -i $original.FullName -t 18 `
    -map "0:v:0" -map "0:a:0?" `
    -vf "scale=1920:1080:force_original_aspect_ratio=decrease,format=yuv420p" `
    -c:v libx264 -preset veryfast -crf 21 `
    -c:a aac -b:a 128k -movflags +faststart $clip

  if (
    $LASTEXITCODE -ne 0 -or
    -not (Test-Path $clip) -or
    (Get-Item $clip).Length -lt 20000
  ) {
    Write-Warning "Encoding failed: $($spec.key). Original untouched."
    continue
  }

  & ffmpeg -hide_banner -loglevel error -y -ss 2 -i $clip `
    -frames:v 1 -q:v 3 $poster

  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $poster)) {
    Write-Warning "Poster creation failed: $($spec.key). Original untouched."
    continue
  }

  # Preserve originals outside Docker's build folder.
  if ($original.DirectoryName -ne $backupFolder) {
    $backupPath = Join-Path $backupFolder $original.Name

    if (-not (Test-Path -LiteralPath $backupPath)) {
      Move-Item -LiteralPath $original.FullName -Destination $backupPath
      Write-Host "Original safely moved to $backupFolder"
    } else {
      Write-Warning "Backup already exists; original kept in public/trailers."
    }
  }

  $made++
}

Write-Host "Finished. Processed: $made." -ForegroundColor Green
Write-Host "Clips: $outputFolder"
Write-Host "Originals remain backed up or in their source folder."
