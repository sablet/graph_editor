/**
 * データ管理・ストレージ関連の機能を提供するモジュール
 * RDBMS移植時はこのファイルのみ変更すればよい
 */

// デバウンス用変数
let saveTimeout = null;
const SAVE_DEBOUNCE_DELAY = 500; // 500ms

// LocalStorageキー定義
const STORAGE_KEYS = {
    NODES: 'graphEditor_nodes',
    RELATIONS: 'graphEditor_relations', 
    NODE_HIERARCHY: 'graphEditor_nodeHierarchy',
    NODE_TASKS: 'graphEditor_nodeTasks',
    NODE_STATUSES: 'graphEditor_nodeStatuses',
    NODE_CARD_COLLAPSED: 'graphEditor_nodeCardCollapsed',
    FLAT_TASK_GROUP_COLLAPSED: 'graphEditor_flatTaskGroupCollapsed',
    DATA_VERSION: 'graphEditor_dataVersion',
    // プロジェクト管理
    PROJECTS: 'graphEditor_projects',
    CURRENT_PROJECT_ID: 'graphEditor_currentProjectId',
    // タブ状態管理
    LAST_ACTIVE_TAB: 'graphEditor_lastActiveTab',
    // プロジェクト全体チャット
    PROJECT_CHAT_HISTORY: 'graphEditor_projectChatHistory',
    // ノードメモ（一人用）
    NODE_MEMOS: 'graphEditor_nodeMemos'
};

// データバージョン
const CURRENT_DATA_VERSION = '1.0.0';

// デフォルトのフラットタスクグループ折りたたみ状態
const DEFAULT_FLAT_TASK_GROUP_COLLAPSED = {
    'incomplete': false,        // 未完了タスク：デフォルト展開
    'blocked_incomplete': false, // ブロック中の未完了タスク：デフォルト展開
    'completed': true           // 完了タスク：デフォルト折りたたみ
};

// LocalStorageが利用可能かチェック
function isLocalStorageAvailable() {
    try {
        const testKey = '__localStorage_test__';
        localStorage.setItem(testKey, 'test');
        localStorage.removeItem(testKey);
        return true;
    } catch (e) {
        return false;
    }
}

// ===== プロジェクト管理機能 =====

/**
 * デフォルトプロジェクトを作成
 */
function createDefaultProject(name = '新しいプロジェクト', description = '', useInitialData = false) {
    return {
        id: generateProjectId(),
        name: name,
        description: description,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: {
            nodes: useInitialData ? [...initialNodes] : [],
            relations: [],
            nodeHierarchy: [],
            nodeTasks: {},
            nodeStatuses: {},
            nodeCardCollapsed: {},
        }
    };
}

/**
 * プロジェクトID生成
 */
