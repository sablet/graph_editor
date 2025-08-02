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
    
    renderNodes();
    renderSelects();
    renderHierarchySelects();
    renderRelations();
    renderHierarchy();
    updateUILabels();
    generateMermaidCode();
    setupDiagramControls();
    setupFullscreenControls();
    setupMobileTabs();
    
    // プレビューパネルタブ機能初期化
    setupPreviewTabs();
    
    // タスク機能初期化
    initializeTaskSystem();
    
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

// ノードテキストの加工処理（共通関数）
function processNodeText(text) {
    // 文頭の"* "を除去
    if (text.startsWith('* ')) {
        text = text.substring(2);
    }
    
    // 今後、他の加工処理もここに追加可能
    // 例: 特殊文字のエスケープ、文字数制限など
    
    return text;
}

// 単一ノード追加（最初の行のみ使用）
function addSingleNode() {
    const nodeInput = document.getElementById('node-input');
    const inputText = nodeInput.value.trim();
    
    if (inputText === '') {
        alert('ノード名を入力してください');
        return;
    }
    
    // 最初の行のみを取得し、共通関数で加工
    const firstLine = inputText.split('\n')[0].trim();
    const cleanedFirstLine = processNodeText(firstLine);
    
    if (cleanedFirstLine === '') {
        alert('有効なノード名を入力してください');
        return;
    }
    
    if (nodes.includes(cleanedFirstLine)) {
        alert('同じ名前のノードが既に存在します');
        return;
    }
    
    nodes.push(cleanedFirstLine);
    nodeInput.value = '';
    
    renderNodes();
    renderSelects();
    updateTaskNodeSelect();
    
    // LocalStorageに保存
    saveToLocalStorage();
}

// バルクノード追加（複数行対応・確認ダイアログ付き）
function addBulkNodes() {
    const nodeInput = document.getElementById('node-input');
    const inputText = nodeInput.value.trim();
    
    if (inputText === '') {
        alert('ノード名を入力してください');
        return;
    }
    
    // 行ごとに分割し、空行を除去、共通関数で加工
    const newNodes = inputText.split('\n')
        .map(line => line.trim())
        .map(line => processNodeText(line))
        .filter(line => line !== '');
    
    if (newNodes.length === 0) {
        alert('有効なノード名が見つかりません');
        return;
    }
    
    // 重複チェック
    const duplicates = [];
    const validNodes = [];
    
    newNodes.forEach(nodeText => {
        if (nodes.includes(nodeText)) {
            duplicates.push(nodeText);
        } else if (validNodes.includes(nodeText)) {
            // 入力内での重複もチェック
            duplicates.push(nodeText + ' (入力内重複)');
        } else {
            validNodes.push(nodeText);
        }
    });
    
    // 追加予定のノードを確認
    let confirmMessage = `以下の${validNodes.length}個のノードを追加しますか？\n\n`;
    confirmMessage += validNodes.map((node, index) => `${index + 1}. ${node}`).join('\n');
    
    if (duplicates.length > 0) {
        confirmMessage += `\n\n※ 以下は重複のため追加されません：\n${duplicates.join('\n')}`;
    }
    
    if (validNodes.length === 0) {
        alert('追加できる新しいノードがありません。\n\n重複したノード：\n' + duplicates.join('\n'));
        return;
    }
    
    // 確認ダイアログを表示
    if (confirm(confirmMessage)) {
        nodes.push(...validNodes);
        nodeInput.value = '';
        
        renderNodes();
        renderSelects();
        renderHierarchySelects();
        updateTaskNodeSelect();
        
        // LocalStorageに保存
        saveToLocalStorage();
        
        let resultMessage = `${validNodes.length}個のノードを追加しました。`;
        if (duplicates.length > 0) {
            resultMessage += `\n\n${duplicates.length}個のノードは重複のため追加されませんでした。`;
        }
        alert(resultMessage);
    }
}

// ノード削除
function deleteNode(index) {
    if (confirm(`ノード「${nodes[index]}」を削除しますか？関連するリレーション、階層関係、タスクも削除されます。`)) {
        // 関連するリレーションを削除
        relations = relations.filter(rel => rel.from !== index && rel.to !== index);
        
        // インデックスを調整
        relations = relations.map(rel => ({
            from: rel.from > index ? rel.from - 1 : rel.from,
            to: rel.to > index ? rel.to - 1 : rel.to
        }));

        // 関連する階層関係を削除
        nodeHierarchy = nodeHierarchy.filter(hier => 
            hier.parent !== index && !hier.children.includes(index)
        );

        // 階層関係のインデックスを調整
        nodeHierarchy = nodeHierarchy.map(hier => ({
            children: hier.children.map(child => child > index ? child - 1 : child).filter(child => child !== index),
            parent: hier.parent > index ? hier.parent - 1 : hier.parent
        })).filter(hier => hier.children.length > 0);
        
        // タスクデータのクリーンアップ
        cleanupTasksAfterNodeDeletion(index);
        
        // ステータスデータのクリーンアップ
        cleanupNodeStatusAfterDeletion(index);
        
        // 折りたたみ状態のクリーンアップ
        cleanupNodeCardStateAfterDeletion(index);
        
        // ノードを削除
        nodes.splice(index, 1);
        
        renderNodes();
        renderSelects();
        renderHierarchySelects();
        renderRelations();
        renderHierarchy();
        updateTaskNodeSelect();
        generateMermaidCode();
        
        // LocalStorageに保存
        saveToLocalStorage();
    }
}

// ノード一覧を表示（階層対応・折りたたみ）
function renderNodes() {
    const nodeList = document.getElementById('node-list');
    nodeList.innerHTML = '';
    
    if (nodes.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.style.color = '#6b7280';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.padding = '20px';
        emptyMessage.textContent = 'ノードがありません';
        nodeList.appendChild(emptyMessage);
        return;
    }
    
    // すべての子ノードのインデックスを取得
    const childIndices = new Set();
    nodeHierarchy.forEach(hierarchy => {
        hierarchy.children.forEach(childIndex => {
            childIndices.add(childIndex);
        });
    });
    
    // 親ノードと独立ノードを順番に表示
    const parentAndStandaloneNodes = [];
    for (let i = 0; i < nodes.length; i++) {
        if (!childIndices.has(i)) {
            parentAndStandaloneNodes.push(i);
        }
    }
    
    parentAndStandaloneNodes.forEach(index => {
        renderNodeItemRecursive(index, 0);
    });
}

// 再帰的にノードアイテムを描画（多階層対応）
function renderNodeItemRecursive(nodeIndex, depth = 0, parentIndex = null) {
    const node = nodes[nodeIndex];
    const isChild = depth > 0;
    
    renderNodeItem(node, nodeIndex, isChild, parentIndex, depth);
    
    // このノードが親ノードの場合は子ノードも再帰的に表示
    if (isParentNode(nodeIndex)) {
        const childNodes = getChildNodes(nodeIndex);
        childNodes.forEach(childIndex => {
            renderNodeItemRecursive(childIndex, depth + 1, nodeIndex);
        });
    }
}

// 個別ノードアイテムを描画（多階層対応）
function renderNodeItem(node, index, isChild = false, parentIndex = null, depth = 0) {
    const nodeList = document.getElementById('node-list');
    const nodeElement = document.createElement('div');
    
    if (isChild) {
        nodeElement.className = 'node-item child-node';
        nodeElement.dataset.parentIndex = parentIndex;
        nodeElement.dataset.depth = depth;
        // 階層の深さに応じてインデントを調整
        const indentWidth = 20 * depth;
        nodeElement.style.marginLeft = `${indentWidth}px`;
    } else {
        nodeElement.className = 'node-item';
        if (isParentNode(index)) {
            nodeElement.classList.add('parent-node');
        }
    }
    
    nodeElement.style.display = 'flex';
    nodeElement.style.justifyContent = 'space-between';
    nodeElement.style.alignItems = 'center';
    
    const nodeTextContainer = document.createElement('div');
    nodeTextContainer.style.flex = '1';
    nodeTextContainer.style.display = 'flex';
    nodeTextContainer.style.alignItems = 'center';
    
    // アイコン用のスペースを確保（親ノードでなくても同じ幅を保持）
    const iconContainer = document.createElement('span');
    iconContainer.style.width = '15px';
    iconContainer.style.display = 'inline-block';
    iconContainer.style.textAlign = 'left';
    
    // 親ノードの場合は展開/折りたたみアイコンを追加
    if (isParentNode(index)) {
        const expandIcon = document.createElement('span');
        expandIcon.className = 'expand-icon';
        expandIcon.textContent = '▶';
        expandIcon.dataset.parentIndex = index;
        expandIcon.onclick = (e) => {
            e.stopPropagation();
            toggleChildNodes(index, expandIcon);
        };
        iconContainer.appendChild(expandIcon);
    }
    
    const nodeText = document.createElement('span');
    const statusInfo = getNodeStatusInfo(index);
    
    // ノード名の前にステータスインジケーターを追加
    const statusIndicator = document.createElement('span');
    statusIndicator.style.cssText = `
        display: inline-block;
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: ${statusInfo.color};
        margin-right: 6px;
        vertical-align: middle;
    `;
    statusIndicator.title = `ステータス: ${statusInfo.label}`;
    
    nodeText.appendChild(statusIndicator);
    nodeText.appendChild(document.createTextNode(`${getNodeDisplayNumber(index)}. ${node}`));
    nodeText.style.marginRight = '10px';
    
    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn-danger';
    deleteButton.style.fontSize = '11px';
    deleteButton.style.padding = '4px 8px';
    deleteButton.textContent = '削除';
    deleteButton.onclick = () => deleteNode(index);
    
    nodeTextContainer.appendChild(iconContainer);
    nodeTextContainer.appendChild(nodeText);
    nodeElement.appendChild(nodeTextContainer);
    nodeElement.appendChild(deleteButton);
    nodeList.appendChild(nodeElement);
    
    // 親ノードがクリックされた時の展開/折りたたみ
    if (isParentNode(index)) {
        nodeElement.onclick = (e) => {
            if (e.target !== deleteButton && !e.target.classList.contains('expand-icon')) {
                const expandIcon = nodeElement.querySelector('.expand-icon');
                toggleChildNodes(index, expandIcon);
            }
        };
    }
}

