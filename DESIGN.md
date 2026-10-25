---
name: 我的 AI 寵物
description: 國小高年級 AI 課的 iPad 網頁遊戲；每隻寵物是一張學生自己的集換式卡，作品道具是依稀有度換框的小卡。
colors:
  table: "#eef1f8"
  table-2: "#e1e6f2"
  ink: "#1e2140"
  ink-2: "#474d75"
  line: "#c9d0e3"
  locked: "#6f769b"
  panel: "#ffffff"
  paper: "#fffbea"
  gold: "#ffd23f"
  gold-deep: "#9a6f00"
  sky: "#8cc8ff"
  blue: "#2f6beb"
  blue-deep: "#1f4fc0"
  blue-soft: "#e3ecff"
  good: "#167a4b"
  good-soft: "#e0f4e9"
  bad: "#c8323c"
  bad-soft: "#fde4e5"
  note: "#fff2c2"
typography:
  display:
    fontFamily: "ui-rounded, \"SF Pro Rounded\", \"PingFang TC\", \"Noto Sans TC\", sans-serif"
    fontSize: "32px"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "0.01em"
  headline:
    fontFamily: "ui-rounded, \"SF Pro Rounded\", \"PingFang TC\", \"Noto Sans TC\", sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "0.01em"
  title:
    fontFamily: "ui-rounded, \"SF Pro Rounded\", \"PingFang TC\", \"Noto Sans TC\", sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1.25
  stat:
    fontFamily: "ui-rounded, \"SF Pro Rounded\", \"PingFang TC\", \"Noto Sans TC\", sans-serif"
    fontSize: "24px"
    fontWeight: 800
    fontFeature: "\"tnum\""
  body:
    fontFamily: "-apple-system, \"PingFang TC\", \"Noto Sans TC\", sans-serif"
    fontSize: "18px"
    fontWeight: 500
    lineHeight: 1.55
    fontFeature: "\"tnum\""
  label:
    fontFamily: "ui-rounded, \"SF Pro Rounded\", \"PingFang TC\", \"Noto Sans TC\", sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.2
  serial:
    fontFamily: "ui-monospace, Menlo, monospace"
    fontSize: "22px"
    fontWeight: 800
    letterSpacing: "0.12em"
rounded:
  inset: "9px"
  sm: "12px"
  md: "14px"
  base: "16px"
  lg: "18px"
  sheet: "22px"
  frame: "26px"
  pill: "999px"
spacing:
  xs: "6px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  xxl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.panel}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "56px"
  button-primary-home:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.panel}"
    rounded: "{rounded.md}"
    height: "68px"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "56px"
  button-small:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "48px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    height: "48px"
  button-selected:
    backgroundColor: "{colors.blue-soft}"
    textColor: "{colors.blue-deep}"
    rounded: "{rounded.md}"
  button-yes:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.good}"
    rounded: "{rounded.md}"
    height: "88px"
  button-no:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.bad}"
    rounded: "{rounded.md}"
    height: "88px"
  pet-card:
    backgroundColor: "{colors.gold}"
    rounded: "{rounded.frame}"
    padding: "12px"
    width: "420px"
  pet-card-face:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "17px"
    padding: "12px 14px 14px"
  item-card-t1:
    backgroundColor: "{colors.sky}"
    rounded: "{rounded.md}"
    padding: "6px"
  item-card-t2:
    backgroundColor: "{colors.gold}"
    rounded: "{rounded.md}"
    padding: "6px"
  item-card-locked:
    backgroundColor: "transparent"
    textColor: "{colors.locked}"
    rounded: "{rounded.md}"
  quest-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "10px 10px 12px"
    height: "220px"
  sheet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sheet}"
    padding: "22px 26px"
    width: "640px"
  serial-input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.base}"
    height: "76px"
    width: "380px"
  lesson-tag:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.panel}"
    rounded: "{rounded.pill}"
    padding: "4px 14px"
  rule-note:
    backgroundColor: "{colors.note}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "10px 16px"
---

# Design System: 我的 AI 寵物

## Overview

**Creative North Star: "我的卡，我養的數值"**

