// モバイル画面判定用の定数（CSSの@media (max-width: 1024px)と統一）
const MOBILE_BREAKPOINT = 1024;

// フッタータブ名定数
const LEFT_PANEL_TABS = ['nodes', 'relations', 'chat'];
const RIGHT_PANEL_TABS = ['all-tasks', 'task-list', 'graph'];

// 初期ノードリスト
const initialNodes = [
    "行き：持っていくべきものが決まってない",
    "行き：予定通りの間に合う時間に出られない", 
    "帰り：チェックアウト後片付けの手続きが決まってない",
    "帰り：飛行機乗る場合、時間をどこで潰すか決まらん",
    "長い移動がつまらない、手持ち無沙汰",
    "新幹線で食べるものを用意しておく",
    "mtgなど約束の時間に移動中になっている、目的地に時間通りにつかない",
    "移動手段の予約が取れない、またはあまりに高額である",
    "荷物が届かない",
    "交通機関の遅延・運休",
    "乗り換えの失敗",
    "自宅の空間が仕事に適した環境ではない：ネット、作業",
    "温度管理がしっくりこない",
    "PC作業の効率が悪い、電源やモニターなどの環境が不足",
    "最低限必要な作業ができておらず、観光に時間を使えない",
    "周辺の飲食店のあたりがついてない",
    "自炊か外食か、どちらにしろ食事をどうするか決まっておらず右往左往",
    "常備薬がない",
    "ゴミ処理の方法がわからず家にたまる",
    "歯ブラシ、髭剃り、シャワー、洗濯、の用具がない：施設は充実してると仮定",
    "気まわす服がない",
    "移動手段のレンタルできない",
    "バイクに乗る服、準備がない",
    "またどこへ行って何をするのが目的か",
    "行っても道が原付で走れるような道を確保できてない",
    "混んでて楽しくない",
    "お土産の候補",
    "現地の交通ルール、雰囲気を知る",
    "元々行きたいところに行けてない",
    "どれだけの時間を移動手段確保すればいいのかわからない",
    "借りたバイクをどこに置けばいいかわからない",
    "いざ行こうと思ったら天気が悪い",
    "熊対策、目撃情報場所を避けるか対策して突っ込むか"
];

// アプリケーションの状態
let nodes = []; // LocalStorageから読み込み、なければinitialNodesを使用
let relations = [];
let nodeHierarchy = []; // 親子関係を保存 {children: [childIndex1, childIndex2], parent: parentIndex}
let currentZoom = 1;
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let fullscreenZoom = 1;
let isFullscreenDragging = false;
let fullscreenLastMousePos = { x: 0, y: 0 };

// タスク管理データ
let nodeTasks = {};
let selectedNodeIndex = null;

// ノードステータス管理データ
let nodeStatuses = {};

// ノードカード折りたたみ状態管理
let nodeCardCollapsed = {};

// ノードステータスグループ折りたたみ状態管理
let nodeStatusGroupCollapsed = {};

// プロジェクト管理データ
let projects = [];
let currentProjectId = null;

// Mermaidの設定
mermaid.initialize({ 
    startOnLoad: false,
    theme: 'default',
    flowchart: {
        useMaxWidth: true,
        htmlLabels: true
    }
});

// ===== ユーティリティ関数 =====

/**
 * ノードインデックスの有効性をチェック
 * @param {number} nodeIndex - チェックするノードインデックス
 * @returns {boolean} 有効な場合はtrue
 */
function isValidNodeIndex(nodeIndex) {
    return nodeIndex !== null && 
           nodeIndex !== undefined && 
           !isNaN(nodeIndex) && 
           nodeIndex >= 0 && 
           nodeIndex < nodes.length;
}

/**
 * ノード関連の状態をリセット
 */
function resetNodeSelection() {
    selectedNodeIndex = null;
    if (typeof currentSelectedNodeIndex !== 'undefined') {
        currentSelectedNodeIndex = null;
    }
    
    // タスクリストコンテナを非表示にする
    const taskContainer = document.getElementById('task-list-container');
    if (taskContainer) {
        taskContainer.style.display = 'none';
    }
    
    // タスクノード選択をリセット
    const taskNodeSelect = document.getElementById('task-node-select');
    if (taskNodeSelect) {
        taskNodeSelect.value = '';
    }
    
    // 埋め込みプロジェクトチャットの関連タスク設定もリセット
    const embeddedSelect = document.getElementById('embedded-task-association-select');
    if (embeddedSelect) {
        embeddedSelect.value = 'global';
    }
    
    // プロジェクトチャットモーダルの関連タスク設定もリセット
    const modalSelect = document.getElementById('task-association-select');
    if (modalSelect) {
        modalSelect.value = 'global';
    }
}

/**
 * 関連タスク設定の有効性をチェックし、必要に応じて修正
 * @param {string} selectedValue - 選択された値
 * @param {HTMLElement} select - セレクト要素
 * @returns {object} 有効な関連タスクオブジェクト
 */
function validateAndGetAssociatedTask(selectedValue, select) {
    let associatedTask = { type: 'global' };
    
    if (selectedValue.startsWith('node_')) {
        const nodeIndex = parseInt(selectedValue.replace('node_', ''));
        if (isValidNodeIndex(nodeIndex)) {
            associatedTask = {
                type: 'node',
                nodeIndex: nodeIndex,
                nodeName: nodes[nodeIndex] || null
            };
        } else {
            // 無効なノードインデックスの場合はグローバルに変更
            associatedTask = { type: 'global' };
            if (select) {
                select.value = 'global';
            }
        }
    }
    
    return associatedTask;
}

// UI統合関数（外部モジュールの関数呼び出し用）
function updateAllUI() {
    renderNodes();
    renderSelects();
    renderHierarchySelects();
    renderRelations();
    renderHierarchy();
    
    // タスク関連のUI更新（関数が存在する場合のみ）
    if (typeof updateTaskNodeSelect === 'function') {
        updateTaskNodeSelect();
    }
    if (typeof renderAllNodeTasks === 'function') {
        renderAllNodeTasks();
    }
    
    updateOverallProgress();
    generateMermaidCode();
}

