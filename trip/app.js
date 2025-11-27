// グローバル変数
let currentTeam = null;
let selectedFiles = [];
let allReports = [];
let autoRefreshTimer = null;
let lastReportCount = 0;
let lastUpdateTime = null;

// 初期化
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

// トークンをLocalStorageから取得または初回入力
function decodeToken() {
    // LocalStorageからトークンを取得
    const savedToken = localStorage.getItem('github_token');
    
    if (savedToken) {
        CONFIG.github.token = savedToken;
        console.log('✅ GitHubトークン読み込み成功');
    } else if (CONFIG.github.enabled) {
        // トークン設定モーダルを表示
        showTokenModal();
    }
}

// トークン設定モーダルを表示
function showTokenModal() {
    const modal = document.getElementById('tokenModal');
    modal.classList.add('active');
    
    let html5QrCode = null;
    
    // QRスキャン開始
    document.getElementById('startQRScan').onclick = async function() {
        const qrReader = document.getElementById('qrReader');
        qrReader.style.display = 'block';
        this.disabled = true;
        this.textContent = 'スキャン中...';
        
        html5QrCode = new Html5Qrcode("qrReader");
        
        try {
            await html5QrCode.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                onScanSuccess,
                () => {} // エラーは無視
            );
        } catch (err) {
            showTokenStatus('カメラの起動に失敗しました', 'error');
            qrReader.style.display = 'none';
            this.disabled = false;
            this.textContent = '📷 カメラでスキャン';
        }
    };
    
    // QRコード画像アップロード
    document.getElementById('uploadQRImage').onclick = function() {
        document.getElementById('qrImageInput').click();
    };
    
    document.getElementById('qrImageInput').onchange = async function(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        showTokenStatus('QRコードを解析中...', 'success');
        
        try {
            const html5QrCodeScanner = new Html5Qrcode("qrReader");
            const result = await html5QrCodeScanner.scanFile(file, true);
            
            if (result && result.startsWith('ghp_')) {
                CONFIG.github.token = result;
                localStorage.setItem('github_token', result);
                showTokenStatus('✅ トークンを保存しました!', 'success');
                setTimeout(() => {
                    modal.classList.remove('active');
                }, 1500);
            } else {
                showTokenStatus('⚠️ 無効なトークンです', 'error');
            }
        } catch (err) {
            showTokenStatus('❌ QRコードの読み取りに失敗しました', 'error');
            console.error(err);
        }
        
        // ファイル入力をリセット
        e.target.value = '';
    };
    
    // スキャン成功
    function onScanSuccess(decodedText) {
        if (decodedText.startsWith('ghp_')) {
            CONFIG.github.token = decodedText;
            localStorage.setItem('github_token', decodedText);
            
            if (html5QrCode) {
                html5QrCode.stop();
            }
            
            showTokenStatus('✅ トークンを保存しました!', 'success');
            setTimeout(() => {
                modal.classList.remove('active');
            }, 1500);
        } else {
            showTokenStatus('⚠️ 無効なトークンです', 'error');
        }
    }
    
    // スキップボタン
    document.getElementById('skipToken').onclick = function() {
        CONFIG.github.enabled = false;
        modal.classList.remove('active');
        if (html5QrCode) {
            html5QrCode.stop();
        }
    };
}

// トークンステータス表示
function showTokenStatus(message, type) {
    const status = document.getElementById('tokenStatus');
    status.textContent = message;
    status.className = type;
}

function initializeApp() {
    // トークンをデコード
    decodeToken();
    
    renderTeamGrid();
    setupFileInput();
    
    // 記憶されているチームがあれば自動選択
    const savedTeamId = localStorage.getItem('selectedTeamId');
    if (savedTeamId) {
        const team = CONFIG.teams.find(t => t.id === parseInt(savedTeamId));
        if (team) {
            selectTeam(team);
        }
    }
    
    // 自動リフレッシュ開始(30秒ごと)
    startAutoRefresh();
}