整個介面是一張攤在冷灰藍卡桌上的集換式卡牌。寵物是學生自己的金框卡，卡上的「資料量、資料品質、訓練次數、準確率」是他親手餵資料養出來的數值；完成任務得到的作品道具，是依稀有度換框的小卡；彈窗是一張攤開的奶白卡面。拒絕「白底圓角卡片＋綠色立體按鈕」的學習 App 預設樣子，也拒絕讓高年級覺得幼稚的糖果感：卡桌是冷靜的灰藍，字是深靛墨，熱鬧只留給卡框。

密度是課堂節奏：一屏一件事、一個藍色主要動作，老師一句話全班就跟得上。iPad 橫放 1024×768 是主要畫面，直放 768 仍維持兩欄。零外部依賴：字型只用系統的 PingFang TC 與 ui-rounded，圖示是自繪 SVG，所有插圖窗用 CSS 漸層，不載入任何外部字型、圖片或 CDN。

寵物本身的畫法（`pet/render.js`）是固定的品牌資產，不屬於這套系統的調整範圍；系統只負責放它的卡框與插圖窗。

**Key Characteristics:**
- 金框寵物卡＋奶白卡面＋深靛墨粗框線，是整個世界的母體。
- 稀有度用卡框表達：★ 天藍、★★ 金、★★★ 閃卡彩虹框；沒得到的是虛線「？」。
- 藍色只給每屏唯一的主要動作。
- 對＝綠、錯＝珊瑚紅，一定同時有符號（⭕／✗、✓／✗）與文字。
- 數值用粗圓體大數字、表格數字（tabular-nums）。
- 簽名動作：得到道具時卡片從背面翻到正面，閃卡反光掃過一次。

## Colors

冷灰藍卡桌、深靛墨字與框線、奶白卡面，再用金、天藍、彩虹三種卡框表達稀有度；藍色是唯一的行動色。

### Primary
- **行動藍**（`blue`）：只用在主要按鈕、選取中的選項、焦點外框、資料品質與接龍機率的進度條、文字游標。實作值比方向稿的 #3A7BFF 深一點，白字對比才達到 4.5:1。
- **深行動藍**（`blue-deep`）：主要按鈕的邊框、選取中按鈕的文字、接龍的抽中次數文字、藍色彈窗圖示。
- **淡行動藍**（`blue-soft`）：選取中按鈕與候選字的底色、序號輸入框的焦點光暈、彈窗圖示底。

### Secondary
- **寵物卡金**（`gold`）：寵物卡外框、★★ 道具卡框、能量格填滿、文字選取底色。
- **深金**（`gold-deep`）：★ 星形、守則與能量的圖示色、能量格邊框。
- **天藍卡框**（`sky`）：★ 道具卡框、領養空白卡的外框。

### Tertiary
- **閃卡彩虹**（`--holo`，`conic-gradient(from 200deg, #ff7eb6, #ffd23f, #7dffb0, #6ec8ff, #b18cff, #ff7eb6)`）：只給 ★★★ 道具卡與 ★★★ 任務卡的外框。漸層無法放進 frontmatter，完整值記在 sidecar。
- **對**（`good`／`good-soft`）：答對的選項、已完成的任務卡外圈、「對」按鈕、回顧清單的正確項。
- **錯**（`bad`／`bad-soft`）：答錯的選項、「錯」按鈕、錯誤訊息、序號不在名單的橫幅。

### Neutral
- **卡桌灰藍**（`table`）：整個頁面底色，也是 `theme-color`。
- **深卡桌**（`table-2`）：未解鎖插圖窗、接龍機率條的軌道、空能量格。
- **深靛墨**（`ink`）：所有文字、卡框線、按鈕預設邊框、堂次標籤底。
- **次要靛墨**（`ink-2`）：說明文字、數值列標題、序號標籤、ghost 按鈕文字。
- **分隔線**（`line`）：次要按鈕與選項的細框、小面板框、捲軸。
- **鎖住灰**（`locked`）：沒得到的道具卡與尚未開放的任務卡的虛線與字，在卡桌底上對比 ≥ 3:1。
- **卡面奶白**（`paper`）：寵物卡面、道具卡內面、任務卡面、彈窗、提示詞預覽。
- **白面板**（`panel`）：按鈕、對話泡泡、溫度滑桿、事實條、輸入框。
- **便條黃**（`note`）：守則條、提問條、金色彈窗圖示底。

### Named Rules
**The One Blue Rule.** 每一屏只有一個藍色實心按鈕。首頁依堂次切換哪一顆是 `primary`，其他動作一律白底墨框。

