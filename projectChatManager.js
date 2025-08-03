/**
 * プロジェクト全体チャット管理機能を提供するモジュール
 * プロジェクト全体に対応するチャット機能の管理
 */

// プロジェクトチャット機能の初期化用変数
let currentTaskAssociation = { type: 'global' };

// ===== プロジェクトチャット表示機能 =====



// ===== チャット履歴表示機能 =====


// 注意: getAssociationLabelはapp.jsの共通ユーティリティ関数を使用

// ===== メッセージ送信機能 =====


// ===== メッセージ削除・編集機能 =====


// ===== イベント処理 =====


// ===== プロジェクト切り替え連携 =====

/**
 * プロジェクト切り替え時に呼ばれる関数
 * 埋め込みチャット画面の内容を更新
 */
function onProjectSwitched() {
    // 埋め込みプロジェクトチャットのタスク関連付けオプションと履歴を更新
    if (typeof updateEmbeddedTaskAssociationOptions === 'function') {
        updateEmbeddedTaskAssociationOptions();
    }
    if (typeof renderEmbeddedProjectChatHistory === 'function') {
        renderEmbeddedProjectChatHistory();
    }
}

// ===== ユーティリティ関数 =====

/**
 * チャット履歴コンテナを一番下までスクロール
 * @param {HTMLElement} container - スクロール対象のコンテナ
 */
// scrollChatToBottom関数はapp.jsの共通ユーティリティ関数として移動

// 注意: escapeHtml, formatTimestampは
// app.jsの共通ユーティリティ関数を使用してください