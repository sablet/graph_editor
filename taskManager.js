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
    const newTask = {
        id: "task_" + Date.now(),
        text: taskText.trim(),
        completed: false
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
 * ノードのタスク一覧を取得
 * @param {number} nodeIndex - ノードのインデックス
 * @returns {Array} タスクの配列
 */
function getNodeTasks(nodeIndex) {
    return nodeTasks[nodeIndex] || [];
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
 * 全タスクの統計情報を取得
 * @returns {Object} 総タスク数、完了数、達成率
 */
function getAllTaskStats() {
    let totalTasks = 0;
    let completedTasks = 0;
    
    Object.values(nodeTasks).forEach(tasks => {
        totalTasks += tasks.length;
        completedTasks += tasks.filter(t => t.completed).length;
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
        renderTaskList(nodeIndex);
        updateOverallProgress(); // 全体進捗も更新
        
        // LocalStorageに保存
        saveToLocalStorage();
        return task.completed;
    }
    
    return null;
}

/**
 * タスクを削除
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} taskId - タスクID
 * @returns {boolean} 削除成功時true
 */
function deleteTask(nodeIndex, taskId) {
    if (!nodeTasks[nodeIndex]) {
        return false;
    }
    
    const originalLength = nodeTasks[nodeIndex].length;
    nodeTasks[nodeIndex] = nodeTasks[nodeIndex].filter(task => task.id !== taskId);
    
    const deleted = originalLength > nodeTasks[nodeIndex].length;
    
    if (deleted) {
        renderTaskList(nodeIndex);
        updateOverallProgress(); // 全体進捗も更新
        
        // LocalStorageに保存
        saveToLocalStorage();
    }
    
    return deleted;
}

/**
 * ノードの全タスクを削除
 * @param {number} nodeIndex - ノードのインデックス
 * @returns {number} 削除されたタスク数
 */
function deleteAllNodeTasks(nodeIndex) {
    const taskCount = nodeTasks[nodeIndex] ? nodeTasks[nodeIndex].length : 0;
    
    delete nodeTasks[nodeIndex];
    renderTaskList(nodeIndex);
    updateOverallProgress(); // 全体進捗も更新
    
    // LocalStorageに保存
    saveToLocalStorage();
    
    return taskCount;
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
    
    if (isNaN(nodeIndex)) {
        hideTaskList();
        return;
    }
    
    selectedNodeIndex = nodeIndex;
    showTaskList();
    renderSelectedNodeInfo(nodeIndex);
    renderTaskList(nodeIndex);
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
    
    // 他のメニューを閉じる
    closeAllTaskMenus();
    
    // 現在のメニューを表示
    if (menu.style.display === 'none') {
        menu.style.display = 'block';
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
 * 全ノードのタスクとステータスを表示
 */
function renderAllNodeTasks() {
    const container = document.getElementById('all-tasks-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (nodes.length === 0) {
        container.innerHTML = '<div style="color: #9ca3af; text-align: center; padding: 40px; font-style: italic;">ノードがありません</div>';
        return;
    }
    
    // 共通の階層情報付きノードリストを使用
    const hierarchicalNodeInfo = getHierarchicalNodeInfo();
    
    hierarchicalNodeInfo.forEach(nodeInfo => {
        createNodeTaskCard(nodeInfo.nodeIndex, container, nodeInfo.depth, nodeInfo.isChild);
    });
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
    
    const isCollapsed = nodeCardCollapsed[nodeIndex] || false;
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
    nodeTitle.textContent = `${getNodeDisplayNumber(nodeIndex)}. ${nodes[nodeIndex]}`;
    nodeTitle.style.cssText = `
        font-weight: 600;
        font-size: 16px;
        color: #1f2937;
    `;
    
    // 右側：ステータスバッジ
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
    
    nodeHeaderLeft.appendChild(expandIcon);
    nodeHeaderLeft.appendChild(nodeTitle);
    nodeHeader.appendChild(nodeHeaderLeft);
    nodeHeader.appendChild(statusBadge);
    
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
    const isCurrentlyCollapsed = nodeCardCollapsed[nodeIndex] || false;
    
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