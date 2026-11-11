cd C: \price - pulse\frontend

Write - Host "`n=== Scanning src/ for missing local imports ===`n" - ForegroundColor Cyan

$missing = @()

Get - ChildItem - Path src - Recurse - Include *.js,*.jsx,*.ts,*.tsx - File | ForEach - Object {
    $file = $_
    $content = Get - Content $file.FullName - Raw
    $matches = [regex]:: Matches($content, "from\s+['`"](\.{ 1, 2} / [^ '`"]+)['`"]")

    foreach ($m in $matches) {
        $imp = $m.Groups[1].Value
        $basePath = [System.IO.Path]::GetFullPath((Join-Path $file.DirectoryName $imp))

        $found = $false
        foreach ($ext in @('.js', '.jsx', '.ts', '.tsx', '')) {
            if (Test-Path "$basePath$ext" -PathType Leaf) { $found = $true; break }
        }
        if (-not $found) {
            foreach ($ext in @('.js', '.jsx', '.ts', '.tsx')) {
                if (Test-Path (Join-Path $basePath "index$ext") -PathType Leaf) { $found = $true; break }
            }
        }

        if (-not $found) {
            $missing += [PSCustomObject]@{
                File        = $file.FullName.Replace("$PWD\", '')
                Import      = $imp
                ExpectedAt  = $basePath.Replace("$PWD\", '')
            }
        }
    }
}

if ($missing.Count -eq 0) {
    Write-Host "✅ No missing imports!" -ForegroundColor Green
} else {
    Write-Host "❌ $($missing.Count) missing imports:`n" -ForegroundColor Red
    $missing | Format - Table - AutoSize - Wrap
}