// Shrinks shipped artwork for the WeChat 2 MB main-package budget.
// Source PNG/SVG stay full resolution in static/; only the built copy changes.
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const outputDir = process.argv[2]
if (!outputDir) throw new Error('Usage: optimize-mp-art.mjs <mp-weixin output directory>')

const targets = {
  enemies: 128,
  'set-emblems': 96,
  items: 128,
  'map-icons': 128,
}
const scenes = { dungeon: [480, 270], abyss: [480, 270], final: [480, 270], camp: [480, 192], shop: [480, 192] }

const plan = []
for (const [dir, size] of Object.entries(targets)) {
  const full = path.join(outputDir, 'static', dir)
  if (!fs.existsSync(full)) continue
  for (const file of fs.readdirSync(full)) {
    if (file.endsWith('.png')) plan.push({ file: path.join(full, file), width: size, height: size })
    if (file.endsWith('.svg')) fs.unlinkSync(path.join(full, file))
  }
}
const sceneDir = path.join(outputDir, 'static', 'scenes')
if (fs.existsSync(sceneDir)) {
  for (const file of fs.readdirSync(sceneDir)) {
    const id = file.replace(/\.(png|svg)$/, '')
    if (file.endsWith('.svg')) { fs.unlinkSync(path.join(sceneDir, file)); continue }
    const dims = scenes[id]
    if (dims) plan.push({ file: path.join(sceneDir, file), width: dims[0], height: dims[1] })
  }
}

const listings = plan.map(item => `${item.file}|${item.width}|${item.height}`).join('\n')
fs.writeFileSync(path.join(process.env.TEMP || '.', 'z80z-art-plan.txt'), listings, 'utf8')

const script = `
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$planPath = Join-Path $env:TEMP 'z80z-art-plan.txt'
foreach ($line in Get-Content -LiteralPath $planPath) {
  $parts = $line -split '\\|'
  $file = $parts[0]; $w = [int]$parts[1]; $h = [int]$parts[2]
  $src = [System.Drawing.Image]::FromFile($file)
  try {
    if ($src.Width -le $w -and $src.Height -le $h -and $src.Width -le 160) { continue }
    $bmp = New-Object System.Drawing.Bitmap $w, $h
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    try {
      $g.CompositingQuality = 'HighQuality'
      $g.InterpolationMode = 'HighQualityBicubic'
      $g.SmoothingMode = 'HighQuality'
      $g.PixelOffsetMode = 'HighQuality'
      $g.Clear([System.Drawing.Color]::Transparent)
      $g.DrawImage($src, 0, 0, $w, $h)
    } finally { $g.Dispose() }
    $src.Dispose()
    $bmp.Save($file, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
  } finally { if ($src) { $src.Dispose() } }
}
Write-Output ("optimized " + ($(Get-Content -LiteralPath $planPath).Count) + " images")
`
const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8' })
if (result.status !== 0) throw new Error(result.stderr || result.stdout)
console.log(result.stdout.trim())

// Make sure any future copy of SVG sources never enters the package.
const configPath = path.join(outputDir, 'project.config.json')
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
  config.packOptions = config.packOptions || {}
  config.packOptions.ignore = [{ type: 'suffix', value: '.svg' }]
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')
}
