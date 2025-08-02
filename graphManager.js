/**
 * ノード・グラフ・関係管理機能を提供するモジュール
 * RDBMS移植時はこのファイル内のノード・関係データ操作部分を変更すればよい
 */

// ===== ノード管理機能 =====

/**
 * ノードテキストの加工処理（共通関数）
 * @param {string} text - 加工するテキスト
 * @returns {string} 加工後のテキスト
 */
function processNodeText(text) {
    // 文頭の"* "を除去
    if (text.startsWith('* ')) {
        text = text.substring(2);
    }
    
    // 今後、他の加工処理もここに追加可能
    // 例: 特殊文字のエスケープ、文字数制限など
    
    return text;
}

/**
 * 単一ノードを追加
 */
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
    
    // 重複チェック
    if (nodes.includes(cleanedFirstLine)) {
        alert('このノードは既に存在します');
        return;
    }
    
    // ノードを追加
    nodes.push(cleanedFirstLine);
    const newNodeIndex = nodes.length - 1;
    
    // 新しいノードにタスクとステータスを初期化
    if (!nodeTasks[newNodeIndex]) {
        nodeTasks[newNodeIndex] = [];
    }
    
    nodeInput.value = '';
    
    // UI更新
    renderNodes();
    renderSelects();
    renderHierarchySelects();
    renderRelations();
    renderHierarchy();
    updateTaskNodeSelect();
    updateUILabels();
    renderAllNodesTasks();
    generateMermaidCode();
    
    // LocalStorageに保存
    saveToLocalStorage();
}

/**
 * バルクノード追加（複数行対応・確認ダイアログ付き）
 */
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
    
    newNodes.forEach(node => {
        if (nodes.includes(node)) {
            duplicates.push(node);
        } else {
            validNodes.push(node);
        }
    });
    
    if (validNodes.length === 0) {
        alert('すべてのノードが重複しています');
        return;
    }
    
    // 確認ダイアログ
    let confirmMessage = `以下の${validNodes.length}個のノードを追加しますか？\n\n`;
    validNodes.forEach((node, index) => {
        if (index < 10) { // 最初の10個のみ表示
            confirmMessage += `・${node}\n`;
        } else if (index === 10) {
            confirmMessage += `...他${validNodes.length - 10}個\n`;
        }
    });
    
    if (duplicates.length > 0) {
        confirmMessage += `\n重複により追加されないノード: ${duplicates.length}個`;
    }
    
    if (confirm(confirmMessage)) {
        // ノードを一括追加
        const startIndex = nodes.length;
        validNodes.forEach(node => nodes.push(node));
        
        // 新しいノードにタスクとステータスを初期化
        validNodes.forEach((node, index) => {
            const nodeIndex = startIndex + index;
            if (!nodeTasks[nodeIndex]) {
                nodeTasks[nodeIndex] = [];
            }
        });
        
        nodeInput.value = '';
        
        // UI更新
        renderNodes();
        renderSelects();
        renderHierarchySelects();
        renderRelations();
        renderHierarchy();
        updateTaskNodeSelect();
        updateUILabels();
        renderAllNodesTasks();
        generateMermaidCode();
        
        // LocalStorageに保存
        saveToLocalStorage();
        
        let resultMessage = `${validNodes.length}個のノードを追加しました。`;
        if (duplicates.length > 0) {
            resultMessage += `\n\n${duplicates.length}個のノードは重複のため追加されませんでした。`;
        }
        alert(resultMessage);
    }
}

/**
 * ノードを削除
 * @param {number} index - 削除するノードのインデックス
 */
function deleteNode(index) {
    if (confirm(`ノード「${nodes[index]}」を削除しますか？関連するリレーション、階層関係、タスクも削除されます。`)) {
        // 関連するリレーションを削除
        relations = relations.filter(rel => rel.from !== index && rel.to !== index);
        
        // インデックスを調整
        relations = relations.map(rel => ({
            from: rel.from > index ? rel.from - 1 : rel.from,
            to: rel.to > index ? rel.to - 1 : rel.to
        }));
        
        // 関連する階層関係を削除・調整
        nodeHierarchy = nodeHierarchy.filter(hier => 
            hier.parent !== index && !hier.children.includes(index)
        );
        
        nodeHierarchy = nodeHierarchy.map(hier => ({
            parent: hier.parent > index ? hier.parent - 1 : hier.parent,
            children: hier.children
                .filter(child => child !== index)
                .map(child => child > index ? child - 1 : child)
        }));
        
        // ノードを削除
        nodes.splice(index, 1);
        
        // タスクデータのクリーンアップ
        cleanupTasksAfterNodeDeletion(index);
        
        // ノードステータスのクリーンアップ
        cleanupNodeStatusAfterDeletion(index);
        
        // ノードカード状態のクリーンアップ
        cleanupNodeCardStateAfterDeletion(index);
        
        // UI更新
        renderNodes();
        renderSelects();
        renderHierarchySelects();
        renderRelations();
        renderHierarchy();
        updateTaskNodeSelect();
        updateUILabels();
        renderAllNodesTasks();
        generateMermaidCode();
        
        // LocalStorageに保存
        saveToLocalStorage();
    }
}