function generateProjectId() {
    return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * プロジェクト作成
 */
function createProject(name, description = '') {
    const newProject = createDefaultProject(name, description);
    projects.push(newProject);
    saveProjectsToStorage();
    return newProject;
}

/**
 * プロジェクト更新
 */
function updateProject(projectId, updates) {
    const project = projects.find(p => p.id === projectId);
    if (project) {
        Object.assign(project, updates);
        project.updatedAt = new Date().toISOString();
        saveProjectsToStorage();
        return project;
    }
    return null;
}

/**
 * プロジェクト削除
 */
function deleteProject(projectId) {
    const index = projects.findIndex(p => p.id === projectId);
    if (index !== -1) {
        projects.splice(index, 1);
        
        // 削除したプロジェクトが現在選択中の場合
        if (currentProjectId === projectId) {
            if (projects.length > 0) {
                switchToProject(projects[0].id);
            } else {
                // プロジェクトが全部削除された場合、新規プロジェクトを作成
                const defaultProject = createProject('デフォルトプロジェクト');
                switchToProject(defaultProject.id);
            }
        }
        
        saveProjectsToStorage();
        return true;
    }
    return false;
}

/**
 * 現在のプロジェクトデータを保存
 */
function saveCurrentProjectData() {
    if (!currentProjectId) return false;
    
    const project = getCurrentProject();
    if (project) {
        project.data = {
            nodes: [...nodes],
            relations: [...relations],
            nodeHierarchy: [...nodeHierarchy],
            nodeTasks: {...nodeTasks},
            nodeStatuses: {...nodeStatuses},
            nodeCardCollapsed: {...nodeCardCollapsed},
            projectChatHistory: [...projectChatHistory],
            flatTaskGroupCollapsed: {...flatTaskGroupCollapsed}
        };
        project.updatedAt = new Date().toISOString();
        return true;
    }
    return false;
}

/**
 * プロジェクトデータを読み込み
 */
function loadProjectData(project) {
    nodes = [...project.data.nodes];
    relations = [...project.data.relations];
    nodeHierarchy = [...project.data.nodeHierarchy];
    nodeTasks = {...project.data.nodeTasks};
    nodeStatuses = {...project.data.nodeStatuses};
    nodeCardCollapsed = {...project.data.nodeCardCollapsed};
    projectChatHistory = [...(project.data.projectChatHistory || [])];
    flatTaskGroupCollapsed = {
        ...DEFAULT_FLAT_TASK_GROUP_COLLAPSED,
        ...(project.data.flatTaskGroupCollapsed || {})
    };
}

/**
 * 孤立データのクリーンアップ
 */
function cleanupOrphanedData() {
    // 存在しないノードのタスクを削除
    Object.keys(nodeTasks).forEach(nodeIndexStr => {
        const nodeIndex = parseInt(nodeIndexStr);
        if (nodeIndex >= nodes.length) {
            delete nodeTasks[nodeIndex];
        }
    });
    
    // 存在しないノードのステータスを削除
    Object.keys(nodeStatuses).forEach(nodeIndexStr => {
        const nodeIndex = parseInt(nodeIndexStr);
        if (nodeIndex >= nodes.length) {
            delete nodeStatuses[nodeIndex];
        }
    });
    
    // 存在しないノードの折りたたみ状態を削除
    Object.keys(nodeCardCollapsed).forEach(nodeIndexStr => {
        const nodeIndex = parseInt(nodeIndexStr);
        if (nodeIndex >= nodes.length) {
            delete nodeCardCollapsed[nodeIndex];
        }
    });
    
    // 存在しないノードのチャット履歴を削除
    
    // 存在しないノードの階層関係を削除
    nodeHierarchy = nodeHierarchy.filter(hier => 
        hier.parent < nodes.length && 
        hier.children.every(child => child < nodes.length)
    );
    
    // 存在しないノードのリレーションを削除
    relations = relations.filter(rel => 
        rel.from < nodes.length && rel.to < nodes.length
    );
}

/**
 * プロジェクト一覧をStorageに保存
 */
function saveProjectsToStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
        return true;
    } catch (e) {
        console.error('Failed to save projects to localStorage:', e);
        return false;
    }
}

/**
 * 現在のプロジェクトIDをStorageに保存
 */
function saveCurrentProjectIdToStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT_ID, currentProjectId);
        return true;
    } catch (e) {
        console.error('Failed to save current project ID to localStorage:', e);
        return false;
    }
}

/**
 * プロジェクト一覧をStorageから読み込み
 */
function loadProjectsFromStorage() {
    try {
        const savedProjects = localStorage.getItem(STORAGE_KEYS.PROJECTS);
        const savedCurrentProjectId = localStorage.getItem(STORAGE_KEYS.CURRENT_PROJECT_ID);
        
        if (savedProjects) {
            projects = JSON.parse(savedProjects);
        } else {
            // 初回訪問時、デフォルトプロジェクトを作成（初期データ付き）
            const defaultProject = createDefaultProject('デフォルトプロジェクト', '初期プロジェクト', true);
            projects = [defaultProject];
        }
        
        // 現在のプロジェクトIDを復元
        if (savedCurrentProjectId && projects.find(p => p.id === savedCurrentProjectId)) {
            currentProjectId = savedCurrentProjectId;
        } else {
            // プロジェクトが見つからない場合、最初のプロジェクトを選択
            currentProjectId = projects.length > 0 ? projects[0].id : null;
        }
        
        return true;
    } catch (e) {
        console.error('Failed to load projects from localStorage:', e);
        return false;
    }
}

// ===== 旧形式データ操作機能（後方互換性） =====

/**
 * データをLocalStorageに保存（デバウンス版）
 */
function saveToLocalStorage() {
    // 既存のタイマーをクリア
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    // 新しいタイマーを設定
    saveTimeout = setTimeout(() => {
        saveToLocalStorageImmediate();
        saveTimeout = null;
    }, SAVE_DEBOUNCE_DELAY);
}

