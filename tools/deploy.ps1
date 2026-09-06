# 部署脚本:通过 GitHub API 同步文件并开通 Pages
# 背景:本机直连 github.com 不稳定,但 api.github.com 可用;本脚本全部走 API 通道
# 用法: powershell -File tools\deploy.ps1 [-Owner 用户名] [-Repo 仓库名]
param([string]$Owner = 'violetsunfei-create', [string]$Repo = 'reader')

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$env:Path = [System.Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path', 'User')
$utf8 = New-Object System.Text.UTF8Encoding($false)

Write-Host '== 1) 检查仓库 =='
gh repo view "$Owner/$Repo" --json name | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host '仓库不存在,创建中…'
  gh repo create $Repo --public --add-readme --description '随身书架:EPUB 阅读 + DeepSeek AI 问答(个人项目)' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw '创建仓库失败' }
  Write-Host '仓库已创建'
} else {
  Write-Host '仓库已存在'
}

Write-Host '== 2) 获取远程已有文件清单 =='
$treeOut = gh api "repos/$Owner/$Repo/git/trees/main?recursive=1" --jq '.tree[] | [.path, .sha] | @tsv'
if ($LASTEXITCODE -ne 0) { throw '获取远程文件清单失败' }
$shaMap = @{}
foreach ($line in $treeOut) {
  $parts = $line -split "`t"
  if ($parts.Count -eq 2) { $shaMap[$parts[0]] = $parts[1] }
}
Write-Host "远程已有 $($shaMap.Count) 个文件"

Write-Host '== 3) 同步本地文件(排除 .git 与 test-books)=='
$files = Get-ChildItem -Path $root -Recurse -File | Where-Object {
  $_.FullName -notmatch '\\\.git\\' -and $_.FullName -notmatch '\\test-books\\'
}
$count = 0
foreach ($f in $files) {
  $path = $f.FullName.Substring($root.Length + 1) -replace '\\', '/'
  $b64 = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($f.FullName))
  $body = @{ message = 'deploy: ' + $path; content = $b64; branch = 'main' }
  if ($shaMap.ContainsKey($path)) { $body.sha = $shaMap[$path] }
  $tmp = Join-Path $env:TEMP 'gh-body.json'
  [System.IO.File]::WriteAllText($tmp, ($body | ConvertTo-Json -Compress), $utf8)
  gh api -X PUT "repos/$Owner/$Repo/contents/$path" --input $tmp | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "上传失败: $path" }
  $count++
  Write-Host "  已上传: $path"
}
Write-Host "共上传 $count 个文件"

Write-Host '== 4) 开通 GitHub Pages =='
gh api "repos/$Owner/$Repo/pages" --jq '.html_url' | Out-Null
if ($LASTEXITCODE -ne 0) {
  gh api -X POST "repos/$Owner/$Repo/pages" -f 'source[branch]=main' -f 'source[path]=/' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw '开通 Pages 失败' }
  Write-Host 'Pages 已开通,等待构建…'
} else {
  Write-Host 'Pages 已存在,等待重新构建…'
}

$url = "https://$Owner.github.io/$Repo/"
Write-Host '== 5) 验证站点 =='
$ok = $false
for ($i = 0; $i -lt 18; $i++) {
  Start-Sleep -Seconds 10
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 15
    if ($r.StatusCode -eq 200) { $ok = $true; break }
  } catch {}
  Write-Host "  等待构建中… ($($i + 1)/18)"
}
if ($ok) {
  Write-Host ''
  Write-Host "部署成功!应用地址: $url"
  Write-Host '在 iPhone/iPad 的 Safari 中打开该地址 → 分享 → 添加到主屏幕'
} else {
  Write-Host ''
  Write-Host "页面已启用但暂未就绪,请稍后手动访问: $url"
}
