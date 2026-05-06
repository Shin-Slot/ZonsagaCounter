document.addEventListener('DOMContentLoaded', () => {
    // HTMLの要素を取得します
    const gInput = document.getElementById('gInput');
    const fallButton = document.getElementById('fallButton');
    const diagonalButton = document.getElementById('diagonalButton');
    const stButton = document.getElementById('stButton');
    const pendingStatus = document.getElementById('pendingStatus');
    const dataTableBody = document.getElementById('dataTableBody');
    const averageDisplay = document.getElementById('averageDisplay');
    const resetButton = document.getElementById('resetButton');
    const exportButton = document.getElementById('exportButton');
    const importButton = document.getElementById('importButton');
    const csvFileInput = document.getElementById('csvFileInput');

    // localStorageからデータを読み込む
    let savedData = JSON.parse(localStorage.getItem('zombiCountData')) || [];
    let pendingFallG = localStorage.getItem('pendingFallG') || null;

    // --- イベントリスナーの設定 ---

    // CSV出力
    exportButton.addEventListener('click', () => {
        if (savedData.length === 0) {
            alert('出力するデータがありません。');
            return;
        }

        let csvContent = "No.,転落G,斜めG,母数\n";
        savedData.forEach((data, index) => {
            csvContent += `${index + 1},${data.fallG},${data.diagonalG},${data.population}\n`;
        });

        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "zombi_count_data.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // CSV読込ボタン（ファイル選択ダイアログを開く）
    importButton.addEventListener('click', () => {
        csvFileInput.click();
    });

    // ファイルが選択された時の処理
    csvFileInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const lines = content.split('\n');
            const newData = [];

            // 1行目はヘッダーなので2行目から処理
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line === '') continue;

                const columns = line.split(',');
                if (columns.length >= 4) {
                    const fallG = parseInt(columns[1], 10);
                    const diagonalG = parseInt(columns[2], 10);
                    const population = parseInt(columns[3], 10);

                    if (!isNaN(fallG) && !isNaN(diagonalG) && !isNaN(population)) {
                        newData.push({
                            fallG: fallG,
                            diagonalG: diagonalG,
                            population: population,
                            probability: 1 / population,
                            isST: false
                        });
                    }
                }
            }

            if (newData.length > 0) {
                if (confirm(`${newData.length}件のデータを読み込みますか？（既存のデータに追加されます）`)) {
                    savedData = savedData.concat(newData);
                    updateDisplayAndSave();
                    alert('読み込みが完了しました。');
                }
            } else {
                alert('有効なデータが見つかりませんでした。CSVの形式を確認してください。');
            }
            csvFileInput.value = ''; // 選択をリセット
        };
        reader.readAsText(file);
    });

    // ST当選ボタン
    stButton.addEventListener('click', () => {
        if (savedData.length === 0) {
            alert('データがありません。');
            return;
        }
        if (confirm('ST当選を記録しますか？直前のデータに印を付けます。')) {
            savedData[savedData.length - 1].isST = true;
            updateDisplayAndSave();
        }
    });

    // 転落Gを記録ボタン
    fallButton.addEventListener('click', () => {
        const value = parseInt(gInput.value, 10);
        if (isNaN(value)) {
            alert('有効な数値を入力してください。');
            return;
        }
        pendingFallG = value;
        localStorage.setItem('pendingFallG', pendingFallG);
        updateInputUI();
        gInput.value = '';
        gInput.focus();
    });

    // 斜めGを記録(保存)ボタン
    diagonalButton.addEventListener('click', () => {
        const diagonalG = parseInt(gInput.value, 10);
        const fallG = parseInt(pendingFallG, 10);

        if (isNaN(diagonalG)) {
            alert('斜めGを入力してください。');
            return;
        }

        const populationValue = diagonalG - fallG;

        if (populationValue <= 0) {
            alert('斜めGは転落G (' + fallG + ') より大きい値である必要があります。');
            return;
        }

        // 新しいデータを配列に追加
        savedData.push({
            fallG: fallG,
            diagonalG: diagonalG,
            population: populationValue,
            probability: 1 / populationValue,
            isST: false
        });

        // 状態をクリア
        pendingFallG = null;
        localStorage.removeItem('pendingFallG');
        
        updateDisplayAndSave();
        updateInputUI();
        gInput.value = '';
        gInput.focus();
    });

    // 入力UIの状態（メッセージとボタンの有効無効）を更新
    function updateInputUI() {
        if (pendingFallG !== null) {
            pendingStatus.textContent = `転落G: ${pendingFallG} を記録中...`;
            pendingStatus.style.backgroundColor = '#fff3cd'; // warning color light
            pendingStatus.style.color = '#856404';
            diagonalButton.disabled = false;
        } else {
            pendingStatus.textContent = '転落Gの入力を待機中...';
            pendingStatus.style.backgroundColor = '#e9ecef'; // light gray
            pendingStatus.style.color = '#495057';
            diagonalButton.disabled = true;
        }
    }

    // リセットボタン
    resetButton.addEventListener('click', () => {
        if (confirm('本当にすべてのデータをリセットしますか？')) {
            savedData = [];
            pendingFallG = null;
            localStorage.removeItem('pendingFallG');
            updateDisplayAndSave();
            updateInputUI();
            alert('データをリセットしました。');
        }
    });

    // 表の中のボタン（編集・削除）
    dataTableBody.addEventListener('click', (event) => {
        const target = event.target;
        const index = target.dataset.index;

        if (target.classList.contains('edit-btn')) {
            editData(index);
        } else if (target.classList.contains('delete-btn')) {
            deleteData(index);
        }
    });

    // --- データ操作関数 ---

    // 編集
    function editData(index) {
        const currentData = savedData[index];
        const newFallGStr = prompt('新しい転落Gの値を入力してください:', currentData.fallG);
        if (newFallGStr === null) return;

        const newDiagonalGStr = prompt('新しい斜めGの値を入力してください:', currentData.diagonalG);
        if (newDiagonalGStr === null) return;

        const newFallG = parseInt(newFallGStr, 10);
        const newDiagonalG = parseInt(newDiagonalGStr, 10);

        if (isNaN(newFallG) || isNaN(newDiagonalG) || (newDiagonalG - newFallG) <= 0) {
            alert('有効な数値を入力してください（斜めG > 転落G）。');
            return;
        }

        const newPopulation = newDiagonalG - newFallG;
        savedData[index] = {
            ...currentData,
            fallG: newFallG,
            diagonalG: newDiagonalG,
            population: newPopulation,
            probability: 1 / newPopulation
        };
        updateDisplayAndSave();
    }

    // 削除
    function deleteData(index) {
        if (confirm(`No.${parseInt(index) + 1} のデータを削除しますか？`)) {
            savedData.splice(index, 1);
            updateDisplayAndSave();
        }
    }

    // --- 表示更新と保存 ---

    function updateDisplayAndSave() {
        // 表をクリア
        dataTableBody.innerHTML = '';

        // データから表の行を再作成
        savedData.forEach((data, index) => {
            const row = dataTableBody.insertRow();
            if (data.isST) {
                row.classList.add('st-row');
            }
            row.innerHTML = `
                <td>${index + 1}</td>
                <td>${data.fallG}</td>
                <td>${data.diagonalG}</td>
                <td>${data.population}</td>
                <td>1/${data.population}</td>
                <td>
                    <button class="action-btn edit-btn" data-index="${index}">編集</button>
                    <button class="action-btn delete-btn" data-index="${index}">削除</button>
                </td>
            `;
        });

        calculateAndShowAverage();
        localStorage.setItem('zombiCountData', JSON.stringify(savedData));
    }

    function calculateAndShowAverage() {
        if (savedData.length === 0) {
            averageDisplay.textContent = 'まだデータがありません';
            return;
        }
        // 母数の合計を計算
        const totalPopulation = savedData.reduce((sum, data) => sum + data.population, 0);
        // 母数の平均を計算
        const averagePopulation = totalPopulation / savedData.length;

        // 平均母数を小数点第一位まで表示
        const averageDenominator = averagePopulation.toFixed(1);
        averageDisplay.textContent = `期待値(母数平均)からの確率: 1/${averageDenominator}`;
    }

    // --- 初期化 ---
    updateDisplayAndSave();
    updateInputUI();
});
