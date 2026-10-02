param([string]$Root = "artifacts/P6-offline")
$ErrorActionPreference = "Stop"
$word = $null
try {
  $word = New-Object -ComObject Word.Application
  $word.Visible = $false
  $word.DisplayAlerts = 0
  $word.AutomationSecurity = 3
  foreach ($file in Get-ChildItem -LiteralPath (Resolve-Path -LiteralPath $Root).Path -Filter '*.docx' -Recurse) {
    $document = $null
    try {
      $document = $word.Documents.Open($file.FullName, $false, $true, $false)
      $document.Fields.Update() | Out-Null
      $target = Join-Path $file.DirectoryName ($file.BaseName + '.word-reference.pdf')
      $document.ExportAsFixedFormat($target, 17)
      Write-Output $target
    } finally { if ($document) { $document.Close(0); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($document) } }
  }
} finally { if ($word) { $word.Quit(); [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word) } }
