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
    
    if (selectedValue === 'none') {
        associatedTask = { type: 'none' };
    } else if (selectedValue.startsWith('node_')) {
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
    updateTaskNodeSelect();
    renderAllNodesTasks();
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
document.addEventListener('DOMContentLoaded', function() {
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
    
    // プレビューパネルタブ機能初期化
    setupPreviewTabs();
    
    // 保存されたタブ状態を復元
    restoreLastActiveTab();
    
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
    
    // Ctrl+Enterキーでシングルノード追加
    document.getElementById('node-input').addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            addSingleNode();
        }
    });
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
    // デフォルトタブ（プロジェクトチャット）に切り替える
    switchPreviewTab('project-chat');
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

function restoreLastActiveTab() {
    const lastActiveTab = getLastActiveTab();
    
    if (!lastActiveTab) {
        // デフォルトタブに設定
        return;
    }
    
    if (lastActiveTab.startsWith('preview:')) {
        // プレビューパネル内のタブ
        const previewTab = lastActiveTab.replace('preview:', '');
        switchPreviewTab(previewTab);
    } else {
        // メインタブ（モバイル用）
        const tabButtons = document.querySelectorAll('.tab-button');
        const panels = document.querySelectorAll('[data-panel]');
        
        // タブボタンをアクティブに
        tabButtons.forEach(btn => {
            if (btn.dataset.tab === lastActiveTab) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // パネルを表示
        panels.forEach(panel => {
            if (panel.dataset.panel === lastActiveTab) {
                panel.classList.add('active');
            } else {
                panel.classList.remove('active');
            }
        });
    }
}

function setupMobileTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const panels = document.querySelectorAll('[data-panel]');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.dataset.tab;
            
            // タブの状態を更新
            tabButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // パネルの表示を更新
            panels.forEach(panel => {
                if (panel.dataset.panel === targetTab) {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            });
            
            // タブ状態を保存
            saveActiveTab(targetTab);
        });
    });
}

function setupPreviewTabs() {
    const previewTabButtons = document.querySelectorAll('.preview-tab-button');
    const previewSections = document.querySelectorAll('[data-preview-section]');
    
    previewTabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.dataset.previewTab;
            switchPreviewTab(targetTab);
        });
    });
}

function switchPreviewTab(targetTab) {
    const previewTabButtons = document.querySelectorAll('.preview-tab-button');
    const previewSections = document.querySelectorAll('[data-preview-section]');
    
    // タブの状態を更新
    previewTabButtons.forEach(btn => {
        if (btn.dataset.previewTab === targetTab) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // プレビュータブの状態を保存 (preview: プレフィックス付き)
    saveActiveTab(`preview:${targetTab}`);
    
    // セクションの表示を更新
    previewSections.forEach(section => {
        if (section.dataset.previewSection === targetTab) {
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
        }
    });
    
    // 特定タブの初期化処理
    if (targetTab === 'all-tasks') {
        renderAllNodesTasks();
    } else if (targetTab === 'task-list') {
        renderFlatTaskList();
    } else if (targetTab === 'project-chat') {
        if (typeof updateEmbeddedTaskAssociationOptions === 'function') {
            updateEmbeddedTaskAssociationOptions();
        }
        if (typeof renderEmbeddedProjectChatHistory === 'function') {
            renderEmbeddedProjectChatHistory();
        }
    }
}

function initializeTaskSystem() {
    updateTaskNodeSelect();
    renderAllNodesTasks();
    updateOverallProgress();
    
    // Enterキーでタスク追加
    const newTaskInput = document.getElementById('new-task-input');
    if (newTaskInput) {
        newTaskInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addNewTask();
            }
        });
    }
    
    // グローバルノード入力のEnterキー処理
    const globalNewNodeInput = document.getElementById('global-new-node-input');
    if (globalNewNodeInput) {
        globalNewNodeInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addGlobalNewNode();
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