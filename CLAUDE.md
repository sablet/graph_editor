# Graph Editor プロジェクト編集方針

## プロジェクト概要
HTML+JavaScriptで動作するグラフエディタアプリケーション。ノード管理、階層関係設定、タスク管理、プロジェクト管理、チャット履歴管理機能を提供。

## UI構造（2カラムレイアウト + フッタータブ）

### レイアウト概要
- **2カラム構成**: 左パネル + 右パネル
- **フッタータブ**: 各パネル下部に専用タブ（左右独立）
- **モバイル対応**: タブ切り替えによる1カラム表示

### 左パネル（ノード・関係管理）
フッタータブで機能切り替え：
1. **ノード追加** (`data-footer-tab="nodes"`)
   - ノード追加フォーム
   - ノード一覧表示
2. **階層設定** (`data-footer-tab="relations"`)
   - 階層・リレーション設定フォーム
   - 階層関係一覧
   - リレーション一覧
3. **💬 プロジェクトチャット** (`data-footer-tab="chat"`)
   - タスク関連付け設定
   - チャット履歴表示
   - メッセージ入力エリア

### 右パネル（表示・分析）
フッタータブで機能切り替え：
1. **📋 全ノード表示** (`data-right-footer-tab="all-tasks"`)
   - 全体進捗バー
   - 全ノードタスク・ステータス管理
   - グローバルノード追加フォーム
2. **📝 タスクリスト** (`data-right-footer-tab="task-list"`)
   - フラットなタスク一覧
   - グループ化された表示
3. **📊 グラフプレビュー** (`data-right-footer-tab="graph"`)
   - Mermaidダイアグラム表示
   - ズーム・パン機能
   - 全画面表示機能
   - Mermaidコード表示（デバッグ用）

## アーキテクチャ
RDBMS移植を見据えたモジュール分離設計を採用。

### ファイル構成
- `index.html` - メインHTML、CSS、2カラムレイアウト、フッタータブ
- `dataManager.js` - データ管理・ストレージ（**RDBMS移植対象**）
- `taskManager.js` - タスク管理機能（**RDBMS移植対象**）  
- `graphManager.js` - ノード・関係管理（**RDBMS移植対象**）
- `memoManager.js` - メモ機能（一人用、ユーザー投稿限定）
- `projectChatManager.js` - プロジェクトチャット機能
- `nodeTabManager.js` - ノードタブ管理機能
- `app.js` - UI制御・イベント処理・統合・フッタータブ機能

## 編集原則

### 1. モジュール分離の維持
- 各モジュールの責務を明確に分離
- データ操作とUI操作の分離
- 相互依存を最小限に抑制

### 2. RDBMS移植準備
- **データ操作関数のみ変更**: `saveToLocalStorage()` → DB保存関数
- **UI機能は維持**: 表示・イベント処理は変更不要
- **後方互換性確保**: 既存データ形式をサポート

### 3. 機能追加時の指針
- 新機能は適切なモジュールに配置
- データ管理が必要な場合は`dataManager.js`に追加
- UI制御は`app.js`に集約
- フッタータブ機能の拡張は`app.js`の`initFooterTabs()`、`initRightFooterTabs()`で対応

### 4. コード品質
- 関数の単一責務原則
- 明確な命名規則
- 適切なエラーハンドリング

## RDBMS移植時の作業範囲

### 変更対象（データ操作部分のみ）
- `dataManager.js`: LocalStorage → データベース操作
- `taskManager.js`: タスクCRUD → データベースCRUD
- `graphManager.js`: ノード・関係CRUD → データベースCRUD
- `memoManager.js`: メモ表示・UI機能（dataManager.jsの関数を使用）
- `projectChatManager.js`: プロジェクトチャットCRUD

### 変更不要（UI・表示部分）
- `app.js`: UI制御・イベント処理・フッタータブ機能
- `index.html`: HTML構造・CSS・2カラムレイアウト
- `nodeTabManager.js`: ノードタブ管理
- 全ての表示・操作機能

## データ構造

### ノードチャット履歴
```javascript
nodeChatHistory = {
  [nodeIndex]: [
    {
      id: "chat_timestamp_randomId",
      content: "チャット内容",
      timestamp: "2024-01-01T12:00:00.000Z",
      type: "user" // "assistant", "system"
    }
  ]
}
```

### チャット履歴CRUD関数
- `addChatMessage(nodeIndex, content, type)`: メッセージ追加
- `getChatHistory(nodeIndex)`: 履歴取得
- `deleteChatMessage(nodeIndex, messageId)`: 個別メッセージ削除
- `clearNodeChatHistory(nodeIndex)`: ノード履歴全削除
- `updateChatMessage(nodeIndex, messageId, newContent)`: メッセージ更新
- `cleanupChatHistoryAfterNodeDeletion(deletedNodeIndex)`: 削除時クリーンアップ

### メモ機能（memoManager.js）
- 一人用メモ機能（ユーザー投稿限定、type: 'user'のみ）
- 表示場所：右パネル→全ノード表示→ノードタスク管理→ノード選択後→新しいタスク入力の下
- 主要関数：
  - `renderMemoList(nodeIndex)`: メモ一覧表示
  - `addNewMemo()`: 新しいメモ追加
  - `deleteMemo(nodeIndex, messageId)`: メモ削除
  - `showNodeMemos(nodeIndex)`: ノード選択時メモ表示
- キーボードショートカット：Ctrl+Enterでメモ追加

## フッタータブ機能

### 実装関数
- `initFooterTabs()`: 左パネル用フッタータブ初期化
- `initRightFooterTabs()`: 右パネル用フッタータブ初期化
- 各タブは独立して動作（左右のパネルが互いに影響しない）

### データ属性
**左パネル:**
- `data-footer-tab`: タブボタンの識別子
- `data-footer-section`: 対応するセクションの識別子

**右パネル:**
- `data-right-footer-tab`: タブボタンの識別子  
- `data-right-footer-section`: 対応するセクションの識別子

### CSS構造
- `.footer-tabs-left`: 左パネル用フッタータブ（画面左半分）
- `.footer-tabs-right`: 右パネル用フッタータブ（画面右半分）
- モバイル対応：右パネルタブは非表示、左パネルタブのみ全幅表示

## 注意事項
- プロジェクト作成・切り替え時は`updateProjectUI()`で全UI更新
- 進捗統計は`updateOverallProgress()`で明示的更新
- 重複コード・関数定義の回避
- チャット履歴はノード削除時に自動クリーンアップされる
- 古いプレビュータブ機能は無効化済み（`setupPreviewTabs()`等をコメントアウト）
- フッタータブ機能はメインの`DOMContentLoaded`で初期化される