// 自動リフレッシュを開始
function startAutoRefresh() {
    // 既存のタイマーをクリア
    if (autoRefreshTimer) {
        clearInterval(autoRefreshTimer);
    }
    
    // 30秒ごとに自動更新
    autoRefreshTimer = setInterval(async () => {
        console.log('🔄 自動リフレッシュ実行中...');
        await refreshData(false); // 通知なしで更新
    }, 30000); // 30秒
    
    console.log('✅ 自動リフレッシュ開始 (30秒ごと)');
}

// データを手動でリフレッシュ
async function manualRefresh() {
    console.log('🔄 手動リフレッシュ実行中...');
    showRefreshStatus('更新中...', 'loading');
    await refreshData(true); // 通知ありで更新
}

// データをリフレッシュ(共通処理)
async function refreshData(showNotification = false) {
    try {
        const beforeCount = lastReportCount;
        
        // 現在のページに応じて更新
        const currentPage = document.querySelector('.section.active');
        if (currentPage && currentPage.id === 'uploadPage' && currentTeam) {
            // チーム履歴を再読み込み
            await loadTeamHistory();
            
            // 進捗を更新
            const reports = await getTeamReports(currentTeam.id);
            document.getElementById('progressCount').textContent = reports.length;
            
            lastReportCount = reports.length;
        } else if (currentPage && currentPage.id === 'teamSelect') {
            // チーム選択画面を再読み込み
            await renderTeamGrid();
        }
        
        lastUpdateTime = new Date();
        
        // 新しい報告があれば通知
        if (showNotification && lastReportCount > beforeCount) {
            const newCount = lastReportCount - beforeCount;
            showRefreshStatus(`✨ 新しい報告が${newCount}件あります!`, 'success');
        } else if (showNotification) {
            showRefreshStatus('✅ 最新データを取得しました', 'success');
        }
        
        updateLastUpdateTime();
        
    } catch (error) {
        console.error('❌ リフレッシュエラー:', error);
        if (showNotification) {
            showRefreshStatus('⚠️ 更新に失敗しました', 'error');
        }
    }
}

