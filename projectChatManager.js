/**
 * プロジェクト全体チャット管理機能を提供するモジュール
 * プロジェクト全体に対応するチャット機能の管理
 */

// プロジェクトチャット機能の初期化用変数
let currentTaskAssociation = { type: 'global' };
let isProjectChatVisible = false;

// ===== プロジェクトチャット表示機能 =====

/**
 * プロジェクト全体チャット画面を表示
 */
function showProjectChat() {
    const modal = document.getElementById('project-chat-modal');
    if (!modal) return;
    
    modal.style.display = 'block';
    isProjectChatVisible = true;
    
    // 初期化
    updateTaskAssociationOptions();
    
    // 現在のプロジェクトのチャット履歴のみを表示
    renderProjectChatHistory();
    
    // 入力フィールドにフォーカス
    const chatInput = document.getElementById('project-chat-input');
    if (chatInput) {
        setTimeout(() => chatInput.focus(), 100);
    }
    
    console.log('プロジェクトチャット画面を表示しました - プロジェクトID:', currentProjectId || 'なし');
}

/**
 * プロジェクト全体チャット画面を閉じる
 */
function closeProjectChat() {
    const modal = document.getElementById('project-chat-modal');
    if (!modal) return;
    
    modal.style.display = 'none';
    isProjectChatVisible = false;
    
    // 入力をクリア
    const chatInput = document.getElementById('project-chat-input');
    if (chatInput) {
        chatInput.value = '';
    }
    
    console.log('プロジェクトチャット画面を閉じました');
}

/**
 * タスク関連付けオプションを更新
 */
function updateTaskAssociationOptions() {
    const select = document.getElementById('task-association-select');
    if (!select) return;
    
    // 現在の選択値を保存
    const currentValue = select.value;
    
    // 既存のノードオプションを削除
    const existingNodeOptions = select.querySelectorAll('option[data-node-index]');
    existingNodeOptions.forEach(option => option.remove());
    
    // ノードオプションを追加
    nodes.forEach((node, index) => {
        const option = document.createElement('option');
        option.value = `node_${index}`;
        option.setAttribute('data-node-index', index);
        option.textContent = `📍 [ノード${index + 1}: ${node.substring(0, 20)}${node.length > 20 ? '...' : ''}]`;
        select.appendChild(option);
    });
    
    // 選択値を復元（有効な場合のみ）
    if (currentValue === 'global') {
        select.value = currentValue;
    } else if (currentValue.startsWith('node_')) {
        const nodeIndex = parseInt(currentValue.replace('node_', ''));
        if (isValidNodeIndex(nodeIndex)) {
            select.value = currentValue;
        } else {
            select.value = 'global';
        }
    } else {
        select.value = 'global';
    }
}

/**
 * タスク関連付けをクリア
 */
function clearTaskAssociation() {
    const select = document.getElementById('task-association-select');
    if (select) {
        select.value = 'global';
        currentTaskAssociation = { type: 'global' };
    }
}

// ===== チャット履歴表示機能 =====

/**
 * プロジェクトチャット履歴を表示
 */
function renderProjectChatHistory() {
    const historyContainer = document.getElementById('project-chat-history');
    if (!historyContainer) return;
    
    const messages = getProjectChatHistory();
    
    if (messages.length === 0) {
        historyContainer.innerHTML = `
            <div class="chat-empty">
                まだメッセージがありません
            </div>
        `;
        return;
    }
    
    historyContainer.innerHTML = '';
    
    // メッセージを新しい順に表示
    const sortedMessages = [...messages].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    sortedMessages.forEach(message => {
        const messageElement = createProjectChatMessageElement(message);
        historyContainer.appendChild(messageElement);
    });
}

/**
 * プロジェクトチャットメッセージ要素を作成
 * @param {object} message - メッセージオブジェクト
 * @returns {HTMLElement} メッセージ要素
 */
