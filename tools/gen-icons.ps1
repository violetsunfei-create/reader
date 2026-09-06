# 生成应用图标(零外部依赖,.NET System.Drawing)
# 用法: powershell -File tools\gen-icons.ps1
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$iconsDir = Join-Path $root 'icons'
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

function New-AppIcon {
  param([string]$OutFile, [int]$Size, [bool]$Maskable)

  $bmp = New-Object System.Drawing.Bitmap($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $bgColor = [System.Drawing.ColorTranslator]::FromHtml('#C05E2C')
  $g.Clear($bgColor)

  $pad = if ($Maskable) { [single]($Size * 0.19) } else { [single]($Size * 0.14) }
  $area = [single]($Size - 2 * $pad)
  $bookW = [single]($area * 0.74)
  $bookH = [single]($area * 0.90)
  $bookX = [single]($pad + ($area - $bookW) / 2)
  $bookY = [single]($pad + ($area - $bookH) / 2)
  $rad = [single]($bookW * 0.10)

  # 白色书本(圆角矩形)
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $path.AddArc($bookX, $bookY, 2 * $rad, 2 * $rad, 180, 90)
  $path.AddArc($bookX + $bookW - 2 * $rad, $bookY, 2 * $rad, 2 * $rad, 270, 90)
  $path.AddArc($bookX + $bookW - 2 * $rad, $bookY + $bookH - 2 * $rad, 2 * $rad, 2 * $rad, 0, 90)
  $path.AddArc($bookX, $bookY + $bookH - 2 * $rad, 2 * $rad, 2 * $rad, 90, 90)
  $path.CloseFigure()
  $g.FillPath([System.Drawing.Brushes]::White, $path)

  # 书脊
  $spineW = [single]($bookW * 0.06)
  $spineBrush = New-Object System.Drawing.SolidBrush($bgColor)
  $g.FillRectangle($spineBrush, [single]($bookX + $bookW / 2 - $spineW / 2), $bookY, $spineW, $bookH)

  # 黄色高亮条(呼应高亮功能)
  $hlBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml('#FFD84D'))
  $hlH = [single]($bookH * 0.085)
  $hlX = [single]($bookX + $bookW * 0.56)
  $g.FillRectangle($hlBrush, $hlX, [single]($bookY + $bookH * 0.30), [single]($bookW * 0.28), $hlH)
  $g.FillRectangle($hlBrush, $hlX, [single]($bookY + $bookH * 0.48), [single]($bookW * 0.20), $hlH)

  $g.Dispose()
  $bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

New-AppIcon -OutFile (Join-Path $root 'apple-touch-icon.png') -Size 180 -Maskable $false
New-AppIcon -OutFile (Join-Path $iconsDir 'icon-192.png') -Size 192 -Maskable $false
New-AppIcon -OutFile (Join-Path $iconsDir 'icon-512.png') -Size 512 -Maskable $false
New-AppIcon -OutFile (Join-Path $iconsDir 'maskable-512.png') -Size 512 -Maskable $true
Write-Host '图标已生成'
