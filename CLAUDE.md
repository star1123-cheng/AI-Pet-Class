# AI 寵物養成遊戲（ai-pet）

國小高年級 6 堂 AI 課使用的 iPad 網頁遊戲。完整設計在 `docs/`，本檔只放開發時每次都需要的規則。

## 技術
- 純 HTML/CSS/JS（ES modules），無 build，部署到 GitHub Pages
- 後端：Google Apps Script Web App＋一份試算表；前端用 `fetch`＋`text/plain` 送 JSON
- **offline-first**：GAS 失敗時遊戲照常運作，事件寫入 localStorage 佇列，連線後補送
- 零外部依賴：不用 CDN、外部字型、外部圖片；圖像用 SVG／CSS
- 引擎與狀態邏輯寫成不依賴 DOM 的純函式，用 `node --test` 測試

## iPad-first
- 主要裝置 iPad Safari，手指操作（沒有 Apple Pencil）
- 畫布 `touch-action: none`；鎖定捲動、縮放、雙擊放大；用 Pointer Events 與 `100dvh`
- 觸控目標 ≥ 44 px、內文 ≥ 18 px、一屏一個主要動作
- 學生以點選為主；遊戲內只有序號（6 碼）需要輸入；語音輸入只發生在 Gemini Canvas

## serial-only 隱私
- 學生身分只有 6 碼序號；程式、資料、日誌、測試資料都以序號代表人
- 事件只記選項代碼，自由文字留在本機
- `config.js` 只放 GAS URL；金鑰、密碼、token 不進 repo

## 用語
寵物狀態一律用 AI 詞彙：資料量、資料品質、訓練次數、準確率、範例、標籤。介面文字用台灣繁體中文，句子短、適合 10 至 12 歲。

## 規格索引（需要時才讀）
- 每堂活動與時間：`docs/02-六堂教案.md`
- 任務、題庫、前後測、第 3 堂內容：`docs/03-前後測與任務題庫.md`
- 技能、提示詞積木、Canvas 範本、保底版：`docs/04-技能與提示詞積木.md`
- 資料表、API、品質指標、看板：`docs/05-資料與教師看板規格.md`

## 完成標準（每個 P 任務共用）
1. `node --test` 全綠
2. 在 iPad Safari（或 Safari 響應式模式＋觸控模擬）跑完該任務的手動清單，並回報每一項結果
3. 實作與 `docs/` 不一致處，先更新 `docs/`（單一來源）再改程式