**The Frame Is the Rarity Rule.** 稀有度只用卡框顏色加星數表達：★ 天藍、★★ 金、★★★ 閃卡彩虹。卡面永遠是奶白，不因稀有度換底色（插圖窗可帶同色系淡漸層）。

**The Never Color Alone Rule.** 對與錯一定同時有圖示與文字：判斷按鈕是 ⭕「對」與 ✗「錯」，回顧清單是 ✓／✗ 圖示，已完成是 ✓「已完成」。色弱學生只看形狀也能判斷。

## Typography

**Display Font:** ui-rounded（SF Pro Rounded，退回 PingFang TC、Noto Sans TC）
**Body Font:** -apple-system（PingFang TC、Noto Sans TC）
**Label/Mono Font:** ui-monospace（Menlo），只給序號

**Character:** 標題、按鈕、數值用 800 粗的系統圓體，像卡牌上印的名字與數字；內文用系統黑體，教室投影下清楚好讀。全頁開啟 `tabular-nums`，數字跳動時不會左右晃。

### Hierarchy
- **Display**（800，32px，1.2）：領養卡標題這種一屏一個的大標。
- **Headline**（800，28px，1.25）：第 3 堂與提示詞頁的活動標題；題目句（`question`）用 26px。
- **Title**（800，24px，1.25）：區塊標題（「作品道具卡 n／9」）、對話泡泡（24～26px）、寵物卡數值。
- **Stat**（800，24px，表格數字）：寵物卡數值列；準確率的數字放大到 26px，跟在 18px 的「準確率」字樣後面。
- **Body**（500，18px，1.55）：說明、提示、卡片說明文字。最小字級就是 18px。
- **Label**（700，21px，1.2）：一般按鈕；首頁主要按鈕 24px；小按鈕 19px；判斷對錯按鈕 30px。
- **Serial**（800，等寬，字距 0.12～0.3em）：卡名列序號 22px、頂列序號 20px、序號輸入框 40px。

### Named Rules
**The 18px Floor Rule.** 任何會被學生讀的文字都不小於 18px，包括說明、機率百分比與溫度兩端文字。

**The Printed Number Rule.** 數值一律用粗圓體加表格數字，像印在卡上的數字，不用細字或灰色小字表示數值。

## Layout

畫面高度固定 `100dvh`，整頁不捲動（鎖定捲動、縮放與雙擊放大），內容在 `max-width: 1000px` 內置中，左右留 24px（活動頁 16px），上下尊重 safe-area。

首頁 iPad 橫放：頂列三欄（左名稱、中堂次標籤、右序號與隔開 28px 的「換人」），下方兩欄格線，左欄 `minmax(300px, 420px)` 是寵物卡，右欄是「作品道具卡」3×3 小卡格、提示句與貼底的主要按鈕，欄距 32px。寬度 ≤ 860px（iPad 直放）時兩欄等寬、欄距 20px、整塊垂直置中、插圖窗改 1:1；≤ 680px（分割畫面）才改成一欄並允許捲動。

活動頁（第 3 堂、提示詞積木）是可捲動的內容區：任務卡用 `auto-fill, minmax(280px, 1fr)` 格線、間距 16px；兩欄內容用可換行的 `flex: 1 1 340px`、最寬 480px。間距節奏以 6、8、12、16、24、32px 為主，卡內較密（6～12px），區塊之間 16～32px。

**The One Screen One Action Rule.** 每一屏只有一件要做的事，主要按鈕在橫放與直放都不必捲動就看得到。

## Elevation & Depth

卡片「放在桌上」的淺浮起：卡片用柔和的靛色陰影浮在卡桌上，彈窗與寵物卡浮得更高。深度主要靠卡框與粗墨線表達，陰影只是輔助，不用硬邊位移陰影。

### Shadow Vocabulary
- **lift**（`box-shadow: 0 2px 4px rgba(30, 33, 64, 0.08), 0 8px 20px rgba(30, 33, 64, 0.1)`）：道具小卡、任務卡、對話泡泡。
- **lift-big**（`box-shadow: 0 4px 10px rgba(30, 33, 64, 0.12), 0 18px 40px rgba(30, 33, 64, 0.18)`）：寵物卡、領養卡、彈窗。
- **primary-glow**（`box-shadow: 0 3px 8px rgba(47, 107, 235, 0.35)`）：主要按鈕；按下時縮成 `0 1px 3px`。
- **done-ring**（`box-shadow: var(--lift), 0 0 0 3px #167a4b`）：已完成的任務卡外圈。

