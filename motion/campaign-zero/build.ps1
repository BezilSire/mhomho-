# MHOMHO — Campaign Zero clip build.
#
#   1. render the two motion templates (claude-motion-styles-20)
#   2. composite them over the original footage: original framing, original sound
#   3. copy the results into public/download for the creator app
#
# The originals are never cropped, re-timed or re-voiced. The motion graphics
# are an overlay: a kinetic beat in the first 6 seconds (lower band, clear of
# the face and the burned-in captions) and a particle outro over the last 5.
param(
  [int]$Width = 1280,
  [int]$Height = 720
)

$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here '..\..')
$work = Join-Path $here 'build'
New-Item -ItemType Directory -Force -Path $work | Out-Null

# Brand tokens -------------------------------------------------------------
$Bg = '080706'
$Yellow = 'ffcf3f'
$Orange = 'ff9f0a'
$Coral = 'ff6b4a'
$Bone = 'f7f4f0'

# --- 1. render the templates ----------------------------------------------
Write-Host "Rendering motion templates..."
python "$here\motion-particles\render.py" "$here\motion-particles\template.html" "$work\outro.mp4" `
  --w 1920 --h 1080 --fps 30 --dur 5 --text "MHOMHO" --sub "GET PAID TO POST" `
  --set "bg=$Bg" --set "c1=$Orange" --set "c2=$Yellow" --set "c3=$Coral" --crf 18
if ($LASTEXITCODE -ne 0) { throw "particles render failed" }

python "$here\motion-kinetic-type\render.py" "$here\motion-kinetic-type\template.html" "$work\kinetic.mov" ``
  --w 1280 --h 720 --fps 30 --dur 6 --text "GET PAID" --sub "MHOMHO CREATORS" --alpha ``
  --set "bg=$Bg" --set "c1=$Yellow" --set "c2=$Bone" --set "c3=$Coral" ``
  --set cx=0.74 --set cy=0.76 --set fs=0.5 --set mw=0.42 --set echo=0
if ($LASTEXITCODE -ne 0) { throw "kinetic render failed" }

# --- 2. composite over the originals --------------------------------------
$clips = @(
  @{ src = 'IMG_5576.MOV'; out = 'mhomho-campaign-zero-1.mp4'; dur = 58.95 },
  @{ src = 'IMG_5577.MOV'; out = 'mhomho-campaign-zero-2.mp4'; dur = 77.51 },
  @{ src = 'IMG_5578.MOV'; out = 'mhomho-campaign-zero-3.mp4'; dur = 54.41 }
)

foreach ($clip in $clips) {
  $src = Join-Path $root $clip.src
  $start = [double]$clip.dur - 5
  $out = Join-Path $work $clip.out
  Write-Host "Compositing $($clip.src)..."
  $filter = "[0:v]scale=${Width}:${Height}:flags=lanczos,fps=30[base];" +
            "[1:v]format=rgba[kin];" +
            "[2:v]scale=${Width}:${Height}:flags=lanczos,setpts=PTS+$start/TB[card];" +
            "[base][kin]overlay=0:0:enable='lt(t,6)'[a];" +
            "[a][card]overlay=0:0:enable='gte(t,$start)'[v]"
  ffmpeg -y -v error -i $src -i "$work\kinetic.mov" -i "$work\outro.mp4" `
    -filter_complex $filter -map "[v]" -map 0:a `
    -c:v libx264 -profile:v main -level 3.1 -pix_fmt yuv420p -crf 26 -preset veryfast `
    -c:a aac -b:a 96k -movflags +faststart $out
  if ($LASTEXITCODE -ne 0) { throw "composite failed for $($clip.src)" }
}

# The particle outro doubles as the standalone brand card.
ffmpeg -y -v error -i "$work\outro.mp4" -vf "scale=${Width}:${Height}:flags=lanczos" `
  -c:v libx264 -profile:v main -level 3.1 -pix_fmt yuv420p -crf 26 -preset veryfast `
  -c:a aac -b:a 96k -movflags +faststart "$work\mhomho-brand-card.mp4"

# --- 3. publish ------------------------------------------------------------
$dest = Join-Path $root 'public\download'
Copy-Item "$work\mhomho-campaign-zero-*.mp4" $dest -Force
Copy-Item "$work\mhomho-brand-card.mp4" $dest -Force
Get-ChildItem $dest -Filter '*.mp4' | Select-Object Name, @{n='MB';e={[math]::Round($_.Length / 1MB, 2)}} | Format-Table -AutoSize
Write-Host "Done. Now run: npm run build   (copies public/ into dist/client before deploy)"