// 子ノードの表示/非表示を切り替え（多階層対応）
function toggleChildNodes(parentIndex, expandIcon) {
    const childNodes = document.querySelectorAll(`[data-parent-index="${parentIndex}"]`);
    
    if (!expandIcon) return;
    
    const isExpanded = expandIcon.classList.contains('expanded');
    
    childNodes.forEach(childNode => {
        if (isExpanded) {
            // 折りたたみ：直接の子ノードとその子孫をすべて非表示
            hideNodeAndDescendants(childNode);
            expandIcon.classList.remove('expanded');
            expandIcon.textContent = '▶';
        } else {
            // 展開：直接の子ノードのみ表示
            childNode.classList.add('expanded');
            expandIcon.classList.add('expanded');
            expandIcon.textContent = '▼';
        }
    });
}

// ノードとその子孫を再帰的に非表示にする
function hideNodeAndDescendants(nodeElement) {
    nodeElement.classList.remove('expanded');
    
    // この要素のノードインデックスを取得
    const deleteButton = nodeElement.querySelector('.btn-danger');
    let nodeIndex;
    if (deleteButton && deleteButton.onclick) {
        nodeIndex = parseInt(deleteButton.onclick.toString().match(/deleteNode\((\d+)\)/)?.[1]);
    }
    
    if (nodeIndex !== undefined) {
        // このノードの子ノードもすべて非表示にする
        const descendantNodes = document.querySelectorAll(`[data-parent-index="${nodeIndex}"]`);
        descendantNodes.forEach(descendant => {
            hideNodeAndDescendants(descendant);
        });
        
        // 展開アイコンもリセット
        const expandIcon = nodeElement.querySelector('.expand-icon');
        if (expandIcon) {
            expandIcon.classList.remove('expanded');
            expandIcon.textContent = '▶';
        }
    }
}

// セレクトボックスとチェックボックスを更新
function renderSelects() {
    renderUnifiedMultiCheckboxes();
    renderUnifiedSingleSelect();
}

// 階層選択セレクトボックスを更新（統合UI用）
function renderHierarchySelects() {
    renderUnifiedMultiCheckboxes();
    renderUnifiedSingleSelect();
}

// 統合UI用：複数選択チェックボックスを描画（多階層対応）
function renderUnifiedMultiCheckboxes() {
    const checkboxContainer = document.getElementById('multi-checkboxes');
    checkboxContainer.innerHTML = '';
    
    // すべての子ノードのインデックスを取得
    const childIndices = new Set();
    nodeHierarchy.forEach(hierarchy => {
        hierarchy.children.forEach(childIndex => {
            childIndices.add(childIndex);
        });
    });
    
    // 親ノードと独立ノードを順番に表示
    const parentAndStandaloneNodes = [];
    for (let i = 0; i < nodes.length; i++) {
        if (!childIndices.has(i)) {
            parentAndStandaloneNodes.push(i);
        }
    }
    
    parentAndStandaloneNodes.forEach(index => {
        renderUnifiedCheckboxItemRecursive(index, checkboxContainer, 0);
    });
}

// 再帰的にチェックボックスアイテムを描画
function renderUnifiedCheckboxItemRecursive(nodeIndex, container, depth = 0, parentIndex = null) {
    const node = nodes[nodeIndex];
    const isChild = depth > 0;
    
    renderUnifiedCheckboxItem(node, nodeIndex, isChild, container, parentIndex, depth);
    
    // この ノードが親ノードの場合は子ノードも再帰的に表示
    if (isParentNode(nodeIndex)) {
        const childNodes = getChildNodes(nodeIndex);
        childNodes.forEach(childIndex => {
            renderUnifiedCheckboxItemRecursive(childIndex, container, depth + 1, nodeIndex);
        });
    }
}

// 統合UI用：個別チェックボックスアイテムを描画（多階層対応）
function renderUnifiedCheckboxItem(node, index, isChild = false, container, parentIndex = null, depth = 0) {
    const checkboxItem = document.createElement('div');
    checkboxItem.className = 'checkbox-item';
    checkboxItem.style.display = 'flex';
    checkboxItem.style.alignItems = 'center';
    
    if (isChild) {
        // 階層の深さに応じてインデントを調整
        const indentWidth = 20 * depth;
        checkboxItem.style.marginLeft = `${indentWidth}px`;
        checkboxItem.style.borderLeft = '3px solid #059669';
        checkboxItem.style.paddingLeft = '8px';
        checkboxItem.style.backgroundColor = '#f0fdf4';
        checkboxItem.classList.add('child-checkbox');
        checkboxItem.dataset.parentIndex = parentIndex;
        checkboxItem.dataset.depth = depth;
        checkboxItem.style.display = 'none'; // デフォルトで非表示
    }
    
    // アイコン用のスペースを確保（親ノードでなくても同じ幅を保持）
    const iconContainer = document.createElement('span');
    iconContainer.style.width = '15px'; // アイコン分の固定幅
    iconContainer.style.display = 'inline-block';
    iconContainer.style.textAlign = 'left';
    
    if (isParentNode(index)) {
        checkboxItem.classList.add('parent-checkbox');
        checkboxItem.style.cursor = 'pointer';
        
        // 展開/折りたたみアイコンを追加
        const expandIcon = document.createElement('span');
        expandIcon.className = 'expand-icon-checkbox';
        expandIcon.textContent = '▶';
        expandIcon.style.fontSize = '10px';
        expandIcon.style.color = '#059669';
        expandIcon.style.cursor = 'pointer';
        expandIcon.dataset.nodeIndex = index; // ノードインデックスを保存
        expandIcon.onclick = (e) => {
            e.stopPropagation();
            toggleChildCheckboxes(index, expandIcon);
        };
        iconContainer.appendChild(expandIcon);
    }
    
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `multi-checkbox-${index}`;
    checkbox.value = index;
    checkbox.style.marginRight = '8px';
    
    const label = document.createElement('label');
    label.htmlFor = `multi-checkbox-${index}`;
    label.textContent = `${getNodeDisplayNumber(index)}. ${node}`;
    label.style.cursor = 'pointer';
    label.style.flex = '1';
    
    checkboxItem.appendChild(iconContainer);
    checkboxItem.appendChild(checkbox);
    checkboxItem.appendChild(label);
    container.appendChild(checkboxItem);
    
    // 親ノードクリック時の展開/折りたたみ
    if (isParentNode(index)) {
        checkboxItem.onclick = (e) => {
            if (e.target !== checkbox && e.target !== label && !e.target.classList.contains('expand-icon-checkbox')) {
                const expandIcon = checkboxItem.querySelector('.expand-icon-checkbox');
                toggleChildCheckboxes(index, expandIcon);
            }
        };
    }
}

// 子チェックボックスの表示/非表示を切り替え（多階層対応）
function toggleChildCheckboxes(parentIndex, expandIcon) {
    const childCheckboxes = document.querySelectorAll(`[data-parent-index="${parentIndex}"].child-checkbox`);
    
    if (!expandIcon) return;
    
    const isExpanded = expandIcon.classList.contains('expanded');
    
    childCheckboxes.forEach(childCheckbox => {
        if (isExpanded) {
            // 折りたたみ：直接の子ノードとその子孫をすべて非表示
            hideCheckboxAndDescendants(childCheckbox);
            expandIcon.classList.remove('expanded');
            expandIcon.textContent = '▶';
        } else {
            // 展開：直接の子ノードのみ表示（孫は親の展開状態による）
            childCheckbox.style.display = 'flex';
            expandIcon.classList.add('expanded');
            expandIcon.textContent = '▼';
        }
    });
}

// チェックボックスとその子孫を再帰的に非表示にする
function hideCheckboxAndDescendants(checkboxElement) {
    checkboxElement.style.display = 'none';
    
    // この要素のノードインデックスを取得
    const nodeIndex = parseInt(checkboxElement.querySelector('input').value);
    
    // このノードの子ノードもすべて非表示にする
    const descendantCheckboxes = document.querySelectorAll(`[data-parent-index="${nodeIndex}"].child-checkbox`);
    descendantCheckboxes.forEach(descendant => {
        hideCheckboxAndDescendants(descendant);
    });
    
    // 展開アイコンもリセット
    const expandIcon = checkboxElement.querySelector('.expand-icon-checkbox');
    if (expandIcon) {
        expandIcon.classList.remove('expanded');
        expandIcon.textContent = '▶';
    }
}

// 統合UI用：単一選択セレクトボックスを描画
function renderUnifiedSingleSelect() {
    const singleSelect = document.getElementById('single-select');
    const singleValue = singleSelect.value;
    
    singleSelect.innerHTML = '<option value="">選択してください</option>';
    
    nodes.forEach((node, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = `${getNodeDisplayNumber(index)}. ${node}`;
        singleSelect.appendChild(option);
    });
    
    singleSelect.value = singleValue;
}


// 階層関係追加（統合UI対応）
function addHierarchy() {
    const singleSelect = document.getElementById('single-select');
    const parentIndex = singleSelect.value;
    
    // 選択された子ノードチェックボックスを取得
    const selectedChildren = [];
    const checkboxes = document.querySelectorAll('#multi-checkboxes input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
        selectedChildren.push(parseInt(checkbox.value));
    });
    
    if (selectedChildren.length === 0 || parentIndex === '') {
        alert('子ノードと親ノードの両方を選択してください');
        return;
    }
    
    // 親に子を含める選択をチェック
    if (selectedChildren.includes(parseInt(parentIndex))) {
        alert('親ノードを子ノードに含めることはできません');
        return;
    }
    
    // 既存の階層関係をチェック（同じ親の場合は子を追加）
    const existingHierarchyIndex = nodeHierarchy.findIndex(hier => hier.parent === parseInt(parentIndex));
    
    if (existingHierarchyIndex >= 0) {
        // 既存の親の子リストに追加
        const existingChildren = nodeHierarchy[existingHierarchyIndex].children;
        const newChildren = selectedChildren.filter(child => !existingChildren.includes(child));
        
        if (newChildren.length === 0) {
            alert('選択された子ノードは既に同じ親に設定されています');
            return;
        }
        
        nodeHierarchy[existingHierarchyIndex].children = [...existingChildren, ...newChildren];
    } else {
        // 新しい階層関係を追加
        nodeHierarchy.push({
            children: selectedChildren,
            parent: parseInt(parentIndex)
        });
    }
    
    // UIを更新
    renderHierarchy();
    regenerateNodeNumbers();
    updateUILabels(); // ラベルを更新
    generateMermaidCode();
    
    // LocalStorageに保存
    saveToLocalStorage();
    
    // フォームをリセット
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    singleSelect.value = '';
}