// プロジェクト管理のヘルパー関数
function getProjects() {
    return projects;
}

function getCurrentProject() {
    return projects.find(p => p.id === currentProjectId) || null;
}

// 初期化
document.addEventListener('DOMContentLoaded', async function() {
    // 同期マネージャー初期化（透明）
    if (window.syncManager) {
        await window.syncManager.initialize();
    }
    
    // タブ状態の読み込み
    loadTabState();
    
    // プロジェクト管理の初期化
    loadProjectsFromStorage();
    
    // 古いLocalStorageデータのマイグレーション処理を先に行う
    const oldDataLoaded = loadFromLocalStorage();
    if (oldDataLoaded && projects.length === 1 && projects[0].name === 'デフォルトプロジェクト') {
        // 既存データを現在のプロジェクトに統合
        saveCurrentProjectData();
        saveProjectsToStorage();
    } else {
        // プロジェクトがある場合は現在のプロジェクトを読み込み
        if (currentProjectId) {
            const currentProject = getCurrentProject();
            if (currentProject) {
                loadProjectData(currentProject);
            }
        }
    }
    
    updateAllUI();
    setupDiagramControls();
    setupFullscreenControls();
    setupMobileTabs();
    
    // タスク機能初期化（基本機能は維持）
    initializeTaskSystem();
    
    // メモ機能初期化
    if (typeof initializeMemoFeatures === 'function') {
        initializeMemoFeatures();
    }
    
    // プロジェクトチャット機能初期化
    if (typeof initializeProjectChatFeatures === 'function') {
        initializeProjectChatFeatures();
    }
    
    // ノードタブ機能初期化
    if (typeof initializeNodeTabFeatures === 'function') {
        initializeNodeTabFeatures();
    }
    
    // プロジェクト管理UI初期化
    initializeProjectManagement();
    
    // フッタータブ機能初期化
    initFooterTabs();
    initRightFooterTabs();
    
    // タブ状態の復元（フッタータブ初期化後に実行）
    restoreTabState();
    
    // 同期設定UIの初期化
    setupSyncSettingsUI();
    
    // ウィンドウリサイズ時のタブ状態更新
    window.addEventListener('resize', function() {
        setTimeout(() => {
            restoreTabState();
        }, 100); // リサイズ処理完了後に実行
    });
    
    // Ctrl+Enterキーでシングルノード追加
    document.getElementById('node-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            addSingleNode();
        }
    });
    
    // 埋め込みタスククリアボタンのイベントリスナー
    const embeddedTaskClearButton = document.getElementById('embedded-task-clear-button');
    if (embeddedTaskClearButton) {
        embeddedTaskClearButton.addEventListener('click', clearEmbeddedTaskAssociation);
    }
});

// ===== プロジェクト管理UI機能 =====

function initializeProjectManagement() {
    updateProjectSelector();
    
    // プロジェクト管理イベントリスナー
    document.getElementById('create-project-btn').addEventListener('click', createNewProject);
    document.getElementById('update-project-btn').addEventListener('click', updateCurrentProject);
    document.getElementById('delete-project-btn').addEventListener('click', deleteCurrentProject);
    document.getElementById('project-selector').addEventListener('change', function(e) {
        if (e.target.value) {
            switchToProject(e.target.value);
        }
    });
}

function updateProjectSelector() {
    const selector = document.getElementById('project-selector');
    selector.innerHTML = '<option value="">プロジェクトを選択...</option>';
    
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        if (project.id === currentProjectId) {
            option.selected = true;
        }
        selector.appendChild(option);
    });
}

function updateProjectUI() {
    updateProjectSelector();
    updateAllUI();
    // デフォルトタブを設定（フッタータブ移行のため、この処理は不要）
    // switchPreviewTab('project-chat');
    // 進捗統計を明示的に更新
    updateOverallProgress();
}

function createNewProject() {
    const name = prompt('新しいプロジェクト名を入力してください:', '');
    if (name && name.trim()) {
        const description = prompt('プロジェクトの説明を入力してください（任意）:', '');
        const newProject = createProject(name.trim(), description?.trim() || '');
        switchToProject(newProject.id);
        updateProjectUI();
        alert(`プロジェクト「${name.trim()}」が作成されました。`);
    }
}

function updateCurrentProject() {
    if (!currentProjectId) {
        alert('プロジェクトが選択されていません');
        return;
    }
    
    const currentProject = getCurrentProject();
    if (!currentProject) {
        alert('選択されたプロジェクトが見つかりません');
        return;
    }
    
    const newName = prompt('プロジェクト名を入力してください:', currentProject.name);
    if (newName && newName.trim() && newName.trim() !== currentProject.name) {
        const newDescription = prompt('プロジェクトの説明を入力してください:', currentProject.description || '');
        
        updateProject(currentProjectId, {
            name: newName.trim(),
            description: newDescription?.trim() || ''
        });
        
        updateProjectUI();
        alert(`プロジェクト「${newName.trim()}」が更新されました。`);
    }
}

function deleteCurrentProject() {
    if (!currentProjectId) {
        alert('プロジェクトが選択されていません');
        return;
    }
    
    const currentProject = getCurrentProject();
    if (!currentProject) {
        alert('選択されたプロジェクトが見つかりません');
        return;
    }
    
    if (confirm(`プロジェクト「${currentProject.name}」を削除しますか？この操作は取り消せません。`)) {
        deleteProject(currentProjectId);
        updateProjectUI();
        alert('プロジェクトが削除されました');
    }
}

