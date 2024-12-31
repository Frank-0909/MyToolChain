let ffmpegInstance = null;

const { createFFmpeg, fetchFile } = FFmpeg;

// 全局变量和函数定义
let isInitialized = false;

// 文本翻译函数 - 用于中英互译页面
async function translateText() {
    const inputText = document.getElementById('inputText');
    const outputText = document.getElementById('outputText');
    const text = inputText.value.trim();
    
    if (!text) {
        outputText.value = '请输入要翻译的文本';
        return;
    }

    try {
        const isEnglish = /^[A-Za-z\s.,!?'"]+$/.test(text);
        const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${isEnglish ? 'en|zh' : 'zh|en'}`);
        
        if (!response.ok) {
            throw new Error(`Translation API error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('翻译API响应:', data);

        if (data.responseStatus === 200) {
            const result = data.responseData.translatedText;
            if (!result) {
                throw new Error('翻译API返回空结果');
            }
            outputText.value = result;
            
            // 保存到翻译历史
            const history = JSON.parse(localStorage.getItem('translationHistory')) || [];
            const newTranslation = {
                original: text,
                translated: result,
                timestamp: new Date().toISOString(),
                fromLang: isEnglish ? 'en' : 'zh',
                toLang: isEnglish ? 'zh' : 'en'
            };
            
            // 添加到历史记录
            history.unshift(newTranslation);
            if (history.length > 50) history.pop(); // 限制历史记录数量
            localStorage.setItem('translationHistory', JSON.stringify(history));
            
            // 如果当前在历史记录页面，立即更新显示
            const historyList = document.getElementById('historyList');
            if (historyList) {
                const historyContainer = document.getElementById('historyContainer');
                if (historyContainer) {
                    // 更新历史记录显示
                    const historyItem = document.createElement('div');
                    historyItem.className = 'history-item';
                    historyItem.innerHTML = `
                        <label class="checkbox-container">
                            <input type="checkbox" class="history-checkbox" data-index="0">
                            <span class="checkmark"></span>
                        </label>
                        <div class="history-text">
                            <div>${text}</div>
                            <div>${result}</div>
                        </div>
                        <div class="history-actions">
                            <button onclick="toggleFavorite('${encodeURIComponent(JSON.stringify(newTranslation))}')" 
                                    class="favorite-btn">
                                ⭐
                            </button>
                        </div>
                    `;
                    // 在列表开头插入新记录
                    historyList.insertBefore(historyItem, historyList.firstChild);
                }
            }
        } else {
            throw new Error(data.responseDetails || '翻译失败');
        }
    } catch (error) {
        console.error('Translation error:', error);
        outputText.value = '翻译出错，请稍后重试';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const inputText = document.getElementById('inputText');
    const outputText = document.getElementById('outputText');
    const translateBtn = document.getElementById('translateBtn');
    
    // 初始化本地存储
    const history = JSON.parse(localStorage.getItem('translationHistory')) || [];
    const favorites = JSON.parse(localStorage.getItem('translationFavorites')) || [];

    // 回车键翻译功能
    inputText.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault(); // 阻止默认的换行行为
            translateText();
        }
    });

    // 翻译按钮点击事件
    translateBtn.addEventListener('click', translateText);

    // 添加到历史记录
    function addToHistory(translation) {
        history.unshift(translation);
        if (history.length > 50) history.pop(); // 限制历史记录数量
        localStorage.setItem('translationHistory', JSON.stringify(history));
        updateHistoryList();
    }

    // 更新历史记录列表
    function updateHistoryList() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;

        historyList.innerHTML = history.map((item, index) => `
            <div class="history-item">
                <label class="checkbox-container">
                    <input type="checkbox" class="history-checkbox" data-index="${index}">
                    <span class="checkmark"></span>
                </label>
                <div class="history-text">
                    <div>${item.original}</div>
                    <div>${item.translated}</div>
                </div>
                <div class="history-actions">
                    <button onclick="toggleFavorite('${encodeURIComponent(JSON.stringify(item))}')" 
                            class="favorite-btn ${isFavorite(item) ? 'active' : ''}">
                        ⭐
                    </button>
                </div>
            </div>
        `).join('');

        // 添加全选和删除功能
        const selectAllCheckbox = document.getElementById('selectAllHistory');
        const deleteSelectedBtn = document.getElementById('deleteSelected');
        
        if (selectAllCheckbox && deleteSelectedBtn) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('.history-checkbox');
                checkboxes.forEach(checkbox => checkbox.checked = e.target.checked);
            });

            deleteSelectedBtn.addEventListener('click', () => {
                const selectedIndexes = Array.from(document.querySelectorAll('.history-checkbox:checked'))
                    .map(checkbox => parseInt(checkbox.dataset.index))
                    .sort((a, b) => b - a); // 从大到小排序，以便从后往前删除

                if (selectedIndexes.length === 0) {
                    alert('请选择要删除的记录');
                    return;
                }

                if (confirm('确定要删除选中的记录吗？')) {
                    selectedIndexes.forEach(index => {
                        history.splice(index, 1);
                    });
                    localStorage.setItem('translationHistory', JSON.stringify(history));
                    updateHistoryList();
                }
            });
        }
    }

    // 导航菜单切换
    document.querySelectorAll('.nav-menu li').forEach(item => {
        item.addEventListener('click', () => {
            console.log('导航菜单被点击:', item.querySelector('a').textContent);
            
            // 移除所有活动状态
            document.querySelectorAll('.nav-menu li').forEach(i => i.classList.remove('active'));
            // 添加当前活动状态
            item.classList.add('active');
            
            // 获取所有内容容器
            const translator = document.querySelector('.translator');
            const audioConverter = document.querySelector('.audio-converter');
            const faceSwap = document.querySelector('.face-swap');
            
            // 先隐藏所有内容
            if (translator) translator.style.display = 'none';
            if (audioConverter) audioConverter.style.display = 'none';
            if (faceSwap) faceSwap.style.display = 'none';
            
            // 根据点击的菜单项显示相应内容
            const type = item.querySelector('a').textContent;
            console.log('切换到:', type);
            
            if (type.includes('翻译历史')) {
                showHistory();
            } else if (type.includes('收藏夹')) {
                showFavorites();
            } else if (type.includes('音频转换')) {
                if (audioConverter) {
                    audioConverter.style.display = 'block';
                }
                clearAllContainers();
            } else if (type.includes('换脸工具')) {
                if (faceSwap) {
                    faceSwap.style.display = 'block';
                    console.log('显示换脸工具界面');
                    // 重置初始化状态，确保每次切换到换脸工具时都重新初始化
                    isInitialized = false;
                    setTimeout(initializeFaceSwap, 0);
                }
                clearAllContainers();
            } else if (type.includes('中英互译')) {
                if (translator) {
                    translator.style.display = 'flex';
                }
                clearAllContainers();
            }
        });
    });

    // 全局函数定义
    async function handleFaceSwap() {
        console.log('换脸按钮被点击');
        const sourcePreview = document.getElementById('sourcePreview');
        const targetPreview = document.getElementById('targetPreview');
        const sourceImg = sourcePreview.querySelector('img');
        const targetImg = targetPreview.querySelector('img');
        const swapFaceBtn = document.getElementById('swapFaceBtn');
        
        if (!sourceImg || !targetImg) {
            alert('请先上传两张图片');
            return;
        }

        try {
            // 显示进度条和步骤
            const progressContainer = document.querySelector('.face-swap .progress-container');
            if (progressContainer) {
                progressContainer.style.display = 'block';
                console.log('显示进度条');
            }
            swapFaceBtn.disabled = true;
            
            // 1. 检测人脸
            updateFaceSwapStep(0, 'processing', '正在检测人脸...');
            const sourceData = await getImageData(sourceImg.src);
            const targetData = await getImageData(targetImg.src);
            
            // 2. 分析特征
            updateFaceSwapStep(1, 'processing', '正在分析面部特征...');
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // 3. 换脸处理
            updateFaceSwapStep(2, 'processing', '正在进行换脸处理...');
            console.log('发送换脸请求...');
            const response = await fetch('/proxy/face_swap', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    source_image: sourceData,
                    target_image: targetData
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            console.log('接收换脸结果...');
            const result = await response.blob();
            console.log('换脸结果大小:', result.size);
            
            // 显示结果
            const resultArea = document.querySelector('.face-swap .result-area');
            if (resultArea) {
                resultArea.style.display = 'block';
                console.log('显示结果区域');
            }
            const resultImage = document.getElementById('resultImage');
            if (resultImage) {
                resultImage.src = URL.createObjectURL(result);
                console.log('结果图片已设置');
                
                // 确保图片加载完成后再显示
                resultImage.onload = () => {
                    console.log('结果图片加载完成');
                    updateFaceSwapStep(2, 'completed', '处理完成');
                    // 显示下载按钮
                    const downloadBtn = document.getElementById('downloadSwappedImage');
                    if (downloadBtn) {
                        downloadBtn.style.display = 'block';
                        console.log('显示下载按钮');
                    }
                };
            }

        } catch (error) {
            console.error('换脸处理错误:', error);
            alert(`换脸失败: ${error.message}`);
            // 重置步骤状态
            document.querySelectorAll('.face-swap .step').forEach(step => {
                step.classList.remove('completed', 'active');
            });
        } finally {
            const progressContainer = document.querySelector('.face-swap .progress-container');
            if (progressContainer) {
                progressContainer.style.display = 'none';
                console.log('隐藏进度条');
            }
            swapFaceBtn.disabled = false;
        }
    }

    // 换脸工具初始化函数
    function initializeFaceSwap() {
        if (isInitialized) {
            console.log('换脸工具已经初始化，跳过');
            return;
        }
        
        console.log('初始化换脸工具...');
        const sourceImage = document.getElementById('sourceImage');
        const targetImage = document.getElementById('targetImage');
        const sourcePreview = document.getElementById('sourcePreview');
        const targetPreview = document.getElementById('targetPreview');
        const swapFaceBtn = document.getElementById('swapFaceBtn');
        const downloadSwappedImage = document.getElementById('downloadSwappedImage');

        console.log('初始化元素状态:');
        console.log('- sourceImage:', sourceImage ? '已找到' : '未找到');
        console.log('- targetImage:', targetImage ? '已找到' : '未找到');
        console.log('- swapFaceBtn:', swapFaceBtn ? '已找到' : '未找到');

        // 移除所有现有的事件监听器
        if (sourceImage) {
            const newSourceImage = sourceImage.cloneNode(true);
            sourceImage.parentNode.replaceChild(newSourceImage, sourceImage);
            newSourceImage.addEventListener('change', (e) => {
                console.log('源图片上传事件触发');
                if (e.target.files && e.target.files[0]) {
                    handleImageUpload(e.target.files[0], sourcePreview);
                }
            });
        }
        
        if (targetImage) {
            const newTargetImage = targetImage.cloneNode(true);
            targetImage.parentNode.replaceChild(newTargetImage, targetImage);
            newTargetImage.addEventListener('change', (e) => {
                console.log('目标图片上传事件触发');
                if (e.target.files && e.target.files[0]) {
                    handleImageUpload(e.target.files[0], targetPreview);
                }
            });
        }
        
        if (swapFaceBtn) {
            const newSwapFaceBtn = swapFaceBtn.cloneNode(true);
            swapFaceBtn.parentNode.replaceChild(newSwapFaceBtn, swapFaceBtn);
            newSwapFaceBtn.addEventListener('click', handleFaceSwap);
            console.log('换脸按钮事件已绑定');
        }
        
        if (downloadSwappedImage) {
            const newDownloadBtn = downloadSwappedImage.cloneNode(true);
            downloadSwappedImage.parentNode.replaceChild(newDownloadBtn, downloadSwappedImage);
            newDownloadBtn.addEventListener('click', () => {
                const resultImage = document.getElementById('resultImage');
                if (resultImage && resultImage.src) {
                    const a = document.createElement('a');
                    a.href = resultImage.src;
                    a.download = 'face_swapped.jpg';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                } else {
                    alert('没有可下载的图片');
                }
            });
        }

        // 初始检查按钮状态
        checkSwapButtonState();
        isInitialized = true;
    }

    // 事件处理函数
    function handleSourceImageChange(e) {
        console.log('源图片上传事件触发');
        if (e.target.files && e.target.files[0]) {
            handleImageUpload(e.target.files[0], document.getElementById('sourcePreview'));
        }
    }

    function handleTargetImageChange(e) {
        console.log('目标图片上传事件触发');
        if (e.target.files && e.target.files[0]) {
            handleImageUpload(e.target.files[0], document.getElementById('targetPreview'));
        }
    }

    function handleDownload() {
        const resultImage = document.getElementById('resultImage');
        if (resultImage && resultImage.src) {
            const a = document.createElement('a');
            a.href = resultImage.src;
            a.download = 'face_swapped.jpg';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert('没有可下载的图片');
        }
    }

    // 显示翻译器
    function showTranslator() {
        // 先清除其他内容
        clearAllContainers();
        document.querySelector('.translator').style.display = 'flex';
    }

    // 显示历史记录
    function showHistory() {
        clearAllContainers();
        const translator = document.querySelector('.translator');
        const audioConverter = document.querySelector('.audio-converter');
        
        if (translator) translator.style.display = 'none';
        if (audioConverter) audioConverter.style.display = 'none';
        
        const container = document.createElement('div');
        container.id = 'historyContainer';
        container.innerHTML = `
            <div class="history-header">
                <h2>翻译历史</h2>
                <div class="history-controls">
                    <label class="checkbox-container">
                        <input type="checkbox" id="selectAllHistory">
                        <span class="checkmark"></span>
                        全选
                    </label>
                    <button id="deleteSelected" class="delete-btn">删除选中</button>
                </div>
            </div>
            <div id="historyList" class="history-list"></div>
        `;
        document.querySelector('.container').appendChild(container);
        updateHistoryList();
    }

    // 显示收藏夹
    function showFavorites() {
        clearAllContainers();
        const translator = document.querySelector('.translator');
        const audioConverter = document.querySelector('.audio-converter');
        
        if (translator) translator.style.display = 'none';
        if (audioConverter) audioConverter.style.display = 'none';
        
        const container = document.createElement('div');
        container.id = 'favoritesContainer';
        container.innerHTML = `
            <div class="history-header">
                <h2>收藏夹</h2>
                <div class="history-controls">
                    <label class="checkbox-container">
                        <input type="checkbox" id="selectAllFavorites">
                        <span class="checkmark"></span>
                        全选
                    </label>
                    <button id="deleteFavorites" class="delete-btn">删除选中</button>
                </div>
            </div>
            <div id="favoritesList" class="history-list"></div>
        `;
        document.querySelector('.container').appendChild(container);
        updateFavoritesList();
    }

    // 更新收藏夹列表
    function updateFavoritesList() {
        const favoritesList = document.getElementById('favoritesList');
        if (!favoritesList) return;

        favoritesList.innerHTML = favorites.map((item, index) => `
            <div class="history-item">
                <label class="checkbox-container">
                    <input type="checkbox" class="favorite-checkbox" data-index="${index}">
                    <span class="checkmark"></span>
                </label>
                <div class="history-text">
                    <div>${item.original}</div>
                    <div>${item.translated}</div>
                </div>
                <div class="history-actions">
                    <button onclick="toggleFavorite('${encodeURIComponent(JSON.stringify(item))}')" 
                            class="favorite-btn active">
                        ⭐
                    </button>
                </div>
            </div>
        `).join('');

        // 添加全选和删除功能
        const selectAllCheckbox = document.getElementById('selectAllFavorites');
        const deleteSelectedBtn = document.getElementById('deleteFavorites');
        
        if (selectAllCheckbox && deleteSelectedBtn) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('.favorite-checkbox');
                checkboxes.forEach(checkbox => checkbox.checked = e.target.checked);
            });

            deleteSelectedBtn.addEventListener('click', () => {
                const selectedIndexes = Array.from(document.querySelectorAll('.favorite-checkbox:checked'))
                    .map(checkbox => parseInt(checkbox.dataset.index))
                    .sort((a, b) => b - a); // 从大到小排序，以便从后往前删除

                if (selectedIndexes.length === 0) {
                    alert('请选择要删除的收藏');
                    return;
                }

                if (confirm('确定要删除选中的收藏吗？')) {
                    selectedIndexes.forEach(index => {
                        favorites.splice(index, 1);
                    });
                    localStorage.setItem('translationFavorites', JSON.stringify(favorites));
                    updateFavoritesList();
                    // 更新历史记录列表以反映收藏状态的变化
                    updateHistoryList();
                }
            });
        }
    }

    // 检查是否已收藏
    function isFavorite(item) {
        return favorites.some(f => f.original === item.original && f.translated === item.translated);
    }

    // 切换收藏状态
    window.toggleFavorite = function(itemStr) {
        const item = JSON.parse(decodeURIComponent(itemStr));
        const index = favorites.findIndex(f => 
            f.original === item.original && f.translated === item.translated
        );
        
        if (index === -1) {
            // 添加到收藏
            favorites.unshift(item);
        } else {
            // 从收藏中移除
            favorites.splice(index, 1);
        }
        
        // 保存到本地存储
        localStorage.setItem('translationFavorites', JSON.stringify(favorites));
        
        // 更新两个列表的显示
        updateHistoryList();
        updateFavoritesList();
    };

    // 清除所有内容容器的辅助函数
    function clearAllContainers() {
        // 移除历史记录容器
        const historyContainer = document.getElementById('historyContainer');
        if (historyContainer) {
            historyContainer.remove();
        }
        
        // 移除收藏夹容器
        const favoritesContainer = document.getElementById('favoritesContainer');
        if (favoritesContainer) {
            favoritesContainer.remove();
        }
    }

    // 添加清空按钮功能
    const clearInput = document.getElementById('clearInput');
    const clearOutput = document.getElementById('clearOutput');

    clearInput.addEventListener('click', () => {
        inputText.value = '';
        inputText.focus();
    });

    clearOutput.addEventListener('click', () => {
        outputText.value = '';
    });

    // 监听输入框内容变化，控制清空按钮的显示
    inputText.addEventListener('input', () => {
        clearInput.style.opacity = inputText.value ? '1' : '0';
    });

    outputText.addEventListener('input', () => {
        clearOutput.style.opacity = outputText.value ? '1' : '0';
    });

    // 音频转换功能
    const audioFileInput = document.getElementById('audioFileInput');
    const fileUploadArea = document.querySelector('.file-upload-area');
    const fileInfo = document.querySelector('.file-info');
    const fileName = document.querySelector('.file-name');
    const fileSize = document.querySelector('.file-size');
    const removeFileBtn = document.querySelector('.remove-file');
    const convertBtn = document.getElementById('convertBtn');
    const progressBar = document.querySelector('.progress-bar');
    const progress = document.querySelector('.progress');
    const progressText = document.querySelector('.progress-text');
    const resultArea = document.querySelector('.result-area');
    const resultAudio = document.getElementById('resultAudio');
    const downloadBtn = document.getElementById('downloadBtn');

    // 文件拖拽功能
    fileUploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileUploadArea.classList.add('drag-over');
    });

    fileUploadArea.addEventListener('dragleave', () => {
        fileUploadArea.classList.remove('drag-over');
    });

    fileUploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        fileUploadArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        handleFile(file);
    });

    // 文件选择功能
    audioFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleFile(file);
    });

    // 文件处理函数
    function handleFile(file) {
        if (file && (file.type.startsWith('audio/') || file.type.startsWith('video/'))) {
            fileName.textContent = file.name;
            fileSize.textContent = formatFileSize(file.size);
            fileInfo.style.display = 'flex';
            convertBtn.disabled = false;
        } else {
            alert('请选择有效的音频或视频文件');
        }
    }

    // 移除文件
    removeFileBtn.addEventListener('click', () => {
        audioFileInput.value = '';
        fileInfo.style.display = 'none';
        convertBtn.disabled = true;
        resultArea.style.display = 'none';
    });

    // 视频处理相关变量
    const steps = document.querySelectorAll('.step');
    const progressDetail = document.querySelector('.progress-detail');
    const transcriptionOriginal = document.querySelector('.transcription-original .transcription-text');
    const transcriptionTranslated = document.querySelector('.transcription-translated .transcription-text');

    // 更新音频转换步骤状态
    function updateAudioStep(stepIndex, status, message = '') {
        console.log(`更新音频转换步骤 ${stepIndex} 状态:`, status, message);
        const steps = document.querySelectorAll('.audio-converter .step');
        steps.forEach((step, index) => {
            if (index < stepIndex) {
                step.classList.add('completed');
                step.classList.remove('active');
                console.log(`音频步骤 ${index} 设置为已完成`);
            } else if (index === stepIndex) {
                step.classList.add('active');
                step.classList.remove('completed');
                console.log(`音频步骤 ${index} 设置为进行中`);
            } else {
                step.classList.remove('completed', 'active');
            }
            if (index === stepIndex && message) {
                const statusElement = step.querySelector('.step-status');
                if (statusElement) {
                    statusElement.textContent = message;
                    console.log(`音频步骤 ${index} 更新消息:`, message);
                }
            }
        });
    }

    // 更新换脸步骤状态
    function updateFaceSwapStep(stepIndex, status, message = '') {
        console.log(`更新换脸步骤 ${stepIndex} 状态:`, status, message);
        const steps = document.querySelectorAll('.face-swap .step');
        steps.forEach((step, index) => {
            if (index < stepIndex) {
                step.classList.add('completed');
                step.classList.remove('active');
                console.log(`换脸步骤 ${index} 设置为已完成`);
            } else if (index === stepIndex) {
                step.classList.add('active');
                step.classList.remove('completed');
                console.log(`换脸步骤 ${index} 设置为进行中`);
            } else {
                step.classList.remove('completed', 'active');
            }
            if (index === stepIndex && message) {
                const statusElement = step.querySelector('.step-status');
                if (statusElement) {
                    statusElement.textContent = message;
                    console.log(`换脸步骤 ${index} 更新消息:`, message);
                }
            }
        });
    }

    // 开始转换
    convertBtn.addEventListener('click', async () => {
        const file = audioFileInput.files[0];
        if (!file) return;

        progressBar.style.display = 'block';
        progressDetail.style.display = 'block';
        convertBtn.disabled = true;
        resultArea.style.display = 'none';

        try {
            console.log('开始处理文件:', file.name);

            // 1. 提取音频
            updateAudioStep(0, 'processing', '正在提取音频...');
            console.log('开始提取音频...');
            const audioBlob = await extractAudio(file);
            console.log('音频提取完成，大小:', audioBlob.size);

            // 2. 语音识别
            updateAudioStep(1, 'processing', '正在进行语音识别...');
            console.log('开始语音识别...');
            const transcription = await speechToText(audioBlob);
            console.log('语音识别结果:', transcription);
            
            if (!transcription) {
                throw new Error('未能识别出任何文本，请检查音频质量或重试');
            }
            
            transcriptionOriginal.textContent = transcription;

            // 3. 文本翻译
            updateAudioStep(2, 'processing', '正在翻译文本...');
            console.log('开始翻译文本...');
            const translation = await VideotranslateText(transcription);
            console.log('翻译结果:', translation);
            
            if (!translation) {
                throw new Error('翻译失败，未获得翻译结果');
            }
            
            transcriptionTranslated.textContent = translation;

            // 4. 语音合成
            updateAudioStep(3, 'processing', '正在合成语音...');
            console.log('开始语音合成...');
            const translatedAudio = await textToSpeech(translation);
            if (!translatedAudio || !(translatedAudio instanceof Blob)) {
                throw new Error('语音合成失败，未获得有效的音频数据');
            }
            console.log('语音合成完成，大小:', translatedAudio.size);

            // 5. 合成视频
            updateAudioStep(4, 'processing', '正在合成视频...');
            console.log('开始合成最终视频...');
            const finalVideo = await mergeVideoAndAudio(file, translatedAudio);
            console.log('视频合成完成，大小:', finalVideo.size);

            // 显示结果
            updateAudioStep(4, 'completed', '处理完成');
            resultArea.style.display = 'block';
            document.getElementById('resultVideo').src = URL.createObjectURL(finalVideo);

        } catch (error) {
            console.error('转换过程详细错误:', error);
            alert(`转换失败: ${error.message}`);
        } finally {
            progressBar.style.display = 'none';
            convertBtn.disabled = false;
        }
    });

    // 修改腾讯云配置
    const TENCENT_CONFIG = {
        // 语音识别 (ASR)
        ASR: {
            SECRET_ID: 'xxx',    // 替换为您的 SecretId
            SECRET_KEY: 'xxx',    // 替换为您的 SecretKey
            REGION: 'ap-guangzhou'
        },
        // 语音合成 (TTS)
        TTS: {
            SECRET_ID: 'xxx',    // 替换为您的 SecretId
            SECRET_KEY: 'xxx',    // 替换为您的 SecretKey
            REGION: 'ap-guangzhou'
        }
    };

    // 修改音频提取函数
    async function extractAudio(videoFile) {
        try {
            const ffmpeg = await initFFmpeg();
            
            if (!ffmpeg.isLoaded()) {
                throw new Error('FFmpeg 未正确加载');
            }
            
            console.log('写入视频文件...');
            await ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoFile));
            
            console.log('开始音频提取...');
            await ffmpeg.run(
                '-i', 'input.mp4',
                '-vn',                // 不处理视频
                '-acodec', 'pcm_s16le', // 16位 PCM
                '-ar', '16000',         // 16kHz 采样率
                '-ac', '1',             // 单声道
                '-f', 'wav',            // WAV 格式
                '-y',                   // 覆盖输出文件
                'output.wav'            // 输出单个文件
            );
            
            console.log('读取转换后的音频...');
            const audioData = ffmpeg.FS('readFile', 'output.wav');
            
            // 清理文件系统
            try {
                ffmpeg.FS('unlink', 'input.mp4');
                ffmpeg.FS('unlink', 'output.wav');
            } catch (error) {
                console.warn('清理文件系统失败:', error);
            }
            
            // 创建音频 Blob
            const audioBlob = new Blob([audioData.buffer], { type: 'audio/wav' });
            console.log('音频提取完成，大小:', formatFileSize(audioBlob.size));
            
            if (audioBlob.size > 3 * 1024 * 1024) {
                console.warn('音频文件超过3MB限制，尝试压缩...');
                // 压缩音频
                await ffmpeg.FS('writeFile', 'temp.wav', await fetchFile(audioBlob));
                await ffmpeg.run(
                    '-i', 'temp.wav',
                    '-acodec', 'pcm_s16le',
                    '-ar', '16000',
                    '-ac', '1',
                    '-compression_level', '10',
                    '-y',
                    'compressed.wav'
                );
                const compressedData = ffmpeg.FS('readFile', 'compressed.wav');
                
                // 清理临时文件
                ffmpeg.FS('unlink', 'temp.wav');
                ffmpeg.FS('unlink', 'compressed.wav');
                
                const compressedBlob = new Blob([compressedData.buffer], { type: 'audio/wav' });
                console.log('压缩后音频大小:', formatFileSize(compressedBlob.size));
                return compressedBlob;
            }
            
            return audioBlob;
        } catch (error) {
            console.error('音频提取详细错误:', error);
            throw error;
        }
    }

    // 修改语音识别函数
    async function speechToText(audioBlob) {
        try {
            if (!(audioBlob instanceof Blob)) {
                throw new Error('Invalid audio data: not a Blob');
            }
            
            console.log('开始语音识别...');
            const audioBase64 = await blobToBase64(audioBlob);
            
            console.log('音频文件大小:', audioBlob.size);
            console.log('Base64 长度:', audioBase64.length);
            
            const requestData = {
                audio: audioBase64.split(',')[1],
                config: {
                    secretId: TENCENT_CONFIG.ASR.SECRET_ID,
                    secretKey: TENCENT_CONFIG.ASR.SECRET_KEY,
                    region: TENCENT_CONFIG.ASR.REGION
                }
            };

            console.log('发送请求到腾讯云 ASR...');
            
            const response = await fetch('/proxy/tencent/asr', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log('腾讯云 ASR 响应:', result);

            if (result.error) {
                throw new Error(result.error.message);
            }

            if (result.Result) {
                return result.Result;
            } else if (result.Response && result.Response.Result) {
                return result.Response.Result;
            } else if (result.Response && result.Response.Error) {
                throw new Error(result.Response.Error.Message);
            }

            return '';
        } catch (error) {
            console.error('语音识别详细错误:', error);
            throw new Error('语音识别失败: ' + error.message);
        }
    }

    // 修改语音合成函数
    async function textToSpeech(text) {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('Invalid text parameter: text must be a non-empty string');
            }
            
            text = text.trim();
            if (text.length === 0) {
                throw new Error('Text cannot be empty');
            }
            
            // 获取选择的声音类型
            const voiceSelect = document.getElementById('voiceSelect');
            // 映射选择值到腾讯云的声音类型ID
            const voiceTypeMap = {
                'female': 101001,  // 英文女声
                'male': 101002    // 英文男声
            };
            const selectedVoice = voiceTypeMap[voiceSelect.value];
            console.log('选择的声音类型:', voiceSelect.value, '映射到ID:', selectedVoice);
            
            console.log('开始语音合成，文本:', text);
            const response = await fetch('/proxy/tencent/tts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    config: {
                        secretId: TENCENT_CONFIG.TTS.SECRET_ID,
                        secretKey: TENCENT_CONFIG.TTS.SECRET_KEY,
                        region: TENCENT_CONFIG.TTS.REGION,
                        voiceType: selectedVoice,  // 使用映射后的声音类型ID
                        volume: 5,          // 音量
                        speed: 1,           // 语速
                        projectId: 0,       // 项目ID
                        codec: 'wav'        // 音频格式
                    }
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                try {
                    const errorData = JSON.parse(errorText);
                    throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
                } catch (e) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
            }

            // 直接获取音频数据
            const audioData = await response.blob();
            console.log('语音合成完成，音频大小:', formatFileSize(audioData.size));
            return audioData;
        } catch (error) {
            console.error('语音合成错误:', error);
            throw new Error('语音合成失败: ' + error.message);
        }
    }

    // 修改 FFmpeg 配置
    const ffmpegConfig = {
        log: true,
        corePath: 'https://unpkg.com/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js',
        progress: ({ ratio }) => {
            if (ratio) {
                console.log('FFmpeg 处理进度:', Math.round(ratio * 100) + '%');
            }
        }
    };

    // 初始化 FFmpeg
    async function initFFmpeg() {
        if (!ffmpegInstance) {
            try {
                console.log('正在加载 FFmpeg...');
                ffmpegInstance = createFFmpeg(ffmpegConfig);
                await ffmpegInstance.load();
                console.log('FFmpeg 加载完成');
            } catch (error) {
                console.error('FFmpeg 加载失败:', error);
                throw error;
            }
        }
        return ffmpegInstance;
    }

    // 修改视频合并函数
    async function mergeVideoAndAudio(videoFile, audioFile) {
        try {
            console.log('正在加载 FFmpeg...');
            const ffmpeg = createFFmpeg(ffmpegConfig);
            
            console.log('等待 FFmpeg 加载...');
            await ffmpeg.load();
            console.log('FFmpeg 加载完成');
            
            if (!ffmpeg.isLoaded()) {
                throw new Error('FFmpeg 加载失败');
            }
            
            console.log('写入文件...');
            await ffmpeg.FS('writeFile', 'input.mp4', await fetchFile(videoFile));
            await ffmpeg.FS('writeFile', 'audio.wav', await fetchFile(audioFile));
            
            console.log('开始合并...');
            await ffmpeg.run(
                '-i', 'input.mp4',
                '-i', 'audio.wav',
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-map', '0:v:0',
                '-map', '1:a:0',
                'output.mp4'
            );
            
            console.log('读取结果...');
            const data = ffmpeg.FS('readFile', 'output.mp4');
            
            // 清理文件系统
            try {
                ffmpeg.FS('unlink', 'input.mp4');
                ffmpeg.FS('unlink', 'audio.wav');
                ffmpeg.FS('unlink', 'output.mp4');
            } catch (error) {
                console.warn('清理文件系统失败:', error);
            }
            
            const outputBlob = new Blob([data.buffer], { type: 'video/mp4' });
            console.log('视频合并完成，大小:', formatFileSize(outputBlob.size));
            return outputBlob;
        } catch (error) {
            console.error('视频合并详细错误:', error);
            throw new Error('视频合并失败: ' + error.message);
        }
    }

    // 辅助函数：将 Blob 转换为 Base64
    function blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // MD5 加密函数（需要引入 md5.js 库）
    function MD5(string) {
        return md5(string);
    }

    // 文件大小格式化
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 视频转换中的文本翻译函数
    async function VideotranslateText(text) {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('Invalid text parameter: text must be a non-empty string');
            }
            
            text = text.trim();
            if (text.length === 0) {
                throw new Error('Text cannot be empty');
            }
            
            console.log('开始翻译视频文本:', text);
            
            // 检测语言
            const isEnglish = /^[A-Za-z\s.,!?'"]+$/.test(text);
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${isEnglish ? 'en|zh' : 'zh|en'}`);
            
            if (!response.ok) {
                throw new Error(`Translation API error: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('翻译API响应:', data);
            
            if (data.responseStatus === 200) {
                const result = data.responseData.translatedText;
                if (!result) {
                    throw new Error('Translation API returned empty result');
                }
                console.log('翻译结果:', result);
                return result;
            } else {
                throw new Error(data.responseDetails || 'Translation failed');
            }
        } catch (error) {
            console.error('翻译错误:', error);
            throw new Error('翻译失败: ' + error.message);
        }
    }

    // 添加下载按钮事件处理
    downloadBtn.addEventListener('click', () => {
        const video = document.getElementById('resultVideo');
        if (video && video.src) {
            // 创建下载链接
            const a = document.createElement('a');
            a.href = video.src;
            a.download = 'translated_video.mp4';  // 设置下载文件名
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert('没有可下载的视频');
        }
    });

    // 图片预览功能
    function handleImageUpload(file, previewElement) {
        console.log('处理图片上传:', file.name, file.type);
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function(e) {
                console.log('图片加载完成');
                previewElement.style.display = 'block';
                previewElement.innerHTML = `<img src="${e.target.result}" alt="预览图片">`;
                setTimeout(checkSwapButtonState, 100); // 添加延时确保DOM更新
            };
            reader.readAsDataURL(file);
        } else {
            alert('请选择有效的图片文件');
        }
    }

    // 检查换脸按钮状态
    function checkSwapButtonState() {
        const sourcePreview = document.getElementById('sourcePreview');
        const targetPreview = document.getElementById('targetPreview');
        const swapFaceBtn = document.getElementById('swapFaceBtn');
        
        console.log('检查按钮状态:');
        console.log('- sourcePreview:', sourcePreview ? '存在' : '不存在');
        console.log('- targetPreview:', targetPreview ? '存在' : '不存在');
        console.log('- swapFaceBtn:', swapFaceBtn ? '存在' : '不存在');
        
        if (sourcePreview && targetPreview && swapFaceBtn) {
            const sourceImg = sourcePreview.querySelector('img');
            const targetImg = targetPreview.querySelector('img');
            
            console.log('- sourceImg:', sourceImg ? '已加载' : '未加载');
            console.log('- targetImg:', targetImg ? '已加载' : '未加载');
            
            const shouldEnable = sourceImg && targetImg;
            swapFaceBtn.disabled = !shouldEnable;
            console.log('按钮状态:', shouldEnable ? '启用' : '禁用');
        }
    }

    // 获取图片数据
    async function getImageData(src) {
        try {
            const response = await fetch(src);
            const blob = await response.blob();
            return await blobToBase64(blob);
        } catch (error) {
            console.error('获取图片数据失败:', error);
            throw error;
        }
    }

    // 移除全局范围内的重复事件绑定
    const globalElements = ['sourceImage', 'targetImage', 'swapFaceBtn', 'downloadSwappedImage'];
    globalElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
        }
    });
}); 