/**
 * ノードタブ管理機能を提供するモジュール
 * タスク、チャット、プロジェクトチャットのタブ切り替えを管理
 */

// ノードタブ管理の状態
let currentNodeTab = 'tasks';
let currentSelectedNodeIndex = null;

// ===== タブ切り替え機能 =====

/**
 * ノードタブを切り替え
 * @param {string} tabName - タブ名 ('tasks', 'project-chat')
 */
function switchNodeTab(tabName) {
    // タブボタンの状態更新
    const tabButtons = document.querySelectorAll('.node-tab-button');
    tabButtons.forEach(button => {
        button.classList.remove('active');
        if (button.dataset.nodeTab === tabName) {
            button.classList.add('active');
        }
    });
    
    // タブコンテンツの表示切り替え
    const tabContents = document.querySelectorAll('.node-tab-content');
    tabContents.forEach(content => {
        content.style.display = 'none';
    });
    
    const targetContent = document.getElementById(`${tabName}-tab`);
    if (targetContent) {
        targetContent.style.display = 'block';
    }
    
    currentNodeTab = tabName;
    
    // タブ切り替え時の処理
    onNodeTabSwitched(tabName);
    
    console.log(`ノードタブを切り替えました: ${tabName}`);
}

/**
 * タブ切り替え時の追加処理
 * @param {string} tabName - 切り替え先のタブ名
 */
function onNodeTabSwitched(tabName) {
    if (currentSelectedNodeIndex === null) return;
    
    switch (tabName) {
        case 'tasks':
            // タスクタブ：特に追加処理なし（既存の機能が動作）
            break;
            
        case 'project-chat':
            // プロジェクトチャットタブ：埋め込みチャットを初期化
            initializeEmbeddedProjectChat();
            break;
    }
}

// ===== 埋め込みプロジェクトチャット機能 =====

/**
 * 埋め込みプロジェクトチャット機能を初期化
 */
function initializeEmbeddedProjectChat() {
    updateEmbeddedTaskAssociationOptions();
    renderEmbeddedProjectChatHistory();
    
    // プレビューパネルのプロジェクトチャットタブでは、現在のノードを自動設定しない
    // ノードタブでのみ自動設定を行う（かつ、有効なノードインデックスの場合のみ）
    if (isValidNodeIndex(currentSelectedNodeIndex) && 
        document.getElementById('task-list-container')?.style.display !== 'none') {
        const select = document.getElementById('embedded-task-association-select');
        if (select) {
            select.value = `node_${currentSelectedNodeIndex}`;
        }
    }
}

/**
 * 埋め込みタスク関連付けオプションを更新
 */