// リフレッシュステータス表示
function showRefreshStatus(message, type) {
    // トースト通知を表示
    const toast = document.createElement('div');
    toast.className = `refresh-toast ${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'success' ? '#52c41a' : type === 'error' ? '#f5222d' : '#1890ff'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        font-weight: 500;
        animation: slideIn 0.3s ease-out;
    `;
    
    document.body.appendChild(toast);
    
    // 3秒後に削除
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// 最終更新時刻を表示
function updateLastUpdateTime() {
    const timeElement = document.getElementById('lastUpdateTime');
    if (timeElement && lastUpdateTime) {
        const timeStr = lastUpdateTime.toLocaleTimeString('ja-JP');
        timeElement.textContent = `最終更新: ${timeStr}`;
    }
}

// チーム選択画面のレンダリング
async function renderTeamGrid() {
    // ロックイン済みの場合はチーム選択をスキップ
    const lockedTeamId = localStorage.getItem('lockedTeamId');
    if (lockedTeamId) {
        const team = CONFIG.teams.find(t => t.id === parseInt(lockedTeamId));
        if (team) {
            await selectTeam(team);
            return;
        }
    }
    
    const teamGrid = document.getElementById('teamGrid');
    teamGrid.innerHTML = '<p style="text-align: center; color: #999;">読み込み中...</p>';
    
    const allReports = await getAllReports();
    
    teamGrid.innerHTML = '';
    
    CONFIG.teams.forEach(team => {
        const teamCard = document.createElement('div');
        teamCard.className = 'team-card';
        teamCard.onclick = () => showTeamPasswordModal(team);
        
        const reports = allReports.filter(r => r.teamId === team.id);
        const isCompleted = reports.length >= CONFIG.requiredReports;
        
        teamCard.innerHTML = `
            <div class="team-logo">
                <img src="${team.logo}" alt="${team.name}">
            </div>
            <div class="team-name">${team.name}</div>
            <div class="team-status ${isCompleted ? 'completed' : 'pending'}">
                ${isCompleted ? '✓ 達成済み' : `${reports.length}/${CONFIG.requiredReports} 報告`}
            </div>
        `;
        
        teamGrid.appendChild(teamCard);
    });
}

// チームパスワードモーダルを表示
function showTeamPasswordModal(team) {
    const modal = document.getElementById('teamPasswordModal');
    document.getElementById('teamPasswordLogo').src = team.logo;
    document.getElementById('teamPasswordName').textContent = team.name;
    document.getElementById('teamPasswordInput').value = '';
    document.getElementById('passwordError').style.display = 'none';
    
    modal.classList.add('active');
    
    // Enterキーで送信
    const passwordInput = document.getElementById('teamPasswordInput');
    passwordInput.onkeypress = function(e) {
        if (e.key === 'Enter') {
            verifyTeamPassword(team);
        }
    };
    
    // 認証ボタン
    document.getElementById('submitTeamPassword').onclick = () => verifyTeamPassword(team);
    
    // キャンセルボタン
    document.getElementById('cancelTeamPassword').onclick = () => {
        modal.classList.remove('active');
    };
    
    // フォーカス
    setTimeout(() => passwordInput.focus(), 100);
}

// チームパスワードを検証
function verifyTeamPassword(team) {
    const input = document.getElementById('teamPasswordInput').value;
    const errorDiv = document.getElementById('passwordError');
    
    if (input === team.password) {
        // 認証成功
        localStorage.setItem('lockedTeamId', team.id);
        document.getElementById('teamPasswordModal').classList.remove('active');
        selectTeam(team);
    } else {
        // 認証失敗
        errorDiv.textContent = '⚠️ パスワードが違います';
        errorDiv.style.display = 'block';
        document.getElementById('teamPasswordInput').value = '';
        document.getElementById('teamPasswordInput').focus();
    }
}

// チーム選択
async function selectTeam(team) {
    currentTeam = team;
    
    // チーム選択を記憶
    localStorage.setItem('selectedTeamId', team.id);
    
    document.getElementById('currentTeamName').innerHTML = `
        <img src="${team.logo}" alt="${team.name}" class="team-logo-small">
        ${team.name}
    `;
    
    const reports = await getTeamReports(team.id);
    
    // 達成済みミッションを取得
    const completedMissions = new Set();
    reports.forEach(report => {
        if (report.missions && Array.isArray(report.missions)) {
            report.missions.forEach(m => {
                completedMissions.add(m.index);
            });
        }
    });
    
    // ミッションリストを表示（達成済みは緑色表示）
    const missionList = document.getElementById('missionDescription');
    missionList.innerHTML = team.missions.map((mission, index) => {
        const isCompleted = completedMissions.has(index);
        return `
            <div class="mission-item ${isCompleted ? 'completed' : ''}" onclick="toggleMission(event, ${index})">
                <input type="checkbox" id="mission-${index}" class="mission-checkbox" onclick="event.stopPropagation()">
                <span class="mission-number ${isCompleted ? 'completed' : ''}">${index + 1}</span>
                <span class="mission-text">${mission}</span>
            </div>
        `;
    }).join('');
    
    document.getElementById('progressCount').textContent = reports.length;
    document.getElementById('progressTotal').textContent = CONFIG.requiredReports;
    
    // 達成済みミッション一覧を更新
    updateCompletedMissions(reports, team);
    
    showPage('uploadPage');
    loadTeamHistory();
}

// 達成済みミッション一覧を更新
function updateCompletedMissions(reports, team) {
    const completedMissions = new Set();
    
    reports.forEach(report => {
        if (report.missions && Array.isArray(report.missions)) {
            report.missions.forEach(m => {
                completedMissions.add(m.index);
            });
        }
    });
    
    const completedList = document.getElementById('completedMissionsList');
    
    if (completedMissions.size === 0) {
        completedList.innerHTML = '<p style="text-align: center; color: #999;">まだ達成したミッションがありません</p>';
        return;
    }
    
    const missionList = team.missions.map((mission, index) => {
        const isCompleted = completedMissions.has(index);
        if (!isCompleted) return '';
        
        return `
            <div style="display: flex; align-items: center; gap: 5px; padding: 5px 0; border-bottom: 1px solid #e0e0e0;">
                <span style="font-size: 1.1em;">✅</span>
                <span style="font-size: 0.9em; color: #52c41a; flex: 1;">
                    ${index + 1}. ${mission}
                </span>
            </div>
        `;
    }).filter(item => item).join('');
    
    completedList.innerHTML = missionList || '<p style="text-align: center; color: #999;">まだ達成したミッションがありません</p>';
}

// ミッションの選択トグル
function toggleMission(event, index) {
    // チェックボックス自体のクリックの場合は何もしない
    if (event.target.type === 'checkbox') {
        updateSubmitButton();
        return;
    }
    
    const checkbox = document.getElementById(`mission-${index}`);
    checkbox.checked = !checkbox.checked;
    updateSubmitButton();
}

// ファイル入力のセットアップ
function setupFileInput() {
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', handleFileSelect);
}

// ファイル選択ハンドラ
function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    
    files.forEach(file => {
        if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
            // 動画のサイズチェック
            if (file.type.startsWith('video/')) {
                const maxSize = 10 * 1024 * 1024; // 10MB
                if (file.size > maxSize) {
                    alert(`${file.name} は大きすぎます。\n動画は10MB以下にしてください。`);
                    return;
                }
            }
            
            selectedFiles.push(file);
            addPreview(file);
        }
    });
    
    updateSubmitButton();
}