// UIラベルを更新（階層関係の有無に応じて）
function updateUILabels() {
    const multiLabel = document.getElementById('multi-select-label');
    const singleLabel = document.getElementById('single-select-label');
    
    if (nodeHierarchy.length > 0) {
        // 階層関係がある場合は親子関係を明確に表示
        multiLabel.textContent = '子ノード - 複数選択可';
        singleLabel.textContent = '親ノード';
    } else {
        // 階層関係がない場合は従来通りの表示
        multiLabel.textContent = 'From (開始ノード) - 複数選択可';
        singleLabel.textContent = 'To (終了ノード)';
    }
}

// ノード表示番号を取得（階層対応・番号調整）
function getNodeDisplayNumber(nodeIndex) {
    // 該当ノードが子ノードかチェック
    for (let i = 0; i < nodeHierarchy.length; i++) {
        const hierarchy = nodeHierarchy[i];
        const childPosition = hierarchy.children.indexOf(nodeIndex);
        if (childPosition >= 0) {
            const parentNumber = getNodeDisplayNumber(hierarchy.parent);
            return `${parentNumber}-${childPosition + 1}`;
        }
    }
    
    // 親ノードまたは階層に属さないノードの場合は調整された番号を返す
    return getAdjustedNodeNumber(nodeIndex);
}

// 子ノードを除外した調整済み番号を取得
function getAdjustedNodeNumber(nodeIndex) {
    // すべての子ノードのインデックスを取得
    const childIndices = new Set();
    nodeHierarchy.forEach(hierarchy => {
        hierarchy.children.forEach(childIndex => {
            childIndices.add(childIndex);
        });
    });
    
    // 子ノードを除外してソート
    const parentAndStandaloneNodes = [];
    for (let i = 0; i < nodes.length; i++) {
        if (!childIndices.has(i)) {
            parentAndStandaloneNodes.push(i);
        }
    }
    parentAndStandaloneNodes.sort((a, b) => a - b);
    
    // 調整済み番号を返す
    const position = parentAndStandaloneNodes.indexOf(nodeIndex);
    return position >= 0 ? position + 1 : nodeIndex + 1;
}

// ノードが子ノードかどうかを判定
function isChildNode(nodeIndex) {
    return nodeHierarchy.some(hierarchy => hierarchy.children.includes(nodeIndex));
}

// ノードが親ノードかどうかを判定
function isParentNode(nodeIndex) {
    return nodeHierarchy.some(hierarchy => hierarchy.parent === nodeIndex);
}

// ノードの子ノードを取得
function getChildNodes(nodeIndex) {
    const hierarchy = nodeHierarchy.find(h => h.parent === nodeIndex);
    return hierarchy ? hierarchy.children : [];
}

// ノード番号を再生成
function regenerateNodeNumbers() {
    renderNodes();
    renderSelects();
    renderHierarchySelects();
}

// 階層関係一覧を表示
function renderHierarchy() {
    const hierarchyList = document.getElementById('hierarchy-list');
    hierarchyList.innerHTML = '';
    
    if (nodeHierarchy.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.style.color = '#6b7280';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.padding = '20px';
        emptyMessage.textContent = '階層関係がありません';
        hierarchyList.appendChild(emptyMessage);
        return;
    }
    
    nodeHierarchy.forEach((hierarchy, hierarchyIndex) => {
        const hierarchyElement = document.createElement('div');
        hierarchyElement.className = 'relation-item';
        hierarchyElement.style.flexDirection = 'column';
        hierarchyElement.style.alignItems = 'flex-start';
        
        const hierarchyText = document.createElement('div');
        hierarchyText.style.width = '100%';
        hierarchyText.style.marginBottom = '10px';
        
        // 子ノード部分（複数の場合はリスト表示）
        const childrenList = hierarchy.children.map(childIndex => 
            `<strong>${getNodeDisplayNumber(childIndex)}.</strong> ${nodes[childIndex]}`
        ).join('<br>');
        
        hierarchyText.innerHTML = `
            <div style="margin-bottom: 8px;">
                ${childrenList}
            </div>
            <div style="text-align: center; margin: 8px 0; color: #059669; font-weight: bold;">
                ↑ 子ノード
            </div>
            <div style="background: #f0fdf4; padding: 8px; border-radius: 4px; border-left: 3px solid #059669;">
                <strong>${getNodeDisplayNumber(hierarchy.parent)}.</strong> ${nodes[hierarchy.parent]} (親)
            </div>
        `;
        
        // 削除ボタンコンテナ
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '5px';
        buttonContainer.style.flexWrap = 'wrap';
        buttonContainer.style.marginTop = '10px';
        
        // 個別削除ボタン
        hierarchy.children.forEach(childIndex => {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn-danger';
            deleteButton.style.fontSize = '11px';
            deleteButton.style.padding = '4px 8px';
            deleteButton.textContent = `${getNodeDisplayNumber(childIndex)}→${getNodeDisplayNumber(hierarchy.parent)} 削除`;
            deleteButton.onclick = () => deleteHierarchyChild(hierarchyIndex, childIndex);
            buttonContainer.appendChild(deleteButton);
        });
        
        // 全て削除ボタン（複数子がある場合のみ）
        if (hierarchy.children.length > 1) {
            const deleteAllButton = document.createElement('button');
            deleteAllButton.className = 'btn-danger';
            deleteAllButton.style.fontSize = '11px';
            deleteAllButton.style.padding = '4px 8px';
            deleteAllButton.style.backgroundColor = '#dc2626';
            deleteAllButton.textContent = `全て削除 (→${getNodeDisplayNumber(hierarchy.parent)})`;
            deleteAllButton.onclick = () => deleteHierarchy(hierarchyIndex);
            buttonContainer.appendChild(deleteAllButton);
        }
        
        hierarchyElement.appendChild(hierarchyText);
        hierarchyElement.appendChild(buttonContainer);
        hierarchyList.appendChild(hierarchyElement);
    });
}

// 階層関係から特定の子を削除
function deleteHierarchyChild(hierarchyIndex, childIndex) {
    const hierarchy = nodeHierarchy[hierarchyIndex];
    hierarchy.children = hierarchy.children.filter(child => child !== childIndex);
    
    // 子が一つもなくなった場合は階層自体を削除
    if (hierarchy.children.length === 0) {
        nodeHierarchy.splice(hierarchyIndex, 1);
    }
    
    renderHierarchy();
    regenerateNodeNumbers();
    updateUILabels();
    generateMermaidCode();
    
    // LocalStorageに保存
    saveToLocalStorage();
}

// 階層関係を削除
function deleteHierarchy(hierarchyIndex) {
    nodeHierarchy.splice(hierarchyIndex, 1);
    renderHierarchy();
    regenerateNodeNumbers();
    updateUILabels();
    generateMermaidCode();
    
    // LocalStorageに保存
    saveToLocalStorage();
}


// リレーション追加（統合UI対応）
function addRelation() {
    const singleSelect = document.getElementById('single-select');
    const toIndex = singleSelect.value;
    
    // 選択されたFromチェックボックスを取得
    const selectedFroms = [];
    const checkboxes = document.querySelectorAll('#multi-checkboxes input[type="checkbox"]:checked');
    checkboxes.forEach(checkbox => {
        selectedFroms.push(parseInt(checkbox.value));
    });
    
    if (selectedFroms.length === 0 || toIndex === '') {
        alert('FromとToの両方を選択してください');
        return;
    }
    
    // 同じノードの選択をチェック
    if (selectedFroms.includes(parseInt(toIndex))) {
        alert('FromとToに同じノードを選択することはできません');
        return;
    }
    
    // 新しいリレーションを追加
    let addedCount = 0;
    selectedFroms.forEach(fromIndex => {
        // 既存のリレーションをチェック
        const exists = relations.some(rel => 
            rel.from === fromIndex && rel.to === parseInt(toIndex)
        );
        
        if (!exists) {
            relations.push({
                from: fromIndex,
                to: parseInt(toIndex)
            });
            addedCount++;
        }
    });
    
    if (addedCount === 0) {
        alert('選択されたリレーションは既に存在します');
        return;
    }
    
    // UIを更新
    renderRelations();
    generateMermaidCode();
    
    // LocalStorageに保存
    saveToLocalStorage();
    
    // フォームをリセット
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    singleSelect.value = '';
}