function updateEmbeddedTaskAssociationOptions() {
    const select = document.getElementById('embedded-task-association-select');
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
 * 埋め込みプロジェクトチャット履歴を表示
 */
function renderEmbeddedProjectChatHistory() {
    const historyContainer = document.getElementById('embedded-project-chat-history');
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
    
    // メッセージを古い順に表示（新しいメッセージが下に来る）
    const sortedMessages = [...messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    
    sortedMessages.forEach(message => {
        const messageElement = createEmbeddedChatMessageElement(message);
        historyContainer.appendChild(messageElement);
    });
    
    // 一番下までスクロール
    scrollChatToBottom(historyContainer);
}

/**
 * 埋め込みチャットメッセージ要素を作成
 * @param {object} message - メッセージオブジェクト
 * @returns {HTMLElement} メッセージ要素
 */
function createEmbeddedChatMessageElement(message) {
    const messageItem = document.createElement('div');
    messageItem.className = 'project-chat-message';
    messageItem.setAttribute('data-message-id', message.id);
    
    const timestamp = formatTimestamp(message.timestamp);
    const associationLabel = getAssociationLabel(message.associatedTask);
    
    messageItem.innerHTML = `
        <div class="message-header">
            <span class="message-timestamp">${timestamp}</span>
            <div class="message-menu">
                <button class="message-menu-button" onclick="toggleEmbeddedMessageMenu(event, '${message.id}')">⋯</button>
            </div>
        </div>
        <div class="message-content">${escapeHtml(message.content)}</div>
        <span class="association-label">${associationLabel}</span>
    `;
    
    return messageItem;
}

/**
 * 埋め込みタスク関連付けをクリア
 */
function clearEmbeddedTaskAssociation() {
    const select = document.getElementById('embedded-task-association-select');
    if (select) {
        select.value = 'global';
    }
}

/**
 * 埋め込みプロジェクトチャットメッセージを送信
 */
function sendEmbeddedProjectChatMessage() {
    const chatInput = document.getElementById('embedded-project-chat-input');
    if (!chatInput) return;
    
    const content = chatInput.value.trim();
    if (content === '') {
        alert('メッセージ内容を入力してください');
        return;
    }
    
    // 現在の関連タスク設定を取得
    const select = document.getElementById('embedded-task-association-select');
    const associatedTask = validateAndGetAssociatedTask(select?.value || 'global', select);
    
    // dataManager.jsのaddProjectChatMessage関数を使用
    const message = addProjectChatMessage(content, 'user', associatedTask);
    
    if (message) {
        // 入力をクリア
        chatInput.value = '';
        
        // チャット履歴を更新
        renderEmbeddedProjectChatHistory();
        
        console.log('埋め込みプロジェクトチャットメッセージが追加されました:', message);
    }
}

// ===== 埋め込みメッセージメニュー機能 =====

let currentEmbeddedMessageMenuDropdown = null;

/**
 * 埋め込みメッセージメニューの表示/非表示を切り替え
 * @param {Event} event - クリックイベント
 * @param {string} messageId - メッセージID
 */
function toggleEmbeddedMessageMenu(event, messageId) {
    event.stopPropagation();
    
    // 既存のメニューを閉じる
    closeEmbeddedMessageMenu();
    
    const rect = event.target.getBoundingClientRect();
    const dropdown = createEmbeddedMessageMenuDropdown(messageId);
    
    // ドロップダウンの位置を調整
    dropdown.style.left = `${rect.left - 80}px`;
    dropdown.style.top = `${rect.bottom + 5}px`;
    
    document.body.appendChild(dropdown);
    currentEmbeddedMessageMenuDropdown = dropdown;
    
    // クリック外しで閉じる
    setTimeout(() => {
        document.addEventListener('click', closeEmbeddedMessageMenu, { once: true });
    }, 10);
}

/**
 * 埋め込みメッセージメニュードロップダウンを作成
 * @param {string} messageId - メッセージID
 * @returns {HTMLElement} ドロップダウン要素
 */
function createEmbeddedMessageMenuDropdown(messageId) {
    const dropdown = document.createElement('div');
    dropdown.className = 'message-menu-dropdown';
    
    dropdown.innerHTML = `
        <button onclick="editEmbeddedMessage('${messageId}')">
            ✏️ 編集
        </button>
        <button class="delete-action" onclick="deleteEmbeddedMessage('${messageId}')">
            🗑️ 削除
        </button>
    `;
    
    return dropdown;
}

/**
 * 埋め込みメッセージメニューを閉じる
 */
function closeEmbeddedMessageMenu() {
    if (currentEmbeddedMessageMenuDropdown) {
        currentEmbeddedMessageMenuDropdown.remove();
        currentEmbeddedMessageMenuDropdown = null;
    }
}

/**
 * 埋め込みメッセージを削除
 * @param {string} messageId - メッセージID
 */
function deleteEmbeddedMessage(messageId) {
    if (confirm('このメッセージを削除しますか？')) {
        // dataManager.jsのdeleteProjectChatMessage関数を使用
        const deleted = deleteProjectChatMessage(messageId);
        
        if (deleted) {
            // チャット履歴を更新
            renderEmbeddedProjectChatHistory();
            console.log('埋め込みメッセージが削除されました');
        } else {
            alert('メッセージの削除に失敗しました');
        }
    }
}

/**
 * 埋め込みメッセージをインライン編集モードに切り替え
 * @param {string} messageId - メッセージID
 */
function editEmbeddedMessage(messageId) {
    closeEmbeddedMessageMenu();
    
    // 既に編集中の要素があれば先にキャンセル
    cancelAllEmbeddedMessageEditing();
    
    const messageItem = document.querySelector(`#embedded-project-chat-history [data-message-id="${messageId}"]`);
    if (!messageItem) return;
    
    const messages = getProjectChatHistory();
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const contentElement = messageItem.querySelector('.message-content');
    const originalContent = message.content;
    
    // 現在の関連付けを取得
    const currentAssociation = message.associatedTask || { type: 'global' };
    
    // ノード選択ドロップダウンのオプションを生成
    let nodeOptions = '<option value="global">🌍 プロジェクト全体</option>';
    nodes.forEach((node, index) => {
        const selected = currentAssociation.type === 'node' && currentAssociation.nodeIndex === index ? ' selected' : '';
        nodeOptions += `<option value="node_${index}"${selected}>📍 [ノード${index + 1}: ${node.substring(0, 20)}${node.length > 20 ? '...' : ''}]</option>`;
    });
    
    // 編集フォームを作成
    contentElement.innerHTML = `
        <textarea class="message-edit-textarea" id="edit-textarea-${messageId}">${escapeHtml(originalContent)}</textarea>
        <div class="message-edit-node-selection">
            <label for="edit-node-select-${messageId}">関連ノード:</label>
            <select id="edit-node-select-${messageId}" class="message-edit-node-select">
                ${nodeOptions}
            </select>
        </div>
        <div class="message-edit-actions">
            <button class="message-edit-button message-edit-save" onclick="saveEmbeddedMessageEdit('${messageId}')">保存</button>
            <button class="message-edit-button message-edit-cancel" onclick="cancelEmbeddedMessageEdit()">キャンセル</button>
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
                saveEmbeddedMessageEdit(messageId);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEmbeddedMessageEdit();
            }
        });
    }
}

/**
 * 埋め込みメッセージ編集を保存
 * @param {string} messageId - メッセージID
 */
function saveEmbeddedMessageEdit(messageId) {
    const textarea = document.getElementById(`edit-textarea-${messageId}`);
    const nodeSelect = document.getElementById(`edit-node-select-${messageId}`);
    if (!textarea) return;
    
    const newContent = textarea.value.trim();
    
    if (newContent === '') {
        alert('メッセージ内容を入力してください');
        textarea.focus();
        return;
    }
    
    // 新しい関連付けを取得
    let newAssociation = { type: 'global' };
    if (nodeSelect && nodeSelect.value !== 'global') {
        const nodeIndex = parseInt(nodeSelect.value.replace('node_', ''));
        if (isValidNodeIndex(nodeIndex)) {
            newAssociation = { type: 'node', nodeIndex: nodeIndex };
        }
    }
    
    // dataManager.jsのupdateProjectChatMessage関数を使用（内容と関連付けの両方を更新）
    const updated = updateProjectChatMessageWithAssociation(messageId, newContent, newAssociation);
    
    if (updated) {
        // チャット履歴を更新
        renderEmbeddedProjectChatHistory();
        console.log('埋め込みメッセージが更新されました');
    } else {
        alert('メッセージの更新に失敗しました');
    }
}

/**
 * 埋め込みメッセージ編集をキャンセル
 */
function cancelEmbeddedMessageEdit() {
    // チャット履歴を再描画して元に戻す
    renderEmbeddedProjectChatHistory();
}

/**
 * 全ての埋め込みメッセージ編集をキャンセル
 */
function cancelAllEmbeddedMessageEditing() {
    const editingItems = document.querySelectorAll('#embedded-project-chat-history .message-edit-textarea');
    editingItems.forEach(textarea => {
        renderEmbeddedProjectChatHistory();
    });
}

// ===== ノード選択連携 =====

/**
 * ノード選択時に呼ばれる関数
 * @param {number} nodeIndex - 選択されたノードのインデックス
 */
function onNodeSelected(nodeIndex) {
    currentSelectedNodeIndex = nodeIndex;
    
    // 現在のタブに応じて適切な初期化を実行
    onNodeTabSwitched(currentNodeTab);
}

/**
 * プロジェクト切り替え時に呼ばれる関数
 */
function onNodeTabProjectSwitched() {
    // ノード選択状態をリセット
    currentSelectedNodeIndex = null;
    
    if (currentNodeTab === 'project-chat') {
        // プロジェクトチャットタブが表示中の場合、チャット履歴を更新
        updateEmbeddedTaskAssociationOptions();
        renderEmbeddedProjectChatHistory();
    }
}

// ===== 初期化とイベント処理 =====

/**
 * プロジェクトチャット機能の初期化
 */
function initializeProjectChatFeatures() {
    // 初期化時にプロジェクトチャット履歴とオプションを表示
    updateEmbeddedTaskAssociationOptions();
    renderEmbeddedProjectChatHistory();
}

/**
 * ノードタブ機能の初期化
 */
function initializeNodeTabFeatures() {
    // 埋め込みプロジェクトチャット入力でCtrl+Enterキーの処理
    const embeddedChatInput = document.getElementById('embedded-project-chat-input');
    if (embeddedChatInput) {
        embeddedChatInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && e.ctrlKey) {
                e.preventDefault();
                sendEmbeddedProjectChatMessage();
            }
        });
    }
    
    // タスク関連付け選択の変更監視
    const embeddedSelect = document.getElementById('embedded-task-association-select');
    if (embeddedSelect) {
        embeddedSelect.addEventListener('change', function(e) {
            // 必要に応じて追加処理
        });
    }
}

// ===== ユーティリティ関数 =====

/**
 * チャット履歴コンテナを一番下までスクロール
 * @param {HTMLElement} container - スクロール対象のコンテナ
 */
// scrollChatToBottom関数はapp.jsの共通ユーティリティ関数として移動

// 注意: escapeHtml, formatTimestamp, getAssociationLabelは
// app.jsの共通ユーティリティ関数を使用してください