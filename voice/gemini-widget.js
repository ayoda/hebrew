// Находим функцию startConversation и заменяем её содержимое или весь файл
async function startConversation() {
    const btn = document.getElementById('my-voice-btn');
    const status = document.getElementById('my-status');
    btn.style.background = '#2563eb';
    status.textContent = 'Соединение...';

    try {
        ws = new WebSocket('wss://falling-dust-3e1e.oleayoda.workers.dev/ws');
        
        ws.onopen = () => {
            status.textContent = 'Настройка...';
            // Шлем конфиг ПЕРВЫМ делом
            ws.send(JSON.stringify({
                setup: { model: "models/gemini-2.0-flash-exp" }
            }));
            
            // Ждем полсекунды перед включением микрофона
            setTimeout(async () => {
                audioContext = new AudioContext({ sampleRate: 16000 });
                mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                status.textContent = 'Слушаю тебя, Михалыч!';
                startStreaming();
            }, 500);
        };

        ws.onmessage = async (e) => {
            const data = JSON.parse(await e.data.text());
            if (data.serverContent?.modelDraft?.parts?.[0]?.inlineData) {
                playResponse(data.serverContent.modelDraft.parts[0].inlineData.data);
            }
        };

        ws.onclose = () => { status.textContent = 'Связь окончена.'; btn.style.background = '#1e3a8a'; };
        ws.onerror = () => { status.textContent = 'Ошибка сети.'; };
    } catch (err) {
        status.textContent = 'Доступ запрещен.';
    }
}