/**
 * データをLocalStorageに即座に保存
 */
function saveToLocalStorageImmediate() {
    if (!isLocalStorageAvailable()) {
        console.warn('LocalStorage not available, data will not be persisted');
        return false;
    }
    
    try {
        // プロジェクト管理対応: 現在のプロジェクトデータを保存
        if (currentProjectId) {
            saveCurrentProjectData();
            saveProjectsToStorage();
            saveCurrentProjectIdToStorage();
        } else {
            // 旧形式のデータ保存（後方互換性のため）
            localStorage.setItem(STORAGE_KEYS.DATA_VERSION, CURRENT_DATA_VERSION);
            localStorage.setItem(STORAGE_KEYS.NODES, JSON.stringify(nodes));
            localStorage.setItem(STORAGE_KEYS.RELATIONS, JSON.stringify(relations));
            localStorage.setItem(STORAGE_KEYS.NODE_HIERARCHY, JSON.stringify(nodeHierarchy));
            localStorage.setItem(STORAGE_KEYS.NODE_TASKS, JSON.stringify(nodeTasks));
            localStorage.setItem(STORAGE_KEYS.NODE_STATUSES, JSON.stringify(nodeStatuses));
            localStorage.setItem(STORAGE_KEYS.NODE_CARD_COLLAPSED, JSON.stringify(nodeCardCollapsed));
            localStorage.setItem(STORAGE_KEYS.PROJECT_CHAT_HISTORY, JSON.stringify(projectChatHistory));
            localStorage.setItem(STORAGE_KEYS.NODE_MEMOS, JSON.stringify(nodeMemos));
            localStorage.setItem(STORAGE_KEYS.FLAT_TASK_GROUP_COLLAPSED, JSON.stringify(flatTaskGroupCollapsed));
        }
        
        console.log('Data saved to localStorage successfully');
        return true;
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
        return false;
    }
}

/**
 * 即座に保存を実行（デバウンスをスキップ）
 */
function forceSaveToLocalStorage() {
    // タイマーをクリア
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }
    
    return saveToLocalStorageImmediate();
}

/**
 * データをLocalStorageから読み込み
 */
function loadFromLocalStorage() {
    if (!isLocalStorageAvailable()) {
        console.warn('LocalStorage not available, using initial data');
        initializeWithDefaultData();
        return false;
    }
    
    try {
        // データバージョンチェック
        const savedVersion = localStorage.getItem(STORAGE_KEYS.DATA_VERSION);
        if (savedVersion !== CURRENT_DATA_VERSION) {
            console.log('Data version mismatch or no saved data, using initial data');
            initializeWithDefaultData();
            return false;
        }
        
        // 各データを個別に読み込み
        const savedNodes = localStorage.getItem(STORAGE_KEYS.NODES);
        const savedRelations = localStorage.getItem(STORAGE_KEYS.RELATIONS);
        const savedNodeHierarchy = localStorage.getItem(STORAGE_KEYS.NODE_HIERARCHY);
        const savedNodeTasks = localStorage.getItem(STORAGE_KEYS.NODE_TASKS);
        const savedNodeStatuses = localStorage.getItem(STORAGE_KEYS.NODE_STATUSES);
        const savedNodeCardCollapsed = localStorage.getItem(STORAGE_KEYS.NODE_CARD_COLLAPSED);
        const savedProjectChatHistory = localStorage.getItem(STORAGE_KEYS.PROJECT_CHAT_HISTORY);
        const savedNodeMemos = localStorage.getItem(STORAGE_KEYS.NODE_MEMOS);
        const savedFlatTaskGroupCollapsed = localStorage.getItem(STORAGE_KEYS.FLAT_TASK_GROUP_COLLAPSED);
        
        // データがある場合のみ復元
        if (savedNodes) {
            nodes = JSON.parse(savedNodes);
        } else {
            nodes = [...initialNodes];
        }
        
        if (savedRelations) {
            relations = JSON.parse(savedRelations);
        } else {
            relations = [];
        }
        
        if (savedNodeHierarchy) {
            nodeHierarchy = JSON.parse(savedNodeHierarchy);
        } else {
            nodeHierarchy = [];
        }
        
        if (savedNodeTasks) {
            nodeTasks = JSON.parse(savedNodeTasks);
        } else {
            nodeTasks = {};
        }
        
        if (savedNodeStatuses) {
            nodeStatuses = JSON.parse(savedNodeStatuses);
        } else {
            nodeStatuses = {};
        }
        
        if (savedNodeCardCollapsed) {
            nodeCardCollapsed = JSON.parse(savedNodeCardCollapsed);
        } else {
            nodeCardCollapsed = {};
        }
        
        
        if (savedProjectChatHistory) {
            projectChatHistory = JSON.parse(savedProjectChatHistory);
        } else {
            projectChatHistory = [];
        }
        
        if (savedNodeMemos) {
            nodeMemos = JSON.parse(savedNodeMemos);
        } else {
            nodeMemos = {};
        }
        
        if (savedFlatTaskGroupCollapsed) {
            flatTaskGroupCollapsed = JSON.parse(savedFlatTaskGroupCollapsed);
        } else {
            // デフォルト値を設定
            flatTaskGroupCollapsed = {...DEFAULT_FLAT_TASK_GROUP_COLLAPSED};
        }
        
        console.log('Data loaded from localStorage successfully');
        return true;
    } catch (e) {
        console.error('Failed to load from localStorage:', e);
        initializeWithDefaultData();
        return false;
    }
}

