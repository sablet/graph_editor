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
 * メモ要素を作成（チャット風）
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
        <div class="memo-timestamp">${timestamp}</div>
        <div class="memo-content-wrapper">
            <div class="memo-content">${escapeHtml(memo.content)}</div>
            <div class="memo-menu">
                <button class="memo-menu-button" onclick="toggleMemoMenu(event, ${nodeIndex}, '${memo.id}')">⋯</button>
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

// ===== 三点リーダーメニュー機能 =====

let currentMemoMenuDropdown = null;

/**
 * メモメニューの表示/非表示を切り替え
 * @param {Event} event - クリックイベント
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} messageId - メッセージID
 */
function toggleMemoMenu(event, nodeIndex, messageId) {
    event.stopPropagation();
    
    // 既存のメニューを閉じる
    closeMemoMenu();
    
    const rect = event.target.getBoundingClientRect();
    const dropdown = createMemoMenuDropdown(nodeIndex, messageId);
    
    // ドロップダウンの位置を調整
    dropdown.style.left = `${rect.left - 80}px`;
    dropdown.style.top = `${rect.bottom + 5}px`;
    
    document.body.appendChild(dropdown);
    currentMemoMenuDropdown = dropdown;
    
    // クリック外しで閉じる
    setTimeout(() => {
        document.addEventListener('click', closeMemoMenu, { once: true });
    }, 10);
}

/**
 * メモメニュードロップダウンを作成
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} messageId - メッセージID
 * @returns {HTMLElement} ドロップダウン要素
 */
function createMemoMenuDropdown(nodeIndex, messageId) {
    const dropdown = document.createElement('div');
    dropdown.className = 'memo-menu-dropdown';
    
    dropdown.innerHTML = `
        <button onclick="editMemo(${nodeIndex}, '${messageId}')">
            ✏️ 編集
        </button>
        <button class="delete-action" onclick="deleteMemo(${nodeIndex}, '${messageId}')">
            🗑️ 削除
        </button>
    `;
    
    return dropdown;
}

/**
 * メモメニューを閉じる
 */
function closeMemoMenu() {
    if (currentMemoMenuDropdown) {
        currentMemoMenuDropdown.remove();
        currentMemoMenuDropdown = null;
    }
}

/**
 * メモをインライン編集モードに切り替え
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} messageId - メッセージID
 */
function editMemo(nodeIndex, messageId) {
    closeMemoMenu();
    
    // 既に編集中の要素があれば先にキャンセル
    cancelAllEditing();
    
    const memoItem = document.querySelector(`[data-memo-id="${messageId}"]`);
    if (!memoItem) return;
    
    const memos = getChatHistory(nodeIndex);
    const memo = memos.find(m => m.id === messageId);
    if (!memo) return;
    
    const contentWrapper = memoItem.querySelector('.memo-content-wrapper');
    const originalContent = memo.content;
    
    // 編集フォームを作成
    contentWrapper.innerHTML = `
        <div class="memo-content" style="flex: 1;">
            <textarea class="memo-edit-textarea" id="edit-textarea-${messageId}">${escapeHtml(originalContent)}</textarea>
            <div class="memo-edit-actions">
                <button class="memo-edit-button memo-edit-save" onclick="saveMemoEdit(${nodeIndex}, '${messageId}')">保存</button>
                <button class="memo-edit-button memo-edit-cancel" onclick="cancelMemoEdit(${nodeIndex}, '${messageId}', '${escapeForAttribute(originalContent)}')">キャンセル</button>
            </div>
        </div>
    `;
    
    // テキストエリアにフォーカス
    const textarea = document.getElementById(`edit-textarea-${messageId}`);
    if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        
        // Enterキーで保存、Escキーでキャンセル
        textarea.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                saveMemoEdit(nodeIndex, messageId);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelMemoEdit(nodeIndex, messageId, originalContent);
            }
        });
    }
}

/**
 * メモ編集を保存
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} messageId - メッセージID
 */
function saveMemoEdit(nodeIndex, messageId) {
    const textarea = document.getElementById(`edit-textarea-${messageId}`);
    if (!textarea) return;
    
    const newContent = textarea.value.trim();
    
    if (newContent === '') {
        alert('メモ内容を入力してください');
        textarea.focus();
        return;
    }
    
    // dataManager.jsのupdateChatMessage関数を使用
    const updated = updateChatMessage(nodeIndex, messageId, newContent);
    
    if (updated) {
        // メモ一覧を更新
        renderMemoList(nodeIndex);
        console.log('メモが更新されました');
    } else {
        alert('メモの更新に失敗しました');
    }
}

/**
 * メモ編集をキャンセル
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} messageId - メッセージID
 * @param {string} originalContent - 元の内容
 */
function cancelMemoEdit(nodeIndex, messageId, originalContent) {
    // メモ一覧を再描画して元に戻す
    renderMemoList(nodeIndex);
}

/**
 * 全ての編集をキャンセル
 */
function cancelAllEditing() {
    const editingItems = document.querySelectorAll('.memo-edit-textarea');
    editingItems.forEach(textarea => {
        const memoItem = textarea.closest('.memo-item');
        if (memoItem && selectedMemoNodeIndex !== null) {
            renderMemoList(selectedMemoNodeIndex);
        }
    });
}

/**
 * 属性用にエスケープ（シングルクォート対応）
 * @param {string} text - エスケープするテキスト
 * @returns {string} エスケープされたテキスト
 */
function escapeForAttribute(text) {
    return text.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
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