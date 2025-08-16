/**
 * タスク管理機能を提供するモジュール
 * RDBMS移植時はこのファイル内のタスクデータ操作部分を変更すればよい
 */

// ===== タスクデータCRUD操作 =====

/**
 * ノードにタスクを追加
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} taskText - タスクのテキスト
 * @returns {string|boolean} 成功時はタスクID、失敗時はfalse
 */
function addTaskToNode(nodeIndex, taskText) {
    // 入力検証
    if (!taskText || taskText.trim() === '') {
        return false;
    }
    
    // ノード配列初期化
    if (!nodeTasks[nodeIndex]) {
        nodeTasks[nodeIndex] = [];
    }
    
    // 新規タスク作成
    const now = new Date().toISOString();
    const newTask = {
        id: "task_" + Date.now(),
        text: taskText.trim(),
        completed: false,
        createdAt: now,
        updatedAt: now,
        deleted: false
    };
    
    // 配列に追加
    nodeTasks[nodeIndex].push(newTask);
    
    // タスクリスト表示更新
    renderTaskList(nodeIndex);
    updateOverallProgress(); // 全体進捗も更新
    
    // LocalStorageに保存
    saveToLocalStorage();
    
    return newTask.id;
}

/**
 * ノードのタスク一覧を取得（削除済みタスクは除外）
 * @param {number} nodeIndex - ノードのインデックス
 * @returns {Array} タスクの配列
 */
function getNodeTasks(nodeIndex) {
    const tasks = nodeTasks[nodeIndex] || [];
    return tasks.filter(task => !task.deleted);
}

/**
 * 特定のタスクを取得
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} taskId - タスクID
 * @returns {Object|null} タスクオブジェクトまたはnull
 */
function getTaskById(nodeIndex, taskId) {
    const tasks = nodeTasks[nodeIndex] || [];
    return tasks.find(task => task.id === taskId) || null;
}

/**
 * 全タスクの統計情報を取得（削除済みタスクは除外）
 * @returns {Object} 総タスク数、完了数、達成率
 */
function getAllTaskStats() {
    let totalTasks = 0;
    let completedTasks = 0;
    
    Object.values(nodeTasks).forEach(tasks => {
        const activeTasks = tasks.filter(t => !t.deleted);
        totalTasks += activeTasks.length;
        completedTasks += activeTasks.filter(t => t.completed).length;
    });
    
    return {
        total: totalTasks,
        completed: completedTasks,
        percentage: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
    };
}

/**
 * タスクのテキストを更新
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} taskId - タスクID
 * @param {string} newText - 新しいテキスト
 * @returns {boolean} 成功時true、失敗時false
 */
function updateTaskText(nodeIndex, taskId, newText) {
    const tasks = nodeTasks[nodeIndex] || [];
    const task = tasks.find(t => t.id === taskId);
    
    if (task && newText.trim() !== '') {
        task.text = newText.trim();
        task.updatedAt = new Date().toISOString();
        renderTaskList(nodeIndex);
        updateOverallProgress(); // 全体進捗も更新
        
        // LocalStorageに保存
        saveToLocalStorage();
        return true;
    }
    
    return false;
}

/**
 * タスクの完了状態を切り替え
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} taskId - タスクID
 * @returns {boolean|null} 新しい完了状態またはnull
 */
function toggleTaskCompletion(nodeIndex, taskId) {
    const tasks = nodeTasks[nodeIndex] || [];
    const task = tasks.find(t => t.id === taskId);
    
    if (task) {
        task.completed = !task.completed;
        task.updatedAt = new Date().toISOString();
        renderTaskList(nodeIndex);
        updateOverallProgress(); // 全体進捗も更新
        
        // LocalStorageに保存
        saveToLocalStorage();
        return task.completed;
    }
    
    return null;
}

/**
 * タスクを削除（論理削除）
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} taskId - タスクID
 * @returns {boolean} 削除成功時true
 */
function deleteTask(nodeIndex, taskId) {
    if (!nodeTasks[nodeIndex]) {
        return false;
    }
    
    const task = nodeTasks[nodeIndex].find(t => t.id === taskId);
    
    if (task) {
        // 論理削除：削除マーカーを設定
        task.deleted = true;
        task.deletedAt = new Date().toISOString();
        task.updatedAt = new Date().toISOString();
        
        renderTaskList(nodeIndex);
        updateOverallProgress(); // 全体進捗も更新
        
        // LocalStorageに保存
        saveToLocalStorage();
        return true;
    }
    
    return false;
}

/**
 * ノードの全タスクを削除（論理削除）
 * @param {number} nodeIndex - ノードのインデックス
 * @returns {number} 削除されたタスク数
 */
function deleteAllNodeTasks(nodeIndex) {
    if (!nodeTasks[nodeIndex]) {
        return 0;
    }
    
    const activeTasks = nodeTasks[nodeIndex].filter(t => !t.deleted);
    const deleteCount = activeTasks.length;
    const now = new Date().toISOString();
    
    // 全てのアクティブタスクに削除マーカーを設定
    activeTasks.forEach(task => {
        task.deleted = true;
        task.deletedAt = now;
        task.updatedAt = now;
    });
    
    renderTaskList(nodeIndex);
    updateOverallProgress(); // 全体進捗も更新
    
    // LocalStorageに保存
    saveToLocalStorage();
    
    return deleteCount;
}

// ===== タスク管理UI関連機能 =====

/**
 * ノード選択セレクトボックスを更新
 */