// リレーション一覧を表示（複数から一つへの形式でグループ化）
function renderRelations() {
    const relationsList = document.getElementById('relations-list');
    relationsList.innerHTML = '';
    
    if (relations.length === 0) {
        const emptyMessage = document.createElement('div');
        emptyMessage.style.color = '#6b7280';
        emptyMessage.style.textAlign = 'center';
        emptyMessage.style.padding = '20px';
        emptyMessage.textContent = 'リレーションがありません';
        relationsList.appendChild(emptyMessage);
        return;
    }
    
    // Toノードでグループ化
    const groupedRelations = {};
    relations.forEach((relation, index) => {
        const toNode = relation.to;
        if (!groupedRelations[toNode]) {
            groupedRelations[toNode] = [];
        }
        groupedRelations[toNode].push({ ...relation, originalIndex: index });
    });
    
    // グループ化されたリレーションを表示
    Object.keys(groupedRelations).forEach(toNodeIndex => {
        const toNode = parseInt(toNodeIndex);
        const fromNodes = groupedRelations[toNode];
        
        const relationElement = document.createElement('div');
        relationElement.className = 'relation-item';
        relationElement.style.flexDirection = 'column';
        relationElement.style.alignItems = 'flex-start';
        
        const relationText = document.createElement('div');
        relationText.style.width = '100%';
        relationText.style.marginBottom = '10px';
        
        // From部分（複数の場合はリスト表示）
        const fromList = fromNodes.map(rel => 
            `<strong>${getNodeDisplayNumber(rel.from)}.</strong> ${nodes[rel.from]}`
        ).join('<br>');
        
        relationText.innerHTML = `
            <div style="margin-bottom: 8px;">
                ${fromList}
            </div>
            <div style="text-align: center; margin: 8px 0; color: #3b82f6; font-weight: bold;">
                ↓
            </div>
            <div style="background: #f0f9ff; padding: 8px; border-radius: 4px; border-left: 3px solid #3b82f6;">
                <strong>${getNodeDisplayNumber(toNode)}.</strong> ${nodes[toNode]}
            </div>
        `;
        
        // 削除ボタンコンテナ
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.gap = '5px';
        buttonContainer.style.flexWrap = 'wrap';
        buttonContainer.style.marginTop = '10px';
        
        // 個別削除ボタン
        fromNodes.forEach(rel => {
            const deleteButton = document.createElement('button');
            deleteButton.className = 'btn-danger';
            deleteButton.style.fontSize = '11px';
            deleteButton.style.padding = '4px 8px';
            deleteButton.textContent = `${getNodeDisplayNumber(rel.from)}→${getNodeDisplayNumber(toNode)} 削除`;
            deleteButton.onclick = () => deleteRelation(rel.originalIndex);
            buttonContainer.appendChild(deleteButton);
        });
        
        // 全て削除ボタン（複数ある場合のみ）
        if (fromNodes.length > 1) {
            const deleteAllButton = document.createElement('button');
            deleteAllButton.className = 'btn-danger';
            deleteAllButton.style.fontSize = '11px';
            deleteAllButton.style.padding = '4px 8px';
            deleteAllButton.style.backgroundColor = '#dc2626';
            deleteAllButton.textContent = `全て削除 (→${getNodeDisplayNumber(toNode)})`;
            deleteAllButton.onclick = () => {
                // 逆順で削除（インデックスのずれを防ぐため）
                const sortedIndices = fromNodes.map(rel => rel.originalIndex).sort((a, b) => b - a);
                sortedIndices.forEach(index => deleteRelation(index));
            };
            buttonContainer.appendChild(deleteAllButton);
        }
        
        relationElement.appendChild(relationText);
        relationElement.appendChild(buttonContainer);
        relationsList.appendChild(relationElement);
    });
}

// リレーション削除
function deleteRelation(index) {
    relations.splice(index, 1);
    renderRelations();
    generateMermaidCode();
    
    // LocalStorageに保存
    saveToLocalStorage();
}

// ノードIDを生成（Mermaid用）
function getNodeId(index) {
    return `node${index}`;
}

// ノードラベルをエスケープ
function escapeLabel(label) {
    return label.replace(/"/g, '&quot;').replace(/\n/g, '<br>');
}

// Mermaidコードを生成
function generateMermaidCode() {
    let mermaidCode = 'flowchart TD\n';
    
    // ノードを定義
    nodes.forEach((node, index) => {
        const nodeId = getNodeId(index);
        const label = escapeLabel(node);
        mermaidCode += `    ${nodeId}["${label}"]\n`;
    });
    
    // リレーションを定義
    relations.forEach(relation => {
        const fromId = getNodeId(relation.from);
        const toId = getNodeId(relation.to);
        mermaidCode += `    ${fromId} --> ${toId}\n`;
    });
    
    // コードを表示
    document.getElementById('mermaid-code').textContent = mermaidCode;
    
    // Mermaidダイアグラムを描画
    renderMermaidDiagram(mermaidCode);
}

// Mermaidダイアグラムを描画
async function renderMermaidDiagram(code) {
    const diagramElement = document.getElementById('mermaid-diagram');
    
    if (relations.length === 0) {
        diagramElement.innerHTML = '<p style="color: #6b7280; text-align: center; padding: 40px;">リレーションを追加するとグラフが表示されます</p>';
        return;
    }
    
    try {
        // 既存の図を削除
        diagramElement.innerHTML = '';
        
        // 一意のIDを生成
        const diagramId = 'mermaid-diagram-' + Date.now();
        
        // 新しいdiv要素を作成
        const tempDiv = document.createElement('div');
        tempDiv.id = diagramId;
        diagramElement.appendChild(tempDiv);
        
        // Mermaidレンダリング（新しいAPI使用）
        const { svg } = await mermaid.render(diagramId + '-svg', code);
        tempDiv.innerHTML = svg;
        
    } catch (error) {
        console.error('Mermaid rendering error:', error);
        diagramElement.innerHTML = '<p style="color: #dc2626; text-align: center; padding: 40px;">グラフの描画でエラーが発生しました</p>';
    }
}

// ダイアグラムコントロールのセットアップ
function setupDiagramControls() {
    const container = document.getElementById('diagram-container');
    
    // マウスホイールでズーム
    container.addEventListener('wheel', function(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom(currentZoom + delta);
    });
    
    // ドラッグでパン
    container.addEventListener('mousedown', function(e) {
        isDragging = true;
        lastMousePos = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
    });
    
    container.addEventListener('mousemove', function(e) {
        if (!isDragging) return;
        
        const deltaX = e.clientX - lastMousePos.x;
        const deltaY = e.clientY - lastMousePos.y;
        
        container.scrollLeft -= deltaX;
        container.scrollTop -= deltaY;
        
        lastMousePos = { x: e.clientX, y: e.clientY };
    });
    
    container.addEventListener('mouseup', function() {
        isDragging = false;
        container.style.cursor = 'grab';
    });
    
    container.addEventListener('mouseleave', function() {
        isDragging = false;
        container.style.cursor = 'grab';
    });
}

// ズーム機能
function setZoom(zoom) {
    currentZoom = Math.max(0.1, Math.min(3, zoom));
    const diagramElement = document.getElementById('mermaid-diagram');
    diagramElement.style.transform = `scale(${currentZoom})`;
    diagramElement.style.transformOrigin = 'top left';
    document.getElementById('zoom-level').textContent = `${Math.round(currentZoom * 100)}%`;
}

function zoomIn() {
    setZoom(currentZoom + 0.2);
}

function zoomOut() {
    setZoom(currentZoom - 0.2);
}

function resetZoom() {
    setZoom(1);
    const container = document.getElementById('diagram-container');
    container.scrollLeft = 0;
    container.scrollTop = 0;
}

function fitToContainer() {
    const container = document.getElementById('diagram-container');
    const diagram = document.getElementById('mermaid-diagram');
    
    if (diagram.firstElementChild) {
        const diagramRect = diagram.firstElementChild.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        const scaleX = (containerRect.width - 30) / diagramRect.width;
        const scaleY = (containerRect.height - 30) / diagramRect.height;
        const scale = Math.min(scaleX, scaleY, 1);
        
        setZoom(scale);
        container.scrollLeft = 0;
        container.scrollTop = 0;
    }
}

// 全画面表示機能
function openFullscreen() {
    if (relations.length === 0) {
        alert('リレーションを追加してからグラフを全画面表示してください');
        return;
    }
    
    const modal = document.getElementById('fullscreen-modal');
    modal.style.display = 'flex';
    
    // 現在のMermaidコードを取得して全画面用ダイアグラムを描画
    const currentCode = document.getElementById('mermaid-code').textContent;
    renderFullscreenMermaidDiagram(currentCode);
    
    // ESCキーで閉じる
    document.addEventListener('keydown', handleFullscreenEscape);
}

function closeFullscreen() {
    const modal = document.getElementById('fullscreen-modal');
    modal.style.display = 'none';
    document.removeEventListener('keydown', handleFullscreenEscape);
    
    // 全画面用の状態をリセット
    fullscreenZoom = 1;
    const container = document.getElementById('fullscreen-diagram-container');
    container.scrollLeft = 0;
    container.scrollTop = 0;
}

function handleFullscreenEscape(e) {
    if (e.key === 'Escape') {
        closeFullscreen();
    }
}

// 全画面用Mermaidダイアグラムを描画
async function renderFullscreenMermaidDiagram(code) {
    const diagramElement = document.getElementById('fullscreen-mermaid-diagram');
    
    try {
        diagramElement.innerHTML = '';
        
        const diagramId = 'fullscreen-mermaid-diagram-' + Date.now();
        const tempDiv = document.createElement('div');
        tempDiv.id = diagramId;
        diagramElement.appendChild(tempDiv);
        
        const { svg } = await mermaid.render(diagramId + '-svg', code);
        tempDiv.innerHTML = svg;
        
        // 初期ズームを画面に合わせる
        fitToFullscreenContainer();
        
    } catch (error) {
        console.error('Fullscreen Mermaid rendering error:', error);
        diagramElement.innerHTML = '<p style="color: #dc2626; text-align: center; padding: 40px;">グラフの描画でエラーが発生しました</p>';
    }
}

// 全画面用コントロールのセットアップ
function setupFullscreenControls() {
    const container = document.getElementById('fullscreen-diagram-container');
    
    // マウスホイールでズーム
    container.addEventListener('wheel', function(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setFullscreenZoom(fullscreenZoom + delta);
    });
    
    // ドラッグでパン
    container.addEventListener('mousedown', function(e) {
        isFullscreenDragging = true;
        fullscreenLastMousePos = { x: e.clientX, y: e.clientY };
        container.style.cursor = 'grabbing';
    });
    
    container.addEventListener('mousemove', function(e) {
        if (!isFullscreenDragging) return;
        
        const deltaX = e.clientX - fullscreenLastMousePos.x;
        const deltaY = e.clientY - fullscreenLastMousePos.y;
        
        container.scrollLeft -= deltaX;
        container.scrollTop -= deltaY;
        
        fullscreenLastMousePos = { x: e.clientX, y: e.clientY };
    });
    
    container.addEventListener('mouseup', function() {
        isFullscreenDragging = false;
        container.style.cursor = 'grab';
    });
    
    container.addEventListener('mouseleave', function() {
        isFullscreenDragging = false;
        container.style.cursor = 'grab';
    });
}

// 全画面用ズーム機能
function setFullscreenZoom(zoom) {
    fullscreenZoom = Math.max(0.1, Math.min(3, zoom));
    const diagramElement = document.getElementById('fullscreen-mermaid-diagram');
    diagramElement.style.transform = `scale(${fullscreenZoom})`;
    diagramElement.style.transformOrigin = 'top left';
    document.getElementById('fullscreen-zoom-level').textContent = `${Math.round(fullscreenZoom * 100)}%`;
}

function zoomInFullscreen() {
    setFullscreenZoom(fullscreenZoom + 0.2);
}

function zoomOutFullscreen() {
    setFullscreenZoom(fullscreenZoom - 0.2);
}

function resetZoomFullscreen() {
    setFullscreenZoom(1);
    const container = document.getElementById('fullscreen-diagram-container');
    container.scrollLeft = 0;
    container.scrollTop = 0;
}

function fitToFullscreenContainer() {
    const container = document.getElementById('fullscreen-diagram-container');
    const diagram = document.getElementById('fullscreen-mermaid-diagram');
    
    if (diagram.firstElementChild) {
        const diagramRect = diagram.firstElementChild.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        const scaleX = (containerRect.width - 30) / diagramRect.width;
        const scaleY = (containerRect.height - 30) / diagramRect.height;
        const scale = Math.min(scaleX, scaleY, 1);
        
        setFullscreenZoom(scale);
        container.scrollLeft = 0;
        container.scrollTop = 0;
    }
}

// プロジェクト管理機能

// プロジェクトのデフォルト構造
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
            nodeCardCollapsed: {}
        }
    };
}