function createProjectChatMessageElement(message) {
    const messageItem = document.createElement('div');
    messageItem.className = 'project-chat-message';
    messageItem.setAttribute('data-message-id', message.id);
    
    const timestamp = formatTimestamp(message.timestamp);
    const associationLabel = getAssociationLabel(message.associatedTask);
    
    messageItem.innerHTML = `
        <div class="message-header">
            <span class="message-timestamp">${timestamp}</span>
            <div class="message-menu">
                <button class="message-menu-button" onclick="toggleProjectMessageMenu(event, '${message.id}')">⋯</button>
            </div>
        </div>
        <div class="message-content">${escapeHtml(message.content)}</div>
        <span class="association-label">${associationLabel}</span>
    `;
    
    return messageItem;
}

// 注意: getAssociationLabelはapp.jsの共通ユーティリティ関数を使用

// ===== メッセージ送信機能 =====

/**
 * プロジェクトチャットメッセージを送信
 */
function sendProjectChatMessage() {
    const chatInput = document.getElementById('project-chat-input');
    if (!chatInput) return;
    
    const content = chatInput.value.trim();
    if (content === '') {
        alert('メッセージ内容を入力してください');
        return;
    }
    
    // 現在の関連タスク設定を取得
    const select = document.getElementById('task-association-select');
    const associatedTask = validateAndGetAssociatedTask(select?.value || 'global', select);
    
    // dataManager.jsのaddProjectChatMessage関数を使用
    const message = addProjectChatMessage(content, 'user', associatedTask);
    
    if (message) {
        // 入力をクリア
        chatInput.value = '';
        
        // チャット履歴を更新
        renderProjectChatHistory();
        
        console.log('プロジェクトチャットメッセージが追加されました:', message);
    }
}

// ===== メッセージ削除・編集機能 =====

let currentProjectMessageMenuDropdown = null;

/**
 * プロジェクトメッセージメニューの表示/非表示を切り替え
 * @param {Event} event - クリックイベント
 * @param {string} messageId - メッセージID
 */
function toggleProjectMessageMenu(event, messageId) {
    event.stopPropagation();
    
    // 既存のメニューを閉じる
    closeProjectMessageMenu();
    
    const rect = event.target.getBoundingClientRect();
    const dropdown = createProjectMessageMenuDropdown(messageId);
    
    // ドロップダウンの位置を調整
    dropdown.style.left = `${rect.left - 80}px`;
    dropdown.style.top = `${rect.bottom + 5}px`;
    
    document.body.appendChild(dropdown);
    currentProjectMessageMenuDropdown = dropdown;
    
    // クリック外しで閉じる
    setTimeout(() => {
        document.addEventListener('click', closeProjectMessageMenu, { once: true });
    }, 10);
}

/**
 * プロジェクトメッセージメニュードロップダウンを作成
 * @param {string} messageId - メッセージID
 * @returns {HTMLElement} ドロップダウン要素
 */
function createProjectMessageMenuDropdown(messageId) {
    const dropdown = document.createElement('div');
    dropdown.className = 'message-menu-dropdown';
    
    dropdown.innerHTML = `
        <button onclick="editProjectMessage('${messageId}')">
            ✏️ 編集
        </button>
        <button class="delete-action" onclick="deleteProjectMessage('${messageId}')">
            🗑️ 削除
        </button>
    `;
    
    return dropdown;
}

/**
 * プロジェクトメッセージメニューを閉じる
 */
function closeProjectMessageMenu() {
    if (currentProjectMessageMenuDropdown) {
        currentProjectMessageMenuDropdown.remove();
        currentProjectMessageMenuDropdown = null;
    }
}

/**
 * プロジェクトメッセージを削除
 * @param {string} messageId - メッセージID
 */
function deleteProjectMessage(messageId) {
    if (confirm('このメッセージを削除しますか？')) {
        // dataManager.jsのdeleteProjectChatMessage関数を使用
        const deleted = deleteProjectChatMessage(messageId);
        
        if (deleted) {
            // チャット履歴を更新
            renderProjectChatHistory();
            console.log('プロジェクトメッセージが削除されました');
        } else {
            alert('メッセージの削除に失敗しました');
        }
    }
}

/**
 * プロジェクトメッセージをインライン編集モードに切り替え
 * @param {string} messageId - メッセージID
 */