function updateTaskNodeSelect() {
    const select = document.getElementById('task-node-select');
    if (!select) return;
    
    const currentValue = select.value;
    select.innerHTML = '<option value="">タスクを管理するノードを選択</option>';
    
    nodes.forEach((node, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${getNodeDisplayNumber(index)}. ${node}`;
        
        // タスク数を表示
        const taskCount = getNodeTasks(index).length;
        const completedCount = getNodeTasks(index).filter(t => t.completed).length;
        
        if (taskCount > 0) {
            option.textContent += ` (${completedCount}/${taskCount})`;
        }
        
        select.appendChild(option);
    });
    
    // 前の選択を復元
    if (currentValue !== '' && currentValue < nodes.length) {
        select.value = currentValue;
    }
}

/**
 * 選択されたノードのタスクを表示
 */
function showSelectedNodeTasks() {
    const select = document.getElementById('task-node-select');
    const nodeIndex = parseInt(select.value);
    
    if (!isValidNodeIndex(nodeIndex)) {
        hideTaskList();
        selectedNodeIndex = null;
        // メモセクションも非表示
        if (typeof hideMemoSection === 'function') {
            hideMemoSection();
        }
        return;
    }
    
    selectedNodeIndex = nodeIndex;
    showTaskList();
    renderSelectedNodeInfo(nodeIndex);
    renderTaskList(nodeIndex);
    
    // メモも表示
    if (typeof showNodeMemos === 'function') {
        showNodeMemos(nodeIndex);
    }
    
    // ノードタブ機能に通知
    if (typeof onNodeSelected === 'function') {
        onNodeSelected(nodeIndex);
    }
}

/**
 * 選択されたノードの情報を表示
 * @param {number} nodeIndex - ノードのインデックス
 */
function renderSelectedNodeInfo(nodeIndex) {
    const selectedNodeInfo = document.getElementById('selected-node-info');
    if (!selectedNodeInfo) return;
    
    const tasks = getNodeTasks(nodeIndex);
    const completedCount = tasks.filter(t => t.completed).length;
    const totalCount = tasks.length;
    const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
    const statusInfo = getNodeStatusInfo(nodeIndex);
    
    selectedNodeInfo.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <div style="font-weight: 600;">選択ノード: 「${getNodeDisplayNumber(nodeIndex)}. ${nodes[nodeIndex]}」</div>
            <div style="display: flex; align-items: center; gap: 8px;">
                <div onclick="openNodeStatusEditor(${nodeIndex})" 
                     style="background: ${statusInfo.color}; color: white; padding: 8px 16px; border-radius: 12px; font-size: 12px; font-weight: 500; display: flex; align-items: center; gap: 6px; cursor: pointer; border: none; transition: opacity 0.2s ease;"
                     onmouseover="this.style.opacity='0.8'" 
                     onmouseout="this.style.opacity='1'"
                     title="クリックしてステータスを変更">
                    <span>${statusInfo.label}</span>
                    <span style="font-size: 10px;">⚙️</span>
                </div>
            </div>
        </div>
        <span class="task-progress">進捗: ${completedCount}/${totalCount} 完了 (${percentage}%)</span>
    `;
}

/**
 * タスクリストを表示
 */
function showTaskList() {
    const taskContainer = document.getElementById('task-list-container');
    if (taskContainer) {
        taskContainer.style.display = 'block';
    }
    
    // タスクタブが選択されていない場合は自動的に切り替える
    const activeTab = document.querySelector('.preview-tab-button.active');
    if (activeTab && activeTab.dataset.previewTab !== 'tasks') {
        switchPreviewTab('tasks');
    }
}

/**
 * タスクリストを非表示
 */
function hideTaskList() {
    const taskContainer = document.getElementById('task-list-container');
    if (taskContainer) {
        taskContainer.style.display = 'none';
    }
}

/**
 * タスクリストをレンダリング
 * @param {number} nodeIndex - ノードのインデックス
 */
function renderTaskList(nodeIndex) {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;
    
    const tasks = getNodeTasks(nodeIndex);
    taskList.innerHTML = '';
    
    if (tasks.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.style.color = '#9ca3af';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.padding = '20px';
        emptyMessage.style.fontStyle = 'italic';
        emptyMessage.textContent = 'タスクがありません';
        taskList.appendChild(emptyMessage);
        return;
    }
    
    tasks.forEach(task => {
        const taskItem = createTaskItemElement(nodeIndex, task);
        taskList.appendChild(taskItem);
    });
}

/**
 * 新しいタスクを追加
 */
function addNewTask() {
    if (selectedNodeIndex === null) return;
    
    const input = document.getElementById('new-task-input');
    const taskText = input.value.trim();
    
    if (!taskText) return;
    
    const taskId = addTaskToNode(selectedNodeIndex, taskText);
    if (taskId) {
        input.value = '';
    }
}


/**
 * タスクメニューの表示切り替え
 * @param {string} taskId - タスクID
 */
function toggleTaskMenu(taskId) {
    const menu = document.getElementById(`menu-${taskId}`);
    const button = menu.previousElementSibling;
    
    // すべてのメニューを閉じる
    closeAllTaskMenus();
    closeAllNodeMenus();
    
    // 現在のメニューを表示
    if (menu && button && menu.style.display === 'none') {
        menu.style.display = 'block';
        positionMenu(button, menu);
        button.setAttribute('aria-expanded', 'true');
        menu.setAttribute('aria-hidden', 'false');
    }
}

/**
 * 全てのタスクメニューを閉じる
 */
function closeAllTaskMenus() {
    document.querySelectorAll('.task-menu-dropdown').forEach(menu => {
        menu.style.display = 'none';
        const button = menu.previousElementSibling;
        if (button) {
            button.setAttribute('aria-expanded', 'false');
            menu.setAttribute('aria-hidden', 'true');
        }
    });
}

/**
 * タスクを編集モードにする
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} taskId - タスクID
 * @param {HTMLElement} taskTextSpan - タスクテキスト要素
 */
function editTask(nodeIndex, taskId, taskTextSpan) {
    const currentText = taskTextSpan.textContent;
    
    // 編集用input要素を作成
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'task-edit-input';
    
    const saveEdit = () => {
        const newText = input.value.trim();
        if (newText && newText !== currentText) {
            updateTaskText(nodeIndex, taskId, newText);
        } else {
            taskTextSpan.textContent = currentText;
            taskTextSpan.style.display = '';
        }
        input.remove();
    };
    
    const cancelEdit = () => {
        taskTextSpan.style.display = '';
        input.remove();
    };
    
    // イベントリスナー
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
    
    input.addEventListener('blur', saveEdit);
    input.addEventListener('focus', () => {
        input.className = 'task-edit-input-focused';
    });
    input.addEventListener('blur', () => {
        input.className = 'task-edit-input';
    });
    
    // 既存テキストを隠して入力フィールドを挿入
    taskTextSpan.style.display = 'none';
    taskTextSpan.parentNode.insertBefore(input, taskTextSpan.nextSibling);
    input.focus();
    input.select();
}

// ===== 全ノード表示でのタスク管理機能 =====

/**
 * 全ノードのタスクとステータスを表示（ステータス別グルーピング）
 */
function renderAllNodeTasks() {
    const container = document.getElementById('all-tasks-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (nodes.length === 0) {
        container.innerHTML = '<div style="color: #9ca3af; text-align: center; padding: 40px; font-style: italic;">ノードがありません</div>';
        return;
    }
    
    // ノードをステータス別にグループ化
    const nodeGroups = Object.fromEntries(
        Object.values(NODE_STATUSES).map(status => [status.id, []])
    );
    
    // 共通の階層情報付きノードリストを使用
    const hierarchicalNodeInfo = getHierarchicalNodeInfo();
    
    hierarchicalNodeInfo.forEach(nodeInfo => {
        const statusInfo = getNodeStatusInfo(nodeInfo.nodeIndex);
        const statusId = statusInfo.id;
        
        if (nodeGroups[statusId]) {
            nodeGroups[statusId].push(nodeInfo);
        } else {
            // デフォルトは未開始に分類
            nodeGroups.not_started.push(nodeInfo);
        }
    });
    
    // ステータス表示順序とラベル
    const statusDisplayOrder = [
        NODE_STATUSES.NOT_STARTED,
        NODE_STATUSES.IN_PROGRESS,
        NODE_STATUSES.ON_HOLD,
        NODE_STATUSES.COMPLETED
    ];
    
    // グループごとに表示
    statusDisplayOrder.forEach(statusConfig => {
        const groupNodes = nodeGroups[statusConfig.id];
        if (groupNodes && groupNodes.length > 0) {
            renderNodeStatusGroup(container, statusConfig, groupNodes);
        }
    });
    
    // すべてのグループが空の場合
    const totalNodes = Object.values(nodeGroups).reduce((sum, group) => sum + group.length, 0);
    if (totalNodes === 0) {
        container.innerHTML = '<div style="color: #9ca3af; text-align: center; padding: 40px; font-style: italic;">ノードがありません</div>';
    }
}

/**
 * ノードステータスグループを描画
 * @param {HTMLElement} container - コンテナ要素
 * @param {Object} statusConfig - ステータス設定
 * @param {Array} groupNodes - グループ内のノード情報リスト
 */
function renderNodeStatusGroup(container, statusConfig, groupNodes) {
    const groupContainer = document.createElement('div');
    groupContainer.className = 'node-status-group';
    groupContainer.setAttribute('data-status-group', statusConfig.id);
    
    // グループヘッダー
    const groupHeader = document.createElement('div');
    groupHeader.className = 'node-status-group-header';
    // 静的スタイルはCSSクラスで、動的な色のみインラインで設定
    groupHeader.style.backgroundColor = `${statusConfig.color}08`;
    
    // 未完了以外は初期状態で折りたたみ
    const defaultCollapsed = statusConfig.id !== 'not_started';
    const isCollapsed = nodeStatusGroupCollapsed?.[statusConfig.id] ?? defaultCollapsed;
    
    // ヘッダーコンテンツ
    const headerContent = document.createElement('div');
    headerContent.className = 'header-content';
    
    const expandIcon = document.createElement('span');
    expandIcon.className = 'expand-icon';
    // 動的な色とトランスフォームのみインラインで設定
    expandIcon.style.color = statusConfig.color;
    expandIcon.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    expandIcon.textContent = '▼';
    
    const groupTitle = document.createElement('span');
    groupTitle.className = 'group-title';
    groupTitle.style.color = statusConfig.color;
    groupTitle.textContent = statusConfig.label;
    
    const groupCount = document.createElement('span');
    groupCount.className = 'group-count';
    groupCount.style.backgroundColor = statusConfig.color;
    groupCount.textContent = groupNodes.length;
    
    headerContent.appendChild(expandIcon);
    headerContent.appendChild(groupTitle);
    groupHeader.appendChild(headerContent);
    groupHeader.appendChild(groupCount);
    
    // ホバーエフェクト（動的な色のみ）
    groupHeader.addEventListener('mouseenter', function() {
        this.style.backgroundColor = `${statusConfig.color}12`;
    });
    
    groupHeader.addEventListener('mouseleave', function() {
        this.style.backgroundColor = `${statusConfig.color}08`;
    });
    
    // クリックイベント（折りたたみ機能）
    groupHeader.addEventListener('click', function() {
        toggleNodeStatusGroup(statusConfig.id);
    });
    
    // ノードリストコンテンツ
    const groupContent = document.createElement('div');
    groupContent.className = 'node-status-group-content';
    groupContent.style.display = isCollapsed ? 'none' : 'block';
    
    // 各ノードのタスクカードを追加
    groupNodes.forEach(nodeInfo => {
        createNodeTaskCard(nodeInfo.nodeIndex, groupContent, nodeInfo.depth, nodeInfo.isChild);
    });
    
    groupContainer.appendChild(groupHeader);
    groupContainer.appendChild(groupContent);
    container.appendChild(groupContainer);
}

/**
 * ノードステータスグループの折りたたみ切り替え
 * @param {string} statusId - ステータスID
 */
function toggleNodeStatusGroup(statusId) {
    const isCollapsed = nodeStatusGroupCollapsed[statusId] ?? false;
    nodeStatusGroupCollapsed[statusId] = !isCollapsed;
    
    // UI更新
    const groupElement = document.querySelector(`[data-status-group="${statusId}"]`);
    if (groupElement) {
        const header = groupElement.querySelector('.node-status-group-header');
        const content = groupElement.querySelector('.node-status-group-content');
        const expandIcon = header.querySelector('.expand-icon');
        
        if (nodeStatusGroupCollapsed[statusId]) {
            content.style.display = 'none';
            expandIcon.style.transform = 'rotate(-90deg)';
        } else {
            content.style.display = 'block';
            expandIcon.style.transform = 'rotate(0deg)';
        }
    }
    
    // LocalStorage保存
    saveToLocalStorage();
}

/**
 * ノードタスクカードを作成
 * @param {number} nodeIndex - ノードのインデックス
 * @param {HTMLElement} container - コンテナ要素
 * @param {number} depth - 階層の深さ（デフォルト: 0）
 * @param {boolean} isChild - 子ノードかどうか（デフォルト: false）
 */
function createNodeTaskCard(nodeIndex, container, depth = 0, isChild = false) {
    const tasks = getNodeTasks(nodeIndex);
    const statusInfo = getNodeStatusInfo(nodeIndex);
    
    const nodeGroup = document.createElement('div');
    nodeGroup.className = 'node-task-group';
    nodeGroup.setAttribute('data-node-group', nodeIndex);
    
    // 階層インデントを適用
    const indentStyle = getIndentStyle(depth, isChild);
    if (indentStyle) {
        nodeGroup.style.cssText += indentStyle;
    }
    
    // ノードヘッダー（ステータス付き）
    const nodeHeader = document.createElement('div');
    nodeHeader.style.cssText = `
        background: ${statusInfo.bgColor};
        border-bottom: 1px solid #e5e7eb;
        padding: 12px 16px;
        border-radius: 8px 8px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;
    
    // 左側：展開アイコンとタイトル
    const nodeHeaderLeft = document.createElement('div');
    nodeHeaderLeft.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        cursor: pointer;
    `;
    
    // デフォルトは折りたたみ状態（true）、記録されていれば記録値を使用
    const isCollapsed = nodeCardCollapsed[nodeIndex] ?? true;
    const expandIcon = document.createElement('span');
    expandIcon.textContent = isCollapsed ? '▶' : '▼';
    expandIcon.className = 'expand-icon';
    expandIcon.style.cssText = `
        font-size: 14px;
        color: #6b7280;
        cursor: pointer;
        user-select: none;
    `;
    
    const nodeTitle = document.createElement('div');
    nodeTitle.className = 'node-title';
    nodeTitle.textContent = `${getNodeDisplayNumber(nodeIndex)}. ${nodes[nodeIndex]}`;
    nodeTitle.style.cssText = `
        font-weight: 600;
        font-size: 16px;
        color: #1f2937;
    `;
    
    // 右側：ステータスバッジとノードメニュー
    const nodeHeaderRight = document.createElement('div');
    nodeHeaderRight.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
    `;
    
    const statusBadge = document.createElement('div');
    statusBadge.innerHTML = `
        <div onclick="openNodeStatusEditor(${nodeIndex})" 
             style="background: ${statusInfo.color}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; cursor: pointer; border: none; transition: opacity 0.2s ease;"
             onmouseover="this.style.opacity='0.8'" 
             onmouseout="this.style.opacity='1'"
             title="クリックしてステータスを変更">
            ${statusInfo.label}
        </div>
    `;
    
    // ノードメニューコンテナ作成
    const nodeMenuContainer = document.createElement('div');
    nodeMenuContainer.className = 'node-menu';
    nodeMenuContainer.innerHTML = `
        <button class="node-menu-button" 
            onclick="event.stopPropagation(); toggleNodeMenu(${nodeIndex})" 
            aria-label="ノードメニューを開く"
            aria-expanded="false"
            aria-haspopup="menu">⋯</button>
        <div class="node-menu-dropdown" 
            id="node-menu-${nodeIndex}" 
            style="display: none;"
            role="menu"
            aria-hidden="true">
            <button onclick="event.stopPropagation(); editNodeInAllView(${nodeIndex})" role="menuitem">✏️ 編集</button>
            <button onclick="event.stopPropagation(); deleteNodeInAllView(${nodeIndex})" role="menuitem">🗑️ 削除</button>
        </div>
    `;
    
    nodeHeaderRight.appendChild(statusBadge);
    nodeHeaderRight.appendChild(nodeMenuContainer);
    
    nodeHeaderLeft.appendChild(expandIcon);
    nodeHeaderLeft.appendChild(nodeTitle);
    nodeHeader.appendChild(nodeHeaderLeft);
    nodeHeader.appendChild(nodeHeaderRight);
    
    // タスクリスト
    const tasksList = document.createElement('div');
    tasksList.className = 'tasks-list';
    tasksList.style.padding = '16px';
    
    if (tasks.length === 0) {
        tasksList.innerHTML = '<div style="padding: 16px; color: #9ca3af; text-align: center; font-style: italic;">タスクがありません</div>';
    } else {
        tasks.forEach(task => {
            const taskItem = createTaskItemElement(nodeIndex, task);
            tasksList.appendChild(taskItem);
        });
    }
    
    // タスク追加フォーム
    const addTaskForm = document.createElement('div');
    addTaskForm.style.cssText = `
        padding: 16px;
        border-top: 1px solid #f3f4f6;
        background: #f9fafb;
    `;
    addTaskForm.innerHTML = `
        <div style="display: flex; gap: 10px;">
            <input type="text" 
                   id="add-task-input-${nodeIndex}"
                   placeholder="新しいタスクを入力..." 
                   style="flex: 1; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 14px;"
                   onkeypress="if(event.key==='Enter') addTaskToNodeFromAll(${nodeIndex})">
            <button onclick="addTaskToNodeFromAll(${nodeIndex})"
                    style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">
                追加
            </button>
        </div>
    `;
    
    // 初期状態で折りたたみ状態を適用
    if (isCollapsed) {
        tasksList.style.display = 'none';
        addTaskForm.style.display = 'none';
    }
    
    // クリックイベント：ヘッダー左側クリックで展開/折りたたみ
    nodeHeaderLeft.addEventListener('click', () => {
        toggleNodeCard(nodeIndex, expandIcon, tasksList, addTaskForm);
    });
    
    nodeGroup.appendChild(nodeHeader);
    nodeGroup.appendChild(tasksList);
    nodeGroup.appendChild(addTaskForm);
    container.appendChild(nodeGroup);
}

/**
 * ノードカードの展開/折りたたみ切り替え
 * @param {number} nodeIndex - ノードのインデックス
 * @param {HTMLElement} expandIcon - 展開アイコン要素
 * @param {HTMLElement} tasksList - タスクリスト要素
 * @param {HTMLElement} addTaskForm - タスク追加フォーム要素
 */
function toggleNodeCard(nodeIndex, expandIcon, tasksList, addTaskForm) {
    const isCurrentlyCollapsed = nodeCardCollapsed[nodeIndex] ?? true;
    
    if (isCurrentlyCollapsed) {
        // 展開
        tasksList.style.display = 'block';
        addTaskForm.style.display = 'block';
        expandIcon.textContent = '▼';
        nodeCardCollapsed[nodeIndex] = false;
    } else {
        // 折りたたみ
        tasksList.style.display = 'none';
        addTaskForm.style.display = 'none';
        expandIcon.textContent = '▶';
        nodeCardCollapsed[nodeIndex] = true;
    }
    
    saveToLocalStorage();
}

/**
 * 全ノード表示からタスクを追加
 * @param {number} nodeIndex - ノードのインデックス
 */
function addTaskToNodeFromAll(nodeIndex) {
    const input = document.getElementById(`add-task-input-${nodeIndex}`);
    const taskText = input.value.trim();
    
    if (!taskText) return;
    
    const taskId = addTaskToNode(nodeIndex, taskText);
    if (taskId) {
        input.value = '';
        updateNodeTasksOnly(nodeIndex); // 該当ノードのタスクリストのみ更新
        updateTaskNodeSelect(); // 個別ノード選択も更新
    }
}

/**
 * 特定ノードのタスクリストのみを更新（折り畳み状態を保持）
 * @param {number} nodeIndex - ノードのインデックス
 */
function updateNodeTasksOnly(nodeIndex) {
    const nodeGroup = document.querySelector(`[data-node-group="${nodeIndex}"]`);
    if (!nodeGroup) return;
    
    // 現在の折り畳み状態を保存
    const currentCollapsedState = nodeCardCollapsed[nodeIndex];
    
    // タスクリスト部分のみを再構築
    const tasksList = nodeGroup.querySelector('.tasks-list');
    if (tasksList) {
        // タスクリストを再生成
        const tasks = getNodeTasks(nodeIndex);
        tasksList.innerHTML = '';
        
        if (tasks.length === 0) {
            tasksList.innerHTML = '<div style="padding: 16px; color: #9ca3af; text-align: center; font-style: italic;">タスクがありません</div>';
        } else {
            tasks.forEach(task => {
                const taskItem = createTaskItemElement(nodeIndex, task);
                tasksList.appendChild(taskItem);
            });
        }
        
        // 折り畳み状態を復元
        nodeCardCollapsed[nodeIndex] = currentCollapsedState;
        const expandIcon = nodeGroup.querySelector('.expand-icon');
        const addTaskForm = nodeGroup.querySelector('[style*="border-top"]');
        
        if (currentCollapsedState) {
            tasksList.style.display = 'none';
            if (addTaskForm) addTaskForm.style.display = 'none';
            if (expandIcon) expandIcon.textContent = '▶';
        } else {
            tasksList.style.display = 'block';
            if (addTaskForm) addTaskForm.style.display = 'block';
            if (expandIcon) expandIcon.textContent = '▼';
        }
    }
    
    updateOverallProgress(); // 全体進捗も更新
}

/**
 * タスクアイテム要素を作成
 * @param {number} nodeIndex - ノードのインデックス
 * @param {Object} task - タスクオブジェクト
 * @returns {HTMLElement} タスクアイテム要素
 */
function createTaskItemElement(nodeIndex, task) {
    const taskItem = document.createElement('div');
    taskItem.className = 'task-item';
    
    // チェックボックス作成
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'task-checkbox';
    checkbox.checked = task.completed;
    checkbox.setAttribute('onchange', `toggleTaskCompletion(${nodeIndex}, '${task.id}')`);
    checkbox.setAttribute('aria-label', 'タスク完了状態');
    
    // タスクテキスト作成（XSS対策のためtextContentを使用）
    const taskTextSpan = document.createElement('span');
    taskTextSpan.className = `task-text ${task.completed ? 'completed' : ''}`;
    taskTextSpan.id = `task-text-${task.id}`;
    taskTextSpan.textContent = task.text;
    
    // メニューコンテナ作成
    const menuContainer = document.createElement('div');
    menuContainer.className = 'task-menu';
    menuContainer.innerHTML = `
        <button class="task-menu-button" 
            onclick="toggleTaskMenu('${task.id}')" 
            aria-label="タスクメニューを開く"
            aria-expanded="false"
            aria-haspopup="menu">⋯</button>
        <div class="task-menu-dropdown" 
            id="menu-${task.id}" 
            style="display: none;"
            role="menu"
            aria-hidden="true">
            <button onclick="editTaskInAllView(${nodeIndex}, '${task.id}', document.getElementById('task-text-${task.id}'))" role="menuitem">✏️ 編集</button>
            <button onclick="deleteTask(${nodeIndex}, '${task.id}')" role="menuitem">🗑️ 削除</button>
        </div>
    `;
    
    // 要素を組み立て
    taskItem.appendChild(checkbox);
    taskItem.appendChild(taskTextSpan);
    taskItem.appendChild(menuContainer);
    
    return taskItem;
}

/**
 * 全ノード表示でのタスク編集
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} taskId - タスクID
 * @param {HTMLElement} taskTextElement - タスクテキスト要素
 */
function editTaskInAllView(nodeIndex, taskId, taskTextElement) {
    const currentText = taskTextElement.textContent;
    
    // 編集用input要素を作成
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'task-edit-input';
    
    const saveEdit = () => {
        const newText = input.value.trim();
        if (newText && newText !== currentText) {
            updateTaskText(nodeIndex, taskId, newText);
            updateNodeTasksOnly(nodeIndex); // 該当ノードのみ更新
        } else {
            taskTextElement.textContent = currentText;
            taskTextElement.style.display = '';
        }
        input.remove();
    };
    
    const cancelEdit = () => {
        taskTextElement.style.display = '';
        input.remove();
    };
    
    // イベントリスナー
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
    
    input.addEventListener('blur', saveEdit);
    
    // 既存テキストを隠して入力フィールドを挿入
    taskTextElement.style.display = 'none';
    taskTextElement.parentNode.insertBefore(input, taskTextElement.nextSibling);
    input.focus();
    input.select();
    
    // メニューを閉じる
    closeAllTaskMenus();
}

// ===== ノードメニュー機能 =====

/**
 * ノードメニューの表示/非表示を切り替え
 * @param {number} nodeIndex - ノードのインデックス
 */
function toggleNodeMenu(nodeIndex) {
    // すべてのメニューを閉じる
    closeAllNodeMenus();
    closeAllTaskMenus();
    
    const menu = document.getElementById(`node-menu-${nodeIndex}`);
    const button = menu?.previousElementSibling;
    
    if (menu && button) {
        if (menu.style.display === 'none' || !menu.style.display) {
            // メニューを表示し、位置を計算
            menu.style.display = 'block';
            positionMenu(button, menu);
            button.setAttribute('aria-expanded', 'true');
            menu.setAttribute('aria-hidden', 'false');
        } else {
            menu.style.display = 'none';
            button.setAttribute('aria-expanded', 'false');
            menu.setAttribute('aria-hidden', 'true');
        }
    }
}

/**
 * メニューの位置を計算して設定
 * @param {HTMLElement} button - ボタン要素
 * @param {HTMLElement} menu - メニュー要素
 */
function positionMenu(button, menu) {
    const buttonRect = button.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // 基本的にボタンの下、右端揃えで配置
    let left = buttonRect.right - menuRect.width;
    let top = buttonRect.bottom + 2;
    
    // 画面右端からはみ出る場合は左揃えに
    if (left < 0) {
        left = buttonRect.left;
    }
    
    // 画面右端からはみ出る場合は調整
    if (left + menuRect.width > viewportWidth) {
        left = viewportWidth - menuRect.width - 10;
    }
    
    // 画面下端からはみ出る場合はボタンの上に表示
    if (top + menuRect.height > viewportHeight) {
        top = buttonRect.top - menuRect.height - 2;
    }
    
    // 負の値にならないよう調整
    left = Math.max(10, left);
    top = Math.max(10, top);
    
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
}

/**
 * すべてのノードメニューを閉じる
 */
function closeAllNodeMenus() {
    document.querySelectorAll('.node-menu-dropdown').forEach(menu => {
        menu.style.display = 'none';
        const button = menu.previousElementSibling;
        if (button) {
            button.setAttribute('aria-expanded', 'false');
            menu.setAttribute('aria-hidden', 'true');
        }
    });
}

/**
 * 全ノード表示でのノード編集
 * @param {number} nodeIndex - ノードのインデックス
 */
function editNodeInAllView(nodeIndex) {
    if (!nodes[nodeIndex]) return;
    
    // ノードタイトル要素を取得
    const nodeGroup = document.querySelector(`[data-node-group="${nodeIndex}"]`);
    if (!nodeGroup) return;
    
    const nodeTitleElement = nodeGroup.querySelector('.node-title');
    if (!nodeTitleElement) return;
    
    const currentText = nodes[nodeIndex];
    
    // 編集用input要素を作成
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'node-edit-input';
    input.style.cssText = `
        width: 100%;
        padding: 8px;
        border: 2px solid #3b82f6;
        border-radius: 4px;
        font-size: 16px;
        font-weight: 600;
        color: #1f2937;
        background: white;
        box-sizing: border-box;
    `;
    
    const saveEdit = () => {
        const newText = input.value.trim();
        if (newText && newText !== currentText) {
            // graphManager.jsのupdateNode関数を使用
            if (typeof updateNode === 'function') {
                updateNode(nodeIndex, newText);
            } else {
                nodes[nodeIndex] = newText;
                updateAllUI();
                saveToLocalStorage();
            }
        }
        
        // 編集モードを終了
        input.parentNode.removeChild(input);
        nodeTitleElement.style.display = '';
    };
    
    const cancelEdit = () => {
        // 編集モードを終了
        input.parentNode.removeChild(input);
        nodeTitleElement.style.display = '';
    };
    
    // イベントリスナー
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveEdit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
    
    input.addEventListener('blur', saveEdit);
    
    // 既存タイトルを隠して入力フィールドを挿入
    nodeTitleElement.style.display = 'none';
    nodeTitleElement.parentNode.insertBefore(input, nodeTitleElement.nextSibling);
    input.focus();
    input.select();
    
    // メニューを閉じる
    closeAllNodeMenus();
}

/**
 * 全ノード表示でのノード削除
 * @param {number} nodeIndex - ノードのインデックス
 */
function deleteNodeInAllView(nodeIndex) {
    if (!nodes[nodeIndex]) return;
    
    const nodeName = nodes[nodeIndex];
    if (confirm(`ノード「${nodeName}」を削除しますか？\n\nこの操作により以下も削除されます：\n- このノードのタスク\n- このノードを含む関係\n- このノードの階層設定`)) {
        // graphManager.jsのdeleteNode関数を使用
        if (typeof deleteNode === 'function') {
            deleteNode(nodeIndex);
        } else {
            // フォールバック処理
            nodes.splice(nodeIndex, 1);
            cleanupTasksAfterNodeDeletion(nodeIndex);
            cleanupNodeStatusAfterDeletion(nodeIndex);
            cleanupNodeCardStateAfterDeletion(nodeIndex);
            updateAllUI();
            saveToLocalStorage();
        }
    }
    
    // メニューを閉じる
    closeAllNodeMenus();
}

// メニューの外側クリック検知（統合版）
document.addEventListener('click', function(e) {
    // ノードメニューとタスクメニューの外側クリック検知
    if (!e.target.closest('.node-menu') && !e.target.closest('.task-menu')) {
        closeAllNodeMenus();
        closeAllTaskMenus();
    }
    
    // ノードメニューボタン以外をクリックした場合、ノードメニューを閉じる
    if (!e.target.closest('.node-menu')) {
        closeAllNodeMenus();
    }
    
    // タスクメニューボタン以外をクリックした場合、タスクメニューを閉じる  
    if (!e.target.closest('.task-menu')) {
        closeAllTaskMenus();
    }
}, true); // キャプチャフェーズで実行

// グループの折りたたみ状態を管理（dataManager.jsで定義済み）

// タスクグループ設定
const TASK_GROUP_CONFIG = {
    incomplete: {
        id: 'incomplete',
        title: '📝 未完了タスク',
        color: '#3b82f6'
    },
    blocked_incomplete: {
        id: 'blocked_incomplete',
        title: '⚠️ ブロック中タスク',
        color: '#f59e0b'
    },
    completed: {
        id: 'completed',
        title: '✅ 完了タスク',
        color: '#059669'
    }
};

/**
 * タスクフラットリスト表示を生成（グループ化対応）
 */
function renderFlatTaskList() {
    const container = document.getElementById('flat-task-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    // 全ノードからタスクを収集しグループ化
    const taskGroups = {
        incomplete: [],
        blocked_incomplete: [],
        completed: []
    };
    
    nodes.forEach((nodeName, nodeIndex) => {
        const tasks = getNodeTasks(nodeIndex);
        const nodeStatusInfo = getNodeStatusInfo(nodeIndex);
        const isNodeBlocked = nodeStatusInfo.id === 'on_hold'; // 保留 = ブロック状態
        
        if (tasks && tasks.length > 0) {
            tasks.forEach(task => {
                const taskData = {
                    ...task,
                    nodeIndex: nodeIndex,
                    nodeName: nodeName,
                    isNodeBlocked: isNodeBlocked
                };
                
                if (task.completed) {
                    taskGroups.completed.push(taskData);
                } else if (isNodeBlocked) {
                    taskGroups.blocked_incomplete.push(taskData);
                } else {
                    taskGroups.incomplete.push(taskData);
                }
            });
        }
    });
    
    // 全てのグループが空の場合
    const totalTasks = taskGroups.incomplete.length + taskGroups.blocked_incomplete.length + taskGroups.completed.length;
    if (totalTasks === 0) {
        container.innerHTML = '<div class="no-tasks-message">タスクがありません</div>';
        return;
    }
    
    // グループを描画
    Object.values(TASK_GROUP_CONFIG).forEach(groupConfig => {
        renderTaskGroup(container, groupConfig.id, groupConfig.title, taskGroups[groupConfig.id], groupConfig.color);
    });
}

/**
 * タスクグループを描画
 * @param {HTMLElement} container - コンテナ要素
 * @param {string} groupId - グループID
 * @param {string} groupTitle - グループタイトル
 * @param {Array} tasks - タスクリスト
 * @param {string} color - グループカラー
 */
function renderTaskGroup(container, groupId, groupTitle, tasks, color) {
    if (tasks.length === 0) return;
    
    const groupContainer = document.createElement('div');
    groupContainer.className = 'flat-task-group';
    groupContainer.setAttribute('data-group-id', groupId);
    
    // グループヘッダー
    const groupHeader = document.createElement('div');
    groupHeader.className = 'flat-group-header';
    groupHeader.style.backgroundColor = `${color}08`;
    
    const isCollapsed = flatTaskGroupCollapsed[groupId];
    
    // ヘッダーコンテンツ
    const headerContent = document.createElement('div');
    headerContent.className = 'flat-group-header-content';
    
    const expandIcon = document.createElement('span');
    expandIcon.className = 'expand-icon';
    expandIcon.style.color = color;
    expandIcon.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    expandIcon.textContent = '▼';
    
    const groupTitleSpan = document.createElement('span');
    groupTitleSpan.className = 'group-title';
    groupTitleSpan.style.color = color;
    groupTitleSpan.textContent = groupTitle;
    
    headerContent.appendChild(expandIcon);
    headerContent.appendChild(groupTitleSpan);
    
    const groupCount = document.createElement('span');
    groupCount.className = 'group-count';
    groupCount.style.backgroundColor = color;
    groupCount.textContent = tasks.length;
    
    groupHeader.appendChild(headerContent);
    groupHeader.appendChild(groupCount);
    
    // ホバーエフェクト
    groupHeader.addEventListener('mouseenter', function() {
        this.style.backgroundColor = `${color}12`;
    });
    
    groupHeader.addEventListener('mouseleave', function() {
        this.style.backgroundColor = `${color}08`;
    });
    
    // クリックイベント
    groupHeader.addEventListener('click', function() {
        toggleFlatTaskGroup(groupId);
    });
    
    groupContainer.appendChild(groupHeader);
    
    // タスクリストコンテナ
    const taskListContainer = document.createElement('div');
    taskListContainer.className = 'flat-task-list';
    taskListContainer.style.display = isCollapsed ? 'none' : 'block';
    
    // タスクを描画
    tasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = 'flat-task-item';
        
        const taskContent = document.createElement('div');
        taskContent.className = 'flat-task-content';
        
        const taskCheckbox = document.createElement('input');
        taskCheckbox.type = 'checkbox';
        taskCheckbox.className = 'flat-task-checkbox';
        taskCheckbox.checked = task.completed;
        taskCheckbox.addEventListener('change', () => toggleFlatTaskCompletion(task.nodeIndex, task.id));
        
        const taskTextContainer = document.createElement('div');
        taskTextContainer.className = 'flat-task-text-container';
        
        const taskText = document.createElement('div');
        taskText.className = `flat-task-text ${task.completed ? 'completed' : 'incomplete'}`;
        taskText.textContent = task.text;
        
        const taskNode = document.createElement('div');
        taskNode.className = 'flat-task-node';
        taskNode.textContent = `📍 ${task.nodeName}${task.isNodeBlocked ? ' (保留中)' : ''}`;
        
        taskTextContainer.appendChild(taskText);
        taskTextContainer.appendChild(taskNode);
        
        taskContent.appendChild(taskCheckbox);
        taskContent.appendChild(taskTextContainer);
        
        taskItem.appendChild(taskContent);
        
        // ホバーエフェクト
        taskItem.addEventListener('mouseenter', function() {
            this.style.borderColor = color;
        });
        
        taskItem.addEventListener('mouseleave', function() {
            this.style.borderColor = '#e5e7eb';
        });
        
        taskListContainer.appendChild(taskItem);
    });
    
    groupContainer.appendChild(taskListContainer);
    container.appendChild(groupContainer);
}

/**
 * フラットタスクグループの折りたたみ状態を切り替え
 * @param {string} groupId - グループID
 */
function toggleFlatTaskGroup(groupId) {
    // 状態を切り替え
    flatTaskGroupCollapsed[groupId] = !flatTaskGroupCollapsed[groupId];
    
    // UIを更新 - data属性を使って正確にグループを特定
    const targetGroup = document.querySelector(`[data-group-id="${groupId}"]`);
    
    if (targetGroup) {
        const expandIcon = targetGroup.querySelector('.expand-icon');
        const taskList = targetGroup.querySelector('.flat-task-list');
        
        if (flatTaskGroupCollapsed[groupId]) {
            // 折りたたみ
            if (taskList) taskList.style.display = 'none';
            if (expandIcon) expandIcon.style.transform = 'rotate(-90deg)';
        } else {
            // 展開
            if (taskList) taskList.style.display = 'block';
            if (expandIcon) expandIcon.style.transform = 'rotate(0deg)';
        }
    }
    
    // 状態を保存
    saveToLocalStorage();
}

/**
 * フラットリスト内のタスク完了状態を切り替え
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} taskId - タスクのID
 */
function toggleFlatTaskCompletion(nodeIndex, taskId) {
    const result = toggleTaskCompletion(nodeIndex, taskId);
    if (result !== null) {
        // フラットリストを再描画（グループ間移動対応）
        renderFlatTaskList();
        // 全体進捗も更新
        updateOverallProgress();
        // 全ノード表示も更新
        renderAllNodeTasks();
    }
}

// 注意: escapeHtmlはapp.jsの共通ユーティリティ関数を使用してください