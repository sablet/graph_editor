/**
 * メモ管理機能を提供するモジュール
 * ノードに対応するメモ（一人用、ユーザー投稿限定）の管理
 */

// メモ機能の初期化用変数
let selectedMemoNodeIndex = null;
let nodeChatHistory = {}; // dataManager.jsで定義されているグローバル変数

// ===== メモ表示機能 =====

/**
 * メモ一覧を表示
 * @param {number} nodeIndex - ノードのインデックス
 */
function renderMemoList(nodeIndex) {
    selectedMemoNodeIndex = nodeIndex;
    const memoListContainer = document.getElementById('memo-list');
    
    if (!memoListContainer) return;
    
    const memos = getChatHistory(nodeIndex);
    
    if (memos.length === 0) {
        memoListContainer.innerHTML = `
            <div class="memo-empty">
                まだメモがありません
            </div>
        `;
        return;
    }
    
    memoListContainer.innerHTML = '';
    
    // メモを新しい順に表示
    const sortedMemos = [...memos].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    sortedMemos.forEach(memo => {
        const memoElement = createMemoElement(memo, nodeIndex);
        memoListContainer.appendChild(memoElement);
    });
}

/**
 * メモ要素を作成
 * @param {object} memo - メモオブジェクト
 * @param {number} nodeIndex - ノードのインデックス
 * @returns {HTMLElement} メモ要素
 */
function createMemoElement(memo, nodeIndex) {
    const memoItem = document.createElement('div');
    memoItem.className = 'memo-item';
    memoItem.setAttribute('data-memo-id', memo.id);
    
    const timestamp = formatTimestamp(memo.timestamp);
    
    memoItem.innerHTML = `
        <div class="memo-content">${escapeHtml(memo.content)}</div>
        <div class="memo-meta">
            <div class="memo-timestamp">${timestamp}</div>
            <div class="memo-actions">
                <button class="memo-delete-btn" onclick="deleteMemo(${nodeIndex}, '${memo.id}')">削除</button>
            </div>
        </div>
    `;
    
    return memoItem;
}

/**
 * HTMLエスケープ
 * @param {string} text - エスケープするテキスト
 * @returns {string} エスケープされたテキスト
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * タイムスタンプをフォーマット
 * @param {string} timestamp - ISO形式のタイムスタンプ
 * @returns {string} フォーマットされたタイムスタンプ
 */
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    // 1分未満
    if (diff < 60000) {
        return 'たった今';
    }
    
    // 1時間未満
    if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes}分前`;
    }
    
    // 24時間未満
    if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours}時間前`;
    }
    
    // 7日未満
    if (diff < 604800000) {
        const days = Math.floor(diff / 86400000);
        return `${days}日前`;
    }
    
    // それ以外は日付表示
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// ===== メモ追加機能 =====

/**
 * 新しいメモを追加
 */
function addNewMemo() {
    const memoInput = document.getElementById('new-memo-input');
    
    if (!memoInput || selectedMemoNodeIndex === null) {
        return;
    }
    
    const content = memoInput.value.trim();
    
    if (content === '') {
        alert('メモ内容を入力してください');
        return;
    }
    
    // dataManager.jsのaddChatMessage関数を使用（ユーザー投稿限定）
    const message = addChatMessage(selectedMemoNodeIndex, content, 'user');
    
    if (message) {
        // 入力をクリア
        memoInput.value = '';
        
        // メモ一覧を更新
        renderMemoList(selectedMemoNodeIndex);
        
        console.log('メモが追加されました:', message);
    }
}

// ===== メモ削除機能 =====

/**
 * メモを削除
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} messageId - メッセージID
 */
function deleteMemo(nodeIndex, messageId) {
    if (confirm('このメモを削除しますか？')) {
        // dataManager.jsのdeleteChatMessage関数を使用
        const deleted = deleteChatMessage(nodeIndex, messageId);
        
        if (deleted) {
            // メモ一覧を更新
            renderMemoList(nodeIndex);
            console.log('メモが削除されました');
        } else {
            alert('メモの削除に失敗しました');
        }
    }
}

// ===== イベント処理 =====

/**
 * メモ機能の初期化（ページ読み込み後に実行）
 */
function initializeMemoFeatures() {
    // メモ入力でCtrl+Enterキーの処理
    const memoInput = document.getElementById('new-memo-input');
    if (memoInput) {
        memoInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                addNewMemo();
            }
        });
    }
}

/**
 * ノード選択時にメモを表示
 * @param {number} nodeIndex - ノードのインデックス
 */
function showNodeMemos(nodeIndex) {
    renderMemoList(nodeIndex);
}

/**
 * メモセクションを非表示にする
 */
function hideMemoSection() {
    selectedMemoNodeIndex = null;
    const memoListContainer = document.getElementById('memo-list');
    if (memoListContainer) {
        memoListContainer.innerHTML = '';
    }
    
    const memoInput = document.getElementById('new-memo-input');
    if (memoInput) {
        memoInput.value = '';
    }
}