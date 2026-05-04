// ============================================================
// CORE Iris — エントリーポイント (LP / Dashboard 切替)
// ============================================================
import { useState, useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import IrisLanding from './IrisLanding';
import IrisDashboard from './IrisDashboard';

const ENTERED_KEY = 'core_iris_entered_v1';

function hasEntered(): boolean {
  return localStorage.getItem(ENTERED_KEY) === 'true';
}
function markEntered() {
  localStorage.setItem(ENTERED_KEY, 'true');
}

export default function IrisApp() {
  const { settings } = useSettings();
  const [entered, setEntered] = useState(() => hasEntered());

  // タイトルとファビコンを Iris に切り替え
  useEffect(() => {
    document.title = 'CORE Iris — 自分の色で、咲く。';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#FF7AAE');
  }, []);

  if (!entered) {
    return <IrisLanding onEnter={() => { markEntered(); setEntered(true); }} />;
  }
  return <IrisDashboard settings={settings} onLeave={() => setEntered(false)} />;
}
