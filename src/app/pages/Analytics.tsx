import { useMemo } from 'react';
// @ts-ignore — HTML estático con Chart.js (scripts no se ejecutan con dangerouslySetInnerHTML).
import analyticsHTML from '../../imports/Analitica_Fresenius_(2)-2.html?raw';

/**
 * El fragmento HTML incluye <style>, markup y <script> (Chart.js CDN + init).
 * En React los <script> inyectados con innerHTML no corren; un iframe con srcDoc sí.
 */
function analyticsSrcDocument(fragment: string): string {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
</head>
<body style="margin:0">
${fragment}
</body>
</html>`;
}

export default function Analytics() {
  const srcDoc = useMemo(() => analyticsSrcDocument(analyticsHTML), []);

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-100">
      <iframe
        title="Analytics — panel supervisor"
        className="block h-full min-h-[900px] w-full flex-1 border-0 bg-[#f2f3f8]"
        srcDoc={srcDoc}
        sandbox="allow-scripts allow-same-origin"
      />
    </div>
  );
}