// プロジェクトID生成
function generateProjectId() {
    return 'project_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// プロジェクト一覧取得
function getProjects() {
    return projects;
}

// 現在のプロジェクト取得
function getCurrentProject() {
    return projects.find(p => p.id === currentProjectId);
}

// プロジェクト作成
function createProject(name, description = '') {
    const newProject = createDefaultProject(name, description, false); // 空データで作成
    projects.push(newProject);
    saveProjectsToStorage();
    return newProject;
}

// プロジェクト更新
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

// プロジェクト削除
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

// プロジェクト切り替え
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
    
    // UI更新
    updateProjectUI();
    saveCurrentProjectIdToStorage();
    
    return true;
}

// 現在のプロジェクトデータを保存
function saveCurrentProjectData() {
    const currentProject = getCurrentProject();
    if (currentProject) {
        currentProject.data = {
            nodes: [...nodes],
            relations: [...relations],
            nodeHierarchy: [...nodeHierarchy],
            nodeTasks: {...nodeTasks},
            nodeStatuses: {...nodeStatuses},
            nodeCardCollapsed: {...nodeCardCollapsed}
        };
        currentProject.updatedAt = new Date().toISOString();
    }
}

// プロジェクトデータを読み込み
function loadProjectData(project) {
    nodes = [...project.data.nodes];
    relations = [...project.data.relations];
    nodeHierarchy = [...project.data.nodeHierarchy];
    nodeTasks = {...project.data.nodeTasks};
    nodeStatuses = {...project.data.nodeStatuses};
    nodeCardCollapsed = {...project.data.nodeCardCollapsed};
}

// プロジェクト関連のLocalStorage操作
function saveProjectsToStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects));
        return true;
    } catch (e) {
        console.error('Failed to save projects to localStorage:', e);
        return false;
    }
}

function saveCurrentProjectIdToStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.CURRENT_PROJECT_ID, currentProjectId);
        return true;
    } catch (e) {
        console.error('Failed to save current project ID to localStorage:', e);
        return false;
    }
}

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

// UI更新関数
function updateProjectUI() {
    renderNodes();
    renderSelects();
    renderHierarchySelects();
    renderRelations();
    renderHierarchy();
    updateUILabels();
    generateMermaidCode();
    updateTaskNodeSelect();
    renderAllNodesTasks();
    updateProjectSelector();
}

// プロジェクトセレクター更新
function updateProjectSelector() {
    const selector = document.getElementById('project-selector');
    if (!selector) return;
    
    selector.innerHTML = '';
    
    projects.forEach(project => {
        const option = document.createElement('option');
        option.value = project.id;
        option.textContent = project.name;
        option.selected = project.id === currentProjectId;
        selector.appendChild(option);
    });
}

// プロジェクト管理UI関数

// プロジェクト管理の初期化
function initializeProjectManagement() {
    updateProjectSelector();
    setupProjectEventListeners();
}

// プロジェクト関連のイベントリスナー設定
function setupProjectEventListeners() {
    // プロジェクト選択
    const selector = document.getElementById('project-selector');
    if (selector) {
        selector.addEventListener('change', function(e) {
            const projectId = e.target.value;
            if (projectId && projectId !== currentProjectId) {
                switchToProject(projectId);
            }
        });
    }
    
    // プロジェクト作成ボタン
    const createBtn = document.getElementById('create-project-btn');
    if (createBtn) {
        createBtn.addEventListener('click', showCreateProjectModal);
    }
    
    // プロジェクト更新ボタン
    const updateBtn = document.getElementById('update-project-btn');
    if (updateBtn) {
        updateBtn.addEventListener('click', updateCurrentProject);
    }
    
    // プロジェクト削除ボタン
    const deleteBtn = document.getElementById('delete-project-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', deleteCurrentProject);
    }
}

// プロジェクト作成モーダル表示
function showCreateProjectModal() {
    const name = prompt('プロジェクト名を入力してください:', '');
    if (name && name.trim()) {
        const description = prompt('プロジェクトの説明を入力してください（省略可）:', '') || '';
        const newProject = createProject(name.trim(), description.trim());
        switchToProject(newProject.id);
        alert(`プロジェクト「${name}」が作成されました。`);
    }
}

// 現在のプロジェクト更新
function updateCurrentProject() {
    const currentProject = getCurrentProject();
    if (!currentProject) {
        alert('プロジェクトが選択されていません。');
        return;
    }
    
    const newName = prompt('新しいプロジェクト名を入力してください:', currentProject.name);
    if (!newName || newName.trim() === currentProject.name) {
        return; // キャンセルまたは変更なし
    }
    
    const newDescription = prompt('新しい説明を入力してください（省略可）:', currentProject.description || '');
    
    updateProject(currentProject.id, { 
        name: newName.trim(),
        description: newDescription.trim()
    });
    updateProjectSelector();
    alert(`プロジェクト「${newName.trim()}」を更新しました。`);
}

// 現在のプロジェクト削除
function deleteCurrentProject() {
    const currentProject = getCurrentProject();
    if (!currentProject) return;
    
    if (projects.length === 1) {
        alert('最後のプロジェクトは削除できません。');
        return;
    }
    
    const confirmDelete = confirm(`プロジェクト「${currentProject.name}」を削除してもよろしいですか？\n\nこの操作は取り消せません。`);
    if (confirmDelete) {
        const projectName = currentProject.name;
        deleteProject(currentProject.id);
        updateProjectSelector();
        alert(`プロジェクト「${projectName}」を削除しました。`);
    }
}

// プロジェクト複製
function duplicateCurrentProject() {
    const currentProject = getCurrentProject();
    if (!currentProject) return;
    
    const newName = prompt('複製するプロジェクトの名前を入力してください:', `${currentProject.name} のコピー`);
    if (newName && newName.trim()) {
        const copyData = confirm('現在のプロジェクトのデータをコピーしますか？\n\n「OK」: データをコピー\n「キャンセル」: 空のプロジェクト');
        
        // 現在のデータを保存してから複製
        saveCurrentProjectData();
        
        const duplicatedProject = createDefaultProject(newName.trim(), `${currentProject.description} (複製)`, false);
        
        if (copyData) {
            duplicatedProject.data = JSON.parse(JSON.stringify(currentProject.data)); // ディープコピー
        }
        
        // プロジェクト配列を更新
        const index = projects.findIndex(p => p.id === duplicatedProject.id);
        if (index !== -1) {
            projects[index] = duplicatedProject;
        }
        
        saveProjectsToStorage();
        updateProjectSelector();
        alert(`プロジェクト「${newName.trim()}」が作成されました。`);
    }
}

// LocalStorage データ永続化機能

// LocalStorageキー定義
const STORAGE_KEYS = {
    NODES: 'graphEditor_nodes',
    RELATIONS: 'graphEditor_relations', 
    NODE_HIERARCHY: 'graphEditor_nodeHierarchy',
    NODE_TASKS: 'graphEditor_nodeTasks',
    NODE_STATUSES: 'graphEditor_nodeStatuses',
    NODE_CARD_COLLAPSED: 'graphEditor_nodeCardCollapsed',
    DATA_VERSION: 'graphEditor_dataVersion',
    // プロジェクト管理
    PROJECTS: 'graphEditor_projects',
    CURRENT_PROJECT_ID: 'graphEditor_currentProjectId'
};

// データバージョン管理
const CURRENT_DATA_VERSION = '1.0';

// LocalStorageの可用性チェック
function isLocalStorageAvailable() {
    try {
        const test = '__localStorage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch (e) {
        console.warn('LocalStorage not available:', e);
        return false;
    }
}

// 全データをLocalStorageに保存
function saveToLocalStorage() {
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
        }
        
        console.log('Data saved to localStorage successfully');
        return true;
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
        return false;
    }
}

// LocalStorageからデータを読み込み
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
        
        // データが存在する場合のみ復元、なければ初期データを使用
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
        
        console.log('Data loaded from localStorage successfully');
        return true;
    } catch (e) {
        console.error('Failed to load from localStorage:', e);
        initializeWithDefaultData();
        return false;
    }
}

