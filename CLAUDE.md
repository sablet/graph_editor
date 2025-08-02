# Graph Editor プロジェクト編集方針

## プロジェクト概要
HTML+JavaScriptで動作するグラフエディタアプリケーション。ノード管理、階層関係設定、タスク管理、プロジェクト管理、チャット履歴管理機能を提供。

## アーキテクチャ
RDBMS移植を見据えたモジュール分離設計を採用。

### ファイル構成
- `index.html` - メインHTML、スクリプト読み込み
- `dataManager.js` - データ管理・ストレージ（**RDBMS移植対象**）
- `taskManager.js` - タスク管理機能（**RDBMS移植対象**）  
- `graphManager.js` - ノード・関係管理（**RDBMS移植対象**）
- `memoManager.js` - メモ機能（一人用、ユーザー投稿限定）
- `app.js` - UI制御・イベント処理・統合

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

### 変更不要（UI・表示部分）
- `app.js`: UI制御・イベント処理
- `index.html`: HTML構造・CSS
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
- 表示場所：プレビュー→ノードタスク管理→ノード選択後→新しいタスク入力の下
- 主要関数：
  - `renderMemoList(nodeIndex)`: メモ一覧表示
  - `addNewMemo()`: 新しいメモ追加
  - `deleteMemo(nodeIndex, messageId)`: メモ削除
  - `showNodeMemos(nodeIndex)`: ノード選択時メモ表示
- キーボードショートカット：Ctrl+Enterでメモ追加

## 注意事項
- プロジェクト作成・切り替え時は`updateProjectUI()`で全UI更新
- 進捗統計は`updateOverallProgress()`で明示的更新
- 重複コード・関数定義の回避
- チャット履歴はノード削除時に自動クリーンアップされる