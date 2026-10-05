import { useEffect, useRef } from 'react';
import { Shell } from './components/Shell.tsx';
import { markActive } from './data/heartbeat.ts';
import { href, useRoute } from './router.ts';
import { ActivityView } from './views/Activity.tsx';
import { BuildView } from './views/Build.tsx';
import { ConnectView } from './views/Connect.tsx';
import { DailyView } from './views/Daily.tsx';
import { DeepView } from './views/Deep.tsx';
import { DiaryView } from './views/Diary.tsx';
import { ReadView } from './views/Read.tsx';
import { SearchView } from './views/Search.tsx';
import { SettingsView } from './views/Settings.tsx';

export function App() {
  const route = useRoute();
  const p = route.params;
  const first = useRef(true);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    // 起動直後の表示ではなく、アプリ内を移動した（＝明示的に使っている）ときに反応として数える
    if (first.current) {
      first.current = false;
      return;
    }
    markActive();
  }, [route.path, p.toString()]);

  let view;
  switch (route.path) {
    case '/':
    case '/daily':
      view = <DailyView date={p.get('date')} />;
      break;
    case '/read':
      view = <ReadView id={p.get('id')} />;
      break;
    case '/deep':
      view = <DeepView key={p.get('id') ?? ''} id={p.get('id')} />;
      break;
    case '/diary':
      view = <DiaryView id={p.get('id')} state={p.get('state')} tag={p.get('tag')} src={p.get('src')} />;
      break;
    case '/connect':
      view = <ConnectView a={p.get('a')} b={p.get('b')} id={p.get('id')} />;
      break;
    case '/build':
      view = <BuildView from={p.get('from')} id={p.get('id')} design={p.get('design')} />;
      break;
    case '/activity':
      view = <ActivityView />;
      break;
    case '/settings':
      view = <SettingsView />;
      break;
    case '/search':
      view = <SearchView key={p.get('q') ?? ''} q={p.get('q') ?? ''} />;
      break;
    default:
      view = (
        <div className="page">
          <div className="panel panel-pad empty">
            ページが見つかりませんでした。<a href={href('/daily')}>DAILY に戻る</a>
          </div>
        </div>
      );
  }

  return <Shell route={route}>{view}</Shell>;
}
