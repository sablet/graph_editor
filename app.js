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
let nodes = [...initialNodes];
let relations = [];
let nodeHierarchy = []; // 親子関係を保存 {children: [childIndex1, childIndex2], parent: parentIndex}
let currentZoom = 1;
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let fullscreenZoom = 1;
let isFullscreenDragging = false;
let fullscreenLastMousePos = { x: 0, y: 0 };

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
        
        let resultMessage = `${validNodes.length}個のノードを追加しました。`;
        if (duplicates.length > 0) {
            resultMessage += `\n\n${duplicates.length}個のノードは重複のため追加されませんでした。`;
        }
        alert(resultMessage);
    }
}

// ノード削除
function deleteNode(index) {
    if (confirm(`ノード「${nodes[index]}」を削除しますか？関連するリレーションと階層関係も削除されます。`)) {
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
        
        // ノードを削除
        nodes.splice(index, 1);
        
        renderNodes();
        renderSelects();
        renderHierarchySelects();
        renderRelations();
        renderHierarchy();
        generateMermaidCode();
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
    nodeText.textContent = `${getNodeDisplayNumber(index)}. ${node}`;
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
    const nodeIndex = parseInt(deleteButton.onclick.toString().match(/deleteNode\((\d+)\)/)?.[1]);
    
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
}

// 階層関係を削除
function deleteHierarchy(hierarchyIndex) {
    nodeHierarchy.splice(hierarchyIndex, 1);
    renderHierarchy();
    regenerateNodeNumbers();
    updateUILabels();
    generateMermaidCode();
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