function editProjectMessage(messageId) {
    closeProjectMessageMenu();
    
    // 既に編集中の要素があれば先にキャンセル
    cancelAllProjectMessageEditing();
    
    const messageItem = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageItem) return;
    
    const messages = getProjectChatHistory();
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const contentElement = messageItem.querySelector('.message-content');
    const originalContent = message.content;
    
    // 編集フォームを作成
    contentElement.innerHTML = `
        <textarea class="message-edit-textarea" id="edit-textarea-${messageId}">${escapeHtml(originalContent)}</textarea>
        <div class="message-edit-actions">
            <button class="message-edit-button message-edit-save" onclick="saveProjectMessageEdit('${messageId}')">保存</button>
            <button class="message-edit-button message-edit-cancel" onclick="cancelProjectMessageEdit()">キャンセル</button>
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
                saveProjectMessageEdit(messageId);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelProjectMessageEdit();
            }
        });
    }
}

/**
 * プロジェクトメッセージ編集を保存
 * @param {string} messageId - メッセージID
 */
function saveProjectMessageEdit(messageId) {
    const textarea = document.getElementById(`edit-textarea-${messageId}`);
    if (!textarea) return;
    
    const newContent = textarea.value.trim();
    
    if (newContent === '') {
        alert('メッセージ内容を入力してください');
        textarea.focus();
        return;
    }
    
    // dataManager.jsのupdateProjectChatMessage関数を使用
    const updated = updateProjectChatMessage(messageId, newContent);
    
    if (updated) {
        // チャット履歴を更新
        renderProjectChatHistory();
        console.log('プロジェクトメッセージが更新されました');
    } else {
        alert('メッセージの更新に失敗しました');
    }
}

/**
 * プロジェクトメッセージ編集をキャンセル
 */
function cancelProjectMessageEdit() {
    // チャット履歴を再描画して元に戻す
    renderProjectChatHistory();
}

/**
 * 全てのプロジェクトメッセージ編集をキャンセル
 */
function cancelAllProjectMessageEditing() {
    const editingItems = document.querySelectorAll('.message-edit-textarea');
    editingItems.forEach(textarea => {
        renderProjectChatHistory();
    });
}

// ===== イベント処理 =====

/**
 * プロジェクトチャット機能の初期化（ページ読み込み後に実行）
 */
function initializeProjectChatFeatures() {
    // プロジェクトチャット入力でCtrl+Enterキーの処理
    const chatInput = document.getElementById('project-chat-input');
    if (chatInput) {
        chatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                sendProjectChatMessage();
            }
        });
    }
    
    // モーダル外クリックで閉じる
    const modal = document.getElementById('project-chat-modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                closeProjectChat();
            }
        });
    }
    
    // タスク関連付け選択の変更監視
    const select = document.getElementById('task-association-select');
    if (select) {
        select.addEventListener('change', function(e) {
            const selectedValue = e.target.value;
            if (selectedValue.startsWith('node_')) {
                const nodeIndex = parseInt(selectedValue.replace('node_', ''));
                currentTaskAssociation = {
                    type: 'node',
                    nodeIndex: nodeIndex,
                    nodeName: nodes[nodeIndex] || null
                };
            } else {
                currentTaskAssociation = { type: 'global' };
            }
        });
    }
}

// ===== プロジェクト切り替え連携 =====

/**
 * プロジェクト切り替え時に呼ばれる関数
 * チャット画面が開いていれば内容を更新
 */
function onProjectSwitched() {
    if (isProjectChatVisible) {
        // タスク関連付けオプションを更新
        updateTaskAssociationOptions();
        
        // チャット履歴を更新（現在のプロジェクトのもののみ表示）
        renderProjectChatHistory();
        
        console.log('プロジェクト切り替えに伴いチャット履歴を更新しました - プロジェクトID:', currentProjectId || 'なし');
    }
    
    // 埋め込みプロジェクトチャットのタスク関連付けオプションと履歴も更新
    if (typeof updateEmbeddedTaskAssociationOptions === 'function') {
        updateEmbeddedTaskAssociationOptions();
    }
    if (typeof renderEmbeddedProjectChatHistory === 'function') {
        renderEmbeddedProjectChatHistory();
    }
}

// ===== ユーティリティ関数 =====
// 注意: escapeHtml, formatTimestampは
// app.jsの共通ユーティリティ関数を使用してください