function switchToProject(projectId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return false;
    
    // 現在のプロジェクトのデータを保存
    if (currentProjectId && currentProjectId !== projectId) {
        saveCurrentProjectData();
    }
    
    // 新しいプロジェクトのデータを読み込み
    currentProjectId = projectId;
    loadProjectData(project);
    
    // ノードインデックス関連の状態をリセット
    resetNodeSelection();
    
    // クラウド同期（透明）
    if (window.syncManager && window.syncManager.isOnlineMode) {
        window.syncManager.syncFromRemote();
    }
    
    // UI更新
    updateProjectSelector();
    updateAllUI();
    
    // プロジェクトチャット画面が開いていれば更新
    if (typeof onProjectSwitched === 'function') {
        onProjectSwitched();
    }
    
    // ノードタブのプロジェクトチャットも更新
    if (typeof onNodeTabProjectSwitched === 'function') {
        onNodeTabProjectSwitched();
    }
    
    // 埋め込みプロジェクトチャットのオプションも更新
    if (typeof updateEmbeddedTaskAssociationOptions === 'function') {
        updateEmbeddedTaskAssociationOptions();
    }
    
    // LocalStorageに保存
    saveCurrentProjectIdToStorage();
    
    return true;
}

// ===== ノードステータス管理機能 =====

const NODE_STATUSES = {
    NOT_STARTED: {
        id: 'not_started',
        label: '未開始',
        color: '#6b7280',
        bgColor: '#f9fafb'
    },
    IN_PROGRESS: {
        id: 'in_progress', 
        label: '進行中',
        color: '#f59e0b',
        bgColor: '#fffbeb'
    },
    COMPLETED: {
        id: 'completed',
        label: '完了',
        color: '#059669',
        bgColor: '#f0fdf4'
    },
    ON_HOLD: {
        id: 'on_hold',
        label: '保留',
        color: '#7c3aed',
        bgColor: '#f3e8ff'
    },
    CANCELLED: {
        id: 'cancelled',
        label: 'キャンセル',
        color: '#dc2626',
        bgColor: '#fef2f2'
    }
};

function getNodeStatus(nodeIndex) {
    return nodeStatuses[nodeIndex] || 'not_started';
}

function setNodeStatus(nodeIndex, statusId) {
    if (NODE_STATUSES[statusId.toUpperCase()]) {
        nodeStatuses[nodeIndex] = statusId;
        updateOverallProgress();
        renderAllNodesTasks();
        saveToLocalStorage();
        return true;
    }
    return false;
}

function getNodeStatusInfo(nodeIndex) {
    const statusId = getNodeStatus(nodeIndex);
    return NODE_STATUSES[statusId.toUpperCase()] || NODE_STATUSES.NOT_STARTED;
}

function updateOverallProgress() {
    // 全ノードの進捗を計算
    const totalNodes = nodes.length;
    const completedNodes = Object.keys(nodeStatuses).filter(nodeIndex => 
        nodeStatuses[nodeIndex] === 'completed'
    ).length;
    const nodeProgressPercentage = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;
    
    // 全タスクの進捗を計算
    const taskStats = getAllTaskStats();
    
    // ノード進捗を表示
    const nodeProgressElement = document.getElementById('overall-node-progress');
    if (nodeProgressElement) {
        nodeProgressElement.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px; color: #6b7280;">
                <span>ノード進捗 (完了ステータス)</span>
                <span>${completedNodes}/${totalNodes} (${nodeProgressPercentage}%)</span>
            </div>
            <div style="background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden;">
                <div style="background: #059669; height: 100%; width: ${nodeProgressPercentage}%; transition: width 0.3s ease;"></div>
            </div>
        `;
    }
    
    // タスク進捗を表示
    const taskProgressElement = document.getElementById('overall-task-progress');
    if (taskProgressElement) {
        taskProgressElement.innerHTML = `
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 14px; color: #6b7280;">
                <span>タスク進捗</span>
                <span>${taskStats.completed}/${taskStats.total} (${taskStats.percentage}%)</span>
            </div>
            <div style="background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden;">
                <div style="background: #3b82f6; height: 100%; width: ${taskStats.percentage}%; transition: width 0.3s ease;"></div>
            </div>
        `;
    }
}

function openNodeStatusEditor(nodeIndex) {
    const currentStatus = getNodeStatus(nodeIndex);
    
    // モーダルを作成
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-dialog">
            <h3 style="margin-top: 0;">ノードステータスの変更</h3>
            <p style="margin-bottom: 20px; color: #6b7280;">ノード: 「${getNodeDisplayNumber(nodeIndex)}. ${nodes[nodeIndex]}」</p>
            <div style="display: flex; flex-direction: column; gap: 8px;">
                ${Object.values(NODE_STATUSES).map(status => `
                    <div class="status-option ${currentStatus === status.id ? 'selected' : ''}" 
                         onclick="selectStatus('${status.id}')" 
                         style="background: ${currentStatus === status.id ? status.bgColor : 'white'}; border: 1px solid ${currentStatus === status.id ? status.color : '#e5e7eb'};">
                        <div style="width: 12px; height: 12px; background: ${status.color}; border-radius: 50%;"></div>
                        <span style="color: #374151; font-weight: ${currentStatus === status.id ? '600' : '400'};">${status.label}</span>
                    </div>
                `).join('')}
            </div>
            <div style="display: flex; gap: 12px; margin-top: 24px; justify-content: flex-end;">
                <button onclick="closeStatusModal()" style="background: #6b7280; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">キャンセル</button>
                <button id="confirm-status-btn" onclick="confirmStatusChange(${nodeIndex})" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">変更</button>
            </div>
        </div>
    `;
    
    let selectedStatus = currentStatus;
    
    // ステータス選択関数をグローバルに定義
    window.selectStatus = function(statusId) {
        selectedStatus = statusId;
        // 選択状態を更新
        modal.querySelectorAll('.status-option').forEach(option => {
            const optionStatusId = option.onclick.toString().match(/'([^']+)'/)[1];
            const statusInfo = Object.values(NODE_STATUSES).find(s => s.id === optionStatusId);
            if (optionStatusId === statusId) {
                option.style.background = statusInfo.bgColor;
                option.style.border = `1px solid ${statusInfo.color}`;
                option.style.fontWeight = '600';
                option.classList.add('selected');
            } else {
                option.style.background = 'white';
                option.style.border = '1px solid #e5e7eb';
                option.style.fontWeight = '400';
                option.classList.remove('selected');
            }
        });
    };
    
    // モーダル閉じる関数
    window.closeStatusModal = function() {
        document.body.removeChild(modal);
        delete window.selectStatus;
        delete window.closeStatusModal;
        delete window.confirmStatusChange;
    };
    
    // ステータス変更確定関数
    window.confirmStatusChange = function(nodeIndex) {
        setNodeStatus(nodeIndex, selectedStatus);
        closeStatusModal();
    };
    
    // ESCキーで閉じる
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeStatusModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
    
    // モーダル外クリックで閉じる
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeStatusModal();
            document.removeEventListener('keydown', handleEscape);
        }
    });
    
    document.body.appendChild(modal);
}