// プレビュー追加
function addPreview(file) {
    const previewArea = document.getElementById('previewArea');
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        
        if (file.type.startsWith('video/')) {
            previewItem.innerHTML = `
                <video src="${e.target.result}" controls></video>
                <div class="video-badge">🎥 動画</div>
                <button class="remove-btn" onclick="removePreview(this, '${file.name}')">×</button>
            `;
        } else {
            previewItem.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button class="remove-btn" onclick="removePreview(this, '${file.name}')">×</button>
            `;
        }
        
        previewArea.appendChild(previewItem);
    };
    
    reader.readAsDataURL(file);
}

// プレビュー削除
function removePreview(button, fileName) {
    selectedFiles = selectedFiles.filter(f => f.name !== fileName);
    button.parentElement.remove();
    updateSubmitButton();
}

// 送信ボタンの状態更新
function updateSubmitButton() {
    const submitBtn = document.getElementById('submitBtn');
    const hasFiles = selectedFiles.length > 0;
    const hasSelectedMission = document.querySelectorAll('.mission-checkbox:checked').length > 0;
    submitBtn.disabled = !(hasFiles && hasSelectedMission);
}

// 達成報告送信
async function submitReport() {
    if (selectedFiles.length === 0) {
        alert('写真または動画を選択してください');
        return;
    }
    
    // 選択されたミッションを取得
    const selectedMissions = [];
    document.querySelectorAll('.mission-checkbox:checked').forEach(checkbox => {
        const index = parseInt(checkbox.id.replace('mission-', ''));
        selectedMissions.push({
            index: index,
            text: currentTeam.missions[index]
        });
    });
    
    if (selectedMissions.length === 0) {
        alert('達成したミッションを選択してください');
        return;
    }
    
    const comment = document.getElementById('commentInput').value;
    
    showLoading(true);
    
    try {
        // 画像をBase64に変換
        const imageDataArray = await Promise.all(
            selectedFiles.map(file => fileToBase64(file))
        );
        
        const report = {
            teamId: currentTeam.id,
            teamName: currentTeam.name,
            timestamp: new Date().toISOString(),
            images: imageDataArray,
            comment: comment,
            missions: selectedMissions
        };
        
        // LocalStorageに保存
        await saveReport(report);
        
        // GitHub Issuesにも保存(オプション)
        if (CONFIG.github.enabled) {
            await saveToGitHub(report);
        }
        
        // リセット
        selectedFiles = [];
        document.getElementById('previewArea').innerHTML = '';
        document.getElementById('commentInput').value = '';
        document.getElementById('fileInput').value = '';
        document.querySelectorAll('.mission-checkbox').forEach(cb => cb.checked = false);
        updateSubmitButton();
        
        // 履歴を再読み込み
        loadTeamHistory();
        renderTeamGrid();
        
        alert('報告を送信しました! 🎉');
        
    } catch (error) {
        console.error('送信エラー:', error);
        alert('送信に失敗しました。もう一度お試しください。');
    } finally {
        showLoading(false);
    }
}

// ファイルをBase64に変換
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        // 動画の場合
        if (file.type.startsWith('video/')) {
            // 動画サイズをチェック (10MB制限)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                reject(new Error('動画ファイルが大きすぎます。10MB以下の動画を選択してください。'));
                return;
            }
            
            reader.onload = () => {
                resolve({
                    data: reader.result,
                    name: file.name,
                    isVideo: true
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
            return;
        }
        
        // 画像の場合は圧縮
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // 最大サイズを設定
                const maxSize = 800;
                let width = img.width;
                let height = img.height;
                
                if (width > height && width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                } else if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                
                resolve({
                    data: canvas.toDataURL('image/jpeg', 0.7),
                    name: file.name,
                    isVideo: false
                });
            };
            img.src = reader.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// レポート保存(LocalStorage)
async function saveReport(report) {
    try {
        const localData = localStorage.getItem('missionReports');
        let reports = [];
        
        if (localData) {
            try {
                reports = JSON.parse(localData);
                // 配列でない場合は空配列に初期化
                if (!Array.isArray(reports)) {
                    console.warn('⚠️ LocalStorageのデータが配列ではありません。初期化します。');
                    reports = [];
                }
            } catch (parseError) {
                console.error('❌ LocalStorageのJSON解析エラー:', parseError);
                console.warn('⚠️ LocalStorageを初期化します。');
                reports = [];
            }
        }
        
        reports.push(report);
        localStorage.setItem('missionReports', JSON.stringify(reports));
        console.log('✅ レポート保存完了:', reports.length, '件');
    } catch (error) {
        console.error('❌ レポート保存エラー:', error);
        throw error;
    }
}

// 全レポート取得(LocalStorage + GitHub Issues)
async function getAllReports() {
    // ロックイン済みチームを取得
    const lockedTeamId = localStorage.getItem('lockedTeamId');
    
    // LocalStorageのデータ
    const localData = localStorage.getItem('missionReports');
    let localReports = localData ? JSON.parse(localData) : [];
    
    // ロックイン済みの場合は自チームのみ
    if (lockedTeamId) {
        localReports = localReports.filter(r => r.teamId === parseInt(lockedTeamId));
    }
    
    console.log('📦 LocalStorageレポート数:', localReports.length, lockedTeamId ? `(チーム${lockedTeamId}のみ)` : '');
    
    // GitHub Issuesからも取得
    if (CONFIG.github.enabled && CONFIG.github.token) {
        console.log('🔄 GitHub Issuesから取得開始...');
        try {
            const githubReports = await fetchGitHubReports(lockedTeamId);
            console.log('📡 GitHub Issuesレポート数:', githubReports.length);
            
            // 重複を除去してマージ
            const allReports = [...localReports];
            let addedCount = 0;
            githubReports.forEach(ghReport => {
                // timestampで重複チェック
                if (!allReports.find(r => r.timestamp === ghReport.timestamp)) {
                    allReports.push(ghReport);
                    addedCount++;
                }
            });
            
            console.log('✅ 統合完了 - ローカル:', localReports.length, ', GitHub:', githubReports.length, ', 追加:', addedCount, ', 合計:', allReports.length);
            
            return allReports.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        } catch (error) {
            console.error('❌ GitHub Issuesの取得エラー:', error);
            return localReports;
        }
    } else {
        console.log('⚠️ GitHub連携が無効です');
    }
    
    return localReports;
}

// GitHub Issuesから報告を取得
async function fetchGitHubReports(filterTeamId = null) {
    // チームフィルタ用のラベル
    let labelsParam = 'mission-report';
    if (filterTeamId) {
        labelsParam += `,team-${filterTeamId}`;
    }
    
    const url = `https://api.github.com/repos/${CONFIG.github.repo}/issues?labels=${labelsParam}&state=all&per_page=100`;
    console.log('🌐 GitHub API呼び出し:', url);
    
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `token ${CONFIG.github.token}`
        }
    });
    
    if (!response.ok) {
        console.error('❌ GitHub APIエラー - ステータス:', response.status);
        const errorText = await response.text();
        console.error('エラー詳細:', errorText);
        throw new Error(`GitHub API error: ${response.status}`);
    }
    
    const issues = await response.json();
    console.log('📝 取得したIssue数:', issues.length);
    
    const reports = [];
    
    for (const issue of issues) {
        try {
            console.log('🔍 Issue解析中:', issue.title);
            
            // Issueのタイトルからチーム名を抽出
            const teamMatch = issue.title.match(/【(.+?)】/);
            if (!teamMatch) {
                console.warn('⚠️ チーム名が見つかりません:', issue.title);
                continue;
            }
            
            const teamName = teamMatch[1];
            const team = CONFIG.teams.find(t => t.name === teamName);
            if (!team) {
                console.warn('⚠️ 該当チームが存在しません:', teamName);
                continue;
            }
            
            // Issue本文からデータを抽出
            const report = parseIssueBody(issue, team);
            if (report) {
                console.log('✅ レポート解析成功:', teamName, new Date(report.timestamp).toLocaleString());
                reports.push(report);
            } else {
                console.warn('⚠️ レポート解析失敗:', issue.title);
            }
        } catch (error) {
            console.error('❌ Issue解析エラー:', issue.title, error);
        }
    }
    
    console.log('📊 解析完了 - 有効なレポート数:', reports.length);
    return reports;
}