/**
 * 初期データで初期化
 */
function initializeWithDefaultData() {
    nodes = [...initialNodes];
    relations = [];
    nodeHierarchy = [];
    nodeTasks = {};
    nodeStatuses = {};
    nodeCardCollapsed = {};
    projectChatHistory = [];
    nodeMemos = {};
    flatTaskGroupCollapsed = {...DEFAULT_FLAT_TASK_GROUP_COLLAPSED};
    console.log('Initialized with default data');
}

/**
 * 全データを初期状態にリセット
 */
function resetToInitialData() {
    if (confirm('全てのデータを初期状態にリセットしますか？この操作は取り消せません。')) {
        initializeWithDefaultData();
        saveToLocalStorage();
        
        // UI全体を更新（外部で実装される関数を呼び出し）
        if (typeof updateAllUI === 'function') {
            updateAllUI();
        }
        
        alert('データが初期状態にリセットされました');
        return true;
    }
    return false;
}

// ===== データエクスポート・インポート機能 =====

/**
 * データをエクスポート
 */
function exportData() {
    // 現在のプロジェクトデータを保存
    if (currentProjectId) {
        saveCurrentProjectData();
    }
    
    const exportObject = {
        exportedAt: new Date().toISOString(),
        version: CURRENT_DATA_VERSION,
        
        // プロジェクト管理データ
        projects: projects,
        currentProjectId: currentProjectId,
        
        // 後方互換性のため、現在のアクティブプロジェクトのデータを旧形式でもエクスポート
        legacyData: {
            nodes: nodes,
            relations: relations,
            nodeHierarchy: nodeHierarchy,
            nodeTasks: nodeTasks,
            nodeStatuses: nodeStatuses,
            nodeCardCollapsed: nodeCardCollapsed,
        }
    };
    
    return JSON.stringify(exportObject, null, 2);
}

/**
 * データをインポート
 */