/**
 * ノード一覧を表示（階層対応・折りたたみ）
 */
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
    nodeHierarchy.forEach(hier => {
        hier.children.forEach(childIndex => {
            childIndices.add(childIndex);
        });
    });
    
    // 親ノードと独立ノードを先に表示
    const parentAndStandaloneNodes = [];
    for (let i = 0; i < nodes.length; i++) {
        if (!childIndices.has(i)) {
            parentAndStandaloneNodes.push(i);
        }
    }
    
    // 親ノードと独立ノードを表示し、その後に子ノードを再帰的に表示
    parentAndStandaloneNodes.forEach(nodeIndex => {
        renderNodeItemRecursive(nodeIndex, 0);
    });
}

/**
 * ノードアイテムを再帰的に表示
 * @param {number} nodeIndex - ノードのインデックス
 * @param {number} depth - 階層の深さ
 * @param {number|null} parentIndex - 親ノードのインデックス
 */
function renderNodeItemRecursive(nodeIndex, depth = 0, parentIndex = null) {
    const node = nodes[nodeIndex];
    const isChild = depth > 0;
    
    // ノードアイテム要素を作成
    const nodeElement = renderNodeItem(node, nodeIndex, isChild, parentIndex, depth);
    
    // ノードリストに追加
    const nodeList = document.getElementById('node-list');
    nodeList.appendChild(nodeElement);
    
    // 子ノードがある場合は再帰的に表示
    const hierarchy = nodeHierarchy.find(hier => hier.parent === nodeIndex);
    if (hierarchy) {
        hierarchy.children.forEach(childIndex => {
            renderNodeItemRecursive(childIndex, depth + 1, nodeIndex);
        });
    }
}

/**
 * ノードアイテム要素を作成
 * @param {string} node - ノード名
 * @param {number} index - ノードのインデックス
 * @param {boolean} isChild - 子ノードかどうか
 * @param {number|null} parentIndex - 親ノードのインデックス
 * @param {number} depth - 階層の深さ
 * @returns {HTMLElement} ノードアイテム要素
 */
function renderNodeItem(node, index, isChild = false, parentIndex = null, depth = 0) {
    const nodeItem = document.createElement('div');
    const hierarchy = nodeHierarchy.find(hier => hier.parent === index);
    const hasChildren = hierarchy && hierarchy.children.length > 0;
    
    nodeItem.className = isChild ? 'node-item child-node' : 'node-item';
    if (hasChildren && !isChild) {
        nodeItem.classList.add('parent-node');
    }
    
    // 子ノードの場合、親の折りたたみ状態によって表示制御
    if (isChild && parentIndex !== null) {
        const parentElement = document.querySelector(`[data-node-index="${parentIndex}"]`);
        if (parentElement && parentElement.dataset.collapsed === 'true') {
            nodeItem.style.display = 'none';
        } else {
            nodeItem.classList.add('expanded');
        }
    }
    
    let expandIconHtml = '';
    if (hasChildren && !isChild) {
        const isCollapsed = nodeItem.dataset.collapsed === 'true';
        expandIconHtml = `<span class="expand-icon ${isCollapsed ? '' : 'expanded'}" onclick="toggleChildNodes(${index}, this)">▶</span>`;
    }
    
    const indentStyle = isChild ? `margin-left: ${depth * 20}px;` : '';
    const nodeNumber = getNodeDisplayNumber(index);
    
    nodeItem.innerHTML = `
        ${expandIconHtml}
        <span style="${indentStyle}">${nodeNumber}. ${node}</span>
        <button onclick="deleteNode(${index})" style="margin-left: auto; background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 3px; font-size: 12px; cursor: pointer;">削除</button>
    `;
    
    nodeItem.setAttribute('data-node-index', index);
    
    // 親ノードの場合、クリックで子ノードを表示/非表示
    if (hasChildren && !isChild) {
        nodeItem.addEventListener('click', function(e) {
            // 削除ボタンや展開アイコンがクリックされた場合は無視
            if (e.target !== deleteButton && !e.target.classList.contains('expand-icon')) {
                const expandIcon = nodeItem.querySelector('.expand-icon');
                if (expandIcon) {
                    toggleChildNodes(index, expandIcon);
                }
            }
        });
    }
    
    return nodeItem;
}