// 初期データで初期化
function initializeWithDefaultData() {
    nodes = [...initialNodes];
    relations = [];
    nodeHierarchy = [];
    nodeTasks = {};
    nodeStatuses = {};
    nodeCardCollapsed = {};
    selectedNodeIndex = null;
    console.log('Initialized with default data');
}

// LocalStorageデータをクリア
function clearLocalStorage() {
    if (!isLocalStorageAvailable()) {
        return false;
    }
    
    try {
        Object.values(STORAGE_KEYS).forEach(key => {
            localStorage.removeItem(key);
        });
        console.log('LocalStorage cleared successfully');
        return true;
    } catch (e) {
        console.error('Failed to clear localStorage:', e);
        return false;
    }
}

// データリセット（初期状態に戻す）
function resetToInitialData() {
    // データを初期状態に戻す
    nodes = [...initialNodes];
    relations = [];
    nodeHierarchy = [];
    nodeTasks = {};
    selectedNodeIndex = null;
    nodeStatuses = {};
    nodeCardCollapsed = {};
    
    // LocalStorageをクリア
    clearLocalStorage();
    
    // UIを更新
    renderNodes();
    renderSelects();
    renderHierarchySelects();
    renderRelations();
    renderHierarchy();
    updateTaskNodeSelect();
    renderAllNodesTasks();
    generateMermaidCode();
    
    console.log('Data reset to initial state');
}

// エクスポート/インポート機能
function exportData() {
    // 現在のプロジェクトデータを保存
    if (currentProjectId) {
        saveCurrentProjectData();
    }
    
    const exportData = {
        version: CURRENT_DATA_VERSION,
        timestamp: new Date().toISOString(),
        exportType: 'projects', // プロジェクト形式
        data: {
            projects: projects,
            currentProjectId: currentProjectId
        },
        // 後方互換性のための旧形式データ
        legacyData: {
            nodes,
            relations,
            nodeHierarchy,
            nodeTasks,
            nodeStatuses,
            nodeCardCollapsed
        }
    };
    
    return JSON.stringify(exportData, null, 2);
}

function importData(jsonData) {
    try {
        const importedData = JSON.parse(jsonData);
        
        // バージョンチェック
        if (importedData.version !== CURRENT_DATA_VERSION) {
            throw new Error(`Data version mismatch. Expected ${CURRENT_DATA_VERSION}, got ${importedData.version}`);
        }
        
        // プロジェクト形式のデータか確認
        if (importedData.exportType === 'projects' && importedData.data && importedData.data.projects) {
            // プロジェクト形式のインポート
            projects = importedData.data.projects;
            
            // プロジェクトIDが存在するか確認
            const targetProjectId = importedData.data.currentProjectId;
            if (targetProjectId && projects.find(p => p.id === targetProjectId)) {
                currentProjectId = targetProjectId;
            } else {
                currentProjectId = projects.length > 0 ? projects[0].id : null;
            }
            
            // 現在のプロジェクトのデータを読み込み
            if (currentProjectId) {
                const currentProject = getCurrentProject();
                if (currentProject) {
                    loadProjectData(currentProject);
                }
            }
            
            // プロジェクトデータを保存
            saveProjectsToStorage();
            saveCurrentProjectIdToStorage();
            
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
            
            // データを復元
            nodes = dataToImport.nodes || [...initialNodes];
            relations = dataToImport.relations || [];
            nodeHierarchy = dataToImport.nodeHierarchy || [];
            nodeTasks = dataToImport.nodeTasks || {};
            nodeStatuses = dataToImport.nodeStatuses || {};
            nodeCardCollapsed = dataToImport.nodeCardCollapsed || {};
            
            // プロジェクトに切り替え
            switchToProject(newProject.id);
        }
        selectedNodeIndex = null;
        
        // LocalStorageに保存
        saveToLocalStorage();
        
        // UI全体を更新
        updateProjectUI();
        
        return true;
    } catch (e) {
        console.error('Failed to import data:', e);
        return false;
    }
}

// UI統合関数

// エクスポートデータをダウンロード
function downloadExportData() {
    try {
        const data = exportData();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `graph-editor-data-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        alert('データをエクスポートしました');
    } catch (e) {
        console.error('Export failed:', e);
        alert('エクスポートに失敗しました');
    }
}

// ファイルインポートハンドラー
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const success = importData(e.target.result);
            if (success) {
                alert('データをインポートしました');
            } else {
                alert('インポートに失敗しました。ファイル形式を確認してください。');
            }
        } catch (err) {
            console.error('Import error:', err);
            alert('インポートに失敗しました: ' + err.message);
        }
        
        // ファイル選択をリセット
        event.target.value = '';
    };
    
    reader.readAsText(file);
}

// タスク管理 CRUD 操作関数

// Create - タスク追加
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
    
    // UI更新
    renderTaskList(nodeIndex);
    updateOverallProgress(); // 全体進捗も更新
    
    // LocalStorageに保存
    saveToLocalStorage();
    
    return newTask.id;
}

// Read - タスク取得
function getNodeTasks(nodeIndex) {
    return nodeTasks[nodeIndex] || [];
}

function getTaskById(nodeIndex, taskId) {
    const tasks = nodeTasks[nodeIndex] || [];
    return tasks.find(task => task.id === taskId) || null;
}

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

// Update - タスク更新
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

// Delete - タスク削除
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

function deleteAllNodeTasks(nodeIndex) {
    const taskCount = nodeTasks[nodeIndex] ? nodeTasks[nodeIndex].length : 0;
    
    delete nodeTasks[nodeIndex];
    renderTaskList(nodeIndex);
    updateOverallProgress(); // 全体進捗も更新
    
    // LocalStorageに保存
    saveToLocalStorage();
    
    return taskCount;
}

// タスクリスト表示制御
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

function hideTaskList() {
    const taskContainer = document.getElementById('task-list-container');
    if (taskContainer) {
        taskContainer.style.display = 'none';
    }
}

// ノード選択プルダウン更新
function updateTaskNodeSelect() {
    const select = document.getElementById('task-node-select');
    if (!select) return;
    
    const currentValue = select.value;
    select.innerHTML = '<option value="">タスクを管理するノードを選択</option>';
    
    nodes.forEach((node, index) => {
        const option = document.createElement('option');
        option.value = index;
        const statusInfo = getNodeStatusInfo(index);
        
        // ノード名とステータスを表示
        option.textContent = `${getNodeDisplayNumber(index)}. ${node} [${statusInfo.label}]`;
        
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

// 選択ノード表示
function showSelectedNodeTasks() {
    const select = document.getElementById('task-node-select');
    const nodeIndex = parseInt(select.value);
    
    if (isNaN(nodeIndex)) {
        hideTaskList();
        return;
    }
    
    selectedNodeIndex = nodeIndex;
    renderTaskList(nodeIndex);
    showTaskList();
}

// タスクリスト描画
function renderTaskList(nodeIndex) {
    const taskList = document.getElementById('task-list');
    const selectedNodeInfo = document.getElementById('selected-node-info');
    
    if (!taskList || !selectedNodeInfo) return;
    
    // ノード情報表示
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
    
    // タスクリスト描画
    taskList.innerHTML = '';
    
    if (tasks.length === 0) {
        taskList.innerHTML = `
            <div style="color: #6b7280; text-align: center; padding: 20px; font-style: italic;">
                まだタスクがありません<br>
                下のフォームから追加してください
            </div>
        `;
        return;
    }
    
    tasks.forEach(task => {
        const taskItem = document.createElement('div');
        taskItem.className = 'task-item';
        taskItem.innerHTML = `
            <input type="checkbox" 
                class="task-checkbox" 
                ${task.completed ? 'checked' : ''} 
                onchange="toggleTaskCompletion(${nodeIndex}, '${task.id}')"
                aria-label="タスク完了状態">
            <span class="task-text ${task.completed ? 'completed' : ''}" 
                id="task-text-${task.id}">${task.text}</span>
            <div class="task-menu">
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
                    <button onclick="editTask(${nodeIndex}, '${task.id}')" role="menuitem">✏️ 編集</button>
                    <button onclick="deleteTask(${nodeIndex}, '${task.id}')" role="menuitem">🗑️ 削除</button>
                </div>
            </div>
        `;
        taskList.appendChild(taskItem);
    });
}

// 新規タスク追加
function addNewTask() {
    const input = document.getElementById('new-task-input');
    const taskText = input.value.trim();
    
    if (!taskText) {
        return;
    }
    
    if (selectedNodeIndex === null) {
        alert('タスクを追加するノードを選択してください');
        return;
    }
    
    const taskId = addTaskToNode(selectedNodeIndex, taskText);
    if (taskId) {
        input.value = '';
    }
}

// 三点リーダーメニュー制御
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

function closeAllTaskMenus() {
    const menus = document.querySelectorAll('.task-menu-dropdown');
    menus.forEach(menu => {
        menu.style.display = 'none';
        const button = menu.previousElementSibling;
        button.setAttribute('aria-expanded', 'false');
        menu.setAttribute('aria-hidden', 'true');
    });
}

// インライン編集
function editTask(nodeIndex, taskId) {
    closeAllTaskMenus();
    
    const taskTextSpan = document.getElementById(`task-text-${taskId}`);
    const currentText = taskTextSpan.textContent;
    
    // 編集用input要素を作成
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'task-edit-input';
    input.style.cssText = `
        flex: 1;
        padding: 4px 8px;
        border: 1px solid #3b82f6;
        border-radius: 4px;
        font-size: 14px;
        box-shadow: 0 0 0 1px #3b82f6;
    `;
    
    // 保存・キャンセル関数
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
    
    // spanを隠してinputを挿入
    taskTextSpan.style.display = 'none';
    taskTextSpan.parentNode.insertBefore(input, taskTextSpan);
    input.focus();
    input.select();
}

// ノード削除時のタスククリーンアップ
function cleanupTasksAfterNodeDeletion(deletedIndex) {
    // 削除されたノードのタスクを削除
    delete nodeTasks[deletedIndex];
    
    // インデックス調整（他のノードのタスクも移動）
    const newNodeTasks = {};
    
    Object.keys(nodeTasks).forEach(nodeIndexStr => {
        const nodeIndex = parseInt(nodeIndexStr);
        
        if (nodeIndex > deletedIndex) {
            // インデックスを1つ減らす
            newNodeTasks[nodeIndex - 1] = nodeTasks[nodeIndex];
        } else {
            // そのまま保持
            newNodeTasks[nodeIndex] = nodeTasks[nodeIndex];
        }
    });
    
    nodeTasks = newNodeTasks;
    
    // 選択中ノードの処理
    if (selectedNodeIndex === deletedIndex) {
        selectedNodeIndex = null;
        hideTaskList();
    } else if (selectedNodeIndex > deletedIndex) {
        selectedNodeIndex--;
    }
}

// ノードステータス管理 CRUD 操作関数

// ノードステータスの状態定義
const NODE_STATUSES = {
    NOT_STARTED: { id: 'not_started', label: '未着手', color: '#6b7280', bgColor: '#f9fafb' },
    IN_PROGRESS: { id: 'in_progress', label: '進行中', color: '#3b82f6', bgColor: '#eff6ff' },
    ON_HOLD: { id: 'on_hold', label: '保留', color: '#f59e0b', bgColor: '#fffbeb' },
    COMPLETED: { id: 'completed', label: '完了', color: '#059669', bgColor: '#f0fdf4' },
    BLOCKED: { id: 'blocked', label: 'ブロック', color: '#dc2626', bgColor: '#fef2f2' }
};

// ノードステータス取得
function getNodeStatus(nodeIndex) {
    return nodeStatuses[nodeIndex] || NODE_STATUSES.NOT_STARTED.id;
}

// ノードステータス設定
function setNodeStatus(nodeIndex, statusId) {
    if (NODE_STATUSES[statusId.toUpperCase()]) {
        nodeStatuses[nodeIndex] = statusId;
        
        // LocalStorageに保存
        saveToLocalStorage();
        return true;
    }
    return false;
}

// ノードステータス情報取得
function getNodeStatusInfo(nodeIndex) {
    const statusId = getNodeStatus(nodeIndex);
    return NODE_STATUSES[statusId.toUpperCase()] || NODE_STATUSES.NOT_STARTED;
}

// 全体進捗を更新
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
                <span>タスク進捗 (全ノード)</span>
                <span>${taskStats.completed}/${taskStats.total} (${taskStats.percentage}%)</span>
            </div>
            <div style="background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden;">
                <div style="background: #3b82f6; height: 100%; width: ${taskStats.percentage}%; transition: width 0.3s ease;"></div>
            </div>
        `;
    }
}