// ===== タスク削除時のクリーンアップ機能 =====

function cleanupTasksAfterNodeDeletion(deletedNodeIndex) {
    // 削除されたノードのタスクを削除
    delete nodeTasks[deletedNodeIndex];
    
    // インデックスを調整（削除されたノード以降のノードのインデックスを1つずつ減らす）
    const adjustedTasks = {};
    Object.keys(nodeTasks).forEach(nodeIndexStr => {
        const nodeIndex = parseInt(nodeIndexStr);
        if (nodeIndex > deletedNodeIndex) {
            adjustedTasks[nodeIndex - 1] = nodeTasks[nodeIndex];
        } else {
            adjustedTasks[nodeIndex] = nodeTasks[nodeIndex];
        }
    });
    
    nodeTasks = adjustedTasks;
}

function cleanupNodeStatusAfterDeletion(deletedNodeIndex) {
    // 削除されたノードのステータスを削除
    delete nodeStatuses[deletedNodeIndex];
    
    // インデックスを調整
    const adjustedStatuses = {};
    Object.keys(nodeStatuses).forEach(nodeIndexStr => {
        const nodeIndex = parseInt(nodeIndexStr);
        if (nodeIndex > deletedNodeIndex) {
            adjustedStatuses[nodeIndex - 1] = nodeStatuses[nodeIndex];
        } else {
            adjustedStatuses[nodeIndex] = nodeStatuses[nodeIndex];
        }
    });
    
    nodeStatuses = adjustedStatuses;
}

function cleanupNodeCardStateAfterDeletion(deletedNodeIndex) {
    // 削除されたノードのカード状態を削除
    delete nodeCardCollapsed[deletedNodeIndex];
    
    // インデックスを調整
    const adjustedCardStates = {};
    Object.keys(nodeCardCollapsed).forEach(nodeIndexStr => {
        const nodeIndex = parseInt(nodeIndexStr);
        if (nodeIndex > deletedNodeIndex) {
            adjustedCardStates[nodeIndex - 1] = nodeCardCollapsed[nodeIndex];
        } else {
            adjustedCardStates[nodeIndex] = nodeCardCollapsed[nodeIndex];
        }
    });
    
    nodeCardCollapsed = adjustedCardStates;
}

// ===== Mermaidダイアグラム表示機能 =====

async function renderMermaidDiagram(code) {
    try {
        const container = document.getElementById('mermaid-diagram');
        container.innerHTML = '';
        
        const { svg } = await mermaid.render('graph', code);
        container.innerHTML = svg;
        
        // SVGのサイズを調整
        const svgElement = container.querySelector('svg');
        if (svgElement) {
            svgElement.style.width = '100%';
            svgElement.style.height = '100%';
            svgElement.style.transform = `scale(${currentZoom})`;
            svgElement.style.transformOrigin = 'top left';
        }
    } catch (error) {
        console.error('Mermaid rendering error:', error);
        document.getElementById('mermaid-diagram').innerHTML = '<div style="color: red; padding: 20px;">ダイアグラムの描画でエラーが発生しました</div>';
    }
}

// ダイアグラム制御機能
function setupDiagramControls() {
    const container = document.getElementById('diagram-container');
    
    // ホイールズーム
    container.addEventListener('wheel', function(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(currentZoom + delta);
    });
    
    // ドラッグ開始
    container.addEventListener('mousedown', function(e) {
        isDragging = true;
        lastMousePos = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
    });
    
    // ドラッグ中
    container.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        const deltaX = e.clientX - lastMousePos.x;
        const deltaY = e.clientY - lastMousePos.y;
        
        container.scrollLeft -= deltaX;
        container.scrollTop -= deltaY;
        
        lastMousePos = { x: e.clientX, y: e.clientY };
    });
    
    // ドラッグ終了
    container.addEventListener('mouseup', function() {
        isDragging = false;
        container.style.cursor = 'grab';
    });
    
    container.addEventListener('mouseleave', function() {
        isDragging = false;
        container.style.cursor = 'grab';
    });
}

function setZoom(zoom) {
    currentZoom = Math.max(0.1, Math.min(3.0, zoom));
    const svgElement = document.querySelector('#mermaid-diagram svg');
    if (svgElement) {
        svgElement.style.transform = `scale(${currentZoom})`;
    }
    document.getElementById('zoom-level').textContent = `${Math.round(currentZoom * 100)}%`;
}

function zoomIn() {
    setZoom(currentZoom + 0.1);
}

function zoomOut() {
    setZoom(currentZoom - 0.1);
}

function resetZoom() {
    setZoom(1.0);
}