/**
 * 子ノードの表示/非表示を切り替え
 * @param {number} parentIndex - 親ノードのインデックス
 * @param {HTMLElement} expandIcon - 展開アイコン要素
 */
function toggleChildNodes(parentIndex, expandIcon) {
    const parentElement = expandIcon.closest('.node-item');
    const isCollapsed = expandIcon.classList.contains('expanded');
    
    if (isCollapsed) {
        // 折りたたみ
        expandIcon.classList.remove('expanded');
        parentElement.dataset.collapsed = 'true';
        hideNodeAndDescendants(parentElement);
    } else {
        // 展開
        expandIcon.classList.add('expanded');
        parentElement.dataset.collapsed = 'false';
        showNodeAndDescendants(parentElement);
    }
}

/**
 * ノードとその子孫ノードを非表示にする
 * @param {HTMLElement} nodeElement - ノード要素
 */
function hideNodeAndDescendants(nodeElement) {
    const nodeIndex = parseInt(nodeElement.dataset.nodeIndex);
    const hierarchy = nodeHierarchy.find(hier => hier.parent === nodeIndex);
    
    if (hierarchy) {
        hierarchy.children.forEach(childIndex => {
            const childElement = document.querySelector(`[data-node-index="${childIndex}"]`);
            if (childElement) {
                childElement.style.display = 'none';
                childElement.classList.remove('expanded');
                // 再帰的に子の子も非表示にする
                hideNodeAndDescendants(childElement);
            }
        });
    }
}

/**
 * ノードとその子孫ノードを表示する
 * @param {HTMLElement} nodeElement - ノード要素
 */
function showNodeAndDescendants(nodeElement) {
    const nodeIndex = parseInt(nodeElement.dataset.nodeIndex);
    const hierarchy = nodeHierarchy.find(hier => hier.parent === nodeIndex);
    
    if (hierarchy) {
        hierarchy.children.forEach(childIndex => {
            const childElement = document.querySelector(`[data-node-index="${childIndex}"]`);
            if (childElement) {
                childElement.style.display = 'flex';
                childElement.classList.add('expanded');
                
                // 子ノードが展開状態の場合、その子も表示
                const childExpandIcon = childElement.querySelector('.expand-icon');
                if (childExpandIcon && childExpandIcon.classList.contains('expanded')) {
                    showNodeAndDescendants(childElement);
                }
            }
        });
    }
}

// ===== セレクトボックス・チェックボックス更新機能 =====

/**
 * セレクトボックスを更新
 */
function renderSelects() {
    renderUnifiedSingleSelect();
}

/**
 * 階層設定用セレクトボックスを更新
 */
function renderHierarchySelects() {
    renderUnifiedMultiCheckboxes();
}

/**
 * 統合マルチチェックボックスを更新
 */
function renderUnifiedMultiCheckboxes() {
    const container = document.getElementById('multi-checkboxes');
    container.innerHTML = '';
    
    if (nodes.length === 0) {
        container.innerHTML = '<div style="color: #6b7280; text-align: center; padding: 10px;">ノードがありません</div>';
        return;
    }
    
    // すべての子ノードのインデックスを取得
    const childIndices = new Set();
    nodeHierarchy.forEach(hier => {
        hier.children.forEach(childIndex => {
            childIndices.add(childIndex);
        });
    });
    
    // 親ノードと独立ノードを先に表示
    const parentAndStandaloneNodes = [];
    for (let i = 0; i < nodes.length; i++) {
        if (!childIndices.has(i)) {
            parentAndStandaloneNodes.push(i);
        }
    }
    
    // 親ノードと独立ノードを表示し、その後に子ノードを再帰的に表示
    parentAndStandaloneNodes.forEach(nodeIndex => {
        renderUnifiedCheckboxItemRecursive(nodeIndex, container, 0);
    });
}