// Issue本文をパースして報告データに変換
function parseIssueBody(issue, team) {
    try {
        const body = issue.body;
        
        // 日時を抽出
        const dateMatch = body.match(/\*\*日時:\*\* (.+)/);
        const timestamp = dateMatch ? new Date(dateMatch[1]).toISOString() : issue.created_at;
        
        // コメントを抽出
        const commentMatch = body.match(/\*\*コメント:\*\* (.+)/);
        const comment = commentMatch ? commentMatch[1] : '';
        
        // ミッションを抽出
        const missionsSection = body.match(/\*\*達成したミッション:\*\*\n([\s\S]+?)\n\n/);
        const missions = [];
        if (missionsSection) {
            const missionLines = missionsSection[1].split('\n');
            missionLines.forEach(line => {
                const match = line.match(/- (\d+)\. (.+)/);
                if (match) {
                    missions.push({
                        index: parseInt(match[1]) - 1,
                        text: match[2]
                    });
                }
            });
        }
        
        // 画像を抽出
        const images = [];
        const imageMatches = body.matchAll(/!\[.+?\]\((data:image[^)]+)\)/g);
        for (const match of imageMatches) {
            images.push({
                data: match[1],
                name: 'image.jpg',
                isVideo: false
            });
        }
        
        return {
            teamId: team.id,
            teamName: team.name,
            timestamp: timestamp,
            images: images.length > 0 ? images : [{ data: '', name: '', isVideo: false }],
            comment: comment,
            missions: missions,
            fromGitHub: true  // GitHub由来のフラグ
        };
    } catch (error) {
        console.error('Issue解析エラー:', error);
        return null;
    }
}