function fitToContainer() {
    const container = document.getElementById('diagram-container');
    const svgElement = document.querySelector('#mermaid-diagram svg');
    
    if (svgElement) {
        const containerRect = container.getBoundingClientRect();
        const svgRect = svgElement.getBoundingClientRect();
        
        const scaleX = containerRect.width / svgRect.width;
        const scaleY = containerRect.height / svgRect.height;
        const scale = Math.min(scaleX, scaleY) * 0.9; // 90%のマージンを追加
        
        setZoom(scale);
    }
}

// 全画面表示機能
function openFullscreen() {
    const modal = document.getElementById('fullscreen-modal');
    modal.style.display = 'flex';
    
    // 現在のMermaidコードを全画面用に再描画
    const code = document.getElementById('mermaid-code').textContent;
    renderFullscreenMermaidDiagram(code);
    
    // ESCキーでの閉じる機能を追加
    document.addEventListener('keydown', handleFullscreenEscape);
}

function closeFullscreen() {
    const modal = document.getElementById('fullscreen-modal');
    modal.style.display = 'none';
    
    // ESCキーイベントリスナーを削除
    document.removeEventListener('keydown', handleFullscreenEscape);
}

function handleFullscreenEscape(e) {
    if (e.key === 'Escape') {
        closeFullscreen();
    }
}

async function renderFullscreenMermaidDiagram(code) {
    try {
        const container = document.getElementById('fullscreen-mermaid-diagram');
        container.innerHTML = '';
        
        const { svg } = await mermaid.render('fullscreen-graph', code);
        container.innerHTML = svg;
        
        // SVGのサイズを調整
        const svgElement = container.querySelector('svg');
        if (svgElement) {
            svgElement.style.width = '100%';
            svgElement.style.height = '100%';
            svgElement.style.transform = `scale(${fullscreenZoom})`;
            svgElement.style.transformOrigin = 'top left';
        }
    } catch (error) {
        console.error('Fullscreen Mermaid rendering error:', error);
        document.getElementById('fullscreen-mermaid-diagram').innerHTML = '<div style="color: red; padding: 20px;">ダイアグラムの描画でエラーが発生しました</div>';
    }
}

// 全画面用のダイアグラム制御
function setupFullscreenControls() {
    const container = document.getElementById('fullscreen-diagram-container');
    
    // ホイールズーム
    container.addEventListener('wheel', function(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setFullscreenZoom(fullscreenZoom + delta);
    });
    
    // ドラッグ開始
    container.addEventListener('mousedown', function(e) {
        isFullscreenDragging = true;
        fullscreenLastMousePos = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
    });
    
    // ドラッグ中
    container.addEventListener('mousemove', function(e) {
        if (!isFullscreenDragging) return;
        
        const deltaX = e.clientX - fullscreenLastMousePos.x;
        const deltaY = e.clientY - fullscreenLastMousePos.y;
        
        container.scrollLeft -= deltaX;
        container.scrollTop -= deltaY;
        
        fullscreenLastMousePos = { x: e.clientX, y: e.clientY };
    });
    
    // ドラッグ終了
    container.addEventListener('mouseup', function() {
        isFullscreenDragging = false;
        container.style.cursor = 'grab';
    });
    
    container.addEventListener('mouseleave', function() {
        isFullscreenDragging = false;
        container.style.cursor = 'grab';
    });
}

function setFullscreenZoom(zoom) {
    fullscreenZoom = Math.max(0.1, Math.min(3.0, zoom));
    const svgElement = document.querySelector('#fullscreen-mermaid-diagram svg');
    if (svgElement) {
        svgElement.style.transform = `scale(${fullscreenZoom})`;
    }
    document.getElementById('fullscreen-zoom-level').textContent = `${Math.round(fullscreenZoom * 100)}%`;
}

function zoomInFullscreen() {
    setFullscreenZoom(fullscreenZoom + 0.1);
}

function zoomOutFullscreen() {
    setFullscreenZoom(fullscreenZoom - 0.1);
}

function resetZoomFullscreen() {
    setFullscreenZoom(1.0);
}

function fitToFullscreenContainer() {
    const container = document.getElementById('fullscreen-diagram-container');
    const svgElement = document.querySelector('#fullscreen-mermaid-diagram svg');
    
    if (svgElement) {
        const containerRect = container.getBoundingClientRect();
        const svgRect = svgElement.getBoundingClientRect();
        
        const scaleX = containerRect.width / svgRect.width;
        const scaleY = containerRect.height / svgRect.height;
        const scale = Math.min(scaleX, scaleY) * 0.9; // 90%のマージンを追加
        
        setFullscreenZoom(scale);
    }
}

// ===== モバイル・タブ機能 =====

function setupMobileTabs() {
    const tabButtons = document.querySelectorAll('.mobile-tabs .tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // data-footer-tab または data-right-footer-tab を取得
            const footerTab = this.dataset.footerTab;
            const rightFooterTab = this.dataset.rightFooterTab;
            
            // タブの状態を更新
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            if (footerTab) {
                // 左パネルのタブ切り替え（ノード追加、階層設定、チャット）
                switchFooterTab('left', footerTab);
                showLeftPanel();
                
                // モバイルタブ状態を更新・保存
                activeTabState.mobile = footerTab;
                saveTabState();
            } else if (rightFooterTab) {
                // 右パネルのタブ切り替え（全ノード表示、タスクリスト、グラフプレビュー）
                switchFooterTab('right', rightFooterTab);
                showRightPanel();
                
                // モバイルタブ状態を更新・保存
                activeTabState.mobile = rightFooterTab;
                saveTabState();
            }
        });
    });
}

function showLeftPanel() {
    const leftPanel = document.querySelector('.left-panel');
    const rightPanel = document.querySelector('.right-panel');
    
    if (leftPanel && rightPanel) {
        leftPanel.classList.add('active');
        rightPanel.classList.remove('active');
    }
}

function showRightPanel() {
    const leftPanel = document.querySelector('.left-panel');
    const rightPanel = document.querySelector('.right-panel');
    
    if (leftPanel && rightPanel) {
        leftPanel.classList.remove('active');
        rightPanel.classList.add('active');
    }
}