/**
 * チェックボックスアイテムを再帰的に表示
 * @param {number} nodeIndex - ノードのインデックス
 * @param {HTMLElement} container - コンテナ要素
 * @param {number} depth - 階層の深さ
 * @param {number|null} parentIndex - 親ノードのインデックス
 */
function renderUnifiedCheckboxItemRecursive(nodeIndex, container, depth = 0, parentIndex = null) {
    const node = nodes[nodeIndex];
    const isChild = depth > 0;
    
    // チェックボックスアイテム要素を作成
    const checkboxElement = renderUnifiedCheckboxItem(node, nodeIndex, isChild, container, parentIndex, depth);
    
    // 子ノードがある場合は再帰的に表示
    const hierarchy = nodeHierarchy.find(hier => hier.parent === nodeIndex);
    if (hierarchy) {
        hierarchy.children.forEach(childIndex => {
            renderUnifiedCheckboxItemRecursive(childIndex, container, depth + 1, nodeIndex);
        });
    }
}

/**
 * チェックボックスアイテム要素を作成
 * @param {string} node - ノード名
 * @param {number} index - ノードのインデックス
 * @param {boolean} isChild - 子ノードかどうか
 * @param {HTMLElement} container - コンテナ要素
 * @param {number|null} parentIndex - 親ノードのインデックス
 * @param {number} depth - 階層の深さ
 */
function renderUnifiedCheckboxItem(node, index, isChild = false, container, parentIndex = null, depth = 0) {
    const hierarchy = nodeHierarchy.find(hier => hier.parent === index);
    const hasChildren = hierarchy && hierarchy.children.length > 0;
    
    const checkboxItem = document.createElement('div');
    checkboxItem.className = isChild ? 'checkbox-item child-checkbox' : 'checkbox-item';
    
    // 子ノードの場合、親の折りたたみ状態によって表示制御
    if (isChild && parentIndex !== null) {
        const parentElement = container.querySelector(`[data-checkbox-node-index="${parentIndex}"]`);
        if (parentElement && parentElement.dataset.collapsed === 'true') {
            checkboxItem.style.display = 'none';
        } else {
            checkboxItem.classList.add('expanded');
        }
    }
    
    let expandIconHtml = '';
    if (hasChildren && !isChild) {
        const isCollapsed = checkboxItem.dataset.collapsed === 'true';
        expandIconHtml = `<span class="expand-icon-checkbox ${isCollapsed ? '' : 'expanded'}" onclick="toggleChildCheckboxes(${index}, this)" style="margin-right: 8px; font-size: 12px; color: #059669; font-weight: bold; cursor: pointer; user-select: none;">▶</span>`;
    }
    
    const indentStyle = isChild ? `margin-left: ${depth * 20}px;` : '';
    const nodeNumber = getNodeDisplayNumber(index);
    
    checkboxItem.innerHTML = `
        ${expandIconHtml}
        <input type="checkbox" value="${index}" style="margin-right: 8px; margin-top: 2px; flex-shrink: 0;">
        <label style="font-weight: normal; font-size: 13px; line-height: 1.4; cursor: pointer; color: #374151; word-wrap: break-word; white-space: normal; overflow-wrap: break-word; hyphens: auto; flex: 1; min-width: 0; ${indentStyle}">${nodeNumber}. ${node}</label>
    `;
    
    checkboxItem.setAttribute('data-checkbox-node-index', index);
    
    // 親ノードの場合、クリックで子ノードを表示/非表示
    if (hasChildren && !isChild) {
        checkboxItem.addEventListener('click', function(e) {
            // チェックボックス、ラベル、展開アイコンがクリックされた場合は無視
            if (e.target !== checkbox && e.target !== label && !e.target.classList.contains('expand-icon-checkbox')) {
                const expandIcon = checkboxItem.querySelector('.expand-icon-checkbox');
                if (expandIcon) {
                    toggleChildCheckboxes(index, expandIcon);
                }
            }
        });
    }
    
    container.appendChild(checkboxItem);
}

/**
 * 子チェックボックスの表示/非表示を切り替え
 * @param {number} parentIndex - 親ノードのインデックス
 * @param {HTMLElement} expandIcon - 展開アイコン要素
 */
