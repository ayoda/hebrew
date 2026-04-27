(function() {
    'use strict';

    const CONFIG = {
        // Твой боевой адрес в Cloudflare
        serverUrl: 'wss://falling-dust-3e1e.oleayoda.workers.dev'
    };

    let audioContext, ws, mediaStream, processor;

    function init() {
        createStyles();
        createWidgetHTML();
        const btn = document.getElementById('my-voice-btn');
        if (btn) {
            btn.addEventListener('click', startConversation);
        }
    }

    async function startConversation() {
        const btn = document.getElementById('my-voice-btn');
        const status = document.getElementById('my-status');
        
        btn.style.background = '#2563eb';
        status.textContent = 'Связь с Джиминай...';

        try {
            // 1. Инициализация аудио (важно: 16кГц для Gemini)
            audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            // 2. Открываем туннель к твоему воркеру
            ws = new WebSocket(CONFIG.serverUrl);
            
            ws.onopen = () => {
                status.textContent = 'Слушаю тебя, Михалыч!';
                btn.style.boxShadow = '0 0 20px #10b981';
                
                // Сразу представляемся системе
                const setupPacket = {
                    setup: {
                        model: "models/gemini-2.0-flash-exp",
                        generation_config: { response_modalities: ["audio"] }
                    }
                };
                ws.send(JSON.stringify(setupPacket));
                startStreaming();
            };

            ws.onmessage = async (event) => {
                // Если пришел ответ в аудио - играем его
                if (event.data instanceof Blob) {
                    playResponse(event.data);
                } else {
                    const data = JSON.parse(event.data);
                    if (data.serverContent?.modelDraft?.parts?.[0]?.inlineData) {
                        playResponse(data.serverContent.modelDraft.parts[0].inlineData.data);
                    }
                }
            };

            ws.onerror = (e) => {
                status.textContent = 'Ошибка связи. Проверь воркер.';
                console.error('Ошибка WS:', e);
            };

            ws.onclose = () => {
                status.textContent = 'Связь окончена.';
                btn.style.background = '#1e3a8a';
            };

        } catch (err) {
            status.textContent = 'Микрофон недоступен!';
            console.error('Ошибка микрофона:', err);
        }
    }

    function startStreaming() {
        const source = audioContext.createMediaStreamSource(mediaStream);
        processor = audioContext.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcm16 = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                pcm16[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
            }
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(pcm16.buffer); // Шлем чистый звук
            }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
    }

    async function playResponse(base64OrBlob) {
        // Функция для воспроизведения голоса ассистента
        let arrayBuffer;
        if (typeof base64OrBlob === 'string') {
            const binary = atob(base64OrBlob);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            arrayBuffer = bytes.buffer;
        } else {
            arrayBuffer = await base64OrBlob.arrayBuffer();
        }
        
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        const playSource = audioContext.createBufferSource();
        playSource.buffer = audioBuffer;
        playSource.connect(audioContext.destination);
        playSource.start();
    }

    function createStyles() {
        if (document.getElementById('my-widget-style')) return;
        const style = document.createElement('style');
        style.id = 'my-widget-style';
        style.textContent = `
            .my-widget { position: fixed; bottom: 30px; right: 30px; z-index: 9999; text-align: center; }
            .my-btn { width: 80px; height: 80px; border-radius: 50%; background: #1e3a8a; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.3); transition: 0.3s; }
            .my-btn:hover { transform: scale(1.1); }
            .status-text { color: white; background: rgba(0,0,0,0.7); padding: 5px 12px; border-radius: 20px; font-size: 13px; margin-bottom: 10px; display: inline-block; font-family: sans-serif; }
        `;
        document.head.appendChild(style);
    }

    function createWidgetHTML() {
        if (document.getElementById('my-voice-btn')) return;
        const div = document.createElement('div');
        div.className = 'my-widget';
        div.innerHTML = `
            <div id="my-status-container"><span class="status-text" id="my-status">Михалыч, я тут!</span></div>
            <div class="my-btn" id="my-voice-btn">
                <span style="font-size: 40px;">🎙</span>
            </div>
        `;
        document.body.appendChild(div);
    }

    // Запуск
    if (document.readyState === 'complete') init();
    else window.addEventListener('load', init);

})();