// 全ノードタスク表示関数
function renderAllNodesTasks() {
    const allTasksContainer = document.getElementById('all-tasks-container');
    if (!allTasksContainer) return;
    
    // 全体進捗を更新
    updateOverallProgress();
    
    allTasksContainer.innerHTML = '';
    
    // タスクがあるノードまたはステータスが設定されているノードを取得
    const relevantNodeIndices = new Set();
    
    // タスクがあるノードを追加
    Object.keys(nodeTasks).forEach(nodeIndex => {
        if (nodeTasks[nodeIndex] && nodeTasks[nodeIndex].length > 0) {
            relevantNodeIndices.add(parseInt(nodeIndex));
        }
    });
    
    // ステータスが設定されているノードを追加
    Object.keys(nodeStatuses).forEach(nodeIndex => {
        relevantNodeIndices.add(parseInt(nodeIndex));
    });
    
    // ノードが存在しない場合のメッセージ
    if (relevantNodeIndices.size === 0) {
        allTasksContainer.innerHTML = `
            <div style="color: #6b7280; text-align: center; padding: 40px; font-style: italic;">
                タスクまたはステータスが設定されているノードがありません<br>
                個別ノード管理から追加してください
            </div>
        `;
        return;
    }
    
    // ノードインデックス順にソート
    const sortedIndices = Array.from(relevantNodeIndices).sort((a, b) => a - b);
    
    sortedIndices.forEach(nodeIndex => {
        if (nodeIndex >= 0 && nodeIndex < nodes.length) {
            renderNodeTaskGroup(nodeIndex, allTasksContainer);
        }
    });
}

// 個別ノードタスクグループを描画
function renderNodeTaskGroup(nodeIndex, container) {
    const node = nodes[nodeIndex];
    const tasks = getNodeTasks(nodeIndex);
    const statusInfo = getNodeStatusInfo(nodeIndex);
    
    const nodeGroup = document.createElement('div');
    nodeGroup.className = 'node-task-group';
    nodeGroup.style.cssText = `
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        margin-bottom: 20px;
        background: white;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    `;
    
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
    const leftSection = document.createElement('div');
    leftSection.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
        cursor: pointer;
    `;
    
    // 展開/折りたたみアイコン
    const expandIcon = document.createElement('span');
    const isCollapsed = nodeCardCollapsed[nodeIndex] || false;
    expandIcon.textContent = isCollapsed ? '▶' : '▼';
    expandIcon.style.cssText = `
        font-size: 14px;
        color: #6b7280;
        transition: transform 0.2s ease;
        user-select: none;
        font-weight: bold;
    `;
    
    const nodeTitle = document.createElement('div');
    nodeTitle.style.cssText = `
        font-weight: 600;
        font-size: 16px;
        color: #1f2937;
        flex: 1;
    `;
    nodeTitle.textContent = `${getNodeDisplayNumber(nodeIndex)}. ${node}`;
    
    leftSection.appendChild(expandIcon);
    leftSection.appendChild(nodeTitle);
    
    // 展開/折りたたみ機能
    leftSection.onclick = (e) => {
        e.stopPropagation();
        toggleNodeCard(nodeIndex, expandIcon, tasksList, addTaskForm);
    };
    
    const statusBadge = document.createElement('div');
    statusBadge.style.cssText = `
        background: ${statusInfo.color};
        color: white;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 500;
        display: flex;
        align-items: center;
        gap: 4px;
    `;
    statusBadge.innerHTML = `
        <span>${statusInfo.label}</span>
        <span style="font-size: 10px; margin-left: 4px;">⚙️</span>
    `;
    
    // バッジ全体をクリック可能にする
    statusBadge.onclick = (e) => {
        e.stopPropagation();
        openNodeStatusEditor(nodeIndex);
    };
    statusBadge.onmouseover = () => statusBadge.style.opacity = '0.8';
    statusBadge.onmouseout = () => statusBadge.style.opacity = '1';
    statusBadge.title = 'クリックしてステータスを変更';
    statusBadge.style.cursor = 'pointer';
    statusBadge.style.transition = 'opacity 0.2s ease';
    
    nodeHeader.appendChild(leftSection);
    nodeHeader.appendChild(statusBadge);
    
    // タスクリスト
    const tasksList = document.createElement('div');
    tasksList.style.cssText = `
        padding: 16px;
    `;
    
    if (tasks.length === 0) {
        tasksList.innerHTML = `
            <div style="color: #6b7280; font-style: italic; text-align: center; padding: 20px;">
                タスクがありません
            </div>
        `;
    } else {
        const completedCount = tasks.filter(t => t.completed).length;
        const totalCount = tasks.length;
        const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        
        
        // 個別タスク
        tasks.forEach(task => {
            const taskItem = document.createElement('div');
            taskItem.style.cssText = `
                display: flex;
                align-items: center;
                padding: 8px 0;
                border-bottom: 1px solid #f3f4f6;
                gap: 8px;
            `;
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = task.completed;
            checkbox.onchange = () => {
                toggleTaskCompletion(nodeIndex, task.id);
                renderAllNodesTasks(); // 全体を再描画
            };
            
            const taskText = document.createElement('span');
            taskText.style.cssText = `
                flex: 1;
                ${task.completed ? 'text-decoration: line-through; color: #6b7280;' : ''}
            `;
            taskText.textContent = task.text;
            
            const editButton = document.createElement('button');
            editButton.style.cssText = `
                background: none;
                border: none;
                color: #6b7280;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                font-size: 12px;
            `;
            editButton.textContent = '✏️';
            editButton.onclick = () => editTaskInAllView(nodeIndex, task.id, taskText);
            
            const deleteButton = document.createElement('button');
            deleteButton.style.cssText = `
                background: none;
                border: none;
                color: #dc2626;
                cursor: pointer;
                padding: 4px;
                border-radius: 4px;
                font-size: 12px;
            `;
            deleteButton.textContent = '🗑️';
            deleteButton.onclick = () => {
                if (confirm('このタスクを削除しますか？')) {
                    deleteTask(nodeIndex, task.id);
                    renderAllNodesTasks(); // 全体を再描画
                }
            };
            
            taskItem.appendChild(checkbox);
            taskItem.appendChild(taskText);
            taskItem.appendChild(editButton);
            taskItem.appendChild(deleteButton);
            
            tasksList.appendChild(taskItem);
        });
    }
    
    // タスク追加フォーム
    const addTaskForm = document.createElement('div');
    addTaskForm.style.cssText = `
        padding: 16px;
        border-top: 1px solid #f3f4f6;
        background: #f9fafb;
        border-radius: 0 0 8px 8px;
    `;
    addTaskForm.innerHTML = `
        <div style="display: flex; gap: 8px;">
            <input type="text" 
                   id="add-task-input-${nodeIndex}" 
                   placeholder="新しいタスクを追加..."
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
    
    nodeGroup.appendChild(nodeHeader);
    nodeGroup.appendChild(tasksList);
    nodeGroup.appendChild(addTaskForm);
    container.appendChild(nodeGroup);
}

// ノードカードの展開/折りたたみ切り替え
function toggleNodeCard(nodeIndex, expandIcon, tasksList, addTaskForm) {
    const isCurrentlyCollapsed = nodeCardCollapsed[nodeIndex] || false;
    
    if (isCurrentlyCollapsed) {
        // 展開する
        nodeCardCollapsed[nodeIndex] = false;
        expandIcon.textContent = '▼';
        tasksList.style.display = 'block';
        addTaskForm.style.display = 'block';
    } else {
        // 折りたたむ
        nodeCardCollapsed[nodeIndex] = true;
        expandIcon.textContent = '▶';
        tasksList.style.display = 'none';
        addTaskForm.style.display = 'none';
    }
}