function switchFooterTab(panelType, targetTab) {
    if (panelType === 'left') {
        const leftFooterButtons = document.querySelectorAll('.footer-tabs-left .footer-tab-button');
        const leftSections = document.querySelectorAll('[data-footer-section]');
        
        // タブの状態を更新
        leftFooterButtons.forEach(btn => {
            if (btn.dataset.footerTab === targetTab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // セクションの表示を更新
        leftSections.forEach(section => {
            if (section.dataset.footerSection === targetTab) {
                section.style.display = 'block';
            } else {
                section.style.display = 'none';
            }
        });
        
        // 左パネルタブ切り替え時の特定処理
        if (targetTab === 'chat') {
            // チャット関連の初期化処理があれば追加
        }
        
    } else if (panelType === 'right') {
        const rightFooterButtons = document.querySelectorAll('.footer-tabs-right .footer-tab-button');
        const rightSections = document.querySelectorAll('[data-right-footer-section]');
        
        // タブの状態を更新
        rightFooterButtons.forEach(btn => {
            if (btn.dataset.rightFooterTab === targetTab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // セクションの表示を更新
        rightSections.forEach(section => {
            if (section.dataset.rightFooterSection === targetTab) {
                section.style.display = 'block';
            } else {
                section.style.display = 'none';
            }
        });
        
        // 右パネルタブ切り替え時の特定処理
        if (targetTab === 'all-tasks') {
            renderAllNodeTasks();
        } else if (targetTab === 'task-list') {
            if (typeof renderFlatTaskList === 'function') {
                renderFlatTaskList();
            }
        } else if (targetTab === 'graph') {
            generateMermaidCode();
        }
    }
}


function initializeTaskSystem() {
    // タスク関連のUI更新（関数が存在する場合のみ）
    if (typeof updateTaskNodeSelect === 'function') {
        updateTaskNodeSelect();
    }
    if (typeof renderAllNodeTasks === 'function') {
        renderAllNodeTasks();
    }
    updateOverallProgress();
    
    // Enterキーでタスク追加
    const newTaskInput = document.getElementById('new-task-input');
    if (newTaskInput) {
        newTaskInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (typeof addNewTask === 'function') {
                    addNewTask();
                }
            }
        });
    }
    
    // グローバルノード入力のEnterキー処理
    const globalNewNodeInput = document.getElementById('global-new-node-input');
    if (globalNewNodeInput) {
        globalNewNodeInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (typeof addGlobalNewNode === 'function') {
                    addGlobalNewNode();
                }
            }
        });
    }
}

// renderAllNodesTasks のエイリアス（外部モジュールとの互換性のため）
function renderAllNodesTasks() {
    if (typeof renderAllNodeTasks === 'function') {
        renderAllNodeTasks();
    }
}

// Mermaidダイアグラム更新後の処理
function generateMermaidCode() {
    // 外部モジュールのgenerateMermaidCode関数を呼び出し
    if (typeof window.generateMermaidCode !== 'undefined') {
        // 名前の衝突を避けるため、グローバル関数を呼び出し
        return;
    }
    
    let mermaidCode = 'flowchart TD\n';
    
    // ノードを定義
    nodes.forEach((node, index) => {
        const nodeId = getNodeId(index);
        const label = escapeLabel(node);
        const nodeNumber = getNodeDisplayNumber(index);
        mermaidCode += `    ${nodeId}["${nodeNumber}. ${label}"]\n`;
    });
    
    // 階層関係（親子関係）を定義
    nodeHierarchy.forEach(hierarchy => {
        const parentId = getNodeId(hierarchy.parent);
        hierarchy.children.forEach(childIndex => {
            const childId = getNodeId(childIndex);
            mermaidCode += `    ${parentId} --> ${childId}\n`;
        });
    });
    
    // リレーションを定義
    relations.forEach(relation => {
        const fromId = getNodeId(relation.from);
        const toId = getNodeId(relation.to);
        mermaidCode += `    ${fromId} -.-> ${toId}\n`;
    });
    
    // コードを表示とダイアグラム描画
    const codeElement = document.getElementById('mermaid-code');
    if (codeElement) {
        codeElement.textContent = mermaidCode;
    }
    
    renderMermaidDiagram(mermaidCode);
}

// ===== 共通ユーティリティ関数 =====

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

/**
 * 関連タスクのラベルを取得
 * @param {object} associatedTask - 関連タスク情報
 * @returns {string} ラベル文字列
 */
function getAssociationLabel(associatedTask) {
    switch (associatedTask.type) {
        case 'global':
            return '🏷️ [全体]';
        case 'node':
            if (isValidNodeIndex(associatedTask.nodeIndex) && nodes[associatedTask.nodeIndex]) {
                const nodeText = nodes[associatedTask.nodeIndex];
                return `📍 [ノード${associatedTask.nodeIndex + 1}: ${nodeText.substring(0, 20)}${nodeText.length > 20 ? '...' : ''}]`;
            }
            return '📍 [ノード: 削除済み]';
        default:
            return '🏷️ [全体]';
    }
}

// ===== 共通チャット機能 =====

/**
 * チャットメッセージ要素を作成（共通機能）
 * @param {object} message - メッセージオブジェクト
 * @param {string} menuHandlerName - メニュー切り替えハンドラー関数名
 * @returns {HTMLElement} メッセージ要素
 */
function createChatMessageElement(message, menuHandlerName) {
    const messageItem = document.createElement('div');
    messageItem.className = 'project-chat-message';
    messageItem.setAttribute('data-message-id', message.id);
    
    const timestamp = formatTimestamp(message.timestamp);
    const associationLabel = getAssociationLabel(message.associatedTask);
    
    messageItem.innerHTML = `
        <div class="message-header">
            <span class="message-timestamp">${timestamp}</span>
            <div class="message-menu">
                <button class="message-menu-button" onclick="${menuHandlerName}(event, '${message.id}')">⋯</button>
            </div>
        </div>
        <div class="message-content">${escapeHtml(message.content)}</div>
        <span class="association-label">${associationLabel}</span>
    `;
    
    return messageItem;
}

