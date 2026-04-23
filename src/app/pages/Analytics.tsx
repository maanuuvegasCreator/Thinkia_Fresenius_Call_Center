import { useEffect } from 'react';
// @ts-ignore
import analyticsHTML from '../../imports/Analitica_Fresenius_(2)-2.html?raw';

export default function Analytics() {
  useEffect(() => {
    // Load Chart.js library dynamically
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js';
    script.async = true;
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="h-full w-full overflow-auto">
      <div dangerouslySetInnerHTML={{ __html: analyticsHTML }} />
    </div>
  );
}
