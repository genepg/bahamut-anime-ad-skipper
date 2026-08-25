# Privacy Policy / 隱私權政策

Effective date / 生效日期: August 25, 2026

## English

### Overview

Bahamut Ani Ad Skip (the "Extension") respects your privacy. This policy explains how the Extension handles data.

### Data Collection and Use

The Extension does not collect, transmit, sell, or share personal information, browsing history, viewing history, account information, payment information, or other user content.

The Extension uses Chrome's `storage` capability only to save your two on/off preferences ("Enabled" and "Wait for reward"). They are synchronized through `chrome.storage.sync` between Chrome browsers where you are signed in, solely to remember how you want the Extension to behave.

The same two preferences are also mirrored into a single `localStorage` key (`__aniAdSkip_settings`) on the pages the Extension runs on. This is an internal mechanism that lets the Extension know your settings before the page starts running; it contains nothing but those two on/off values, and it is never read by or sent to anyone else.

### Website Access Permissions

The Extension requires access to `ani.gamer.com.tw` and the necessary Google advertising iframe domains loaded in Ani-Gamer's playback flow. These permissions are used only to run the Extension's page automation features, including handling age confirmations, login prompts, resuming a paused ad video, and visible, available skip, resume, or close controls.

The Extension does not make its own network requests and does not send any data to the developer or third-party servers.

### Data Retention and Deletion

The two on/off preferences described above are the only data stored by the Extension. You may change them at any time from the Extension's toolbar popup. Uninstalling the Extension removes its locally stored extension data from Chrome; the `__aniAdSkip_settings` mirror is removed by clearing the site's data for `ani.gamer.com.tw` in Chrome's settings.

### Third-Party Services

The Extension does not integrate analytics, tracking, advertising, or data-sale services. Ani-Gamer and third-party advertising content embedded on its pages remain subject to their own terms and privacy policies.

### Policy Updates

If this policy changes materially, the effective date on this page will be updated. Continued use of the Extension after an update indicates acceptance of the updated policy.

### Contact

For questions about this policy, please contact the developer through this project's GitHub Issues:
<https://github.com/genepg/bahamut-anime-ad-skipper/issues>

---

## 繁體中文

### 概述

「巴哈動畫瘋 跳廣告」（下稱「本擴充功能」）重視你的隱私。本政策說明本擴充功能如何處理資料。

### 資料收集與使用

本擴充功能不會收集、傳送、出售或分享你的個人資料、瀏覽紀錄、觀看紀錄、帳號資料、付款資料或其他使用者內容。

本擴充功能只會使用 Chrome 的 `storage` 功能儲存兩項開關偏好設定（「啟用」與「等待獎勵廣告」）。這些設定透過 `chrome.storage.sync` 與你已登入的 Chrome 瀏覽器同步，僅用於記住你希望本擴充功能如何運作。

相同的兩項設定也會寫入所執行頁面的單一 `localStorage` 鍵值（`__aniAdSkip_settings`）。這只是內部機制，讓擴充功能在頁面開始執行前就能得知你的設定；其中只有那兩個開關值，不會被他人讀取或傳送給任何人。

### 網站存取權限

本擴充功能需要存取 `ani.gamer.com.tw`，以及動畫瘋播放流程中載入的必要 Google 廣告 iframe 網域。這些權限僅用於在播放頁面執行自動化功能，包括處理年齡確認、登入提示、恢復被暫停的廣告影片，以及已顯示且可用的跳過、繼續或關閉控制項。

本擴充功能不會自行發出網路請求，也不會將任何資料傳送到開發者或第三方伺服器。

### 資料保留與刪除

唯一儲存的資料就是上述兩項開關偏好設定。你可以隨時在擴充功能工具列彈窗中變更；解除安裝本擴充功能後，Chrome 會移除其儲存的本機擴充功能資料，而 `__aniAdSkip_settings` 鍵值可透過在 Chrome 設定中清除 `ani.gamer.com.tw` 的網站資料來移除。

### 第三方服務

本擴充功能不整合分析、追蹤、廣告或資料販售服務。動畫瘋網站及其嵌入的第三方廣告內容，仍適用各自的服務條款與隱私權政策。

### 政策更新

若本政策有重大變更，將更新本頁的生效日期。繼續使用本擴充功能即表示你同意更新後的政策。

### 聯絡方式

如對本政策有疑問，請透過本專案的 GitHub Issues 聯絡開發者：
<https://github.com/genepg/bahamut-anime-ad-skipper/issues>