/**
 * メッセージメニュードロップダウンを作成（共通機能）
 * @param {string} messageId - メッセージID
 * @param {string} editHandlerName - 編集ハンドラー関数名
 * @param {string} deleteHandlerName - 削除ハンドラー関数名
 * @returns {HTMLElement} ドロップダウン要素
 */
function createMessageMenuDropdown(messageId, editHandlerName, deleteHandlerName) {
    const dropdown = document.createElement('div');
    dropdown.className = 'message-menu-dropdown';
    
    dropdown.innerHTML = `
        <button onclick="${editHandlerName}('${messageId}')">
            ✏️ 編集
        </button>
        <button class="delete-action" onclick="${deleteHandlerName}('${messageId}')">
            🗑️ 削除
        </button>
    `;
    
    return dropdown;
}

/**
 * メッセージを編集モードに切り替え（共通機能）
 * @param {string} messageId - メッセージID
 * @param {Array} messages - メッセージリスト
 * @param {string} saveHandlerName - 保存ハンドラー関数名
 * @param {string} cancelHandlerName - キャンセルハンドラー関数名
 * @param {string} containerSelector - メッセージコンテナーのセレクター
 */
function editChatMessage(messageId, messages, saveHandlerName, cancelHandlerName, containerSelector) {
    const messageItem = document.querySelector(`${containerSelector} [data-message-id="${messageId}"]`);
    if (!messageItem) return;
    
    const message = messages.find(m => m.id === messageId);
    if (!message) return;
    
    const contentElement = messageItem.querySelector('.message-content');
    const originalContent = message.content;
    
    // 編集フォームを作成
    contentElement.innerHTML = `
        <textarea class="message-edit-textarea" id="edit-textarea-${messageId}">${escapeHtml(originalContent)}</textarea>
        <div class="message-edit-actions">
            <button class="message-edit-button message-edit-save" onclick="${saveHandlerName}('${messageId}')">保存</button>
            <button class="message-edit-button message-edit-cancel" onclick="${cancelHandlerName}()">キャンセル</button>
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
                window[saveHandlerName](messageId);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                window[cancelHandlerName]();
            }
        });
    }
}

// アクティブタブ記憶機能
let activeTabState = {
    left: 'nodes',      // デスクトップ用左パネルのアクティブタブ
    right: 'all-tasks', // デスクトップ用右パネルのアクティブタブ
    mobile: 'nodes'     // モバイル用のアクティブタブ
};

// ローカルストレージからタブ状態を読み込み
function loadTabState() {
    const savedTabState = localStorage.getItem('activeTabState');
    if (savedTabState) {
        try {
            activeTabState = { ...activeTabState, ...JSON.parse(savedTabState) };
        } catch (e) {
            console.warn('Failed to load tab state:', e);
        }
    }
}

// ローカルストレージにタブ状態を保存
function saveTabState() {
    localStorage.setItem('activeTabState', JSON.stringify(activeTabState));
}

// タブ状態を復元
function restoreTabState() {
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    
    if (isMobile) {
        // モバイル表示の場合
        const mobileTab = activeTabState.mobile;
        
        // モバイルタブボタンを更新
        const mobileTabButtons = document.querySelectorAll('.mobile-tabs .tab-button');
        mobileTabButtons.forEach(btn => {
            const footerTab = btn.dataset.footerTab;
            const rightFooterTab = btn.dataset.rightFooterTab;
            
            if ((footerTab && footerTab === mobileTab) || (rightFooterTab && rightFooterTab === mobileTab)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // パネルとセクションを適切に表示
        if (LEFT_PANEL_TABS.includes(mobileTab)) {
            switchFooterTab('left', mobileTab);
            showLeftPanel();
        } else if (RIGHT_PANEL_TABS.includes(mobileTab)) {
            switchFooterTab('right', mobileTab);
            showRightPanel();
        }
    } else {
        // デスクトップ表示の場合
        switchFooterTab('left', activeTabState.left);
        switchFooterTab('right', activeTabState.right);
    }
}

// 左パネル用フッタータブ切り替え機能
function initFooterTabs() {
    const footerTabButtons = document.querySelectorAll('.footer-tabs-left .footer-tab-button');
    
    footerTabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.dataset.footerTab;
            switchFooterTab('left', targetTab);
            
            // タブ状態を更新・保存
            activeTabState.left = targetTab;
            const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
            if (isMobile) {
                activeTabState.mobile = targetTab;
            }
            saveTabState();
        });
    });
}

/**
 * 同期設定UIの初期化
 */
function setupSyncSettingsUI() {
    const syncSettingsBtn = document.getElementById('sync-settings-btn');
    const syncSettingsModal = document.getElementById('sync-settings-modal');
    const syncSettingsClose = document.getElementById('sync-settings-close');
    const enableSyncBtn = document.getElementById('enable-sync-btn');
    const forceSyncBtn = document.getElementById('force-sync-btn');
    const disableSyncBtn = document.getElementById('disable-sync-btn');
    const gistTokenInput = document.getElementById('gist-token');

    if (!syncSettingsBtn || !syncSettingsModal) return;

    // モーダル表示
    syncSettingsBtn.addEventListener('click', () => {
        syncSettingsModal.style.display = 'flex';
        updateSyncStatus();
        
        // トークン入力フィールドをクリア
        if (gistTokenInput) {
            gistTokenInput.value = '';
        }
    });

    // モーダル閉じる
    syncSettingsClose?.addEventListener('click', () => {
        syncSettingsModal.style.display = 'none';
    });

    // モーダル外クリックで閉じる
    syncSettingsModal.addEventListener('click', (e) => {
        if (e.target === syncSettingsModal) {
            syncSettingsModal.style.display = 'none';
        }
    });

    // 同期有効化
    enableSyncBtn?.addEventListener('click', async () => {
        const token = gistTokenInput?.value.trim();
        
        if (!token) {
            alert('GitHub Personal Access Tokenを入力してください');
            return;
        }

        if (!window.syncManager) {
            alert('同期マネージャーが初期化されていません');
            return;
        }

        // ボタンを無効化してローディング状態に
        enableSyncBtn.disabled = true;
        enableSyncBtn.textContent = '設定中...';

        try {
            const success = await window.syncManager.enableSync(token);
            
            if (success) {
                updateSyncStatus();
                gistTokenInput.value = '';
                alert('クラウド同期が有効になりました！');
            } else {
                alert('トークンが無効です。確認してください。');
            }
        } catch (error) {
            console.error('同期有効化エラー:', error);
            alert('同期の有効化に失敗しました: ' + error.message);
        } finally {
            enableSyncBtn.disabled = false;
            enableSyncBtn.textContent = '同期を有効にする';
        }
    });

    // 手動同期
    forceSyncBtn?.addEventListener('click', async () => {
        if (!window.syncManager?.isOnlineMode) return;

        forceSyncBtn.disabled = true;
        forceSyncBtn.textContent = '同期中...';

        try {
            await window.syncManager.forceSync();
            updateSyncStatus();
        } catch (error) {
            console.error('手動同期エラー:', error);
            alert('同期に失敗しました: ' + error.message);
        } finally {
            forceSyncBtn.disabled = false;
            forceSyncBtn.textContent = '手動同期';
        }
    });

    // 同期無効化
    disableSyncBtn?.addEventListener('click', () => {
        if (confirm('クラウド同期を無効にしますか？\n（ローカルデータは保持されます）')) {
            window.syncManager?.disableSync();
            updateSyncStatus();
        }
    });

    // Enterキーでトークン入力を実行
    gistTokenInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            enableSyncBtn?.click();
        }
    });
}

/**
 * 同期状態の表示更新
 */
function updateSyncStatus() {
    const syncStatusDisplay = document.getElementById('sync-status-display');
    const syncSetupForm = document.getElementById('sync-setup-form');
    const syncControls = document.getElementById('sync-controls');
    
    if (!syncStatusDisplay || !window.syncManager) return;

    if (!window.syncManager.isOnlineMode) {
        // オフラインモード
        syncStatusDisplay.innerHTML = `
            <div class="sync-status offline">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span style="font-size: 20px;">📱</span>
                    <span style="font-weight: 600; color: #374151;">ローカルモード</span>
                </div>
                <div style="font-size: 13px; color: #6b7280;">クラウド同期は無効です</div>
            </div>
        `;
        
        if (syncSetupForm) syncSetupForm.style.display = 'block';
        if (syncControls) syncControls.style.display = 'none';
        
    } else {
        // オンラインモード
        const lastSync = window.syncManager.lastSyncTime 
            ? new Date(window.syncManager.lastSyncTime).toLocaleTimeString('ja-JP')
            : '未同期';
        
        syncStatusDisplay.innerHTML = `
            <div class="sync-status online">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                    <span style="font-size: 20px;">☁️</span>
                    <span style="font-weight: 600; color: #059669;">クラウド同期有効</span>
                </div>
                <div style="font-size: 13px; color: #6b7280;">最終同期: ${lastSync}</div>
                ${window.syncManager.syncInProgress ? '<div style="font-size: 13px; color: #3b82f6;">同期中...</div>' : ''}
            </div>
        `;
        
        if (syncSetupForm) syncSetupForm.style.display = 'none';
        if (syncControls) syncControls.style.display = 'block';
    }
}

// 簡易トースト通知（同期マネージャー用）
function showToast(message, type = 'info') {
    // 既存のトーストを削除
    const existingToast = document.getElementById('sync-toast');
    if (existingToast) {
        existingToast.remove();
    }

    // トースト要素を作成
    const toast = document.createElement('div');
    toast.id = 'sync-toast';
    
    const bgColor = {
        'success': '#059669',
        'error': '#dc2626', 
        'warning': '#d97706',
        'info': '#3b82f6'
    }[type] || '#3b82f6';

    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${bgColor};
        color: white;
        padding: 12px 16px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 10000;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        transform: translateX(100%);
        transition: transform 0.3s ease;
    `;

    toast.textContent = message;
    document.body.appendChild(toast);

    // アニメーション表示
    setTimeout(() => {
        toast.style.transform = 'translateX(0)';
    }, 100);

    // 自動削除
    setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.remove();
            }
        }, 300);
    }, 3000);
}

// グローバル関数として公開
window.updateSyncStatus = updateSyncStatus;
window.showToast = showToast;

// 右パネル用フッタータブ切り替え機能
function initRightFooterTabs() {
    const rightFooterTabButtons = document.querySelectorAll('.footer-tabs-right .footer-tab-button');
    
    rightFooterTabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.getAttribute('data-right-footer-tab');
            switchFooterTab('right', targetTab);
            
            // タブ状態を更新・保存
            activeTabState.right = targetTab;
            const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
            if (isMobile) {
                activeTabState.mobile = targetTab;
            }
            saveTabState();
            
            console.log('Right panel tab switched to:', targetTab);
        });
    });
}

// フッタータブの初期化は既にメインのDOMContentLoadedで実行されるため、
// 重複する初期化は削除

// ===== 共通ユーティリティ関数 =====

/**
 * チャット履歴を最下部にスクロール
 * @param {HTMLElement} container - スクロール対象のコンテナ要素
 */
function scrollChatToBottom(container) {
    if (container) {
        // 少し遅延を入れてからスクロール（DOMの更新を待つ）
        setTimeout(() => {
            container.scrollTop = container.scrollHeight;
        }, 50);
    }
}