### Named Rules
**The Locked Is Flat Rule.** 沒得到、還沒開放的卡片不浮起：拿掉陰影、改成虛線框，看起來是桌上的空位。

## Shapes

外框包內面的雙層圓角：外框圓角較大（寵物卡 26px、任務卡 18px、道具卡 14px），內面圓角較小（17px、10px、9px），中間露出的寬度就是卡框（寵物卡 12px、道具卡 6px、任務卡 5px 邊框）。插圖窗是 2.5～3px 深靛墨實線框、10～12px 圓角，像卡牌的圖框。按鈕 14px 圓角加 2.5px 墨框；彈窗 22px 圓角加 3px 墨框；堂次標籤是膠囊形。虛線只代表「空位、還沒有」：沒得到的道具卡、未開放的任務卡、領養卡的空白卡位與停用按鈕。

## Components

### Buttons
白底墨框、圓體粗字，按下時往下 2px 並縮到 0.98，像按在卡桌上。
- **Shape:** 柔和圓角（14px），2.5px 深靛墨邊框，最小 56×56px；小按鈕 48px 高、2px 框。
- **Primary:** 行動藍底、深行動藍框、白字 800 粗，帶藍色光暈；首頁主要按鈕滿寬、68px 高、24px 字。
- **Hover / Focus:** 觸控裝置不依賴 hover；`:focus-visible` 是 3px 行動藍外框、外推 3px；`:active` 位移加縮小，0.12 秒 ease-out。
- **Secondary / Ghost:** 一般按鈕即 secondary（白底墨框）；ghost 是透明底、分隔線框、次要靛墨字，只給「換人」這類會離開的動作，並與其他按鈕隔開。
- **Selected:** 淡行動藍底、行動藍框、深行動藍字（分頁、選中的候選字）。
- **Yes / No:** 判斷對錯用兩顆 88px 高的大按鈕，3px 綠框配 ⭕「對」、3px 珊瑚紅框配 ✗「錯」，字 30px。
- **Disabled:** 虛線框、字與框用 locked 色、卡桌底；不用透明度，文字對比才夠。

### Chips
- **Style:** 堂次標籤是深靛墨膠囊、白字 18px 圓體；序號標籤是等寬字加字距的次要靛墨字，沒有底色。
- **State:** 只有顯示用，沒有選取狀態。

### Cards / Containers
- **Corner Style:** 外框 14～26px、內面 9～17px（見 Shapes）。
- **Background:** 卡面一律卡面奶白；卡框依角色換色。
- **Shadow Strategy:** 一般卡 lift，寵物卡與彈窗 lift-big（見 Elevation & Depth）。
- **Border:** 卡框是實心色塊或漸層邊框，不是細線。
- **Internal Padding:** 6～14px，卡內很密，像卡牌排版。

### Inputs / Fields
- **Style:** 序號輸入框 76px 高、白底、3px 深靛墨框、16px 圓角、40px 等寬粗字、字距 0.3em、自動大寫。這是遊戲裡唯一需要打字的地方。
- **Focus:** 框線變行動藍，外加 4px 淡行動藍光暈。
- **Error / Disabled:** 錯誤訊息是框下方的珊瑚紅粗字，預留一行高度避免畫面跳動。
- **Slider:** 溫度滑桿 44px 高，`accent-color` 用行動藍，放在白面板裡，兩端有 18px 文字標示。

### Navigation
頂列（`grid-template-columns: 1fr auto 1fr`）：左邊「我的 AI 寵物」24px 粗圓體，中間堂次膠囊，右邊序號與 ghost「換人」。活動頁用底部的小按鈕「‹ 回到第 3 堂」「‹ 回到我的寵物」返回，左側帶返回箭頭圖示。

### 寵物卡（Signature）
420px 寬的金框卡：卡名列（等寬序號＋「準確率 72%」）、4:3 插圖窗（3px 墨框，內部是淡藍、淡紫、淡綠的柔光漸層，直放改 1:1）、數值列（資料量、資料品質、訓練次數，每列上方 1.5px 淡金分隔線）與一句次要靛墨的卡片說明。資料品質帶一條 12px 的行動藍進度條，寬度變化用 0.6 秒 `cubic-bezier(0.16, 1, 0.3, 1)`。插圖窗裡的寵物畫法固定，不在本系統範圍。