// チーム別レポート取得
async function getTeamReports(teamId) {
    const allReports = await getAllReports();
    return allReports.filter(r => r.teamId === teamId);
}

// チーム履歴読み込み
async function loadTeamHistory() {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = '<p style="text-align: center; color: #999;">読み込み中...</p>';
    
    console.log('📂 チーム履歴読み込み開始:', currentTeam.name);
    const reports = await getTeamReports(currentTeam.id);
    console.log('📊 このチームのレポート数:', reports.length);
    
    // 達成済みミッション一覧も更新
    updateCompletedMissions(reports, currentTeam);
    
    if (reports.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; color: #999;">まだ報告がありません</p>';
        return;
    }
    
    historyList.innerHTML = reports.reverse().map((report, index) => `
        <div class="report-item">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div class="report-time">
                    ${new Date(report.timestamp).toLocaleString('ja-JP')}
                    ${report.fromGitHub ? '<span style="color: #28a745; font-size: 0.8em;"> 📡 GitHub</span>' : ''}
                </div>
            </div>
            ${report.missions ? `
                <div class="report-missions">
                    <strong>達成ミッション:</strong>
                    ${report.missions.map(m => `<span class="mission-badge">${m.index + 1}. ${m.text}</span>`).join('')}
                </div>
            ` : ''}
            <div class="report-images">
                ${report.images.filter(img => img.data).map(img => {
                    if (img.isVideo) {
                        return `<video src="${img.data}" onclick="openVideo('${img.data}'); event.stopPropagation();"></video>`;
                    } else {
                        return `<img src="${img.data}" alt="${img.name}" onclick="openImage('${img.data}'); event.stopPropagation();">`;
                    }
                }).join('')}
            </div>
            ${report.comment && report.comment !== 'なし' ? `<div class="report-comment">"${report.comment}"</div>` : ''}
        </div>
    `).join('');
}