function toggleChildCheckboxes(parentIndex, expandIcon) {
    const parentElement = expandIcon.closest('.checkbox-item');
    const isCollapsed = expandIcon.classList.contains('expanded');
    
    if (isCollapsed) {
        // 折りたたみ
        expandIcon.classList.remove('expanded');
        parentElement.dataset.collapsed = 'true';
        hideCheckboxAndDescendants(parentElement);
    } else {
        // 展開
        expandIcon.classList.add('expanded');
        parentElement.dataset.collapsed = 'false';
        showCheckboxAndDescendants(parentElement);
    }
}

/**
 * チェックボックスとその子孫を非表示にする
 * @param {HTMLElement} checkboxElement - チェックボックス要素
 */
function hideCheckboxAndDescendants(checkboxElement) {
    const nodeIndex = parseInt(checkboxElement.dataset.checkboxNodeIndex);
    const hierarchy = nodeHierarchy.find(hier => hier.parent === nodeIndex);
    
    if (hierarchy) {
        hierarchy.children.forEach(childIndex => {
            const childElement = document.querySelector(`[data-checkbox-node-index="${childIndex}"]`);
            if (childElement) {
                childElement.style.display = 'none';
                childElement.classList.remove('expanded');
                // 再帰的に子の子も非表示にする
                hideCheckboxAndDescendants(childElement);
            }
        });
    }
}

/**
 * チェックボックスとその子孫を表示する
 * @param {HTMLElement} checkboxElement - チェックボックス要素
 */
function showCheckboxAndDescendants(checkboxElement) {
    const nodeIndex = parseInt(checkboxElement.dataset.checkboxNodeIndex);
    const hierarchy = nodeHierarchy.find(hier => hier.parent === nodeIndex);
    
    if (hierarchy) {
        hierarchy.children.forEach(childIndex => {
            const childElement = document.querySelector(`[data-checkbox-node-index="${childIndex}"]`);
            if (childElement) {
                childElement.style.display = 'flex';
                childElement.classList.add('expanded');
                
                // 子ノードが展開状態の場合、その子も表示
                const childExpandIcon = childElement.querySelector('.expand-icon-checkbox');
                if (childExpandIcon && childExpandIcon.classList.contains('expanded')) {
                    showCheckboxAndDescendants(childElement);
                }
            }
        });
    }
}

/**
 * 統合シングルセレクトを更新
 */
function renderUnifiedSingleSelect() {
    const singleSelect = document.getElementById('single-select');
    singleSelect.innerHTML = '<option value="">To を選択</option>';
    
    nodes.forEach((node, index) => {
        const option = document.createElement('option');
        option.value = index;
        const nodeNumber = getNodeDisplayNumber(index);
        option.textContent = `${nodeNumber}. ${node}`;
        singleSelect.appendChild(option);
    });
}

// ===== 階層関係管理 =====

/**
 * 階層関係を追加
 */
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
        alert('親ノードと子ノードの両方を選択してください');
        return;
    }
    
    const parent = parseInt(parentIndex);
    
    // 循環参照チェック
    if (selectedChildren.includes(parent)) {
        alert('親ノードを子ノードに指定することはできません');
        return;
    }
    
    // 既存の階層関係をチェック
    const existingHierarchy = nodeHierarchy.find(hier => hier.parent === parent);
    
    if (existingHierarchy) {
        // 既存の階層関係に子ノードを追加
        selectedChildren.forEach(child => {
            if (!existingHierarchy.children.includes(child)) {
                // 他の親から移動する場合は、元の親から削除
                nodeHierarchy.forEach(hier => {
                    if (hier.parent !== parent) {
                        hier.children = hier.children.filter(c => c !== child);
                    }
                });
                existingHierarchy.children.push(child);
            }
        });
    } else {
        // 新しい階層関係を作成
        selectedChildren.forEach(child => {
            // 他の親から移動する場合は、元の親から削除
            nodeHierarchy.forEach(hier => {
                hier.children = hier.children.filter(c => c !== child);
            });
        });
        
        nodeHierarchy.push({
            parent: parent,
            children: [...selectedChildren]
        });
    }
    
    // 空の階層関係を削除
    nodeHierarchy = nodeHierarchy.filter(hier => hier.children.length > 0);
    
    renderNodes();
    renderHierarchySelects();
    renderHierarchy();
    regenerateNodeNumbers();
    updateUILabels();
    generateMermaidCode();
    
    // LocalStorageに保存
    saveToLocalStorage();
    
    // フォームをリセット
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    singleSelect.value = '';
}