### 作品道具小卡
3×3 小卡格，每張外框 6px：★ 天藍、★★ 金、★★★ 閃卡彩虹，內面奶白、最小 84px 高，名稱 19px 粗圓體、下面一排深金實心星形（`stars()`，`aria-label` 念「n 星」）。沒得到的是 2.5px 鎖住灰虛線框、沒有陰影、中間一個「？」圖示。

### 任務卡（第 3 堂活動卡）
整張是按鈕：5px 卡框（依稀有度，未分級的用深靛墨）、奶白卡面、最小 220px 高。上方 92px 的插圖窗放 46px 的自繪圖示，左上角是稀有度星星、右上角是 28px 的深靛墨圓形建議順序數字；下面是 21px 卡名、18px 說明（「做什麼 › 得到什麼道具」）與 ✓「已完成」。已完成的卡加 3px 綠色外圈；未開放的卡變成虛線、卡桌底、無陰影。

### 彈窗（攤開的卡）
半透明深靛墨遮罩（42%）上的一張卡：奶白卡面、3px 墨框、22px 圓角、最寬 640px、置中排版，進場時由下往上浮 16px（0.35 秒）。頂端可有 72px 的圖示方塊（淡行動藍或便條黃底）。

### 道具翻卡（Signature motion）
得到作品道具時，一張 200px 寬、220px 高內面的道具卡在 `perspective: 900px` 中從 `rotateY(180deg) scale(0.8)` 翻到正面（0.8 秒），0.55 秒後一道白色斜向反光由左掃到右一次（0.9 秒）。減少動態效果時直接顯示正面、沒有反光。

### 圖示
`app/icons.js` 的自繪 SVG：24×24 viewBox、線寬 2.2、圓角端點與轉角、顏色跟著 `currentColor`，用 `createElementNS` 建立，不經過 innerHTML。預設大小 1.1em 跟著字走；判斷按鈕與回顧清單的 ✓／✗ 加粗到 2.8～3。星形是唯一的實心圖示。

### 對話泡泡與提示詞預覽
對話泡泡是白面板、2.5px 墨框、18px 圓角、24～26px 粗圓體，尾巴是旋轉 45° 的小方塊。提示詞預覽是奶白卡面、2.5px 墨框、18px 內文、行高 1.65、可選取文字。

## Do's and Don'ts

### Do:
- **Do** 每一屏只放一顆行動藍（#2F6BEB）實心按鈕，其他按鈕用白底 2.5px 深靛墨框。
- **Do** 用卡框顏色加星數表達稀有度：★ 天藍、★★ 金、★★★ 閃卡彩虹；卡面保持奶白。
- **Do** 對錯同時給顏色、圖示與文字（⭕／✗「對／錯」、✓「已完成」）。
- **Do** 觸控目標至少 44px（按鈕預設 56px），內文至少 18px。
- **Do** 數值用 800 粗圓體加表格數字。
- **Do** 新圖示照 `app/icons.js` 的規格自繪：24×24、線寬 2.2、圓角端點、`currentColor`。
- **Do** 每個動畫都在 `prefers-reduced-motion: reduce` 下關掉，並確保動畫沒跑時畫面仍完整（例如寵物的 pop 不從透明開始）。
- **Do** 用虛線框加鎖住灰（#6F769B）表示「還沒有」的空位。

### Don't:
- **Don't** 載入外部字型、圖片、圖示套件或 CDN；字型只用系統 PingFang TC 與 ui-rounded。
- **Don't** 只靠顏色傳遞對錯、狀態或稀有度。
- **Don't** 把藍色用在裝飾、標題或第二個主要動作上。
- **Don't** 做成「白底圓角卡片＋綠色立體按鈕」的學習 App 預設樣子，也不要糖果色到讓高年級覺得幼稚。
- **Don't** 修改寵物畫法（`pet/render.js`）來配合介面；介面只調整它的卡框與插圖窗。
- **Don't** 用表情符號字元當介面圖示；一律用自繪 SVG。
- **Don't** 把使用者輸入放進 innerHTML。