// レポート削除機能は削除されました（重複ミッションも正しく扱えるため不要）

// 画像を拡大表示
function openImage(dataUrl) {
    const modal = document.getElementById('mediaModal');
    const modalImg = document.getElementById('modalImage');
    const modalVideo = document.getElementById('modalVideo');
    
    modalImg.src = dataUrl;
    modalImg.style.display = 'block';
    modalVideo.style.display = 'none';
    modal.style.display = 'flex';
}

// 動画を再生
function openVideo(dataUrl) {
    const modal = document.getElementById('mediaModal');
    const modalImg = document.getElementById('modalImage');
    const modalVideo = document.getElementById('modalVideo');
    
    modalVideo.src = dataUrl;
    modalVideo.style.display = 'block';
    modalImg.style.display = 'none';
    modal.style.display = 'flex';
}

// モーダルを閉じる
function closeModal() {
    const modal = document.getElementById('mediaModal');
    const modalVideo = document.getElementById('modalVideo');
    
    modal.style.display = 'none';
    modalVideo.pause();
    modalVideo.src = '';
}

// GitHub Actionsを使ってIssueを作成
async function saveToGitHub(report) {
    if (!CONFIG.github.enabled || !CONFIG.github.token) {
        console.log('GitHub連携が無効です');
        return;
    }
    
    // ミッション情報を整形
    const missionsText = report.missions 
        ? report.missions.map(m => `- ${m.index + 1}. ${m.text}`).join('\\n')
        : 'なし';
    
    // 画像を本文に埋め込む(Base64形式)
    const imagesText = report.images.map((img, index) => {
        if (img.isVideo) {
            return `### 動画 ${index + 1}: ${img.name}\\n\\n⚠️ 動画は容量が大きいためGitHub Issuesには含まれていません。LocalStorageで確認してください。\\n`;
        } else {
            return `### 画像 ${index + 1}: ${img.name}\\n\\n![${img.name}](${img.data})\\n`;
        }
    }).join('\\n');
    
    const title = `【${report.teamName}】${new Date(report.timestamp).toLocaleDateString('ja-JP')} ミッション報告`;
    const body = `## ${report.teamName} - ミッション達成報告

**日時:** ${new Date(report.timestamp).toLocaleString('ja-JP')}

**達成したミッション:**
${missionsText}

**コメント:** ${report.comment || 'なし'}

---

## 📸 アップロード画像・動画

${imagesText}

---
*このレポートは社員旅行ミッション管理システムから自動投稿されました*`;

    const labels = `mission-report,team-${report.teamId}`;
    
    try {
        // GitHub Actions workflow_dispatch を呼び出す
        const response = await fetch(
            `https://api.github.com/repos/${CONFIG.github.repo}/actions/workflows/create_issue.yml/dispatches`,
            {
                method: 'POST',
                headers: {
                    'Accept': 'application/vnd.github+json',
                    'Authorization': `token ${CONFIG.github.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ref: 'main',
                    inputs: {
                        title: title,
                        body: body,
                        labels: labels
                    }
                })
            }
        );
        
        if (!response.ok) {
            const errorData = await response.json();
            console.error('GitHub Actions エラー詳細:', errorData);
            throw new Error(`GitHub Actions error: ${response.status}`);
        }
        
        console.log('✅ GitHub Actionsトリガー成功 - 数秒後にIssueが作成されます');
        
    } catch (error) {
        console.error('❌ GitHub保存エラー:', error);
        alert('⚠️ GitHub Issuesへの保存に失敗しましたが、ローカルには保存されています。');
    }
}

// ページ切り替え
function showPage(pageId) {
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    document.getElementById(pageId).classList.add('active');
}

// チーム設定を変更
function changeTeam() {
    // 管理者パスワードモーダルを表示
    showAdminPasswordModal();
}

// 管理者パスワードモーダルを表示
function showAdminPasswordModal() {
    const modal = document.getElementById('adminPasswordModal');
    document.getElementById('adminPasswordInput').value = '';
    document.getElementById('adminPasswordError').style.display = 'none';
    
    modal.classList.add('active');
    
    // Enterキーで送信
    const passwordInput = document.getElementById('adminPasswordInput');
    passwordInput.onkeypress = function(e) {
        if (e.key === 'Enter') {
            verifyAdminPassword();
        }
    };
    
    // 認証ボタン
    document.getElementById('submitAdminPassword').onclick = verifyAdminPassword;
    
    // キャンセルボタン
    document.getElementById('cancelAdminPassword').onclick = () => {
        modal.classList.remove('active');
    };
    
    // フォーカス
    setTimeout(() => passwordInput.focus(), 100);
}

// 管理者パスワードを検証してチーム変更を許可
function verifyAdminPassword() {
    const input = document.getElementById('adminPasswordInput').value;
    const errorDiv = document.getElementById('adminPasswordError');
    const modal = document.getElementById('adminPasswordModal');
    
    if (input === CONFIG.adminPassword) {
        // 認証成功
        modal.classList.remove('active');
        
        // ロックイン解除
        localStorage.removeItem('lockedTeamId');
        localStorage.removeItem('selectedTeamId');
        
        // チーム選択画面に戻る
        currentTeam = null;
        showPage('teamSelect');
        renderTeamGrid();
        
        alert('✅ チーム変更が許可されました。\n新しいチームを選択してください。');
    } else {
        // 認証失敗
        errorDiv.textContent = '⚠️ 管理者パスワードが違います';
        errorDiv.style.display = 'block';
        document.getElementById('adminPasswordInput').value = '';
        document.getElementById('adminPasswordInput').focus();
    }
}

// 報告を削除
async function deleteReport(timestamp) {
    if (!confirm('この報告を削除しますか?\n(この操作は取り消せません)')) {
        return;
    }
    
    const localData = localStorage.getItem('missionReports');
    const reports = localData ? JSON.parse(localData) : [];
    const filteredReports = reports.filter(r => r.timestamp !== timestamp);
    localStorage.setItem('missionReports', JSON.stringify(filteredReports));
    
    // 履歴を再読み込み
    loadTeamHistory();
    renderTeamGrid();
    
    alert('報告を削除しました');
}

// ローディング表示
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}
