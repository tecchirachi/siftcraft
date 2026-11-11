import { StrictMode} from 'react'
import { createRoot} from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
<StrictMode>
<App />
</StrictMode>,
)

// PWA: 本番ビルドのときだけ Service Worker を登録する
// 開発中はキャッシュが邪魔になることがあるため、PROD 判定を入れている。
// 登録すると「ホーム画面に追加」でアプリのように起動できるようになる。
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
window.addEventListener('load', () => {
navigator.serviceWorker.register('./sw.js').catch(() => {
// 登録に失敗してもアプリ本体は動くので、エラーで止めない
})
})
}
