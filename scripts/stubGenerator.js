cd C: \price - pulse\frontend

# PASTE the missing ExpectedAt paths from the audit output into this array
$missingPaths = @(
    # Example — replace with actual paths from audit:
'src\utils\performance\ProductCard.jsx',
    'src\utils\imageUrl\ProductImage.jsx',
    'src\components\CategoryFilter\CategoryPage.jsx',
    'src\components\Pagination\CategoryPage.jsx',
    'src\components\SortDropdown\CategoryPage.jsx'
)

foreach($p in $missingPaths) {
    if (Test - Path $p) { Write - Host "⏭️  Skipped $p (exists)" - ForegroundColor Yellow; continue }

    New - Item - ItemType Directory - Force(Split - Path $p) | Out - Null
    $ext = [System.IO.Path]:: GetExtension($p)
    $name = [System.IO.Path]:: GetFileNameWithoutExtension($p)
    $dir = Split - Path $p - Parent
    $parentRelative = ($dir - replace '^src\\', '../').Replace('\', ' / ')

    if ($ext - eq '.jsx') {
        # React component stub
        @"
            // $($p.Replace('\', '/'))
            import React from 'react';

        export default function $name(props) {
            return (
                <div className="p-4 border border-gray-200 rounded bg-gray-50">
                    <p className="text-sm text-gray-500">$name (stub)</p>
                </div>
            );
        }
        "@ | Out-File -FilePath $p -Encoding UTF8
    } else {
        # JS module / hook / util stub
        @"
        // $($p.Replace('\', '/'))
        export default function $name(...args) {
            // TODO: implement $name
            return null;
        }
        "@ | Out-File -FilePath $p -Encoding UTF8
    }

    Write - Host "✅ Created $p" - ForegroundColor Green
}