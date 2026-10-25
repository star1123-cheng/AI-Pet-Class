---
version: 1
slug: "index-html"
primary_target: "index.html"
related_targets: ["app/lesson3.js","app/prompt.js","app/main.js"]
---

# 學生端遊戲畫面（index.html 與 app/*.js 的各畫面）

Scope：領養、寵物首頁、第 3 堂各活動、提示詞積木頁與所有彈窗。Mode：Operate（學生在課堂上完成一個個活動）。Audience：10～12 歲，教室日光燈下的 iPad，偶爾投影。Constraints：零外部依賴（字型用系統 PingFang TC＋ui-rounded，CJK 字型太大不自帶）、觸控 ≥ 44 px、內文 ≥ 18 px、一屏一個主要動作；流程與文字內容不改（會影響課程的改動先問老師）；寵物畫法不動。

## Direction contract

THESIS：每隻寵物是一張屬於學生自己的集換式卡；AI 狀態是卡上的數值，作品道具是收集來的小卡。拒絕「白底圓角卡片＋綠色立體按鈕」的學習 App 預設樣子。

OWN-WORLD：冷灰藍卡桌底 #EEF1F8、深靛墨 #1E2140；寵物卡用金色粗卡框 #FFD23F 包住奶白卡面 #FFFBEA；道具卡依稀有度換框：★ 天藍、★★ 金、★★★ 閃卡彩虹框。藍只給主要動作（實作用 #2F6BEB，比 #3A7BFF 深一點，白字對比才夠 4.5:1）；對＝綠、錯＝珊瑚紅，一定同時有符號。數值用粗圓體大數字、表格數字。圖示是自繪 SVG，同一種線寬。

STORY：學生一進來就看到「我的卡」，知道數值是自己餵資料養出來的；完成任務時一張新道具卡翻面出現；做作品時把卡上的道具帶進提示詞。

FIRST VIEWPORT：iPad 橫放 1024×768。頂列左邊名稱、中間堂次、右邊序號與隔開的「換人」。左半 420 px 寬的金框寵物卡：卡名列（序號＋準確率）、寵物插圖窗、數值列（資料量、資料品質、訓練次數）。右半「作品道具卡 n／9」3×3 小卡格（未得到的是虛線「？」），下面是本堂藍色主要按鈕。

FORM：集換式卡牌，我的排序第 1（IMPECCABLE’S PICK），抽籤指定的是第 3「扭蛋機台」。seed:9bf9e9039b1c7adb。簽名動作：得到作品道具時，道具卡從背面翻到正面，閃卡框的反光掃過一次（減少動態效果時直接顯示正面）。

FINISH：unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