// ===== リレーション管理 =====

/**
 * リレーションを追加
 */
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
    
    const to = parseInt(toIndex);
    
    // 自己参照チェック
    if (selectedFroms.includes(to)) {
        alert('同じノード間のリレーションは作成できません');
        return;
    }
    
    // 重複チェックして新しいリレーションのみ追加
    selectedFroms.forEach(from => {
        const exists = relations.some(rel => rel.from === from && rel.to === to);
        if (!exists) {
            relations.push({ from: from, to: to });
        }
    });
    
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

/**
 * 階層関係を表示
 */
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
        const hierarchyItem = document.createElement('div');
        hierarchyItem.className = 'relation-item';
        
        const parentNodeNumber = getNodeDisplayNumber(hierarchy.parent);
        const parentNodeName = nodes[hierarchy.parent];
        
        const childrenText = hierarchy.children.map(childIndex => {
            const childNodeNumber = getNodeDisplayNumber(childIndex);
            const childNodeName = nodes[childIndex];
            return `${childNodeNumber}. ${childNodeName}`;
        }).join(', ');
        
        hierarchyItem.innerHTML = `
            <div style="word-wrap: break-word; overflow-wrap: break-word; min-width: 0; flex: 1;">
                <strong>親:</strong> ${parentNodeNumber}. ${parentNodeName}<br>
                <strong>子:</strong> ${childrenText}
            </div>
            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                ${hierarchy.children.map((childIndex, idx) => 
                    `<button onclick="deleteHierarchyChild(${hierarchyIndex}, ${childIndex})" 
                            style="background: #f59e0b; color: white; border: none; padding: 3px 6px; border-radius: 3px; font-size: 10px; cursor: pointer;" 
                            title="子ノードを削除">子削除</button>`
                ).join('')}
                <button onclick="deleteHierarchy(${hierarchyIndex})" 
                        style="background: #dc2626; color: white; border: none; padding: 3px 6px; border-radius: 3px; font-size: 10px; cursor: pointer;">全削除</button>
            </div>
        `;
        
        hierarchyList.appendChild(hierarchyItem);
    });
}

/**
 * 階層関係の子ノードを削除
 * @param {number} hierarchyIndex - 階層関係のインデックス
 * @param {number} childIndex - 子ノードのインデックス
 */
function deleteHierarchyChild(hierarchyIndex, childIndex) {
    const hierarchy = nodeHierarchy[hierarchyIndex];
    hierarchy.children = hierarchy.children.filter(child => child !== childIndex);
    
    // 子ノードがなくなった場合は階層関係全体を削除
    if (hierarchy.children.length === 0) {
        nodeHierarchy.splice(hierarchyIndex, 1);
    }
    
    renderNodes();
    renderHierarchySelects();
    renderHierarchy();
    regenerateNodeNumbers();
    updateUILabels();
    generateMermaidCode();
    
    // LocalStorageに保存
    saveToLocalStorage();
}

/**
 * 階層関係を削除
 * @param {number} hierarchyIndex - 階層関係のインデックス
 */
function deleteHierarchy(hierarchyIndex) {
    nodeHierarchy.splice(hierarchyIndex, 1);
    renderHierarchy();
    regenerateNodeNumbers();
    updateUILabels();
    generateMermaidCode();
    
    // LocalStorageに保存
    saveToLocalStorage();
}

/**
 * リレーション一覧を表示
 */
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
    
    Object.keys(groupedRelations).forEach(toNodeIndex => {
        const toNode = parseInt(toNodeIndex);
        const relationsToThisNode = groupedRelations[toNodeIndex];
        
        const relationItem = document.createElement('div');
        relationItem.className = 'relation-item';
        
        const fromNodesText = relationsToThisNode.map(rel => {
            const fromNodeNumber = getNodeDisplayNumber(rel.from);
            const fromNodeName = nodes[rel.from];
            return `${fromNodeNumber}. ${fromNodeName}`;
        }).join(', ');
        
        const toNodeNumber = getNodeDisplayNumber(toNode);
        const toNodeName = nodes[toNode];
        
        relationItem.innerHTML = `
            <div style="word-wrap: break-word; overflow-wrap: break-word; min-width: 0;">
                <strong>From:</strong> ${fromNodesText}<br>
                <strong>To:</strong> ${toNodeNumber}. ${toNodeName}
            </div>
            <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                ${relationsToThisNode.map(rel => 
                    `<button onclick="deleteRelation(${rel.originalIndex})" 
                            style="background: #dc2626; color: white; border: none; padding: 3px 6px; border-radius: 3px; font-size: 10px; cursor: pointer;" 
                            title="削除">削除</button>`
                ).join('')}
            </div>
        `;
        
        relationsList.appendChild(relationItem);
    });
}