// 全ノード表示からタスクを追加
function addTaskToNodeFromAll(nodeIndex) {
    const input = document.getElementById(`add-task-input-${nodeIndex}`);
    const taskText = input.value.trim();
    
    if (!taskText) return;
    
    const taskId = addTaskToNode(nodeIndex, taskText);
    if (taskId) {
        input.value = '';
        renderAllNodesTasks(); // 全体を再描画
        updateTaskNodeSelect(); // 個別ノード選択も更新
    }
}

// 全ノード表示でのタスク編集
function editTaskInAllView(nodeIndex, taskId, taskTextElement) {
    const currentText = taskTextElement.textContent;
    
    // 編集用input要素を作成
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentText;
    input.className = 'task-edit-input';
    input.style.cssText = `
        flex: 1;
        padding: 4px 8px;
        border: 1px solid #3b82f6;
        border-radius: 4px;
        font-size: 14px;
        box-shadow: 0 0 0 1px #3b82f6;
    `;
    
    // 保存・キャンセル関数
    const saveEdit = () => {
        const newText = input.value.trim();
        if (newText && newText !== currentText) {
            updateTaskText(nodeIndex, taskId, newText);
            renderAllNodesTasks(); // 全体を再描画
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
    
    // spanを隠してinputを挿入
    taskTextElement.style.display = 'none';
    taskTextElement.parentNode.insertBefore(input, taskTextElement);
    input.focus();
    input.select();
}

// ノードステータス編集ダイアログを開く
function openNodeStatusEditor(nodeIndex) {
    const currentStatus = getNodeStatus(nodeIndex);
    const statusOptions = Object.values(NODE_STATUSES);
    
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    `;
    
    const dialog = document.createElement('div');
    dialog.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 24px;
        max-width: 400px;
        width: 90%;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    `;
    
    dialog.innerHTML = `
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">
            ノードステータス変更
        </h3>
        <p style="margin: 0 0 16px 0; color: #6b7280; font-size: 14px;">
            「${getNodeDisplayNumber(nodeIndex)}. ${nodes[nodeIndex]}」
        </p>
        <div id="status-options" style="margin-bottom: 20px;"></div>
        <div style="display: flex; gap: 8px; justify-content: flex-end;">
            <button id="cancel-status" style="background: #6b7280; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                キャンセル
            </button>
            <button id="save-status" style="background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                保存
            </button>
        </div>
    `;
    
    const optionsContainer = dialog.querySelector('#status-options');
    let selectedStatus = currentStatus;
    
    statusOptions.forEach(status => {
        const option = document.createElement('div');
        option.style.cssText = `
            display: flex;
            align-items: center;
            padding: 12px;
            border: 2px solid ${status.id === currentStatus ? status.color : '#e5e7eb'};
            border-radius: 6px;
            margin-bottom: 8px;
            cursor: pointer;
            background: ${status.id === currentStatus ? status.bgColor : 'white'};
            transition: all 0.2s ease;
        `;
        
        option.innerHTML = `
            <input type="radio" 
                   name="nodeStatus" 
                   value="${status.id}" 
                   ${status.id === currentStatus ? 'checked' : ''}
                   style="margin-right: 12px;">
            <div style="flex: 1;">
                <div style="font-weight: 500; color: ${status.color};">${status.label}</div>
            </div>
        `;
        
        option.onclick = () => {
            // 全ての選択を解除（直接の子要素のみ）
            Array.from(optionsContainer.children).forEach(opt => {
                opt.style.border = '2px solid #e5e7eb';
                opt.style.background = 'white';
                const radio = opt.querySelector('input[type="radio"]');
                if (radio) {
                    radio.checked = false;
                }
            });
            
            // 選択されたオプションをハイライト
            option.style.border = `2px solid ${status.color}`;
            option.style.background = status.bgColor;
            const radio = option.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
            }
            selectedStatus = status.id;
        };
        
        optionsContainer.appendChild(option);
    });
    
    // イベントリスナー
    dialog.querySelector('#cancel-status').onclick = () => {
        document.body.removeChild(modal);
    };
    
    dialog.querySelector('#save-status').onclick = () => {
        setNodeStatus(nodeIndex, selectedStatus);
        renderAllNodesTasks(); // 全体を再描画
        
        // 個別ノード管理のタスクリストも更新（選択中の場合）
        if (selectedNodeIndex === nodeIndex) {
            renderTaskList(nodeIndex);
        }
        
        // ノード選択のドロップダウンも更新
        updateTaskNodeSelect();
        
        document.body.removeChild(modal);
    };
    
    modal.onclick = (e) => {
        if (e.target === modal) {
            document.body.removeChild(modal);
        }
    };
    
    modal.appendChild(dialog);
    document.body.appendChild(modal);
}

// ノード削除時のステータスクリーンアップ
function cleanupNodeStatusAfterDeletion(deletedIndex) {
    // 削除されたノードのステータスを削除
    delete nodeStatuses[deletedIndex];
    
    // インデックス調整
    const newNodeStatuses = {};
    
    Object.keys(nodeStatuses).forEach(nodeIndexStr => {
        const nodeIndex = parseInt(nodeIndexStr);
        
        if (nodeIndex > deletedIndex) {
            newNodeStatuses[nodeIndex - 1] = nodeStatuses[nodeIndex];
        } else {
            newNodeStatuses[nodeIndex] = nodeStatuses[nodeIndex];
        }
    });
    
    nodeStatuses = newNodeStatuses;
}

// ノード削除時の折りたたみ状態クリーンアップ
function cleanupNodeCardStateAfterDeletion(deletedIndex) {
    // 削除されたノードの折りたたみ状態を削除
    delete nodeCardCollapsed[deletedIndex];
    
    // インデックス調整
    const newNodeCardCollapsed = {};
    
    Object.keys(nodeCardCollapsed).forEach(nodeIndexStr => {
        const nodeIndex = parseInt(nodeIndexStr);
        
        if (nodeIndex > deletedIndex) {
            newNodeCardCollapsed[nodeIndex - 1] = nodeCardCollapsed[nodeIndex];
        } else {
            newNodeCardCollapsed[nodeIndex] = nodeCardCollapsed[nodeIndex];
        }
    });
    
    nodeCardCollapsed = newNodeCardCollapsed;
}

// タスクシステム初期化
function initializeTaskSystem() {
    // データが空の場合のみ初期化（LocalStorageから読み込まれた場合は保持）
    if (Object.keys(nodeTasks).length === 0) {
        // サンプルタスクを追加
        addSampleTasks();
    }
    
    // selectedNodeIndexは常にリセット
    selectedNodeIndex = null;
    
    // UI初期化
    updateTaskNodeSelect();
    setupTaskInputHandlers();
    
    console.log('Task system initialized');
}

// サンプルタスクの追加
function addSampleTasks() {
    // ノード0（行き：持っていくべきものが決まってない）にサンプルタスクを追加
    nodeTasks[0] = [
        {
            id: "task_sample_1",
            text: "パスポート・身分証明書の確認",
            completed: true
        },
        {
            id: "task_sample_2",
            text: "旅行先の気候調査",
            completed: false
        },
        {
            id: "task_sample_3",
            text: "持参する衣類リスト作成",
            completed: false
        }
    ];
    
    // ノード1にもサンプルタスクを追加
    nodeTasks[1] = [
        {
            id: "task_sample_4",
            text: "新幹線の座席予約",
            completed: false
        }
    ];
    
    // サンプルノードステータスを設定
    nodeStatuses[0] = 'in_progress';  // 進行中
    nodeStatuses[1] = 'not_started';  // 未着手
    nodeStatuses[2] = 'completed';    // 完了
}

function setupTaskInputHandlers() {
    const taskInput = document.getElementById('new-task-input');
    if (taskInput) {
        taskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addNewTask();
            }
        });
    }
    
    // メニュー外クリックで閉じる
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.task-menu')) {
            closeAllTaskMenus();
        }
    });
}

// プレビューパネルタブの設定
function setupPreviewTabs() {
    const tabButtons = document.querySelectorAll('.preview-tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.dataset.previewTab;
            switchPreviewTab(targetTab);
        });
    });
    
    // 初期状態でgraphタブをアクティブにする
    switchPreviewTab('graph');
}

function switchPreviewTab(activeTab) {
    // タブボタンの状態を更新
    const tabButtons = document.querySelectorAll('.preview-tab-button');
    tabButtons.forEach(button => {
        if (button.dataset.previewTab === activeTab) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    // セクションの表示状態を更新
    const sections = document.querySelectorAll('[data-preview-section]');
    sections.forEach(section => {
        if (section.dataset.previewSection === activeTab) {
            section.style.display = 'block';
        } else {
            section.style.display = 'none';
        }
    });
    
    // タスクセクションが選択された場合の特別処理
    if (activeTab === 'tasks') {
        // タスクリストコンテナを表示状態に戻す（以前に選択されていた場合）
        if (selectedNodeIndex !== null) {
            showTaskList();
        }
    }
    
    // 全ノードタスクセクションが選択された場合の特別処理
    if (activeTab === 'all-tasks') {
        renderAllNodesTasks();
    }
}

// モバイルタブの設定
function setupMobileTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetTab = this.dataset.tab;
            switchMobileTab(targetTab);
        });
    });
    
    // 初期状態でnodesタブをアクティブにする
    switchMobileTab('nodes');
}

function switchMobileTab(activeTab) {
    // タブボタンの状態を更新
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        if (button.dataset.tab === activeTab) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });
    
    // パネルの表示状態を更新
    const panels = document.querySelectorAll('[data-panel]');
    panels.forEach(panel => {
        if (panel.dataset.panel === activeTab) {
            panel.classList.add('active');
        } else {
            panel.classList.remove('active');
        }
    });
}