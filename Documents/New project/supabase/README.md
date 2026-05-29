# Supabase 資料結構預留

這個資料夾放的是之後把本地 JSON 存檔切到 Supabase 時要用的 schema 草稿。

## 目前狀態

- 實際執行中的持久化仍然是 `server/data/store.json`
- Supabase 目前不是本地遊玩的必要條件
- migration 內已經先留好這些表：
  - `profiles`
  - `characters`
  - `battle_records`
  - `battle_participants`
  - `activity_logs`

## 已先納入的欄位方向

- 角色基礎資料
- 血量 / 精神力
- 背包
- 狀態欄
- 副欄位
- 行動隊列
- 討伐紀錄

## 之後切換到 Supabase 的路徑

1. 建立 Supabase 專案
2. 套用 `supabase/migrations/` 裡的 SQL
3. 補上 `.env` 裡的：
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. 把目前本地 JSON 的 persistence adapter 換成 Supabase 版本