/**
 * リレーションを削除
 * @param {number} index - リレーションのインデックス
 */
function deleteRelation(index) {
    relations.splice(index, 1);
    renderRelations();
    generateMermaidCode();
    
    // LocalStorageに保存
    saveToLocalStorage();
}

// ===== Mermaidコード生成 =====

/**
 * ノードIDを生成（Mermaid用）
 * @param {number} index - ノードのインデックス
 * @returns {string} ノードID
 */
function getNodeId(index) {
    return `node${index}`;
}

/**
 * ノードラベルをエスケープ
 * @param {string} label - ラベル
 * @returns {string} エスケープされたラベル
 */
function escapeLabel(label) {
    return label.replace(/"/g, '&quot;').replace(/\n/g, '<br>');
}

/**
 * Mermaidコードを生成
 */
function generateMermaidCode() {
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

// ===== ユーティリティ関数 =====

/**
 * UIラベルを更新（階層関係の有無に応じて）
 */
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

/**
 * ノード表示番号を取得
 * @param {number} nodeIndex - ノードのインデックス
 * @returns {number} 表示番号
 */
function getNodeDisplayNumber(nodeIndex) {
    // 階層関係がある場合は調整された番号、ない場合は通常のインデックス+1
    if (nodeHierarchy.length > 0) {
        return getAdjustedNodeNumber(nodeIndex);
    } else {
        return nodeIndex + 1;
    }
}

/**
 * 階層構造を考慮した調整済みノード番号を取得
 * @param {number} nodeIndex - ノードのインデックス
 * @returns {number} 調整済み番号
 */
function getAdjustedNodeNumber(nodeIndex) {
    // 階層関係がない場合は通常の番号を返す
    if (nodeHierarchy.length === 0) {
        return nodeIndex + 1;
    }
    
    // 子ノードかどうかをチェック
    const isChild = isChildNode(nodeIndex);
    
    if (isChild) {
        // 子ノードの場合は親ノードの番号を基準にする
        const parentHierarchy = nodeHierarchy.find(hier => hier.children.includes(nodeIndex));
        if (parentHierarchy) {
            const parentNumber = getAdjustedNodeNumber(parentHierarchy.parent);
            const childPosition = parentHierarchy.children.indexOf(nodeIndex) + 1;
            return parseFloat(`${parentNumber}.${childPosition}`);
        }
    }
    
    // 親ノードまたは独立ノードの場合
    // 親ノードと独立ノードのみを数える
    const parentAndStandaloneNodes = [];
    for (let i = 0; i < nodes.length; i++) {
        if (!isChildNode(i)) {
            parentAndStandaloneNodes.push(i);
        }
    }
    
    const position = parentAndStandaloneNodes.indexOf(nodeIndex);
    return position >= 0 ? position + 1 : nodeIndex + 1;
}

/**
 * ノードが子ノードかどうかを判定
 * @param {number} nodeIndex - ノードのインデックス
 * @returns {boolean} 子ノードの場合true
 */
function isChildNode(nodeIndex) {
    return nodeHierarchy.some(hier => hier.children.includes(nodeIndex));
}

/**
 * ノードが親ノードかどうかを判定
 * @param {number} nodeIndex - ノードのインデックス
 * @returns {boolean} 親ノードの場合true
 */
function isParentNode(nodeIndex) {
    return nodeHierarchy.some(hier => hier.parent === nodeIndex);
}

/**
 * 子ノードのリストを取得
 * @param {number} nodeIndex - 親ノードのインデックス
 * @returns {Array} 子ノードのインデックス配列
 */
function getChildNodes(nodeIndex) {
    const hierarchy = nodeHierarchy.find(hier => hier.parent === nodeIndex);
    return hierarchy ? hierarchy.children : [];
}

/**
 * ノード番号を再生成
 */
function regenerateNodeNumbers() {
    // 番号表示を更新
    renderNodes();
    renderUnifiedMultiCheckboxes();
    renderUnifiedSingleSelect();
    renderHierarchy();
    renderRelations();
    updateTaskNodeSelect();
    renderAllNodesTasks();
}