function importData(importDataString) {
    try {
        const importedData = JSON.parse(importDataString);
        
        if (importedData.projects && Array.isArray(importedData.projects)) {
            // 新形式: プロジェクト管理対応データ
            const confirmMessage = `${importedData.projects.length}個のプロジェクトをインポートしますか？\n現在のデータは保持されます。`;
            
            if (confirm(confirmMessage)) {
                // プロジェクトを追加
                importedData.projects.forEach(importedProject => {
                    const newProject = {
                        ...importedProject,
                        id: generateProjectId(), // 新しいIDを生成
                        name: `${importedProject.name} (インポート)`,
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    projects.push(newProject);
                });
                
                saveProjectsToStorage();
                saveCurrentProjectIdToStorage();
                
            } else {
                return false;
            }
            
        } else {
            // 旧形式または単一プロジェクトデータのインポート
            let dataToImport;
            
            if (importedData.data && Array.isArray(importedData.data.nodes)) {
                // 新形式の単一プロジェクトデータ
                dataToImport = importedData.data;
            } else if (importedData.legacyData && Array.isArray(importedData.legacyData.nodes)) {
                // レガシーデータ
                dataToImport = importedData.legacyData;
            } else {
                throw new Error('Invalid data format');
            }
            
            // 新しいプロジェクトとして追加
            const importProjectName = `インポート ${new Date().toLocaleDateString()}`;
            const newProject = createProject(importProjectName, 'インポートされたプロジェクト');
            
            // データを設定
            newProject.data = {
                nodes: dataToImport.nodes || [],
                relations: dataToImport.relations || [],
                nodeHierarchy: dataToImport.nodeHierarchy || [],
                nodeTasks: dataToImport.nodeTasks || {},
                nodeStatuses: dataToImport.nodeStatuses || {},
                nodeCardCollapsed: dataToImport.nodeCardCollapsed || {},
            };
            
            // 新しいプロジェクトに切り替え
            switchToProject(newProject.id);
        }
        
        saveToLocalStorage();
        
        // UI全体を更新（外部で実装される関数を呼び出し）
        if (typeof updateProjectUI === 'function') {
            updateProjectUI();
        }
        
        return true;
    } catch (e) {
        console.error('Failed to import data:', e);
        return false;
    }
}

/**
 * エクスポートデータをダウンロード
 */
function downloadExportData() {
    try {
        const data = exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        
        a.href = url;
        a.download = `graph-editor-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('Export data downloaded successfully');
    } catch (e) {
        console.error('Failed to download export data:', e);
        alert('エクスポートに失敗しました');
    }
}

/**
 * ファイルからインポート
 */
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const success = importData(e.target.result);
            if (success) {
                alert('データのインポートが完了しました');
            } else {
                alert('インポートがキャンセルされました');
            }
        } catch (error) {
            console.error('Import error:', error);
            alert('インポートに失敗しました: ファイル形式が正しくありません');
        }
        
        // ファイル入力をリセット
        event.target.value = '';
    };
    
    reader.readAsText(file);
}

// ===== タブ状態管理機能 =====

/**
 * アクティブなタブを保存
 */
function saveActiveTab(tabName) {
    if (!isLocalStorageAvailable()) {
        console.warn('LocalStorage not available, tab state will not be persisted');
        return false;
    }
    
    try {
        localStorage.setItem(STORAGE_KEYS.LAST_ACTIVE_TAB, tabName);
        console.log(`Active tab saved: ${tabName}`);
        return true;
    } catch (e) {
        console.error('Failed to save active tab to localStorage:', e);
        return false;
    }
}

/**
 * 保存されたアクティブタブを取得
 */
function getLastActiveTab() {
    if (!isLocalStorageAvailable()) {
        return null;
    }
    
    try {
        return localStorage.getItem(STORAGE_KEYS.LAST_ACTIVE_TAB);
    } catch (e) {
        console.error('Failed to load active tab from localStorage:', e);
        return null;
    }
}

// ===== チャット履歴管理機能 =====



// ===== プロジェクト全体チャット履歴管理 =====

/**
 * プロジェクト全体チャット履歴のグローバル変数
 * 注意: この変数は現在のプロジェクトのチャット履歴のみを保持
 */
let projectChatHistory = [];

/**
 * プロジェクト全体チャット履歴を取得
 * @returns {Array} プロジェクトチャットメッセージの配列
 */
function getProjectChatHistory() {
    // プロジェクト管理が有効な場合は、現在のプロジェクトのチャット履歴のみを返す
    if (currentProjectId && projectChatHistory) {
        return projectChatHistory.filter(msg => msg.projectId === currentProjectId);
    }
    return projectChatHistory || [];
}

/**
 * プロジェクト全体チャットにメッセージを追加
 * @param {string} content - メッセージ内容
 * @param {string} type - メッセージタイプ（'user', 'assistant', 'system'）
 * @param {object} associatedTask - 関連タスク情報
 * @param {string} associatedTask.type - 'global', 'node', 'none'
 * @param {number} [associatedTask.nodeIndex] - ノードインデックス（type='node'の場合）
 * @param {string} [associatedTask.nodeName] - ノード名（表示用）
 * @returns {object|null} 追加されたメッセージオブジェクト
 */
function addProjectChatMessage(content, type = 'user', associatedTask = { type: 'global' }) {
    if (typeof content !== 'string' || content.trim() === '') {
        console.error('Invalid message content');
        return null;
    }
    
    const timestamp = new Date().toISOString();
    const messageId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const message = {
        id: messageId,
        content: content.trim(),
        timestamp: timestamp,
        type: type,
        projectId: currentProjectId || null, // 現在のプロジェクトIDを記録
        associatedTask: {
            type: associatedTask.type || 'global',
            nodeIndex: associatedTask.nodeIndex || null,
            nodeName: associatedTask.nodeName || null
        }
    };
    
    if (!projectChatHistory) {
        projectChatHistory = [];
    }
    
    projectChatHistory.push(message);
    
    // デバウンス版の保存を使用してパフォーマンスを改善
    saveToLocalStorage();
    
    return message;
}

/**
 * プロジェクト全体チャットメッセージを削除
 * @param {string} messageId - メッセージID
 * @returns {boolean} 削除成功の場合true
 */
function deleteProjectChatMessage(messageId) {
    if (!projectChatHistory) {
        return false;
    }
    
    const originalLength = projectChatHistory.length;
    // 現在のプロジェクトのメッセージのみ削除対象とする
    projectChatHistory = projectChatHistory.filter(msg => {
        if (msg.id === messageId) {
            // プロジェクト管理が有効な場合は、現在のプロジェクトのメッセージのみ削除
            if (currentProjectId && msg.projectId !== currentProjectId) {
                return true; // 他のプロジェクトのメッセージは残す
            }
            return false; // 削除対象
        }
        return true; // その他のメッセージは残す
    });
    
    const deleted = projectChatHistory.length < originalLength;
    
    if (deleted) {
        // デバウンス版の保存を使用してパフォーマンスを改善
        saveToLocalStorage();
    }
    
    return deleted;
}

/**
 * プロジェクト全体チャットメッセージを更新
 * @param {string} messageId - メッセージID
 * @param {string} newContent - 新しいメッセージ内容
 * @returns {boolean} 更新成功の場合true
 */
function updateProjectChatMessage(messageId, newContent) {
    if (!projectChatHistory || typeof newContent !== 'string' || newContent.trim() === '') {
        return false;
    }
    
    const message = projectChatHistory.find(msg => {
        if (msg.id === messageId) {
            // プロジェクト管理が有効な場合は、現在のプロジェクトのメッセージのみ更新対象
            if (currentProjectId && msg.projectId !== currentProjectId) {
                return false; // 他のプロジェクトのメッセージは対象外
            }
            return true; // 更新対象
        }
        return false;
    });
    
    if (message) {
        message.content = newContent.trim();
        message.timestamp = new Date().toISOString(); // 更新時刻を記録
        
        // デバウンス版の保存を使用してパフォーマンスを改善
        saveToLocalStorage();
        
        return true;
    }
    
    return false;
}

/**
 * プロジェクト全体チャットメッセージを更新（関連付けも含む）
 * @param {string} messageId - メッセージID
 * @param {string} newContent - 新しいメッセージ内容
 * @param {object} newAssociation - 新しい関連付け設定
 * @returns {boolean} 更新成功の場合true
 */
function updateProjectChatMessageWithAssociation(messageId, newContent, newAssociation) {
    if (!projectChatHistory || typeof newContent !== 'string' || newContent.trim() === '') {
        return false;
    }
    
    const message = projectChatHistory.find(msg => msg.id === messageId && (!currentProjectId || msg.projectId === currentProjectId));
    
    if (message) {
        message.content = newContent.trim();
        message.associatedTask = newAssociation;
        message.timestamp = new Date().toISOString(); // 更新時刻を記録
        
        // デバウンス版の保存を使用してパフォーマンスを改善
        saveToLocalStorage();
        
        return true;
    }
    
    return false;
}

/**
 * プロジェクト全体チャット履歴を全て削除
 * @returns {boolean} 削除成功の場合true
 */
function clearProjectChatHistory() {
    if (!projectChatHistory) {
        return false;
    }
    const originalLength = projectChatHistory.length;
    projectChatHistory = projectChatHistory.filter(msg => msg.projectId !== currentProjectId);
    
    if (projectChatHistory.length < originalLength) {
        // デバウンス版の保存を使用してパフォーマンスを改善
        saveToLocalStorage();
    }
    
    return true;
}

/**
 * タスク関連付けでプロジェクトチャット履歴をフィルタリング
 * @param {string} filterType - 'all', 'global', 'node', 'none'
 * @param {number} [nodeIndex] - filterType='node'の場合のノードインデックス
 * @returns {Array} フィルタされたメッセージ配列
 */
function getFilteredProjectChatHistory(filterType = 'all', nodeIndex = null) {
    if (!projectChatHistory) {
        return [];
    }
    
    // まず現在のプロジェクトのメッセージのみにフィルタ
    let currentProjectMessages = projectChatHistory;
    if (currentProjectId) {
        currentProjectMessages = projectChatHistory.filter(msg => msg.projectId === currentProjectId);
    }
    
    if (filterType === 'all') {
        return [...currentProjectMessages];
    }
    
    return currentProjectMessages.filter(msg => {
        if (filterType === 'node' && nodeIndex !== null) {
            return msg.associatedTask.type === 'node' && msg.associatedTask.nodeIndex === nodeIndex;
        }
        return msg.associatedTask.type === filterType;
    });
}

// ===== ノードメモ管理機能（一人用、ユーザー投稿限定） =====

let nodeMemos = {};

/**
 * ノードメモデータを読み込み
 */
function loadNodeMemos() {
    if (!isLocalStorageAvailable()) {
        console.warn('LocalStorage is not available');
        return;
    }
    
    try {
        const stored = localStorage.getItem(STORAGE_KEYS.NODE_MEMOS);
        if (stored) {
            nodeMemos = JSON.parse(stored);
        }
    } catch (e) {
        console.error('Error loading node memos:', e);
        nodeMemos = {};
    }
}

/**
 * ノードメモを取得
 * @param {number} nodeIndex - ノードのインデックス
 * @returns {Array} メモ配列
 */
function getChatHistory(nodeIndex) {
    return nodeMemos[nodeIndex] || [];
}

/**
 * ノードメモを追加
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} content - メモ内容
 * @param {string} type - 'user'（固定）
 * @returns {object|null} 追加されたメモオブジェクト
 */
function addChatMessage(nodeIndex, content, type) {
    if (type !== 'user' || typeof content !== 'string' || content.trim() === '') {
        return null;
    }
    
    const memo = {
        id: `memo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        content: content.trim(),
        timestamp: new Date().toISOString(),
        type: type
    };
    
    if (!nodeMemos[nodeIndex]) {
        nodeMemos[nodeIndex] = [];
    }
    
    nodeMemos[nodeIndex].push(memo);
    saveToLocalStorage();
    
    return memo;
}

/**
 * ノードメモを削除
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} messageId - メッセージID
 * @returns {boolean} 削除成功の場合true
 */
function deleteChatMessage(nodeIndex, messageId) {
    if (!nodeMemos[nodeIndex]) {
        return false;
    }
    
    const originalLength = nodeMemos[nodeIndex].length;
    nodeMemos[nodeIndex] = nodeMemos[nodeIndex].filter(memo => memo.id !== messageId);
    
    if (nodeMemos[nodeIndex].length < originalLength) {
        // 空になった場合は配列を削除
        if (nodeMemos[nodeIndex].length === 0) {
            delete nodeMemos[nodeIndex];
        }
        saveToLocalStorage();
        return true;
    }
    
    return false;
}

/**
 * ノードメモを更新
 * @param {number} nodeIndex - ノードのインデックス
 * @param {string} messageId - メッセージID
 * @param {string} newContent - 新しい内容
 * @returns {boolean} 更新成功の場合true
 */
function updateChatMessage(nodeIndex, messageId, newContent) {
    if (!nodeMemos[nodeIndex] || typeof newContent !== 'string' || newContent.trim() === '') {
        return false;
    }
    
    const memo = nodeMemos[nodeIndex].find(m => m.id === messageId);
    if (memo) {
        memo.content = newContent.trim();
        memo.timestamp = new Date().toISOString(); // 更新時刻を記録
        saveToLocalStorage();
        return true;
    }
    
    return false;
}

/**
 * ノード削除時のメモクリーンアップ
 * @param {number} deletedNodeIndex - 削除されたノードのインデックス
 */
function cleanupMemosAfterNodeDeletion(deletedNodeIndex) {
    if (nodeMemos[deletedNodeIndex]) {
        delete nodeMemos[deletedNodeIndex];
        saveToLocalStorage();
    }
}