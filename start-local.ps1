param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$runtimeDirectory = if ($env:COURSELOOP_RUNTIME_DIR) { [IO.Path]::GetFullPath($env:COURSELOOP_RUNTIME_DIR) } else { Join-Path $PSScriptRoot '.runtime' }
$localPython = Join-Path $PSScriptRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $localPython)) {
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw '无法建立本机Python环境，请确认已安装Python 3.10或更新版本。' }
}
& $localPython tools/check_dependencies.py
if ($LASTEXITCODE -ne 0) {
    & $localPython -m pip install --disable-pip-version-check -r requirements.lock
    if ($LASTEXITCODE -ne 0) { throw '依赖安装或更新失败，请检查网络后重试。' }
}
& $localPython server/manage.py migrate --noinput
if ($LASTEXITCODE -ne 0) { throw '数据库初始化失败，已停止启动。' }
& $localPython server/manage.py seed_demo
if ($LASTEXITCODE -ne 0) { throw '样例初始化失败，已停止启动。' }
$ollamaAvailable = $false
try {
    $null = Invoke-RestMethod -Uri 'http://127.0.0.1:11434/api/version' -TimeoutSec 2
    $ollamaAvailable = $true
} catch {}
if (-not $ollamaAvailable) {
    $ollamaCommand = Get-Command ollama -ErrorAction SilentlyContinue
    if ($ollamaCommand) {
        $env:OLLAMA_HOST = '127.0.0.1:11434'
        $env:OLLAMA_NO_CLOUD = '1'
        $env:OLLAMA_NOPRUNE = '1'
        $installedModels = Join-Path (Split-Path -Parent $ollamaCommand.Source) 'models'
        if (-not $env:OLLAMA_MODELS -and (Test-Path -LiteralPath (Join-Path $installedModels 'manifests'))) {
            $env:OLLAMA_MODELS = $installedModels
        }
        $ownedOllama = Start-Process -FilePath $ollamaCommand.Source -ArgumentList 'serve' -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $runtimeDirectory 'ollama-stdout.log') -RedirectStandardError (Join-Path $runtimeDirectory 'ollama-stderr.log')
        [IO.File]::WriteAllText((Join-Path $runtimeDirectory 'ollama-owned.pid'), [string]$ownedOllama.Id)
        Write-Host '已尝试启动本机 Ollama；没有安装的模型不会自动下载。'
    } else { Write-Host '尚未检测到 Ollama。教学服务可以启动，AI诊断需先安装并启动 Ollama。' -ForegroundColor Yellow }
}
Write-Host ''
Write-Host 'CourseLoop 本机教学演示：http://127.0.0.1:8080/' -ForegroundColor Cyan
Write-Host ('演示账号保存在 ' + (Join-Path $runtimeDirectory 'demo-accounts.txt') + '，请勿上传或公开此文件。')
Write-Host '关闭此窗口或按 Ctrl+C 停止本机服务。'
if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:8080/' }
& $localPython server/serve_local.py
